import type { SupabaseClient } from "@supabase/supabase-js";
import { plannedLessons, type CalendarMonth } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import { loadStudents, type Student } from "@/lib/students";
import { loadTeacherRules } from "@/lib/teacher-rules";

export type LessonsClient = Pick<SupabaseClient, "from">;

export const lessonStatuses = ["given", "notified_absence", "unnotified_absence", "teacher_absence"] as const;

export type LessonStatus = (typeof lessonStatuses)[number];

export const creditStatuses = ["notified_absence", "teacher_absence"] as const;

export type CreditStatus = (typeof creditStatuses)[number];

export type LessonMark = { student_id: string; lesson_date: string; status: LessonStatus; makeup_date: string | null };

export type MonthLesson = { studentId: string; studentName: string; date: string; time: string | null; status: LessonStatus | null; makeupDate: string | null };

export type MakeupLesson = { studentId: string; studentName: string; date: string; absenceDate: string };

export type LessonDay = { date: string; lessons: MonthLesson[]; makeups: MakeupLesson[] };

export type LessonsSummary = { charged: number; free: number; unmarked: number };

export type LessonMarksLoad = { ok: true; marks: LessonMark[] } | { ok: false };

export type LessonsMonthLoad = { ok: true; month: CalendarMonth; students: Student[]; marks: LessonMark[]; noticeHours: number; makeupDeadlineDays: number | null } | { ok: false; month: CalendarMonth };

export type LessonsState = {
  month: CalendarMonth;
  status: "loading" | "ready" | "failed";
  students: Student[];
  marks: LessonMark[];
  noticeHours: number | null;
  makeupDeadlineDays: number | null;
  pending: string[];
  failedLesson: string | null;
  makeupDrafts: Record<string, string>;
  makeupErrors: Record<string, string>;
};

export const lessonsPath = "/lessons";

export const lessonStatusLabels: Record<LessonStatus, string> = {
  given: "Dada",
  notified_absence: "Falta avisada",
  unnotified_absence: "Falta sem aviso",
  teacher_absence: "Falta do professor",
};

export const lessonsMessages = {
  loadFailed: "Não deu para abrir as aulas agora. Confira a internet e tente de novo.",
  markFailed: "Não deu para guardar esta marcação. Confira a internet e toque de novo.",
  noLessons: "Nenhuma aula prevista neste mês. Defina o horário fixo dos alunos na tela de Alunos.",
  chargeRule: "Entre as faltas, só a falta sem aviso é cobrada.",
  undoHint: "Marcou errado? Toque em outra opção, ou na mesma para desfazer.",
};

export const lessonMarksTable = "lesson_marks";

const columns = "student_id, lesson_date, status, makeup_date";

const conflictColumns = "student_id,lesson_date";

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

const shortDayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function isCharged(status: LessonStatus): boolean {
  return status === "given" || status === "unnotified_absence";
}

export function isCreditStatus(status: LessonStatus): status is CreditStatus {
  return (creditStatuses as readonly LessonStatus[]).includes(status);
}

export function chargeLabel(status: LessonStatus | null): string {
  if (status === null) return "Ainda sem marcar";
  return isCharged(status) ? "Cobrada" : "Sem cobrança";
}

export function lessonKey(lesson: Pick<MonthLesson, "studentId" | "date">): string {
  return `${lesson.studentId}|${lesson.date}`;
}

export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

export function monthRange({ year, month }: CalendarMonth): { first: string; last: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${twoDigits(month)}`;
  return { first: `${prefix}-01`, last: `${prefix}-${twoDigits(lastDay)}` };
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function describeMonth({ year, month }: CalendarMonth): string {
  return capitalized(monthFormat.format(new Date(Date.UTC(year, month - 1, 1))));
}

export function describeDay(date: string): string {
  return capitalized(dayFormat.format(new Date(`${date}T00:00:00Z`)));
}

export function describeShortDay(date: string): string {
  return shortDayFormat.format(new Date(`${date}T00:00:00Z`));
}

export function describeNoticeRule(noticeHours: number): string {
  return `A falta conta como avisada quando vem com ${counted(noticeHours, "hora", "horas")} ou mais de antecedência.`;
}

function compareLessons(a: MonthLesson, b: MonthLesson): number {
  return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.studentName.localeCompare(b.studentName, "pt-BR", { sensitivity: "base" });
}

export function monthLessons(students: Student[], marks: LessonMark[], month: CalendarMonth): MonthLesson[] {
  const { first, last } = monthRange(month);
  const monthMarks = marks.filter((mark) => mark.lesson_date >= first && mark.lesson_date <= last);
  const markByLesson = new Map(monthMarks.map((mark) => [lessonKey({ studentId: mark.student_id, date: mark.lesson_date }), mark]));
  const lessons = students.flatMap((student) => {
    const planned = plannedLessons(student, month);
    const plannedDates = new Set(planned.map((lesson) => lesson.date));
    const markedOutsideSchedule = monthMarks.filter((mark) => mark.student_id === student.id && !plannedDates.has(mark.lesson_date));
    return [
      ...planned.map(({ date, time }) => ({ date, time })),
      ...markedOutsideSchedule.map((mark) => ({ date: mark.lesson_date, time: null })),
    ].map(({ date, time }) => {
      const mark = markByLesson.get(lessonKey({ studentId: student.id, date }));
      return { studentId: student.id, studentName: student.name, date, time, status: mark?.status ?? null, makeupDate: mark?.makeup_date ?? null };
    });
  });
  return lessons.sort(compareLessons);
}

export function groupByDay(lessons: MonthLesson[], makeups: MakeupLesson[] = []): LessonDay[] {
  const dates = [...new Set([...lessons, ...makeups].map(({ date }) => date))].sort();
  return dates.map((date) => ({
    date,
    lessons: lessons.filter((lesson) => lesson.date === date),
    makeups: makeups.filter((makeup) => makeup.date === date),
  }));
}

export function todayAnchorDate(days: LessonDay[], month: CalendarMonth, today: string): string | null {
  const { first, last } = monthRange(month);
  if (today < first || today > last) return null;
  return days.find((day) => day.date >= today)?.date ?? null;
}

export function summarizeLessons(lessons: MonthLesson[], makeups: MakeupLesson[] = []): LessonsSummary {
  const summary: LessonsSummary = { charged: makeups.length, free: 0, unmarked: 0 };
  for (const { status } of lessons) {
    if (status === null) summary.unmarked += 1;
    else if (isCharged(status)) summary.charged += 1;
    else summary.free += 1;
  }
  return summary;
}

export function describeSummary({ charged, free, unmarked }: LessonsSummary): string {
  return `${counted(charged, "aula cobrada", "aulas cobradas")}, ${free} sem cobrança e ${unmarked} para marcar.`;
}

export function describeUnscheduled(students: Student[]): string | null {
  const count = students.filter((student) => student.lesson_weekday === null || student.lesson_time === null).length;
  if (count === 0) return null;
  return count === 1 ? "1 aluno está sem horário fixo e não aparece aqui." : `${count} alunos estão sem horário fixo e não aparecem aqui.`;
}

export async function loadLessonMarks(client: LessonsClient, month: CalendarMonth): Promise<LessonMarksLoad> {
  const { first, last } = monthRange(month);
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(lessonMarksTable).select(columns).gte("lesson_date", first).lte("lesson_date", last)), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, marks: (data ?? []) as LessonMark[] };
  } catch {
    return { ok: false };
  }
}

export async function loadCreditMarks(client: LessonsClient): Promise<LessonMarksLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(lessonMarksTable).select(columns).in("status", [...creditStatuses])), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, marks: (data ?? []) as LessonMark[] };
  } catch {
    return { ok: false };
  }
}

function withoutRepeats(marks: LessonMark[]): LessonMark[] {
  return [...new Map(marks.map((mark) => [lessonKey({ studentId: mark.student_id, date: mark.lesson_date }), mark])).values()];
}

export async function loadLessonsMonth(client: LessonsClient, month: CalendarMonth): Promise<LessonsMonthLoad> {
  const [students, marks, credits, rules] = await Promise.all([loadStudents(client), loadLessonMarks(client, month), loadCreditMarks(client), loadTeacherRules(client)]);
  if (!students.ok || !marks.ok || !credits.ok || !rules.ok) return { ok: false, month };
  return { ok: true, month, students: students.students, marks: withoutRepeats([...marks.marks, ...credits.marks]), noticeHours: rules.rules.notice_hours, makeupDeadlineDays: rules.rules.makeup_deadline_days };
}

export async function persistLessonMark(client: LessonsClient, lesson: MonthLesson, status: LessonStatus | null): Promise<boolean> {
  try {
    const request = status === null
      ? client.from(lessonMarksTable).delete().eq("student_id", lesson.studentId).eq("lesson_date", lesson.date)
      : client.from(lessonMarksTable).upsert({ student_id: lesson.studentId, lesson_date: lesson.date, status }, { onConflict: conflictColumns });
    const { error } = await withTimeout(Promise.resolve(request), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export function initialLessons(month: CalendarMonth): LessonsState {
  return { month, status: "loading", students: [], marks: [], noticeHours: null, makeupDeadlineDays: null, pending: [], failedLesson: null, makeupDrafts: {}, makeupErrors: {} };
}

export function startLessonsMonth(state: LessonsState, delta: number): LessonsState {
  return initialLessons(shiftMonth(state.month, delta));
}

export function startReloadingLessons(state: LessonsState): LessonsState {
  return { ...state, status: "loading" };
}

export function applyLessonsLoad(state: LessonsState, result: LessonsMonthLoad): LessonsState {
  if (result.month.year !== state.month.year || result.month.month !== state.month.month) return state;
  if (!result.ok) return { ...state, status: "failed" };
  return { ...state, status: "ready", students: result.students, marks: result.marks, noticeHours: result.noticeHours, makeupDeadlineDays: result.makeupDeadlineDays };
}

export function nextStatus(lesson: MonthLesson, tapped: LessonStatus): LessonStatus | null {
  return lesson.status === tapped ? null : tapped;
}

function withStatus(marks: LessonMark[], lesson: MonthLesson, status: LessonStatus | null): LessonMark[] {
  const others = marks.filter((mark) => mark.student_id !== lesson.studentId || mark.lesson_date !== lesson.date);
  return status === null ? others : [...others, { student_id: lesson.studentId, lesson_date: lesson.date, status, makeup_date: null }];
}

export function beginMark(state: LessonsState, lesson: MonthLesson, status: LessonStatus | null): LessonsState {
  return { ...state, marks: withStatus(state.marks, lesson, status), pending: [...state.pending, lessonKey(lesson)], failedLesson: null };
}

export function finishMark(state: LessonsState, lesson: MonthLesson, saved: boolean): LessonsState {
  const key = lessonKey(lesson);
  if (!state.pending.includes(key)) return state;
  const pending = state.pending.filter((other) => other !== key);
  if (saved) return { ...state, pending };
  return { ...state, pending, marks: withStatus(state.marks, lesson, lesson.status), failedLesson: key };
}
