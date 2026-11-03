export type ScheduleRow = { lesson_weekday: number; lesson_time: string };

export type SavedSchedule = { lesson_weekday: number | null; lesson_time: string | null };

export type ScheduleDraft = { lessonWeekday: string; lessonTime: string };

export type ScheduleErrors = Partial<Record<keyof ScheduleDraft, string>>;

export type ScheduleValidation = { ok: true; row: ScheduleRow } | { ok: false; errors: ScheduleErrors };

export type CalendarMonth = { year: number; month: number };

export type PlannedLesson = { date: string; time: string };

const sunday = 0;
const monday = 1;
const saturday = 6;
const daysInWeek = 7;

const recurrenceByWeekday = ["Todo domingo", "Toda segunda", "Toda terça", "Toda quarta", "Toda quinta", "Toda sexta", "Todo sábado"];

export const weekdayOptions = [
  { value: monday, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: saturday, label: "Sábado" },
  { value: sunday, label: "Domingo" },
];

export const emptyScheduleDraft: ScheduleDraft = { lessonWeekday: "", lessonTime: "" };

export const scheduleMessages = {
  weekdayMissing: "Escolha o dia da semana da aula.",
  timeInvalid: "Escolha o horário da aula, como 15:00.",
};

const weekdayPattern = /^[0-6]$/;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const monthNameFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

const dayListFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

function shortTime(time: string): string {
  return time.slice(0, 5);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function validateSchedule(draft: ScheduleDraft): ScheduleValidation {
  const time = draft.lessonTime.trim();
  const errors: ScheduleErrors = {};
  if (!weekdayPattern.test(draft.lessonWeekday)) errors.lessonWeekday = scheduleMessages.weekdayMissing;
  if (!timePattern.test(time)) errors.lessonTime = scheduleMessages.timeInvalid;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, row: { lesson_weekday: Number(draft.lessonWeekday), lesson_time: time } };
}

export function scheduleDraftFrom(schedule: SavedSchedule): ScheduleDraft {
  return {
    lessonWeekday: schedule.lesson_weekday === null ? "" : String(schedule.lesson_weekday),
    lessonTime: schedule.lesson_time === null ? "" : shortTime(schedule.lesson_time),
  };
}

export function calendarMonthOf(date: Date): CalendarMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function plannedLessons(schedule: SavedSchedule, { year, month }: CalendarMonth): PlannedLesson[] {
  const { lesson_weekday: weekday, lesson_time: time } = schedule;
  if (weekday === null || time === null) return [];
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lessons: PlannedLesson[] = [];
  for (let day = 1 + ((weekday - firstWeekday + daysInWeek) % daysInWeek); day <= lastDay; day += daysInWeek) {
    lessons.push({ date: `${year}-${twoDigits(month)}-${twoDigits(day)}`, time: shortTime(time) });
  }
  return lessons;
}

export function describeSchedule(schedule: SavedSchedule): string {
  const { lesson_weekday: weekday, lesson_time: time } = schedule;
  if (weekday === null || time === null) return "Horário ainda não definido";
  return `${recurrenceByWeekday[weekday]}, ${shortTime(time)}`;
}

export function describePlannedLessons(schedule: SavedSchedule, calendarMonth: CalendarMonth): string | null {
  const lessons = plannedLessons(schedule, calendarMonth);
  if (lessons.length === 0) return null;
  const monthName = monthNameFormat.format(new Date(Date.UTC(calendarMonth.year, calendarMonth.month - 1, 1)));
  const days = lessons.map((lesson) => String(Number(lesson.date.slice(-2))));
  return `Em ${monthName}: ${lessons.length} aulas previstas, nos dias ${dayListFormat.format(days)}`;
}
