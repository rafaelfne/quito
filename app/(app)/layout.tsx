import { Suspense, type ReactNode } from "react";
import { SessionGate } from "@/app/(app)/session-gate";

export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGate>
      <Suspense>{children}</Suspense>
    </SessionGate>
  );
}
