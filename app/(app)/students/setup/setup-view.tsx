import Link from "next/link";
import { Button } from "@/components/ui/button";
import { billingKinds, billingOptions, describeBilling, isBillingKind, packageRolloverHint, type BillingDraft } from "@/lib/billing";
import { describeSchedule, weekdayOptions, type ScheduleDraft } from "@/lib/schedule";
import { describeApply, hasBilling, scheduleDraftOf, studentSetupMessages, type StudentSetupState } from "@/lib/student-setup";
import { studentsPath, type Student } from "@/lib/students";

const inputClass = "min-h-11 rounded-sm border bg-background px-3 py-3 text-base text-foreground";

type StudentSetupViewProps = {
  state: StudentSetupState;
  busy: boolean;
  onToggle: (id: string) => void;
  onSelectWithoutBilling: () => void;
  onClearSelection: () => void;
  onChangeBilling: (field: keyof BillingDraft, value: string) => void;
  onApplyBilling: () => void;
  onChangeSchedule: (id: string, field: keyof ScheduleDraft, value: string) => void;
  onSaveSchedule: (id: string) => void;
  onRetry: () => void;
};

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <span id={id} role="alert">
      {error}
    </span>
  ) : null;
}

function BillingInput({ field, label, hint, inputMode, state, onChangeBilling }: { field: "billingAmount" | "packageLessons"; label: string; hint?: string; inputMode: "decimal" | "numeric"; state: StudentSetupState; onChangeBilling: StudentSetupViewProps["onChangeBilling"] }) {
  const error = state.billingErrors[field];
  const errorId = `group-${field}-error`;
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {hint ? <span className="opacity-70">{hint}</span> : null}
      <input
        className={inputClass}
        inputMode={inputMode}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={state.billing[field]}
        onChange={(event) => onChangeBilling(field, event.target.value)}
      />
      <FieldError id={errorId} error={error} />
    </label>
  );
}

function StudentPick({ student, checked, onToggle }: { student: Student; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <li>
      <label className="flex min-h-11 items-start gap-3 rounded-sm border p-3 text-base">
        <input className="mt-1" type="checkbox" checked={checked} onChange={() => onToggle(student.id)} />
        <span className="flex min-w-0 flex-col">
          <span className="font-medium break-words">{student.name}</span>
          <span className="text-sm opacity-70">{describeBilling(student)}</span>
        </span>
      </label>
    </li>
  );
}

function GroupBilling({ state, busy, onToggle, onSelectWithoutBilling, onClearSelection, onChangeBilling, onApplyBilling }: StudentSetupViewProps) {
  const kind = state.billing.billingKind;
  const kindError = state.billingErrors.billingKind;
  const withoutBilling = state.students.filter((student) => !hasBilling(student)).length;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold">1. Mesma forma de cobrança para vários alunos</h2>
      <p className="text-sm">Marque os alunos que pagam igual e aplique o valor de uma vez.</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onApplyBilling();
        }}
      >
        <fieldset className="flex flex-col gap-4" disabled={busy}>
          <div className="flex flex-wrap gap-2">
            {withoutBilling > 0 ? (
              <Button variant="outline" type="button" onClick={onSelectWithoutBilling}>
                Marcar os {withoutBilling} sem forma de cobrança
              </Button>
            ) : null}
            {state.selected.length > 0 ? (
              <Button variant="outline" type="button" onClick={onClearSelection}>
                Desmarcar todos
              </Button>
            ) : null}
          </div>
          <ul className="flex flex-col gap-2" aria-label="Alunos">
            {state.students.map((student) => (
              <StudentPick key={student.id} student={student} checked={state.selected.includes(student.id)} onToggle={onToggle} />
            ))}
          </ul>
          <fieldset className="flex flex-col gap-2 text-sm" aria-describedby={kindError ? "group-billing-kind-error" : undefined}>
            <legend className="mb-1">Como estes alunos pagam</legend>
            {billingKinds.map((option) => (
              <label key={option} className="flex min-h-11 items-center gap-2 rounded-sm border px-3 text-base">
                <input type="radio" name="group-billing-kind" value={option} checked={kind === option} onChange={() => onChangeBilling("billingKind", option)} />
                {billingOptions[option].label}
              </label>
            ))}
            <FieldError id="group-billing-kind-error" error={kindError} />
          </fieldset>
          {kind === "package" ? <BillingInput field="packageLessons" label="Quantas aulas tem o pacote" hint={packageRolloverHint} inputMode="numeric" state={state} onChangeBilling={onChangeBilling} /> : null}
          {isBillingKind(kind) ? <BillingInput field="billingAmount" label={billingOptions[kind].amountLabel} inputMode="decimal" state={state} onChangeBilling={onChangeBilling} /> : null}
          <Button type="submit" disabled={state.selected.length === 0}>
            {busy ? "Guardando..." : describeApply(state.selected.length)}
          </Button>
        </fieldset>
      </form>
    </section>
  );
}

function ScheduleRowForm({ student, state, busy, onChangeSchedule, onSaveSchedule }: { student: Student; state: StudentSetupState; busy: boolean; onChangeSchedule: StudentSetupViewProps["onChangeSchedule"]; onSaveSchedule: StudentSetupViewProps["onSaveSchedule"] }) {
  const draft = scheduleDraftOf(state, student.id);
  const errors = state.scheduleErrors[student.id] ?? {};
  const weekdayErrorId = `schedule-${student.id}-weekday-error`;
  const timeErrorId = `schedule-${student.id}-time-error`;
  return (
    <li className="rounded-sm border p-3">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSaveSchedule(student.id);
        }}
      >
        <fieldset className="flex flex-col gap-2" disabled={busy}>
          <legend className="font-medium break-words">{student.name}</legend>
          <p className="text-sm opacity-70">{describeSchedule(student)}</p>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Dia da aula
              <select
                className={inputClass}
                aria-invalid={errors.lessonWeekday ? true : undefined}
                aria-describedby={errors.lessonWeekday ? weekdayErrorId : undefined}
                value={draft.lessonWeekday}
                onChange={(event) => onChangeSchedule(student.id, "lessonWeekday", event.target.value)}
              >
                <option value="">Escolha o dia</option>
                {weekdayOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError id={weekdayErrorId} error={errors.lessonWeekday} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Horário
              <input
                className={inputClass}
                type="time"
                aria-invalid={errors.lessonTime ? true : undefined}
                aria-describedby={errors.lessonTime ? timeErrorId : undefined}
                value={draft.lessonTime}
                onChange={(event) => onChangeSchedule(student.id, "lessonTime", event.target.value)}
              />
              <FieldError id={timeErrorId} error={errors.lessonTime} />
            </label>
          </div>
          <Button variant="outline" type="submit" aria-label={`Guardar horário de ${student.name}`}>
            Guardar horário
          </Button>
        </fieldset>
      </form>
    </li>
  );
}

function Schedules({ state, busy, onChangeSchedule, onSaveSchedule }: StudentSetupViewProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold">2. Horário de cada aluno</h2>
      <p className="text-sm">O dia e a hora da aula fixa de cada um, toda semana.</p>
      <ul className="flex flex-col gap-2">
        {state.students.map((student) => (
          <ScheduleRowForm key={student.id} student={student} state={state} busy={busy} onChangeSchedule={onChangeSchedule} onSaveSchedule={onSaveSchedule} />
        ))}
      </ul>
    </section>
  );
}

function SetupBody(props: StudentSetupViewProps) {
  const { state, onRetry } = props;
  if (state.listStatus === "failed")
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm" role="alert">
          {studentSetupMessages.loadFailed}
        </p>
        <Button variant="outline" type="button" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    );
  if (state.listStatus === "loading" && state.students.length === 0) return <p className="text-sm">Carregando...</p>;
  if (state.students.length === 0) return <p className="text-sm">Nenhum aluno por aqui ainda. Cadastre ou cole a lista de alunos primeiro.</p>;
  return (
    <>
      <GroupBilling {...props} />
      <Schedules {...props} />
    </>
  );
}

export function StudentSetupView(props: StudentSetupViewProps) {
  const { state } = props;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Cobrança e horário em grupo</h1>
        <Link className="text-sm underline" href={studentsPath}>
          Voltar para Alunos
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
      <SetupBody {...props} />
    </main>
  );
}
