import Link from "next/link";
import { accountPath } from "@/lib/account";
import { afterSignInPath } from "@/lib/session";
import { currentDraft, formatPhone, studentMessages, type Student, type StudentField, type StudentsState } from "@/lib/students";

const inputClass = "rounded border px-3 py-3 text-base";
const primaryButtonClass = "min-h-11 flex-1 rounded bg-foreground px-3 py-2 text-background disabled:opacity-50";
const secondaryButtonClass = "min-h-11 rounded border px-3 py-2 disabled:opacity-50";

type FormHandlers = {
  onChange: (field: StudentField, value: string) => void;
  onSubmit: () => void;
};

type StudentsViewProps = FormHandlers & {
  state: StudentsState;
  busy: boolean;
  onEdit: (student: Student) => void;
  onCancelEdit: () => void;
  onRetry: () => void;
};

const fields: { field: StudentField; id: string; label: string; type: "text" | "tel"; hint?: string }[] = [
  { field: "name", id: "student-name", label: "Nome do aluno", type: "text" },
  { field: "guardianName", id: "student-guardian-name", label: "Nome do responsável", type: "text" },
  { field: "guardianPhone", id: "student-guardian-phone", label: "WhatsApp do responsável", type: "tel", hint: "Com DDD. É para este número que a cobrança vai sair." },
];

function StudentForm({ state, busy, submitLabel, onChange, onSubmit, onCancel }: FormHandlers & { state: StudentsState; busy: boolean; submitLabel: string; onCancel?: () => void }) {
  const draft = currentDraft(state);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="flex flex-col gap-4" disabled={busy}>
        {fields.map(({ field, id, label, type, hint }) => {
          const error = state.errors[field];
          return (
            <label key={field} className="flex flex-col gap-1 text-sm">
              {label}
              {hint ? <span className="opacity-70">{hint}</span> : null}
              <input
                className={inputClass}
                type={type}
                inputMode={type === "tel" ? "tel" : "text"}
                autoComplete="off"
                autoCapitalize={type === "tel" ? "off" : "words"}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                value={draft[field]}
                onChange={(event) => onChange(field, event.target.value)}
              />
              {error ? (
                <span id={`${id}-error`} role="alert">
                  {error}
                </span>
              ) : null}
            </label>
          );
        })}
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

function StudentCard({ student, canEdit, onEdit }: { student: Student; canEdit: boolean; onEdit: (student: Student) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dl className="flex min-w-0 flex-col gap-1">
        <dt className="sr-only">Aluno</dt>
        <dd className="font-medium break-words">{student.name}</dd>
        <dt className="sr-only">Responsável</dt>
        <dd className="text-sm break-words">{student.guardian_name}</dd>
        <dt className="sr-only">WhatsApp do responsável</dt>
        <dd className="text-sm">{formatPhone(student.guardian_phone)}</dd>
      </dl>
      {canEdit ? (
        <button className={secondaryButtonClass} type="button" aria-label={`Editar ${student.name}`} onClick={() => onEdit(student)}>
          Editar
        </button>
      ) : null}
    </div>
  );
}

function StudentList({ state, busy, onChange, onSubmit, onEdit, onCancelEdit }: StudentsViewProps) {
  const { students, listStatus, editing } = state;
  if (listStatus === "loading" && students.length === 0) return <p className="text-sm">Carregando...</p>;
  if (listStatus === "ready" && students.length === 0) return <p className="text-sm">Nenhum aluno por aqui ainda. Cadastre o primeiro no formulário acima.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {students.map((student) => (
        <li key={student.id} className="rounded border p-3">
          {editing?.id === student.id ? (
            <StudentForm state={state} busy={busy} submitLabel="Guardar" onChange={onChange} onSubmit={onSubmit} onCancel={onCancelEdit} />
          ) : (
            <StudentCard student={student} canEdit={!editing && listStatus !== "loading"} onEdit={onEdit} />
          )}
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
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Alunos</h1>
        <nav className="flex gap-4">
          <Link className="text-sm underline" href={afterSignInPath}>
            Notas
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
