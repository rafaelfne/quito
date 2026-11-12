import { ComputerGuide } from "@/app/(app)/notifications/guide/computer-guide";
import { ChromeMenuImage, InstallDialogImage, PermissionDialogImage, SiteSettingsImage } from "@/app/(app)/notifications/guide/guide-illustrations";
import { BlockedHelp, EnableButton, Step, TestStep, type TestActions } from "@/app/(app)/notifications/guide/guide-steps";
import { IphoneGuideSteps } from "@/app/(app)/notifications/guide/iphone-guide";
import { Button } from "@/components/ui/button";
import { androidGuideMessages as messages, guideMessages, iphoneGuideMessages, type InstallStatus, type TestStatus } from "@/lib/activation-guide";
import type { PushDevice, PushStatus } from "@/lib/push-subscription";

export type GuideActions = TestActions & { onInstall: () => void; onEnable: () => void; onRecheck: () => void };

export type GuideViewProps = GuideActions & { device: PushDevice | null; guideLink: string; install: InstallStatus; push: PushStatus; test: TestStatus; enabling: boolean };

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
        <p className="text-sm">{guideMessages.checking}</p>
      </Step>
    );
  }
  if (push === "blocked") {
    return (
      <Step number={2} title={title} done={false}>
        <BlockedHelp lines={messages.notifications.blocked} recheck={messages.notifications.recheck} image={<SiteSettingsImage />} onRecheck={onRecheck} />
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
      <EnableButton enabling={enabling} onEnable={onEnable} />
    </Step>
  );
}

function titleOf(device: PushDevice | null): string {
  if (device === "android") return messages.title;
  if (device === "iphone") return iphoneGuideMessages.title;
  return guideMessages.title;
}

export function GuideView({ device, guideLink, install, push, test, enabling, onInstall, onEnable, onRecheck, ...testActions }: GuideViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{titleOf(device)}</h1>
        {device === "android" ? <p className="text-sm">{messages.intro}</p> : null}
        {device === "iphone" ? <p className="text-sm">{iphoneGuideMessages.intro}</p> : null}
      </header>
      {device === null ? <p className="text-sm">{guideMessages.checking}</p> : null}
      {device === "computer" ? <ComputerGuide link={guideLink} /> : null}
      {device === "android" ? (
        <ol className="flex flex-col gap-4">
          <InstallStep install={install} onInstall={onInstall} />
          <NotificationsStep push={push} enabling={enabling} onEnable={onEnable} onRecheck={onRecheck} />
          <TestStep number={3} texts={messages.test} push={push} test={test} {...testActions} />
        </ol>
      ) : null}
      {device === "iphone" ? <IphoneGuideSteps installed={install === "installed"} push={push} test={test} enabling={enabling} onEnable={onEnable} onRecheck={onRecheck} {...testActions} /> : null}
    </main>
  );
}
