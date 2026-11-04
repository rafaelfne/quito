import type { ReactNode } from "react";
import { GettingStartedReminder } from "@/app/(app)/getting-started/reminder";
import { SessionGate } from "@/app/(app)/session-gate";

export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGate>
      <GettingStartedReminder />
      {children}
    </SessionGate>
  );
}
