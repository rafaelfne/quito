import Link from "next/link";
import { currentStep, describeRemaining, gettingStartedMessages, gettingStartedPath, type GettingStartedReminder } from "@/lib/getting-started";

const frameClass = "mx-auto w-full max-w-xl px-4 pt-4 sm:px-8";

export function GettingStartedReminderView({ reminder }: { reminder: GettingStartedReminder }) {
  if (reminder.kind === "back") {
    return (
      <aside className={frameClass}>
        <Link className="text-sm underline" href={gettingStartedPath}>
          Voltar aos primeiros passos
        </Link>
      </aside>
    );
  }
  if (reminder.kind !== "progress") return null;
  const next = currentStep(reminder.steps);
  return (
    <aside className={frameClass}>
      <div className="flex flex-col gap-2 rounded-sm border p-3 text-sm" aria-label="Primeiros passos">
        <p className="font-medium">{next ? `Primeiros passos: ${describeRemaining(reminder.steps)}` : gettingStartedMessages.allDoneReminder}</p>
        {next ? <p>Próximo passo: {next.title}.</p> : null}
        <Link className="flex min-h-11 items-center justify-center rounded-sm bg-foreground px-3 py-2 text-background" href={gettingStartedPath}>
          {next ? "Continuar" : "Ver"}
        </Link>
      </div>
    </aside>
  );
}
