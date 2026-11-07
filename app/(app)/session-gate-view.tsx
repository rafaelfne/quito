import type { ReactNode } from "react";
import { OpeningScreen } from "@/app/opening-screen";
import { Button } from "@/components/ui/button";
import { sessionMessages, type SessionStatus } from "@/lib/session";

export type GateStatus = SessionStatus | "checking";

export function SessionGateView({ status, onRetry, children }: { status: GateStatus; onRetry: () => void; children: ReactNode }) {
  if (status === "signed-in") return <>{children}</>;
  if (status !== "unreachable") return <OpeningScreen />;
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="text-sm" role="alert">
          {sessionMessages.unreachable}
        </p>
        <Button type="button" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    </main>
  );
}
