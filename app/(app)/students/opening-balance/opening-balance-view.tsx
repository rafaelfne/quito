import Link from "next/link";
import { Button } from "@/components/ui/button";
import { describeBilling } from "@/lib/billing";
import { gettingStartedPath } from "@/lib/getting-started";
import { lessonsPath } from "@/lib/lessons";
import {
  describeCreditsDeadline,
  describeOpeningIntro,
  describeOpeningNotYet,
  describePredictedCredits,
  describePredictedPackage,
  isOpeningConfirmed,
  openingBalanceMessages,
  openingDayOf,
  openingDraftOf,
  type OpeningBalanceState,
  type OpeningDraft,
} from "@/lib/opening-balance";
import type { CalendarMonth } from "@/lib/schedule";
import type { Student } from "@/lib/students";

const inputClass = "min-h-11 rounded-sm border bg-background px-3 py-3 text-base text-foreground";

export type OpeningBalanceViewProps = {
  state: OpeningBalanceState;
  today: string;
  busy: boolean;
  onChange: (id: string, field: keyof OpeningDraft, value: string) => void;
  onConfirm: () => void;
  onRetry: () => void;
};

function CountInput({ student, field, label, hint, state, onChange }: { student: Student; field: keyof OpeningDraft; label: string; hint: string; state: OpeningBalanceState; onChange: OpeningBalanceViewProps["onChange"] }) {
  const error = state.errors[student.id]?.[field];
  const errorId = `opening-${student.id}-${field}-error`;
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <span className="opacity-70">{hint}</span>
      <input
        className={inputClass}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={openingDraftOf(state, student.id)[field]}
        onChange={(event) => onChange(student.id, field, event.target.value)}
      />
      {error ? (
        <span id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function StudentBalance({ student, state, onChange }: { student: Student; state: OpeningBalanceState; onChange: OpeningBalanceViewProps["onChange"] }) {
  const prediction = state.predictions[student.id] ?? { packageBalance: null, makeupCredits: 0 };
  return (
    <li className="flex flex-col gap-2 rounded-sm border p-3">
      <h2 className="font-medium break-words">{student.name}</h2>
      <p className="text-sm opacity-70">{describeBilling(student)}</p>
      {prediction.packageBalance === null ? null : <CountInput student={student} field="packageBalance" label="Aulas que sobram no pacote" hint={describePredictedPackage(prediction.packageBalance)} state={state} onChange={onChange} />}
      <CountInput student={student} field="makeupCredits" label="Créditos de reposição" hint={describePredictedCredits(prediction.makeupCredits)} state={state} onChange={onChange} />
      <p className="text-sm font-medium">{isOpeningConfirmed(student) ? openingBalanceMessages.confirmed : openingBalanceMessages.pending}</p>
    </li>
  );
}

function BalanceForm({ state, trainingMonth, busy, onChange, onConfirm }: Omit<OpeningBalanceViewProps, "today" | "onRetry"> & { trainingMonth: CalendarMonth }) {
  if (state.students.length === 0) return <p className="text-sm">{openingBalanceMessages.noStudents}</p>;
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <fieldset className="flex flex-col gap-4" disabled={busy}>
        <p className="text-sm">{describeOpeningIntro(trainingMonth)}</p>
        <p className="text-sm">{describeCreditsDeadline(trainingMonth, state.makeupDeadlineDays)}</p>
        <ul className="flex flex-col gap-2" aria-label="Alunos">
          {state.students.map((student) => (
            <StudentBalance key={student.id} student={student} state={state} onChange={onChange} />
          ))}
        </ul>
        <Button type="submit">{busy ? "Guardando..." : openingBalanceMessages.confirm}</Button>
      </fieldset>
    </form>
  );
}

function OpeningBody({ state, today, busy, onChange, onConfirm, onRetry }: OpeningBalanceViewProps) {
  if (state.status === "failed")
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm" role="alert">
          {openingBalanceMessages.loadFailed}
        </p>
        <Button variant="outline" type="button" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    );
  if (state.status === "loading" && state.students.length === 0) return <p className="text-sm">Carregando...</p>;
  const { trainingMonth } = state;
  if (trainingMonth === null)
    return (
      <p className="text-sm">
        <Link className="underline" href={gettingStartedPath}>
          {openingBalanceMessages.noTraining}
        </Link>
      </p>
    );
  if (today < openingDayOf(trainingMonth)) return <p className="text-sm">{describeOpeningNotYet(trainingMonth)}</p>;
  return <BalanceForm state={state} trainingMonth={trainingMonth} busy={busy} onChange={onChange} onConfirm={onConfirm} />;
}

export function OpeningBalanceView(props: OpeningBalanceViewProps) {
  const { state } = props;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{openingBalanceMessages.title}</h1>
        <Link className="text-sm underline" href={lessonsPath}>
          Voltar para Aulas
        </Link>
      </header>
      {state.notice ? (
        <p className="text-sm" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <OpeningBody {...props} />
    </main>
  );
}
