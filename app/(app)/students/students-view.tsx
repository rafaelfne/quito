import Link from "next/link";
import { accountPath } from "@/lib/account";
import { chargesPath } from "@/lib/charges";
import { closingPath } from "@/lib/closing";
import { lessonsPath } from "@/lib/lessons";
import { billingKinds, billingOptions, describeBilling, isBillingKind, packageRolloverHint } from "@/lib/billing";
import { paymentSettingsPath } from "@/lib/payment-settings";
import { describePlannedLessons, describeSchedule, weekdayOptions, type CalendarMonth } from "@/lib/schedule";
import { afterSignInPath } from "@/lib/session";
import { currentDraft, formatPhone, groupStudentsByGuardian, studentGenderOptions, studentMessages, type Student, type StudentField, type StudentsState } from "@/lib/students";
import { teacherRulesPath } from "@/lib/teacher-rules";

const inputClass = "min-h-11 rounded border bg-background px-3 py-3 text-base text-foreground";
const primaryButtonClass = "min-h-11 flex-1 rounded bg-foreground px-3 py-2 text-background disabled:opacity-50";
const secondaryButtonClass = "min-h-11 rounded border px-3 py-2 disabled:opacity-50";

type FormHandlers = {
  onChange: (field: StudentField, value: string) => void;
  onSubmit: () => void;
};

type StudentsViewProps = FormHandlers & {
  state: StudentsState;
  month: CalendarMonth;
  busy: boolean;
  discountPercent?: number;
  onEdit: (student: Student) => void;
  onCancelEdit: () => void;
  onRetry: () => void;
};

type TextFieldConfig = {
  field: StudentField;
  id: string;
  label: string;
  type?: "text" | "tel" | "time";
  inputMode?: "text" | "tel" | "decimal" | "numeric";
  autoCapitalize?: "off" | "words";
  hint?: string;
};

const studentNameField: TextFieldConfig = { field: "name", id: "student-name", label: "Nome do aluno", autoCapitalize: "words" };

const calledAsField: TextFieldConfig = { field: "calledAs", id: "student-called-as", label: "Como quer ser chamado", autoCapitalize: "words", hint: "Do jeito que deve aparecer na mensagem de cobrança." };

const guardianFields: TextFieldConfig[] = [
  { field: "guardianName", id: "student-guardian-name", label: "Nome do responsável", autoCapitalize: "words" },
  { field: "guardianPhone", id: "student-guardian-phone", label: "WhatsApp do responsável", type: "tel", inputMode: "tel", hint: "Com DDD. É para este número que a cobrança vai sair." },
];

const packageLessonsField: TextFieldConfig = { field: "packageLessons", id: "student-package-lessons", label: "Quantas aulas tem o pacote", inputMode: "numeric", hint: packageRolloverHint };

const lessonTimeField: TextFieldConfig = { field: "lessonTime", id: "student-lesson-time", label: "Horário da aula", type: "time" };

function amountField(label: string): TextFieldConfig {
  return { field: "billingAmount", id: "student-billing-amount", label, inputMode: "decimal" };
}

function TextField({ config, state, onChange }: { config: TextFieldConfig; state: StudentsState; onChange: FormHandlers["onChange"] }) {
  const { field, id, label, type = "text", inputMode = "text", autoCapitalize = "off", hint } = config;
  const error = state.errors[field];
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {hint ? <span className="opacity-70">{hint}</span> : null}
      <input
        className={inputClass}
        type={type}
        inputMode={inputMode}
        autoComplete="off"
        autoCapitalize={autoCapitalize}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={currentDraft(state)[field]}
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

function GenderField({ state, onChange }: { state: StudentsState; onChange: FormHandlers["onChange"] }) {
  const error = state.errors.gender;
  const selected = currentDraft(state).gender;
  return (
    <>
      <fieldset className="flex flex-col gap-2 text-sm" aria-describedby={error ? "student-gender-error" : undefined}>
        <legend className="mb-1">Gênero do aluno</legend>
        <span className="opacity-70">Para a mensagem de cobrança escrever &quot;do Pedro&quot; ou &quot;da Ana&quot;.</span>
        <div className="flex flex-wrap gap-2">
          {studentGenderOptions.map(({ value, label }) => (
            <label key={value} className="flex min-h-11 flex-1 items-center gap-2 rounded border px-3 text-base">
              <input type="radio" name="student-gender" value={value} checked={selected === value} onChange={() => onChange("gender", value)} />
              {label}
            </label>
          ))}
        </div>
        {error ? (
          <span id="student-gender-error" role="alert">
            {error}
          </span>
        ) : null}
      </fieldset>
      {selected === "other" ? <TextField config={calledAsField} state={state} onChange={onChange} /> : null}
    </>
  );
}

function BillingFields({ state, onChange }: { state: StudentsState; onChange: FormHandlers["onChange"] }) {
  const selected = currentDraft(state).billingKind;
  const error = state.errors.billingKind;
  return (
    <>
      <fieldset className="flex flex-col gap-2 text-sm" aria-describedby={error ? "student-billing-kind-error" : undefined}>
        <legend className="mb-1">Como este aluno paga</legend>
        {billingKinds.map((kind) => (
          <label key={kind} className="flex min-h-11 items-center gap-2 rounded border px-3 text-base">
            <input type="radio" name="billing-kind" value={kind} checked={selected === kind} onChange={() => onChange("billingKind", kind)} />
            {billingOptions[kind].label}
          </label>
        ))}
        {error ? (
          <span id="student-billing-kind-error" role="alert">
            {error}
          </span>
        ) : null}
      </fieldset>
      {selected === "package" ? <TextField config={packageLessonsField} state={state} onChange={onChange} /> : null}
      {isBillingKind(selected) ? <TextField config={amountField(billingOptions[selected].amountLabel)} state={state} onChange={onChange} /> : null}
    </>
  );
}

function ScheduleFields({ state, onChange }: { state: StudentsState; onChange: FormHandlers["onChange"] }) {
  const error = state.errors.lessonWeekday;
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        Dia da aula, toda semana
        <select
          className={inputClass}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "student-lesson-weekday-error" : undefined}
          value={currentDraft(state).lessonWeekday}
          onChange={(event) => onChange("lessonWeekday", event.target.value)}
        >
          <option value="">Escolha o dia</option>
          {weekdayOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {error ? (
          <span id="student-lesson-weekday-error" role="alert">
            {error}
          </span>
        ) : null}
      </label>
      <TextField config={lessonTimeField} state={state} onChange={onChange} />
    </>
  );
}

function StudentForm({ state, busy, submitLabel, onChange, onSubmit, onCancel }: FormHandlers & { state: StudentsState; busy: boolean; submitLabel: string; onCancel?: () => void }) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="flex flex-col gap-4" disabled={busy}>
        <TextField config={studentNameField} state={state} onChange={onChange} />
        <GenderField state={state} onChange={onChange} />
        {guardianFields.map((config) => (
          <TextField key={config.field} config={config} state={state} onChange={onChange} />
        ))}
        <ScheduleFields state={state} onChange={onChange} />
        <BillingFields state={state} onChange={onChange} />
        {state.message ? (
          <p className="text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button className={primaryButtonClass} type="submit">
            {busy ? "Guardando..." : submitLabel}
          </button>
          {onCancel ? (
            <button className={secondaryButtonClass} type="button" onClick={onCancel}>
              Cancelar
            </button>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}

function StudentCard({ student, month, canEdit, onEdit, discountPercent }: { student: Student; month: CalendarMonth; canEdit: boolean; onEdit: (student: Student) => void; discountPercent: number }) {
  const planned = describePlannedLessons(student, month);
  return (
    <div className="flex items-start justify-between gap-3">
      <dl className="flex min-w-0 flex-col gap-1">
        <dt className="sr-only">Aluno</dt>
        <dd className="font-medium break-words">{student.name}</dd>
        <dt className="sr-only">Responsável</dt>
        <dd className="text-sm break-words">{student.guardian_name}</dd>
        <dt className="sr-only">WhatsApp do responsável</dt>
        <dd className="text-sm">{formatPhone(student.guardian_phone)}</dd>
        <dt className="sr-only">Forma de cobrança</dt>
        <dd className="text-sm">{describeBilling(student, discountPercent)}</dd>
        <dt className="sr-only">Horário fixo</dt>
        <dd className="text-sm">{describeSchedule(student)}</dd>
        {planned ? (
          <>
            <dt className="sr-only">Aulas previstas no mês</dt>
            <dd className="text-sm">{planned}</dd>
          </>
        ) : null}
      </dl>
      {canEdit ? (
        <button className={secondaryButtonClass} type="button" aria-label={`Editar ${student.name}`} onClick={() => onEdit(student)}>
          Editar
        </button>
      ) : null}
    </div>
  );
}

function StudentList({ state, month, busy, discountPercent = 0, onChange, onSubmit, onEdit, onCancelEdit }: StudentsViewProps) {
  const { students, listStatus, editing } = state;
  if (listStatus === "loading" && students.length === 0) return <p className="text-sm">Carregando...</p>;
  if (listStatus === "ready" && students.length === 0) return <p className="text-sm">Nenhum aluno por aqui ainda. Cadastre o primeiro no formulário acima.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {groupStudentsByGuardian(students).map((group) => (
        <li key={group[0].guardian_phone} className="flex flex-col gap-2">
          {group.length > 1 ? <h3 className="text-sm font-medium">Alunos de {group[0].guardian_name}</h3> : null}
          <ul className="flex flex-col gap-2">
            {group.map((student) => (
              <li key={student.id} className="rounded border p-3">
                {editing?.id === student.id ? (
                  <StudentForm state={state} busy={busy} submitLabel="Guardar" onChange={onChange} onSubmit={onSubmit} onCancel={onCancelEdit} />
                ) : (
                  <StudentCard student={student} month={month} canEdit={!editing && listStatus !== "loading"} onEdit={onEdit} discountPercent={group.length > 1 ? discountPercent : 0} />
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function StudentsView(props: StudentsViewProps) {
  const { state, busy, onChange, onSubmit, onRetry } = props;
  const loading = state.listStatus === "loading";
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Alunos</h1>
        <nav className="flex flex-wrap gap-4">
          <Link className="text-sm underline" href={afterSignInPath}>
            Notas
          </Link>
          <Link className="text-sm underline" href={lessonsPath}>
            Aulas
          </Link>
          <Link className="text-sm underline" href={closingPath}>
            Fechamento
          </Link>
          <Link className="text-sm underline" href={teacherRulesPath}>
            Regras
          </Link>
          <Link className="text-sm underline" href={paymentSettingsPath}>
            Recebimento
          </Link>
          <Link className="text-sm underline" href={chargesPath}>
            Cobranças
          </Link>
          <Link className="text-sm underline" href={accountPath}>
            Conta
          </Link>
        </nav>
      </header>
      {state.notice ? (
        <p className="text-sm" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.editing ? null : (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">Novo aluno</h2>
          <StudentForm state={state} busy={busy || loading} submitLabel="Guardar aluno" onChange={onChange} onSubmit={onSubmit} />
        </section>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">Seus alunos</h2>
        {state.listStatus === "failed" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm" role="alert">
              {studentMessages.loadFailed}
            </p>
            <button className={secondaryButtonClass} type="button" onClick={onRetry}>
              Tentar de novo
            </button>
          </div>
        ) : null}
        <StudentList {...props} />
      </section>
    </main>
  );
}
