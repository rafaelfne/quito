import Link from "next/link";
import { accountPath } from "@/lib/account";
import { closingPath } from "@/lib/closing";
import {
  chargeLabel,
  describeDay,
  describeMonth,
  describeNoticeRule,
  describeShortDay,
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
  type MakeupLesson,
  type MonthLesson,
} from "@/lib/lessons";
import {
  creditKey,
  describeCredit,
  describeLessonCredit,
  makeupDateDraft,
  makeupMessages,
  monthMakeups,
  openCredits,
  type LessonCredit,
  type MakeupTarget,
} from "@/lib/makeups";
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
  onChangeMakeupDate: (target: MakeupTarget, date: string) => void;
  onMakeUp: (credit: LessonCredit) => void;
  onUndoMakeup: (makeup: MakeupLesson) => void;
};

function ProblemText({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <p className="text-sm" role="alert">
      {text}
    </p>
  );
}

function LessonRow({ lesson, state, today, onMark }: { lesson: MonthLesson; state: LessonsState; today: string; onMark: LessonsViewProps["onMark"] }) {
  const key = lessonKey(lesson);
  const saving = state.pending.includes(key);
  const creditText = describeLessonCredit(lesson, state.makeupDeadlineDays, today);
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
            disabled={saving || lesson.makeupDate !== null}
            onClick={() => onMark(lesson, status)}
          >
            {lessonStatusLabels[status]}
          </button>
        ))}
      </div>
      <p className="text-sm">{chargeLabel(lesson.status)}</p>
      {creditText ? <p className="text-sm">{creditText}</p> : null}
      {state.failedLesson === key ? (
        <p className="text-sm" role="alert">
          {lessonsMessages.markFailed}
        </p>
      ) : null}
    </li>
  );
}

function MakeupRow({ makeup, state, onUndoMakeup }: { makeup: MakeupLesson; state: LessonsState; onUndoMakeup: LessonsViewProps["onUndoMakeup"] }) {
  const key = creditKey(makeup);
  return (
    <li className="flex flex-col gap-2 rounded border p-3">
      <span className="min-w-0 font-medium break-words">{makeup.studentName}</span>
      <p className="text-sm">Reposição da falta de {describeShortDay(makeup.absenceDate)}. Cobrada.</p>
      <button className={secondaryButtonClass} type="button" disabled={state.pending.includes(key)} onClick={() => onUndoMakeup(makeup)}>
        Desfazer reposição
      </button>
      <ProblemText text={state.makeupErrors[key]} />
    </li>
  );
}

function CreditRow({ credit, state, today, onChangeMakeupDate, onMakeUp }: { credit: LessonCredit; state: LessonsState; today: string } & Pick<LessonsViewProps, "onChangeMakeupDate" | "onMakeUp">) {
  const key = creditKey(credit);
  return (
    <li className="flex flex-col gap-2 rounded border p-3">
      <span className="min-w-0 font-medium break-words">{credit.studentName}</span>
      <p className="text-sm">{describeCredit(credit)}</p>
      <label className="flex flex-col gap-1 text-sm">
        Dia da reposição
        <input
          className="min-h-11 rounded border px-3 py-2"
          type="date"
          min={credit.absenceDate}
          max={credit.expiresOn ?? undefined}
          value={makeupDateDraft(state, credit, today)}
          onChange={(event) => onChangeMakeupDate(credit, event.target.value)}
        />
      </label>
      <button className={secondaryButtonClass} type="button" disabled={state.pending.includes(key)} onClick={() => onMakeUp(credit)}>
        Marcar reposição
      </button>
      <ProblemText text={state.makeupErrors[key]} />
    </li>
  );
}

function CreditsSection({ state, today, onChangeMakeupDate, onMakeUp }: Pick<LessonsViewProps, "state" | "today" | "onChangeMakeupDate" | "onMakeUp">) {
  const credits = openCredits(state.students, state.marks, state.makeupDeadlineDays, today);
  if (credits.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{makeupMessages.title}</h2>
      <p className="text-sm">{makeupMessages.explanation}</p>
      <ul className="flex flex-col gap-2">
        {credits.map((credit) => (
          <CreditRow key={creditKey(credit)} credit={credit} state={state} today={today} onChangeMakeupDate={onChangeMakeupDate} onMakeUp={onMakeUp} />
        ))}
      </ul>
    </section>
  );
}

function LessonsList({ state, today, onMark, onChangeMakeupDate, onMakeUp, onUndoMakeup }: Omit<LessonsViewProps, "onChangeMonth" | "onRetry">) {
  const lessons = monthLessons(state.students, state.marks, state.month);
  const makeups = monthMakeups(state.students, state.marks, state.month);
  const unscheduled = describeUnscheduled(state.students);
  const days = groupByDay(lessons, makeups);
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
      {days.length === 0 ? <p className="text-sm">{lessonsMessages.noLessons}</p> : <p className="text-sm font-medium">{describeSummary(summarizeLessons(lessons, makeups))}</p>}
      <CreditsSection state={state} today={today} onChangeMakeupDate={onChangeMakeupDate} onMakeUp={onMakeUp} />
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
              <LessonRow key={lessonKey(lesson)} lesson={lesson} state={state} today={today} onMark={onMark} />
            ))}
            {day.makeups.map((makeup) => (
              <MakeupRow key={`makeup-${creditKey(makeup)}`} makeup={makeup} state={state} onUndoMakeup={onUndoMakeup} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function LessonsView({ state, today, onMark, onChangeMonth, onRetry, onChangeMakeupDate, onMakeUp, onUndoMakeup }: LessonsViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Aulas</h1>
        <nav className="flex flex-wrap gap-4">
          <Link className="text-sm underline" href={studentsPath}>
            Alunos
          </Link>
          <Link className="text-sm underline" href={closingPath}>
            Fechamento
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
      {state.status === "ready" ? <LessonsList state={state} today={today} onMark={onMark} onChangeMakeupDate={onChangeMakeupDate} onMakeUp={onMakeUp} onUndoMakeup={onUndoMakeup} /> : null}
    </main>
  );
}
