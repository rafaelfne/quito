import type { SupabaseClient } from "@supabase/supabase-js";
import { monthOfKey } from "@/lib/charge-adjustments";
import { chargeDueDate, chargeDueDatesFor, loadChargeMessageContext, type ChargeMessageContext } from "@/lib/charge-message";
import { awaitsReminders, isChargeSent, loadMonthPlan, remindersSentOf, waitsForMarks, type Charge, type WaitingGuardian } from "@/lib/charges";
import { monthRange, shiftMonth, type LessonsClient } from "@/lib/lessons";
import { fallbackTimeZone } from "@/lib/notification-time";
import { addDays, reminderProgress } from "@/lib/reminders";

export type DayWork = { charges: number; reminders: number; unmarked: number };

export type LocalClock = { date: string; hour: number };

export function ownerScoped(client: Pick<SupabaseClient, "from">, ownerId: string): LessonsClient {
  const scoped = { from: (relation: string) => ({ select: (columns?: string) => client.from(relation).select(columns).eq("owner_id", ownerId) }) };
  return scoped as unknown as LessonsClient;
}

function clockParts(now: Date, timeZone: string): Record<string, string> {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  return Object.fromEntries(format.formatToParts(now).map(({ type, value }) => [type, value]));
}

export function localClock(now: Date, timeZone: string): LocalClock {
  let parts: Record<string, string>;
  try {
    parts = clockParts(now, timeZone);
  } catch {
    parts = clockParts(now, fallbackTimeZone);
  }
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function counted(amount: number, singular: string, plural: string): string {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function describeToSend(charges: number, reminders: number): string | null {
  const parts = [charges > 0 ? counted(charges, "cobrança", "cobranças") : null, reminders > 0 ? counted(reminders, "lembrete", "lembretes") : null].filter((part) => part !== null);
  if (parts.length === 0) return null;
  return `${parts.join(" e ")} para enviar hoje`;
}

function describeToMark(unmarked: number): string | null {
  if (unmarked === 0) return null;
  return `${counted(unmarked, "cobrança", "cobranças")} ${unmarked === 1 ? "precisa" : "precisam"} de aula marcada`;
}

export function describeDayWork({ charges, reminders, unmarked }: DayWork): string | null {
  const parts = [describeToSend(charges, reminders), describeToMark(unmarked)].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(". ");
}

function plannedCharge(charge: Omit<Charge, "id">, index: number): Charge {
  return { ...charge, id: `planned-${index}` };
}

function waitingDueToday(waiting: WaitingGuardian[], chargeMonth: string, { payment, dueDayOverrides }: ChargeMessageContext, today: string): number {
  if (payment === null) return 0;
  return waiting.filter((guardian) => waitsForMarks([guardian]) && chargeDueDate({ charge_month: chargeMonth, guardian_phone: guardian.phone }, payment.due_day, dueDayOverrides) === today).length;
}

export function chargeDaysToSend(today: string): string[] {
  return [today, addDays(today, -1)];
}

export async function loadDayWork(client: LessonsClient, today: string, timeZone: string): Promise<DayWork | null> {
  const month = shiftMonth(monthOfKey(today), -1);
  const [planned, context] = await Promise.all([loadMonthPlan(client, month, today), loadChargeMessageContext(client)]);
  if (!planned.ok || context === null) return null;
  const candidates = [...planned.existing, ...planned.plan.newCharges.map(plannedCharge)];
  const dueDates = chargeDueDatesFor(candidates, context);
  const daysToSend = chargeDaysToSend(today);
  const charges = candidates.filter((charge) => !isChargeSent(charge) && daysToSend.includes(dueDates[charge.id])).length;
  const dateOf = (timestamp: string) => localClock(new Date(timestamp), timeZone).date;
  const reminders = planned.existing.filter((charge) => awaitsReminders(charge) && charge.sent_at && reminderProgress(charge.sent_at, remindersSentOf(charge), context.reminderDays, dateOf).next?.due === today).length;
  const unmarked = waitingDueToday(planned.plan.waiting, monthRange(month).first, context, today);
  return { charges, reminders, unmarked };
}
