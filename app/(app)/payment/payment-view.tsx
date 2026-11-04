import Link from "next/link";
import { accountPath } from "@/lib/account";
import { closingPath } from "@/lib/closing";
import {
  describeGuardianDue,
  describeGuardianStudents,
  formatGuardianPhone,
  guardianDueDaysMessages,
  type GuardianDueDaysState,
  type GuardianDueGroup,
} from "@/lib/guardian-due-days";
import { lessonsPath } from "@/lib/lessons";
import { describeNextDue, paymentSettingsMessages, type PaymentSettingsField, type PaymentSettingsState } from "@/lib/payment-settings";
import { studentsPath } from "@/lib/students";
import { teacherRulesPath } from "@/lib/teacher-rules";

const inputClass = "min-h-11 rounded border bg-background px-3 py-3 text-base text-foreground";
const primaryButtonClass = "min-h-11 flex-1 rounded bg-foreground px-3 py-2 text-background disabled:opacity-50";
const secondaryButtonClass = "min-h-11 rounded border px-3 py-2 disabled:opacity-50";

type FormHandlers = {
  onChange: (field: PaymentSettingsField, value: string) => void;
  onSubmit: () => void;
};

type GuardianDueHandlers = {
  onGuardianDueChange: (phone: string, dueDay: string) => void;
  onGuardianDueSubmit: (phone: string) => void;
  onGuardianDueRetry: () => void;
};

type PaymentSettingsViewProps = FormHandlers &
  GuardianDueHandlers & {
    state: PaymentSettingsState;
    guardianDueDays: GuardianDueDaysState;
    busy: boolean;
    busyPhone: string | null;
    today: string;
    onRetry: () => void;
  };

type TextFieldConfig = {
  field: PaymentSettingsField;
  id: string;
  label: string;
  inputMode: "text" | "numeric";
  hint: string;
};

const pixKeyField: TextFieldConfig = {
  field: "pixKey",
  id: "payment-pix-key",
  label: "Sua chave Pix",
  inputMode: "text",
  hint: "Pode ser CPF, CNPJ, celular, e-mail ou chave aleatória. O pagamento cai direto na sua conta.",
};

const displayNameField: TextFieldConfig = {
  field: "displayName",
  id: "payment-display-name",
  label: "Nome que aparece para o responsável",
  inputMode: "text",
  hint: "Vai logo abaixo da chave Pix, para o responsável conferir quem recebe.",
};

const dueDayField: TextFieldConfig = {
  field: "dueDay",
  id: "payment-due-day",
  label: "Dia de vencimento padrão",
  inputMode: "numeric",
  hint: "Vale para todos, até você trocar o dia de um responsável. Em mês mais curto que esse dia, o vencimento cai no último dia do mês.",
};

function TextField({ config, state, onChange }: { config: TextFieldConfig; state: PaymentSettingsState; onChange: FormHandlers["onChange"] }) {
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

function PaymentSettingsForm({ state, busy, today, onChange, onSubmit }: FormHandlers & { state: PaymentSettingsState; busy: boolean; today: string }) {
  const nextDue = describeNextDue(today, state.draft.dueDay);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="flex flex-col gap-4" disabled={busy || state.status === "loading"}>
        <TextField config={pixKeyField} state={state} onChange={onChange} />
        <TextField config={displayNameField} state={state} onChange={onChange} />
        <TextField config={dueDayField} state={state} onChange={onChange} />
        {nextDue ? <p className="text-sm">{nextDue}</p> : null}
        {state.message ? (
          <p className="text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <button className={primaryButtonClass} type="submit">
          {busy ? "Guardando..." : "Guardar dados"}
        </button>
      </fieldset>
    </form>
  );
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" role="alert">
        {message}
      </p>
      <button className={secondaryButtonClass} type="button" onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  );
}

function GuardianDueForm({
  group,
  state,
  busy,
  today,
  onChange,
  onSubmit,
}: {
  group: GuardianDueGroup;
  state: GuardianDueDaysState;
  busy: boolean;
  today: string;
  onChange: GuardianDueHandlers["onGuardianDueChange"];
  onSubmit: GuardianDueHandlers["onGuardianDueSubmit"];
}) {
  const id = `guardian-due-${group.phone}`;
  const error = state.errors[group.phone];
  const notice = state.notices[group.phone];
  const message = state.messages[group.phone];
  const nextDue = describeGuardianDue(today, group.dueDay, state.defaultDueDay);
  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(group.phone);
      }}
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">{group.guardianName}</p>
        <p className="text-sm">{formatGuardianPhone(group.phone)}</p>
        <p className="text-sm opacity-70">{describeGuardianStudents(group.studentNames)}</p>
      </div>
      <fieldset className="flex flex-col gap-3" disabled={busy}>
        <label className="flex flex-col gap-1 text-sm">
          Dia de vencimento
          <span className="opacity-70">Deixe em branco para usar o dia padrão ({state.defaultDueDay}). Vale para todos os irmãos deste responsável.</span>
          <input
            className={inputClass}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            value={group.dueDay}
            onChange={(event) => onChange(group.phone, event.target.value)}
          />
          {error ? (
            <span id={`${id}-error`} role="alert">
              {error}
            </span>
          ) : null}
        </label>
        {nextDue ? <p className="text-sm">{nextDue}</p> : null}
        {notice ? (
          <p className="text-sm" role="status">
            {notice}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm" role="alert">
            {message}
          </p>
        ) : null}
        <button className={primaryButtonClass} type="submit">
          {busy ? "Guardando..." : "Guardar vencimento"}
        </button>
      </fieldset>
    </form>
  );
}

function GuardianDueDaysSection({
  state,
  busyPhone,
  today,
  onGuardianDueChange,
  onGuardianDueSubmit,
  onGuardianDueRetry,
}: {
  state: GuardianDueDaysState;
  busyPhone: string | null;
  today: string;
} & GuardianDueHandlers) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold">Vencimento por responsável</h2>
      <p className="text-sm">Se um responsável paga em outro dia, troque só o dele. O dia vale para todos os irmãos.</p>
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? <LoadFailure message={guardianDueDaysMessages.loadFailed} onRetry={onGuardianDueRetry} /> : null}
      {state.status === "ready" && state.groups.length === 0 ? <p className="text-sm">{guardianDueDaysMessages.empty}</p> : null}
      {state.status === "ready" ? (
        <ul className="flex flex-col gap-4">
          {state.groups.map((group) => (
            <li key={group.phone}>
              <GuardianDueForm
                group={group}
                state={state}
                busy={busyPhone === group.phone}
                today={today}
                onChange={onGuardianDueChange}
                onSubmit={onGuardianDueSubmit}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PaymentSettingsView({
  state,
  guardianDueDays,
  busy,
  busyPhone,
  today,
  onChange,
  onSubmit,
  onRetry,
  onGuardianDueChange,
  onGuardianDueSubmit,
  onGuardianDueRetry,
}: PaymentSettingsViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Recebimento</h1>
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
          <Link className="text-sm underline" href={teacherRulesPath}>
            Regras
          </Link>
          <Link className="text-sm underline" href={accountPath}>
            Conta
          </Link>
        </nav>
      </header>
      <p className="text-sm">Estes dados entram na cobrança de todos os responsáveis.</p>
      {state.notice ? (
        <p className="text-sm" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? (
        <LoadFailure message={paymentSettingsMessages.loadFailed} onRetry={onRetry} />
      ) : (
        <PaymentSettingsForm state={state} busy={busy} today={today} onChange={onChange} onSubmit={onSubmit} />
      )}
      <GuardianDueDaysSection
        state={guardianDueDays}
        busyPhone={busyPhone}
        today={today}
        onGuardianDueChange={onGuardianDueChange}
        onGuardianDueSubmit={onGuardianDueSubmit}
        onGuardianDueRetry={onGuardianDueRetry}
      />
    </main>
  );
}
