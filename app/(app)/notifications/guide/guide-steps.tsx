import Link from "next/link";
import type { ReactNode } from "react";
import { TestNotificationImage } from "@/app/(app)/notifications/guide/guide-illustrations";
import { Button } from "@/components/ui/button";
import { canSendTest, guideMessages, type GuideTestMessages, type TestStatus } from "@/lib/activation-guide";
import { chargesPath } from "@/lib/charges";
import type { PushStatus } from "@/lib/push-subscription";

export type TestActions = { onSendTest: () => void; onArrived: () => void; onNotArrived: () => void };

export function Step({ number, title, done, children }: { number: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-sm border border-border p-4">
      <h2 className="font-semibold">
        {number}. {title}
      </h2>
      {done ? <p className="text-sm font-medium">{guideMessages.done}</p> : null}
      {children}
    </li>
  );
}

export function BlockedHelp({ lines, recheck, image, onRecheck }: { lines: string[]; recheck: string; image: ReactNode; onRecheck: () => void }) {
  const [intro, ...steps] = lines;
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
      {image}
      <Button type="button" variant="outline" onClick={onRecheck}>
        {recheck}
      </Button>
    </>
  );
}

export function EnableButton({ enabling, onEnable }: { enabling: boolean; onEnable: () => void }) {
  return (
    <Button type="button" disabled={enabling} onClick={onEnable}>
      {enabling ? guideMessages.enabling : guideMessages.enable}
    </Button>
  );
}

function TestResult({ texts, test, onSendTest, onArrived, onNotArrived }: { texts: GuideTestMessages; test: TestStatus } & TestActions) {
  if (test === "sent") {
    return (
      <>
        <p className="text-sm" role="status">
          {texts.sent}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={onArrived}>
            {texts.arrivedAction}
          </Button>
          <Button type="button" variant="outline" onClick={onNotArrived}>
            {texts.notArrivedAction}
          </Button>
        </div>
      </>
    );
  }
  if (test === "not-arrived") {
    const [intro, ...tips] = texts.notArrived;
    return (
      <>
        <p className="text-sm">{intro}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <Button type="button" onClick={onSendTest}>
          {texts.again}
        </Button>
      </>
    );
  }
  return (
    <>
      {test === "failed" ? (
        <p className="text-sm" role="alert">
          {texts.failed}
        </p>
      ) : null}
      <Button type="button" disabled={test === "sending"} onClick={onSendTest}>
        {test === "sending" ? texts.sending : texts.action}
      </Button>
    </>
  );
}

export function TestStep({ number, texts, push, test, ...actions }: { number: number; texts: GuideTestMessages; push: PushStatus; test: TestStatus } & TestActions) {
  if (test === "arrived") {
    return (
      <Step number={number} title={texts.title} done>
        <p className="text-sm" role="status">
          {texts.arrived}
        </p>
        <Link className="flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href={chargesPath}>
          {texts.toCharges}
        </Link>
      </Step>
    );
  }
  return (
    <Step number={number} title={texts.title} done={false}>
      <TestNotificationImage />
      {test === "gone" ? (
        <p className="text-sm" role="alert">
          {texts.gone}
        </p>
      ) : null}
      {canSendTest(push) ? <TestResult texts={texts} test={test} {...actions} /> : <p className="text-sm">{texts.waiting}</p>}
    </Step>
  );
}
