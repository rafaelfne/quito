import Link from "next/link";
import { describeFirstChargeGuardian, describeFirstChargeTiming, describeFirstMonth, firstChargeMessages, firstChargeMissingMessage, firstChargeMissingPaths, type FirstChargeNotice } from "@/lib/first-charge";
import { currentStep, describeRemaining, gettingStartedMessages, remainingSteps, type GettingStartedState, type GettingStartedStep } from "@/lib/getting-started";
import { notificationsGuidePath, notificationsInviteMessages } from "@/lib/notifications-invite";
import { afterSignInPath } from "@/lib/session";

const primaryLinkClass = "flex min-h-11 items-center justify-center rounded-sm bg-foreground px-3 py-2 text-background";
const secondaryLinkClass = "flex min-h-11 items-center justify-center rounded-sm border px-3 py-2";
const secondaryButtonClass = "min-h-11 rounded-sm border px-3 py-2";

export function StepAction({ step, isCurrent, baselineDelayDays, onSaveBaselineDelay }: { step: GettingStartedStep; isCurrent: boolean; baselineDelayDays: number | null; onSaveBaselineDelay: (days: number) => void }) {
  if (step.done) return <p className="text-sm font-medium">Feito</p>;
  if (step.action === "baseline-delay") {
    return (
      <form action={(formData) => onSaveBaselineDelay(Number(formData.get("baseline-delay-days")))} className="flex flex-col gap-2">
        <label className="text-sm" htmlFor="baseline-delay-days">Dias de atraso</label>
        <input className="min-h-11 rounded-sm border px-3" id="baseline-delay-days" name="baseline-delay-days" type="number" min="0" max="365" step="1" required defaultValue={baselineDelayDays ?? ""} />
        <button className={isCurrent ? primaryLinkClass : secondaryButtonClass} type="submit">Salvar resposta</button>
      </form>
    );
  }
  return (
    <Link className={isCurrent ? primaryLinkClass : secondaryLinkClass} href={step.path}>
      {isCurrent ? "Continuar" : "Abrir"}
    </Link>
  );
}

function StepList({ steps, baselineDelayDays, onSaveBaselineDelay }: { steps: GettingStartedStep[]; baselineDelayDays: number | null; onSaveBaselineDelay: (days: number) => void }) {
  const current = currentStep(steps);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const isCurrent = step.id === current?.id;
        return (
          <li key={step.id} className="flex flex-col gap-2 rounded-sm border p-3" aria-current={isCurrent ? "step" : undefined}>
            <h2 className="font-medium">
              {index + 1}. {step.title}
            </h2>
            <p className="text-sm">{step.hint}</p>
            <StepAction step={step} isCurrent={isCurrent} baselineDelayDays={baselineDelayDays} onSaveBaselineDelay={onSaveBaselineDelay} />
          </li>
        );
      })}
    </ol>
  );
}

export function FirstChargeSection({ notice }: { notice: FirstChargeNotice }) {
  return (
    <section className="flex flex-col gap-2 rounded-sm border p-3" aria-labelledby="first-charge-title">
      <h2 className="font-medium" id="first-charge-title">
        {firstChargeMessages.title}
      </h2>
      <p className="text-sm">{describeFirstMonth(notice)}</p>
      {notice.missing === null ? (
        <>
          <p className="text-sm">{describeFirstChargeTiming(notice)}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {notice.guardians.map((guardian) => (
              <li key={guardian.phone}>{describeFirstChargeGuardian(guardian)}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm">
          <Link className="underline" href={firstChargeMissingPaths[notice.missing]}>
            {firstChargeMissingMessage(notice.missing)}
          </Link>
        </p>
      )}
    </section>
  );
}

export function NotificationsInvite() {
  return (
    <section className="flex flex-col gap-2 rounded-sm border p-3" aria-labelledby="notifications-invite-title">
      <h2 className="font-medium" id="notifications-invite-title">
        {notificationsInviteMessages.title}
      </h2>
      <p className="text-sm">{notificationsInviteMessages.text}</p>
      <Link className={primaryLinkClass} href={notificationsGuidePath}>
        {notificationsInviteMessages.action}
      </Link>
    </section>
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

export function GettingStartedView({ state, onRetry, baselineDelayDays = null, onSaveBaselineDelay = () => undefined, firstCharge = null, notificationsInvite = false }: { state: GettingStartedState; onRetry: () => void; baselineDelayDays?: number | null; onSaveBaselineDelay?: (days: number) => void; firstCharge?: FirstChargeNotice | null; notificationsInvite?: boolean }) {
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
          <StepList steps={state.steps} baselineDelayDays={baselineDelayDays} onSaveBaselineDelay={onSaveBaselineDelay} />
          {firstCharge ? <FirstChargeSection notice={firstCharge} /> : null}
          {notificationsInvite ? <NotificationsInvite /> : null}
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
