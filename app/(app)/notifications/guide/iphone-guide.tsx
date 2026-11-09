import { AddToHomeImage, HomeScreenImage, IphonePermissionImage, IphoneSettingsImage, SafariShareImage, ShareSheetImage } from "@/app/(app)/notifications/guide/guide-illustrations";
import { BlockedHelp, EnableButton, Step, TestStep, type TestActions } from "@/app/(app)/notifications/guide/guide-steps";
import { guideMessages, iphoneGuideMessages as messages, type TestStatus } from "@/lib/activation-guide";
import type { PushStatus } from "@/lib/push-subscription";

export type IphoneGuideProps = TestActions & { installed: boolean; push: PushStatus; test: TestStatus; enabling: boolean; onEnable: () => void; onRecheck: () => void };

function AddToHomeStep({ installed }: { installed: boolean }) {
  if (installed) {
    return (
      <Step number={1} title={messages.addToHome.title} done>
        <p className="text-sm">{messages.addToHome.installed}</p>
      </Step>
    );
  }
  const [share, option, confirm] = messages.addToHome.steps;
  return (
    <Step number={1} title={messages.addToHome.title} done={false}>
      <p className="text-sm">{messages.addToHome.safariOnly}</p>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li className="flex flex-col gap-2">
          {share}
          <SafariShareImage />
        </li>
        <li className="flex flex-col gap-2">
          {option}
          <ShareSheetImage />
        </li>
        <li className="flex flex-col gap-2">
          {confirm}
          <AddToHomeImage />
        </li>
      </ol>
    </Step>
  );
}

function OpenFromIconStep({ installed }: { installed: boolean }) {
  return (
    <Step number={2} title={messages.openFromIcon.title} done={installed}>
      {installed ? (
        <p className="text-sm">{messages.openFromIcon.installed}</p>
      ) : (
        <>
          <p className="text-sm">{messages.openFromIcon.text}</p>
          <HomeScreenImage />
        </>
      )}
    </Step>
  );
}

function SignInAgainStep({ installed }: { installed: boolean }) {
  return (
    <Step number={3} title={messages.signInAgain.title} done={installed}>
      {installed ? (
        <p className="text-sm">{messages.signInAgain.installed}</p>
      ) : (
        <>
          <p className="text-sm">{messages.signInAgain.text}</p>
          <p className="text-sm">{messages.signInAgain.next}</p>
        </>
      )}
    </Step>
  );
}

function NotificationsBody({ push, enabling, onEnable, onRecheck }: Pick<IphoneGuideProps, "push" | "enabling" | "onEnable" | "onRecheck">) {
  if (push === "active") return <p className="text-sm">{messages.notifications.active}</p>;
  if (push === "checking") return <p className="text-sm">{guideMessages.checking}</p>;
  if (push === "needs-install") return <p className="text-sm">{messages.notifications.needsInstall}</p>;
  if (push === "blocked") return <BlockedHelp lines={messages.notifications.blocked} recheck={messages.notifications.recheck} image={<IphoneSettingsImage />} onRecheck={onRecheck} />;
  if (push === "unsupported") {
    return (
      <>
        {messages.notifications.unsupported.map((line) => (
          <p className="text-sm" key={line}>
            {line}
          </p>
        ))}
      </>
    );
  }
  return (
    <>
      {push === "failed" ? (
        <p className="text-sm" role="alert">
          {messages.notifications.failed}
        </p>
      ) : null}
      <p className="text-sm">{messages.notifications.ask}</p>
      <IphonePermissionImage />
      <EnableButton enabling={enabling} onEnable={onEnable} />
    </>
  );
}

export function IphoneGuideSteps({ installed, push, test, enabling, onEnable, onRecheck, ...testActions }: IphoneGuideProps) {
  return (
    <ol className="flex flex-col gap-4">
      <AddToHomeStep installed={installed} />
      <OpenFromIconStep installed={installed} />
      <SignInAgainStep installed={installed} />
      <Step number={4} title={messages.notifications.title} done={push === "active"}>
        <NotificationsBody push={push} enabling={enabling} onEnable={onEnable} onRecheck={onRecheck} />
      </Step>
      <TestStep number={5} texts={messages.test} push={push} test={test} {...testActions} />
    </ol>
  );
}
