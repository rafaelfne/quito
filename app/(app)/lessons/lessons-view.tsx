import Link from "next/link";
import { accountPath } from "@/lib/account";
import {
  chargeLabel,
  describeDay,
  describeMonth,
  describeNoticeRule,
  describeSummary,
  describeUnscheduled,
  groupByDay,
  lessonKey,
  lessonStatusLabels,
  lessonStatuses,
  lessonsMessages,
  monthLessons,
  summarizeLessons,
  todayAnchorDate,
  type LessonStatus,
  type LessonsState,
  type MonthLesson,
} from "@/lib/lessons";
import { studentsPath } from "@/lib/students";
import { teacherRulesPath } from "@/lib/teacher-rules";

const secondaryButtonClass = "min-h-11 rounded border px-3 py-2 disabled:opacity-50";
const statusButtonClass = "min-h-11 rounded border px-2 py-2 text-sm disabled:opacity-50";
const selectedButtonClass = "bg-foreground font-medium text-background";

type LessonsViewProps = {
  state: LessonsState;
  today: string;
  onMark: (lesson: MonthLesson, status: LessonStatus) => void;
  onChangeMonth: (delta: number) => void;
  onRetry: () => void;
};

function LessonRow({ lesson, state, onMark }: { lesson: MonthLesson; state: LessonsState; onMark: LessonsViewProps["onMark"] }) {
  const key = lessonKey(lesson);
  const saving = state.pending.includes(key);
  return (
    <li className="flex flex-col gap-2 rounded border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-medium break-words">{lesson.studentName}</span>
        {lesson.time ? <span className="text-sm">{lesson.time}</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Aula de ${lesson.studentName}, ${describeDay(lesson.date)}`}>
        {lessonStatuses.map((status) => (
          <button
            key={status}
            className={lesson.status === status ? `${statusButtonClass} ${selectedButtonClass}` : statusButtonClass}
            type="button"
            aria-pressed={lesson.status === status}
            disabled={saving}
            onClick={() => onMark(lesson, status)}
          >
            {lessonStatusLabels[status]}
          </button>
        ))}
      </div>
      <p className="text-sm">{chargeLabel(lesson.status)}</p>
      {state.failedLesson === key ? (
        <p className="text-sm" role="alert">
          {lessonsMessages.markFailed}
        </p>
      ) : null}
    </li>
  );
}

function LessonsList({ state, today, onMark }: Pick<LessonsViewProps, "state" | "today" | "onMark">) {
  const lessons = monthLessons(state.students, state.marks, state.month);
  const unscheduled = describeUnscheduled(state.students);
  const days = groupByDay(lessons);
  const anchor = todayAnchorDate(days, state.month, today);
  return (
    <>
      {state.noticeHours === null ? null : (
        <p className="text-sm">
          {lessonsMessages.chargeRule} {describeNoticeRule(state.noticeHours)} {lessonsMessages.undoHint}
        </p>
      )}
      {unscheduled ? (
        <p className="text-sm">
          {unscheduled}{" "}
          <Link className="underline" href={studentsPath}>
            Definir em Alunos
          </Link>
        </p>
      ) : null}
      {lessons.length === 0 ? <p className="text-sm">{lessonsMessages.noLessons}</p> : <p className="text-sm font-medium">{describeSummary(summarizeLessons(lessons))}</p>}
      {anchor ? (
        <a className="text-sm underline" href="#hoje">
          Ir para hoje
        </a>
      ) : null}
      {days.map((day) => (
        <section key={day.date} id={day.date === anchor ? "hoje" : undefined} className="flex flex-col gap-2">
          <h2 className="font-semibold">
            {describeDay(day.date)}
            {day.date === today ? " (hoje)" : ""}
          </h2>
          <ul className="flex flex-col gap-2">
            {day.lessons.map((lesson) => (
              <LessonRow key={lessonKey(lesson)} lesson={lesson} state={state} onMark={onMark} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function LessonsView({ state, today, onMark, onChangeMonth, onRetry }: LessonsViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Aulas</h1>
        <nav className="flex gap-4">
          <Link className="text-sm underline" href={studentsPath}>
            Alunos
          </Link>
          <Link className="text-sm underline" href={teacherRulesPath}>
            Regras
          </Link>
          <Link className="text-sm underline" href={accountPath}>
            Conta
          </Link>
        </nav>
      </header>
      <div className="flex items-center justify-between gap-2">
        <button className={secondaryButtonClass} type="button" aria-label="Mês anterior" onClick={() => onChangeMonth(-1)}>
          ←
        </button>
        <p className="font-medium" aria-live="polite">
          {describeMonth(state.month)}
        </p>
        <button className={secondaryButtonClass} type="button" aria-label="Mês seguinte" onClick={() => onChangeMonth(1)}>
          →
        </button>
      </div>
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm" role="alert">
            {lessonsMessages.loadFailed}
          </p>
          <button className={secondaryButtonClass} type="button" onClick={onRetry}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      {state.status === "ready" ? <LessonsList state={state} today={today} onMark={onMark} /> : null}
    </main>
  );
}
