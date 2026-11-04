import { describeShortDay, isCreditStatus, lessonKey, lessonStatusLabels, lessonMarksTable, monthRange, type CreditStatus, type LessonMark, type LessonsClient, type LessonsState, type MakeupLesson, type MonthLesson } from "@/lib/lessons";
import type { CalendarMonth } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import type { Student } from "@/lib/students";

export type MakeupTarget = { studentId: string; absenceDate: string };

export type LessonCredit = MakeupTarget & { studentName: string; status: CreditStatus; expiresOn: string | null };

export const makeupMessages = {
  title: "Créditos de reposição",
  explanation: "A falta avisada e a falta do professor viram crédito. A aula de reposição é cobrada como aula dada.",
  dateMissing: "Escolha o dia da reposição.",
  dateBeforeAbsence: "A reposição precisa ser no dia da falta ou depois.",
  saveFailed: "Não deu para guardar esta reposição. Confira a internet e toque de novo.",
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const millisecondsPerDay = 86_400_000;

export function creditKey({ studentId, absenceDate }: MakeupTarget): string {
  return lessonKey({ studentId, date: absenceDate });
}

export function creditExpiresOn(absenceDate: string, deadlineDays: number | null): string | null {
  if (deadlineDays === null) return null;
  const absence = new Date(`${absenceDate}T00:00:00Z`).getTime();
  return new Date(absence + deadlineDays * millisecondsPerDay).toISOString().slice(0, 10);
}

export function openCredits(students: Student[], marks: LessonMark[], deadlineDays: number | null, asOf: string): LessonCredit[] {
  const nameById = new Map(students.map((student) => [student.id, student.name]));
  const credits: LessonCredit[] = [];
  for (const mark of marks) {
    const studentName = nameById.get(mark.student_id);
    if (studentName === undefined || !isCreditStatus(mark.status) || mark.makeup_date !== null) continue;
    const expiresOn = creditExpiresOn(mark.lesson_date, deadlineDays);
    if (expiresOn !== null && asOf > expiresOn) continue;
    credits.push({ studentId: mark.student_id, studentName, absenceDate: mark.lesson_date, status: mark.status, expiresOn });
  }
  return credits.sort((a, b) => a.absenceDate.localeCompare(b.absenceDate) || a.studentName.localeCompare(b.studentName, "pt-BR", { sensitivity: "base" }));
}

export function monthMakeups(students: Student[], marks: LessonMark[], month: CalendarMonth): MakeupLesson[] {
  const { first, last } = monthRange(month);
  const nameById = new Map(students.map((student) => [student.id, student.name]));
  const makeups: MakeupLesson[] = [];
  for (const { student_id: studentId, lesson_date: absenceDate, makeup_date: date } of marks) {
    const studentName = nameById.get(studentId);
    if (studentName !== undefined && date !== null && date >= first && date <= last) makeups.push({ studentId, studentName, date, absenceDate });
  }
  return makeups;
}

export function describeCredit(credit: LessonCredit): string {
  const absence = `${lessonStatusLabels[credit.status]} de ${describeShortDay(credit.absenceDate)}`;
  return credit.expiresOn === null ? `${absence}, sem prazo` : `${absence}, vale até ${describeShortDay(credit.expiresOn)}`;
}

export function describeLessonCredit(lesson: MonthLesson, deadlineDays: number | null, today: string): string | null {
  if (lesson.status === null || !isCreditStatus(lesson.status)) return null;
  if (lesson.makeupDate !== null) return `Reposta em ${describeShortDay(lesson.makeupDate)}. Para trocar esta marcação, desfaça a reposição nesse dia.`;
  const expiresOn = creditExpiresOn(lesson.date, deadlineDays);
  if (expiresOn === null) return "Virou crédito de reposição, sem prazo.";
  if (today > expiresOn) return `O crédito de reposição venceu em ${describeShortDay(expiresOn)}.`;
  return `Virou crédito de reposição, vale até ${describeShortDay(expiresOn)}.`;
}

export function makeupDateDraft(state: LessonsState, credit: MakeupTarget, today: string): string {
  return state.makeupDrafts[creditKey(credit)] ?? (today > credit.absenceDate ? today : credit.absenceDate);
}

export function makeupDateError(credit: LessonCredit, date: string): string | null {
  if (!datePattern.test(date)) return makeupMessages.dateMissing;
  if (date < credit.absenceDate) return makeupMessages.dateBeforeAbsence;
  if (credit.expiresOn !== null && date > credit.expiresOn) return `O crédito vale até ${describeShortDay(credit.expiresOn)}. Escolha um dia até lá.`;
  return null;
}

export async function persistMakeup(client: LessonsClient, target: MakeupTarget, date: string | null): Promise<boolean> {
  try {
    const request = client.from(lessonMarksTable).update({ makeup_date: date }).eq("student_id", target.studentId).eq("lesson_date", target.absenceDate);
    const { error } = await withTimeout(Promise.resolve(request), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter(([other]) => other !== key));
}

function withMakeupDate(marks: LessonMark[], { studentId, absenceDate }: MakeupTarget, date: string | null): LessonMark[] {
  return marks.map((mark) => (mark.student_id === studentId && mark.lesson_date === absenceDate ? { ...mark, makeup_date: date } : mark));
}

export function changeMakeupDraft(state: LessonsState, target: MakeupTarget, date: string): LessonsState {
  const key = creditKey(target);
  return { ...state, makeupDrafts: { ...state.makeupDrafts, [key]: date }, makeupErrors: withoutKey(state.makeupErrors, key) };
}

export function rejectMakeup(state: LessonsState, target: MakeupTarget, message: string): LessonsState {
  return { ...state, makeupErrors: { ...state.makeupErrors, [creditKey(target)]: message } };
}

export function beginMakeup(state: LessonsState, target: MakeupTarget, date: string | null): LessonsState {
  const key = creditKey(target);
  return { ...state, marks: withMakeupDate(state.marks, target, date), pending: [...state.pending, key], makeupErrors: withoutKey(state.makeupErrors, key) };
}

export function finishMakeup(state: LessonsState, target: MakeupTarget, previousDate: string | null, saved: boolean): LessonsState {
  const key = creditKey(target);
  if (!state.pending.includes(key)) return state;
  const pending = state.pending.filter((other) => other !== key);
  if (saved) return { ...state, pending };
  return { ...state, pending, marks: withMakeupDate(state.marks, target, previousDate), makeupErrors: { ...state.makeupErrors, [key]: makeupMessages.saveFailed } };
}
