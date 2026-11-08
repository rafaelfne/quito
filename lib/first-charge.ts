import type { SupabaseClient } from "@supabase/supabase-js";
import { describeMonthName } from "@/lib/charge-adjustments";
import { dueDayForGuardian, loadGuardianDueDays, overridesByPhone } from "@/lib/guardian-due-days";
import { dateKeyOf, describeMonth, describeShortDay, monthRange, shiftMonth } from "@/lib/lessons";
import { dueDateIn, loadPaymentSettings, paymentSettingsPath } from "@/lib/payment-settings";
import { calendarMonthOf, type CalendarMonth } from "@/lib/schedule";
import { groupStudentsByGuardian, loadStudents, studentsPath, type Student } from "@/lib/students";

export type FirstChargeClient = Pick<SupabaseClient, "from">;

export type FirstChargeGuardian = { phone: string; guardianName: string; studentNames: string[]; dueDate: string };

export type FirstChargeMissing = "payment" | "students";

export type FirstChargeNotice = {
  firstMonth: CalendarMonth;
  entryMonth: CalendarMonth;
  guardians: FirstChargeGuardian[];
  missing: FirstChargeMissing | null;
};

export type FirstChargeFacts = {
  startedAt: string | null;
  today: string;
  students: Student[];
  defaultDueDay: number | null;
  dueDayOverrides: Map<string, number>;
};

export const firstChargeMessages = {
  title: "Quando começa a cobrança",
  missingPayment: "Guarde o dia de vencimento em Recebimento para ver o dia da primeira cobrança de cada responsável.",
  missingStudents: "Cadastre seus alunos para ver o dia da primeira cobrança de cada responsável.",
};

export const firstChargeMissingPaths: Record<FirstChargeMissing, string> = {
  payment: paymentSettingsPath,
  students: studentsPath,
};

function lowerMonth(month: CalendarMonth): string {
  return describeMonth(month).toLocaleLowerCase("pt-BR");
}

export function firstChargedMonth(entryMonth: CalendarMonth): CalendarMonth {
  return shiftMonth(entryMonth, 1);
}

function entryMonthOf(startedAt: string | null, today: string): CalendarMonth {
  return startedAt === null ? calendarMonthOf(new Date(`${today}T12:00:00`)) : calendarMonthOf(new Date(startedAt));
}

export function isFirstChargeOver(startedAt: string | null, today: string): boolean {
  return today > monthRange(shiftMonth(firstChargedMonth(entryMonthOf(startedAt, today)), 1)).last;
}

export function firstChargeNoticeFrom({ startedAt, today, students, defaultDueDay, dueDayOverrides }: FirstChargeFacts): FirstChargeNotice | null {
  const entryMonth = entryMonthOf(startedAt, today);
  const firstMonth = firstChargedMonth(entryMonth);
  const chargeMonth = shiftMonth(firstMonth, 1);
  if (isFirstChargeOver(startedAt, today)) return null;
  const missing: FirstChargeMissing | null = students.length === 0 ? "students" : defaultDueDay === null ? "payment" : null;
  const guardians =
    missing === null && defaultDueDay !== null
      ? groupStudentsByGuardian(students).map((group) => ({
          phone: group[0].guardian_phone,
          guardianName: group[0].guardian_name,
          studentNames: group.map((student) => student.name),
          dueDate: dueDateIn(chargeMonth, dueDayForGuardian(defaultDueDay, dueDayOverrides.get(group[0].guardian_phone))),
        }))
      : [];
  return { firstMonth, entryMonth, guardians, missing };
}

export function describeFirstMonth({ firstMonth, entryMonth }: FirstChargeNotice): string {
  return `O primeiro mês cobrado pelo Quitô é ${lowerMonth(firstMonth)}, o mês seguinte ao da sua entrada, em ${describeMonthName(entryMonth)}.`;
}

export function describeFirstChargeTiming({ firstMonth }: FirstChargeNotice): string {
  return `A cobrança de ${describeMonthName(firstMonth)} sai em ${lowerMonth(shiftMonth(firstMonth, 1))}, no dia de vencimento de cada responsável:`;
}

export function describeFirstChargeGuardian({ guardianName, studentNames, dueDate }: FirstChargeGuardian): string {
  return `${guardianName} (${studentNames.join(", ")}): primeira cobrança em ${describeShortDay(dueDate)}.`;
}

export function firstChargeMissingMessage(missing: FirstChargeMissing): string {
  return missing === "payment" ? firstChargeMessages.missingPayment : firstChargeMessages.missingStudents;
}

export async function loadFirstChargeNotice(client: FirstChargeClient, startedAt: string | null, now: Date = new Date()): Promise<FirstChargeNotice | null> {
  return loadFirstChargeNoticeOn(client, startedAt, dateKeyOf(now));
}

export async function loadFirstChargeNoticeOn(client: FirstChargeClient, startedAt: string | null, today: string): Promise<FirstChargeNotice | null> {
  const [students, payment, dueDays] = await Promise.all([loadStudents(client), loadPaymentSettings(client), loadGuardianDueDays(client)]);
  if (!students.ok || !payment.ok || !dueDays.ok) return null;
  return firstChargeNoticeFrom({
    startedAt,
    today,
    students: students.students,
    defaultDueDay: payment.settings?.due_day ?? null,
    dueDayOverrides: overridesByPhone(dueDays.rows),
  });
}
