import Link from "next/link";
import type { ReactNode } from "react";
import { ChromeMenuImage, InstallDialogImage, PermissionDialogImage, SiteSettingsImage, TestNotificationImage } from "@/app/(app)/notifications/guide/guide-illustrations";
import { Button } from "@/components/ui/button";
import { accountPath } from "@/lib/account";
import { androidGuideMessages as messages, canSendTest, type InstallStatus, type TestStatus } from "@/lib/activation-guide";
import { chargesPath } from "@/lib/charges";
import type { PushDevice, PushStatus } from "@/lib/push-subscription";

export type GuideActions = { onInstall: () => void; onEnable: () => void; onRecheck: () => void; onSendTest: () => void; onArrived: () => void; onNotArrived: () => void };

export type GuideViewProps = GuideActions & { device: PushDevice | null; install: InstallStatus; push: PushStatus; test: TestStatus; enabling: boolean };

function Step({ number, title, done, children }: { number: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-sm border border-border p-4">
      <h2 className="font-semibold">
        {number}. {title}
      </h2>
      {done ? <p className="text-sm font-medium">{messages.done}</p> : null}
      {children}
    </li>
  );
}

function InstallStep({ install, onInstall }: { install: InstallStatus; onInstall: () => void }) {
  if (install === "installed") {
    return (
      <Step number={1} title={messages.install.title} done>
        <p className="text-sm">{messages.install.installed}</p>
      </Step>
    );
  }
  if (install === "can-prompt") {
    return (
      <Step number={1} title={messages.install.title} done={false}>
        <p className="text-sm">{messages.install.prompt}</p>
        <InstallDialogImage />
        <Button type="button" onClick={onInstall}>
          {messages.install.action}
        </Button>
        <p className="text-sm">{messages.install.already}</p>
      </Step>
    );
  }
  const [menu, option, confirm] = messages.install.manual;
  return (
    <Step number={1} title={messages.install.title} done={false}>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>{menu}</li>
        <li className="flex flex-col gap-2">
          {option}
          <ChromeMenuImage />
        </li>
        <li className="flex flex-col gap-2">
          {confirm}
          <InstallDialogImage />
        </li>
      </ol>
      <p className="text-sm">{messages.install.already}</p>
    </Step>
  );
}

function BlockedHelp({ onRecheck }: { onRecheck: () => void }) {
  const [intro, ...steps] = messages.notifications.blocked;
  return (
    <>
      <p className="text-sm" role="alert">
        {intro}
      </p>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <SiteSettingsImage />
      <Button type="button" variant="outline" onClick={onRecheck}>
        {messages.notifications.recheck}
      </Button>
    </>
  );
}

function NotificationsStep({ push, enabling, onEnable, onRecheck }: { push: PushStatus; enabling: boolean; onEnable: () => void; onRecheck: () => void }) {
  const title = messages.notifications.title;
  if (push === "active") {
    return (
      <Step number={2} title={title} done>
        <p className="text-sm">{messages.notifications.active}</p>
      </Step>
    );
  }
  if (push === "checking") {
    return (
      <Step number={2} title={title} done={false}>
        <p className="text-sm">{messages.checking}</p>
      </Step>
    );
  }
  if (push === "blocked") {
    return (
      <Step number={2} title={title} done={false}>
        <BlockedHelp onRecheck={onRecheck} />
      </Step>
    );
  }
  if (push === "unsupported" || push === "needs-install") {
    return (
      <Step number={2} title={title} done={false}>
        <p className="text-sm">{messages.notifications.unsupported}</p>
      </Step>
    );
  }
  return (
    <Step number={2} title={title} done={false}>
      {push === "failed" ? (
        <p className="text-sm" role="alert">
          {messages.notifications.failed}
        </p>
      ) : null}
      <p className="text-sm">{messages.notifications.ask}</p>
      <PermissionDialogImage />
      <Button type="button" disabled={enabling} onClick={onEnable}>
        {enabling ? "Ativando..." : "Ativar as notificações"}
      </Button>
    </Step>
  );
}

function TestResult({ test, onSendTest, onArrived, onNotArrived }: { test: TestStatus } & Pick<GuideActions, "onSendTest" | "onArrived" | "onNotArrived">) {
  if (test === "sent") {
    return (
      <>
        <p className="text-sm" role="status">
          {messages.test.sent}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={onArrived}>
            {messages.test.arrivedAction}
          </Button>
          <Button type="button" variant="outline" onClick={onNotArrived}>
            {messages.test.notArrivedAction}
          </Button>
        </div>
      </>
    );
  }
  if (test === "not-arrived") {
    const [intro, ...tips] = messages.test.notArrived;
    return (
      <>
        <p className="text-sm">{intro}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <Button type="button" onClick={onSendTest}>
          {messages.test.again}
        </Button>
      </>
    );
  }
  return (
    <>
      {test === "failed" ? (
        <p className="text-sm" role="alert">
          {messages.test.failed}
        </p>
      ) : null}
      <Button type="button" disabled={test === "sending"} onClick={onSendTest}>
        {test === "sending" ? messages.test.sending : messages.test.action}
      </Button>
    </>
  );
}

function TestStep({ push, test, ...actions }: { push: PushStatus; test: TestStatus } & Pick<GuideActions, "onSendTest" | "onArrived" | "onNotArrived">) {
  if (test === "arrived") {
    return (
      <Step number={3} title={messages.test.title} done>
        <p className="text-sm" role="status">
          {messages.test.arrived}
        </p>
        <Link className="flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={chargesPath}>
          {messages.test.toCharges}
        </Link>
      </Step>
    );
  }
  return (
    <Step number={3} title={messages.test.title} done={false}>
      <TestNotificationImage />
      {test === "gone" ? (
        <p className="text-sm" role="alert">
          {messages.test.gone}
        </p>
      ) : null}
      {canSendTest(push) ? <TestResult test={test} {...actions} /> : <p className="text-sm">{messages.test.waiting}</p>}
    </Step>
  );
}

export function GuideView({ device, install, push, test, enabling, onInstall, onEnable, onRecheck, ...testActions }: GuideViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        {device === "android" ? <p className="text-sm">{messages.intro}</p> : null}
      </header>
      {device === null ? <p className="text-sm">{messages.checking}</p> : null}
      {device !== null && device !== "android" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{messages.otherDevice}</p>
          <Link className="text-sm underline" href={accountPath}>
            Sua conta
          </Link>
        </div>
      ) : null}
      {device === "android" ? (
        <ol className="flex flex-col gap-4">
          <InstallStep install={install} onInstall={onInstall} />
          <NotificationsStep push={push} enabling={enabling} onEnable={onEnable} onRecheck={onRecheck} />
          <TestStep push={push} test={test} {...testActions} />
        </ol>
      ) : null}
    </main>
  );
}
