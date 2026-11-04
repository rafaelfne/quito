import Link from "next/link";
import { currentStep, describeRemaining, gettingStartedMessages, remainingSteps, type GettingStartedState, type GettingStartedStep } from "@/lib/getting-started";
import { afterSignInPath } from "@/lib/session";

const primaryLinkClass = "flex min-h-11 items-center justify-center rounded bg-foreground px-3 py-2 text-background";
const secondaryLinkClass = "flex min-h-11 items-center justify-center rounded border px-3 py-2";
const secondaryButtonClass = "min-h-11 rounded border px-3 py-2";

function StepAction({ step, isCurrent }: { step: GettingStartedStep; isCurrent: boolean }) {
  if (step.done) return <p className="text-sm font-medium">Feito</p>;
  return (
    <Link className={isCurrent ? primaryLinkClass : secondaryLinkClass} href={step.path}>
      {isCurrent ? "Continuar" : "Abrir"}
    </Link>
  );
}

function StepList({ steps }: { steps: GettingStartedStep[] }) {
  const current = currentStep(steps);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const isCurrent = step.id === current?.id;
        return (
          <li key={step.id} className="flex flex-col gap-2 rounded border p-3" aria-current={isCurrent ? "step" : undefined}>
            <h2 className="font-medium">
              {index + 1}. {step.title}
            </h2>
            <p className="text-sm">{step.hint}</p>
            <StepAction step={step} isCurrent={isCurrent} />
          </li>
        );
      })}
    </ol>
  );
}

function Progress({ steps }: { steps: GettingStartedStep[] }) {
  const remaining = remainingSteps(steps);
  if (remaining === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm" role="status">
          {gettingStartedMessages.finished}
        </p>
        <Link className={primaryLinkClass} href={afterSignInPath}>
          Ir para o início
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium" role="status">
        {describeRemaining(steps)}
      </p>
      <progress className="w-full" aria-label="Passos feitos" value={steps.length - remaining} max={steps.length} />
    </div>
  );
}

export function GettingStartedView({ state, onRetry }: { state: GettingStartedState; onRetry: () => void }) {
  const unfinished = state.status === "ready" && remainingSteps(state.steps) > 0;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Primeiros passos</h1>
        <p className="text-sm">{gettingStartedMessages.intro}</p>
      </header>
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm" role="alert">
            {gettingStartedMessages.loadFailed}
          </p>
          <button className={secondaryButtonClass} type="button" onClick={onRetry}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <>
          <Progress steps={state.steps} />
          <StepList steps={state.steps} />
        </>
      ) : null}
      {state.status !== "ready" || unfinished ? (
        <footer className="flex flex-col gap-1 text-sm">
          <p>{gettingStartedMessages.leaveHint}</p>
          <Link className="underline" href={afterSignInPath}>
            Continuar depois
          </Link>
        </footer>
      ) : null}
    </main>
  );
}
