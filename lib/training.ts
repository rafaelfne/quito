import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarMonthOf, type CalendarMonth } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type TrainingClient = Pick<SupabaseClient, "from">;

export type TrainingMonthLoad = { ok: true; trainingMonth: CalendarMonth | null } | { ok: false };

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

function monthName({ year, month }: CalendarMonth): string {
  return monthFormat.format(new Date(Date.UTC(year, month - 1, 1)));
}

function monthIndex({ year, month }: CalendarMonth): number {
  return year * 12 + month;
}

export function firstChargedMonth({ year, month }: CalendarMonth): CalendarMonth {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function isTrainingMonth(month: CalendarMonth, trainingMonth: CalendarMonth | null): boolean {
  return trainingMonth !== null && monthIndex(month) <= monthIndex(trainingMonth);
}

export function describeTrainingNotice(trainingMonth: CalendarMonth): string {
  return `Mês de treino: marque as aulas como em qualquer mês. Até o fim de ${monthName(trainingMonth)}, nenhuma aula marcada gera cobrança. A primeira cobrança pelo Quitô é de ${monthName(firstChargedMonth(trainingMonth))}.`;
}

export function describeTrainingCharges(trainingMonth: CalendarMonth): string {
  return `As aulas até ${monthName(trainingMonth)} são de treino e não geram cobrança. A primeira cobrança pelo Quitô é de ${monthName(firstChargedMonth(trainingMonth))}.`;
}

export function describeTrainingSummary({ charged, free, unmarked }: { charged: number; free: number; unmarked: number }): string {
  return `Treino: ${charged} ${charged === 1 ? "aula seria cobrada" : "aulas seriam cobradas"}, ${free} sem cobrança e ${unmarked} para marcar. Nenhuma gera cobrança.`;
}

export function describeTrainingClosing(trainingMonth: CalendarMonth): string {
  return `Mês de treino: até o fim de ${monthName(trainingMonth)}, a conta abaixo é só uma prévia com as aulas marcadas. Ela não vira cobrança nem lembrete e não é enviada aos responsáveis. A primeira cobrança pelo Quitô é de ${monthName(firstChargedMonth(trainingMonth))}.`;
}

export const trainingMessages = {
  wouldCharge: "Treino: num mês cobrado, seria cobrada. Agora não gera cobrança.",
  free: "Treino: sem cobrança.",
  makeup: "Treino: não gera cobrança.",
  badge: "Treino",
  monthTotal: "Total do treino",
  guardianTotal: "Prévia do treino",
};

export async function loadTrainingMonth(client: TrainingClient): Promise<TrainingMonthLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from("getting_started").select("started_at").maybeSingle()), requestTimeoutMs);
    if (error) return { ok: false };
    const startedAt = (data as { started_at: string | null } | null)?.started_at ?? null;
    return { ok: true, trainingMonth: startedAt === null ? null : calendarMonthOf(new Date(startedAt)) };
  } catch {
    return { ok: false };
  }
}
