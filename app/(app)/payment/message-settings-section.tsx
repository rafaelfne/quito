import { messageAdjustmentsFrom, messageSettingsMessages, type MessageSettingsDraft, type MessageSettingsState } from "@/lib/message-settings";
import { defaultGreeting, defaultSignature, defaultThanks, exampleMessage, exampleMessageParts, messageTones, quitoFooter, type MessageAdjustments } from "@/lib/message-templates";
import { describeReminderName, exampleReminder, reminderCountLimit, reminderDayLimit, resizeReminderDrafts } from "@/lib/reminders";

const inputClass = "min-h-11 rounded-sm border bg-background px-3 py-3 text-base text-foreground";
const primaryButtonClass = "min-h-11 flex-1 rounded-sm bg-foreground px-3 py-2 text-background disabled:opacity-50";
const secondaryButtonClass = "min-h-11 rounded-sm border px-3 py-2 disabled:opacity-50";

export type MessageSettingsHandlers = {
  onMessageChange: (changes: Partial<MessageSettingsDraft>) => void;
  onMessageSubmit: () => void;
  onMessageRetry: () => void;
};

type MessageSettingsSectionProps = MessageSettingsHandlers & {
  state: MessageSettingsState;
  busy: boolean;
  teacher: { pixKey: string; displayName: string };
};

function ToneOptions({ state, onMessageChange }: Pick<MessageSettingsSectionProps, "state" | "onMessageChange">) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm">Tom da mensagem</legend>
      {messageTones.map((tone) => (
        <label className="flex min-h-11 items-center gap-3 rounded-sm border px-3 py-2 text-sm" key={tone.id}>
          <input type="radio" name="message-tone" checked={state.draft.tone === tone.id} onChange={() => onMessageChange({ tone: tone.id })} />
          <span className="flex flex-col">
            <span className="font-medium">{tone.label}</span>
            <span className="opacity-70">{tone.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function AdjustmentField({
  id,
  label,
  hint,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <span className="opacity-70">{hint}</span>
      <input
        className={inputClass}
        type="text"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function MessageLine({ line }: { line: string }) {
  return (
    <>
      {line.split(/(\*[^*]+\*)/).map((piece, index) =>
        piece.startsWith("*") && piece.endsWith("*") && piece.length > 1 ? <strong key={index}>{piece.slice(1, -1)}</strong> : <span key={index}>{piece}</span>,
      )}
    </>
  );
}

function MessageText({ text }: { text: string }) {
  return (
    <div className="rounded-sm border p-3 text-sm">
      {text.split("\n").map((line, index) => (
        <p className="min-h-5 break-words" key={index}>
          <MessageLine line={line} />
        </p>
      ))}
    </div>
  );
}

function MessageExample({ text }: { text: string }) {
  return (
    <section className="flex flex-col gap-2" aria-label="Exemplo da mensagem">
      <p className="text-sm opacity-70">
        Exemplo com a conta de {exampleMessageParts.guardianName}, mãe {exampleMessageParts.studentsWithArticles}. Os dados de cada responsável entram sozinhos.
      </p>
      <MessageText text={text} />
    </section>
  );
}

const reminderCountOptions = Array.from({ length: reminderCountLimit + 1 }, (_, count) => count);

function describeReminderCount(count: number): string {
  if (count === 0) return "Nenhum lembrete";
  return count === 1 ? "1 lembrete" : `${count} lembretes`;
}

function ReminderSettings({
  state,
  adjustments,
  teacher,
  onMessageChange,
}: Pick<MessageSettingsSectionProps, "state" | "teacher" | "onMessageChange"> & { adjustments: MessageAdjustments }) {
  const drafts = state.draft.reminderDays;
  const error = state.errors.reminderDays;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-medium">Lembretes</legend>
      <p className="text-sm opacity-70">Se a cobrança enviada não for marcada como paga, o lembrete aparece no painel no dia, pronto para o WhatsApp. Os dias contam a partir do envio da cobrança.</p>
      <label className="flex flex-col gap-1 text-sm">
        Quantos lembretes no máximo
        <select className={inputClass} value={drafts.length} onChange={(event) => onMessageChange({ reminderDays: resizeReminderDrafts(drafts, Number(event.target.value)) })}>
          {reminderCountOptions.map((count) => (
            <option key={count} value={count}>
              {describeReminderCount(count)}
            </option>
          ))}
        </select>
      </label>
      {drafts.map((draft, index) => (
        <div className="flex flex-col gap-2" key={index}>
          <label className="flex flex-col gap-1 text-sm">
            {`${describeReminderName(index, drafts.length)}: quantos dias depois do envio`}
            <input
              className={inputClass}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "reminder-days-error" : undefined}
              value={draft}
              onChange={(event) => onMessageChange({ reminderDays: drafts.map((one, position) => (position === index ? event.target.value : one)) })}
            />
          </label>
          <section className="flex flex-col gap-2" aria-label={`Exemplo do ${describeReminderName(index, drafts.length)}`}>
            <MessageText text={exampleReminder(adjustments, teacher, index)} />
          </section>
        </div>
      ))}
      {error ? (
        <span className="text-sm" id="reminder-days-error" role="alert">
          {error}
        </span>
      ) : null}
      <p className="text-sm opacity-70">{`Até ${reminderCountLimit} lembretes, de 1 a ${reminderDayLimit} dias.`}</p>
    </fieldset>
  );
}

export function MessageSettingsSection({ state, busy, teacher, onMessageChange, onMessageSubmit, onMessageRetry }: MessageSettingsSectionProps) {
  const adjustments = messageAdjustmentsFrom(state.draft);
  const greeting = defaultGreeting(state.draft.tone);
  const thanks = defaultThanks(state.draft.tone);
  const signature = defaultSignature(state.draft.tone, teacher.displayName.trim() || exampleMessageParts.receiverName);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold">Mensagem de cobrança</h2>
      <p className="text-sm">Escolha o tom e ajuste a saudação, o agradecimento, a assinatura, a linha do fim e os lembretes. Vale para todos os responsáveis.</p>
      {state.notice ? (
        <p className="text-sm" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm" role="alert">
            {messageSettingsMessages.loadFailed}
          </p>
          <button className={secondaryButtonClass} type="button" onClick={onMessageRetry}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onMessageSubmit();
          }}
        >
          <fieldset className="flex flex-col gap-4" disabled={busy}>
            <ToneOptions state={state} onMessageChange={onMessageChange} />
            <AdjustmentField
              id="message-greeting"
              label="Saudação"
              hint={`O que vem antes do nome do responsável, que entra sozinho. Em branco, fica "${greeting}".`}
              value={state.draft.greeting}
              error={state.errors.greeting}
              onChange={(value) => onMessageChange({ greeting: value })}
            />
            <AdjustmentField
              id="message-thanks"
              label="Agradecimento"
              hint={`O que vem antes da assinatura. Em branco, fica "${thanks}".`}
              value={state.draft.thanks}
              error={state.errors.thanks}
              onChange={(value) => onMessageChange({ thanks: value })}
            />
            <AdjustmentField
              id="message-signature"
              label="Assinatura"
              hint={`Como você assina no fim da mensagem. Em branco, fica "${signature}".`}
              value={state.draft.signature}
              error={state.errors.signature}
              onChange={(value) => onMessageChange({ signature: value })}
            />
            <label className="flex min-h-11 items-center gap-3 rounded-sm border px-3 py-2 text-sm">
              <input type="checkbox" checked={state.draft.footer} onChange={(event) => onMessageChange({ footer: event.target.checked })} />
              <span className="flex flex-col">
                <span className="font-medium">Terminar com &quot;{quitoFooter}&quot;</span>
                <span className="opacity-70">Mostra aos pais que o valor veio de um sistema.</span>
              </span>
            </label>
            <MessageExample text={exampleMessage(adjustments, teacher)} />
            <ReminderSettings state={state} adjustments={adjustments} teacher={teacher} onMessageChange={onMessageChange} />
            {state.message ? (
              <p className="text-sm" role="alert">
                {state.message}
              </p>
            ) : null}
            <button className={primaryButtonClass} type="submit">
              {busy ? "Guardando..." : "Guardar mensagem"}
            </button>
          </fieldset>
        </form>
      ) : null}
    </section>
  );
}
