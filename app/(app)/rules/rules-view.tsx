import Link from "next/link";
import { Button } from "@/components/ui/button";
import { accountPath } from "@/lib/account";
import { closingPath } from "@/lib/closing";
import { lessonsPath } from "@/lib/lessons";
import { studentsPath } from "@/lib/students";
import { fiveWeekOptions, fiveWeekPolicies, makeupOptions, makeupPolicies, teacherRulesMessages, type TeacherRulesField, type TeacherRulesState } from "@/lib/teacher-rules";

const inputClass = "min-h-11 rounded-sm border bg-background px-3 py-3 text-base text-foreground";

type FormHandlers = {
  onChange: (field: TeacherRulesField, value: string) => void;
  onSubmit: () => void;
};

type TeacherRulesViewProps = FormHandlers & {
  state: TeacherRulesState;
  busy: boolean;
  onRetry: () => void;
};

type TextFieldConfig = {
  field: TeacherRulesField;
  id: string;
  label: string;
  inputMode: "numeric" | "decimal";
  hint: string;
};

type ChoiceConfig = {
  field: TeacherRulesField;
  name: string;
  legend: string;
  values: readonly string[];
  labels: Record<string, string>;
};

const noticeField: TextFieldConfig = {
  field: "noticeHours",
  id: "rules-notice-hours",
  label: "Com quantas horas de antecedência a falta conta como avisada",
  inputMode: "numeric",
  hint: "Com menos tempo que isso, a falta conta como sem aviso e é cobrada.",
};

const makeupDaysField: TextFieldConfig = {
  field: "makeupDays",
  id: "rules-makeup-days",
  label: "Prazo para repor, em dias",
  inputMode: "numeric",
  hint: "Contado a partir do dia da falta. Passou do prazo, o crédito vence.",
};

const siblingDiscountField: TextFieldConfig = {
  field: "siblingDiscountPercent",
  id: "rules-sibling-discount-percent",
  label: "Desconto para alunos com o mesmo responsável, em porcentagem",
  inputMode: "numeric",
  hint: "O percentual será descontado da cobrança de cada aluno. Use 0 para não dar desconto.",
};

const fiveWeekExtraField: TextFieldConfig = {
  field: "fiveWeekExtra",
  id: "rules-five-week-extra",
  label: "Valor da aula avulsa, em reais",
  inputMode: "decimal",
  hint: "É o mesmo valor para todos os alunos de mensalidade fixa.",
};

const makeupChoice: ChoiceConfig = { field: "makeupPolicy", name: "makeup-policy", legend: "A reposição tem prazo?", values: makeupPolicies, labels: makeupOptions };

const fiveWeekChoice: ChoiceConfig = { field: "fiveWeekPolicy", name: "five-week-policy", legend: "Na mensalidade fixa, o mês com 5 semanas", values: fiveWeekPolicies, labels: fiveWeekOptions };

function TextField({ config, state, onChange }: { config: TextFieldConfig; state: TeacherRulesState; onChange: FormHandlers["onChange"] }) {
  const { field, id, label, inputMode, hint } = config;
  const error = state.errors[field];
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <span className="opacity-70">{hint}</span>
      <input
        className={inputClass}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={state.draft[field]}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error ? (
        <span id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function Choice({ config, state, onChange }: { config: ChoiceConfig; state: TeacherRulesState; onChange: FormHandlers["onChange"] }) {
  const { field, name, legend, values, labels } = config;
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1">{legend}</legend>
      {values.map((value) => (
        <label key={value} className="flex min-h-11 items-center gap-2 rounded-sm border px-3 text-base">
          <input type="radio" name={name} value={value} checked={state.draft[field] === value} onChange={() => onChange(field, value)} />
          {labels[value]}
        </label>
      ))}
    </fieldset>
  );
}

function TeacherRulesForm({ state, busy, onChange, onSubmit }: FormHandlers & { state: TeacherRulesState; busy: boolean }) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="flex flex-col gap-4" disabled={busy || state.status === "loading"}>
        <TextField config={noticeField} state={state} onChange={onChange} />
        <TextField config={siblingDiscountField} state={state} onChange={onChange} />
        <Choice config={makeupChoice} state={state} onChange={onChange} />
        {state.draft.makeupPolicy === "deadline" ? <TextField config={makeupDaysField} state={state} onChange={onChange} /> : null}
        <Choice config={fiveWeekChoice} state={state} onChange={onChange} />
        {state.draft.fiveWeekPolicy === "add_lesson" ? <TextField config={fiveWeekExtraField} state={state} onChange={onChange} /> : null}
        {state.message ? (
          <p className="text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <Button className="flex-1" type="submit">
          {busy ? "Guardando..." : "Guardar regras"}
        </Button>
      </fieldset>
    </form>
  );
}

function LoadFailure({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" role="alert">
        {teacherRulesMessages.loadFailed}
      </p>
      <Button variant="outline" type="button" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}

export function TeacherRulesView({ state, busy, onChange, onSubmit, onRetry }: TeacherRulesViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Regras</h1>
        <nav className="flex flex-wrap gap-4">
          <Link className="text-sm underline" href={studentsPath}>
            Alunos
          </Link>
          <Link className="text-sm underline" href={lessonsPath}>
            Aulas
          </Link>
          <Link className="text-sm underline" href={closingPath}>
            Fechamento
          </Link>
          <Link className="text-sm underline" href={accountPath}>
            Conta
          </Link>
        </nav>
      </header>
      <p className="text-sm">Estas regras valem para todos os seus alunos.</p>
      {state.notice ? (
        <p className="text-sm" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? <LoadFailure onRetry={onRetry} /> : <TeacherRulesForm state={state} busy={busy} onChange={onChange} onSubmit={onSubmit} />}
    </main>
  );
}
