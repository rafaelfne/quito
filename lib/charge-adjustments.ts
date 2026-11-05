import { discountAmount } from "@/lib/billing";
import { counted, packageUsage, type ChargeBasis, type FrozenMark } from "@/lib/closing";
import { isCharged, monthRange, type LessonMark, type LessonStatus } from "@/lib/lessons";
import type { CalendarMonth } from "@/lib/schedule";

export type SettledAdjustment = { month: string; cents: number };

export type PendingAdjustment = SettledAdjustment & { studentId: string; label: string };

export type ChargedStudent = { studentId: string; basis?: ChargeBasis | null; settled?: SettledAdjustment[] };

export type ChargedMonth = { charge_month: string; account: ChargedStudent[] };

const monthNameFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

const remainderNote = " (o restante fica para o próximo mês)";

const unspecificCorrection = "correção nas aulas";

const absenceTargets: Record<LessonStatus, [string, string]> = {
  given: ["dada", "dadas"],
  notified_absence: ["avisada", "avisadas"],
  unnotified_absence: ["sem aviso", "sem aviso"],
  teacher_absence: ["do professor", "do professor"],
};

const lessonTargets: Record<LessonStatus, [string, string]> = {
  given: ["dada", "dadas"],
  notified_absence: ["falta avisada", "falta avisada"],
  unnotified_absence: ["falta sem aviso", "falta sem aviso"],
  teacher_absence: ["falta do professor", "falta do professor"],
};

function monthOfKey(key: string): CalendarMonth {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function describeMonthName({ year, month }: CalendarMonth): string {
  return monthNameFormat.format(new Date(Date.UTC(year, month - 1, 1)));
}

function inMonth(date: string | null, month: CalendarMonth): boolean {
  const { first, last } = monthRange(month);
  return date !== null && date >= first && date <= last;
}

function describeRemark(from: LessonStatus, to: LessonStatus, count: number): string {
  const verb = count === 1 ? "remarcada" : "remarcadas";
  if (from === "given") return `${counted(count, "aula", "aulas")} ${verb} como ${lessonTargets[to][count === 1 ? 0 : 1]}`;
  return `${counted(count, "falta", "faltas")} ${verb} como ${absenceTargets[to][count === 1 ? 0 : 1]}`;
}

function describeLateMark(to: LessonStatus, count: number): string {
  return `${counted(count, "aula marcada", "aulas marcadas")} como ${lessonTargets[to][count === 1 ? 0 : 1]}`;
}

function describeLessonChanges(before: FrozenMark[], after: FrozenMark[], month: CalendarMonth): string[] {
  const statusBefore = new Map(before.map((mark) => [mark.lesson_date, mark.status]));
  const groups = new Map<string, { from: LessonStatus | null; to: LessonStatus; count: number }>();
  for (const { lesson_date: date, status: to } of after) {
    if (!inMonth(date, month)) continue;
    const from = statusBefore.get(date) ?? null;
    if ((from !== null && isCharged(from)) === isCharged(to)) continue;
    const key = `${from}|${to}`;
    const group = groups.get(key) ?? { from, to, count: 0 };
    groups.set(key, { ...group, count: group.count + 1 });
  }
  return [...groups.values()].map(({ from, to, count }) => (from === null ? describeLateMark(to, count) : describeRemark(from, to, count)));
}

function makeupLessons(marks: FrozenMark[], month: CalendarMonth): Set<string> {
  return new Set(marks.filter((mark) => inMonth(mark.makeup_date, month)).map((mark) => mark.lesson_date));
}

function describeMakeupChanges(before: FrozenMark[], after: FrozenMark[], month: CalendarMonth): string[] {
  const makeupsBefore = makeupLessons(before, month);
  const makeupsAfter = makeupLessons(after, month);
  const included = [...makeupsAfter].filter((lesson) => !makeupsBefore.has(lesson)).length;
  const removed = [...makeupsBefore].filter((lesson) => !makeupsAfter.has(lesson)).length;
  return [included > 0 ? counted(included, "reposição incluída", "reposições incluídas") : "", removed > 0 ? counted(removed, "reposição retirada", "reposições retiradas") : ""].filter(Boolean);
}

export function describeAdjustment(before: FrozenMark[], after: FrozenMark[], month: CalendarMonth): string {
  const changes = [...describeLessonChanges(before, after, month), ...describeMakeupChanges(before, after, month)];
  return `Acerto de ${describeMonthName(month)}: ${changes.length > 0 ? changes.join(", ") : unspecificCorrection}`;
}

function recountGrossCents(basis: ChargeBasis, studentId: string, marks: FrozenMark[], month: CalendarMonth): number | null {
  if (basis.billingKind === "per_class") {
    const lessons = marks.filter((mark) => inMonth(mark.lesson_date, month) && isCharged(mark.status)).length;
    return (lessons + makeupLessons(marks, month).size) * basis.amountCents;
  }
  if (basis.billingKind === "package" && basis.packageLessons !== null) {
    const ownMarks = marks.map((mark) => ({ ...mark, student_id: studentId }));
    return packageUsage(ownMarks, studentId, basis.packageLessons, month).bought * basis.amountCents;
  }
  return null;
}

function withUnmarkedRestored(months: ChargedMonth[], marks: LessonMark[]): LessonMark[] {
  const current = new Set(marks.map((mark) => `${mark.student_id}|${mark.lesson_date}`));
  const restored = new Map<string, LessonMark>();
  for (const { account } of months) {
    for (const { studentId, basis } of account) {
      for (const mark of basis?.marks ?? []) {
        const key = `${studentId}|${mark.lesson_date}`;
        if (!current.has(key)) restored.set(key, { ...mark, student_id: studentId });
      }
    }
  }
  return [...marks, ...restored.values()];
}

function settledCents(months: ChargedMonth[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { account } of months) {
    for (const { studentId, settled } of account) {
      for (const { month, cents } of settled ?? []) totals.set(`${studentId}|${month}`, (totals.get(`${studentId}|${month}`) ?? 0) + cents);
    }
  }
  return totals;
}

export function pendingAdjustments(earlier: ChargedMonth[], marks: LessonMark[]): Map<string, PendingAdjustment[]> {
  const months = [...earlier].sort((a, b) => a.charge_month.localeCompare(b.charge_month));
  const settled = settledCents(months);
  const allMarks = withUnmarkedRestored(months, marks);
  const pending = new Map<string, PendingAdjustment[]>();
  for (const { charge_month: monthKey, account } of months) {
    const month = monthOfKey(monthKey);
    const { last } = monthRange(month);
    for (const { studentId, basis } of account) {
      if (!basis) continue;
      const ownMarks = allMarks.filter((mark) => mark.student_id === studentId && mark.lesson_date <= last);
      const gross = recountGrossCents(basis, studentId, ownMarks, month);
      if (gross === null) continue;
      const cents = discountAmount(gross, basis.discountPercent) - basis.monthCents - (settled.get(`${studentId}|${monthKey}`) ?? 0);
      if (cents === 0) continue;
      const adjustment = { studentId, month: monthKey, cents, label: describeAdjustment(basis.marks, ownMarks, month) };
      pending.set(studentId, [...(pending.get(studentId) ?? []), adjustment]);
    }
  }
  return pending;
}

export function settleAdjustments(monthCents: number, pending: PendingAdjustment[]): PendingAdjustment[] {
  let room = pending.reduce((total, { cents }) => total + Math.max(cents, 0), monthCents);
  const applied: PendingAdjustment[] = [];
  for (const adjustment of pending) {
    if (adjustment.cents > 0) {
      applied.push(adjustment);
      continue;
    }
    const cents = Math.max(adjustment.cents, -room);
    room += cents;
    if (cents === 0) continue;
    applied.push(cents === adjustment.cents ? adjustment : { ...adjustment, cents, label: `${adjustment.label}${remainderNote}` });
  }
  return applied;
}
