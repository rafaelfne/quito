"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SessionGateView, type GateStatus } from "@/app/(app)/session-gate-view";
import { guardPage, signInBasePath, watchSignOut } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<GateStatus>("checking");

  const verify = useCallback(() => {
    const { pathname, search, hash } = window.location;
    void guardPage(supabase.auth, `${pathname}${search}${hash}`, router.replace).then(setStatus);
  }, [router]);

  useEffect(() => {
    verify();
    return watchSignOut(supabase.auth, () => {
      setStatus("signed-out");
      router.replace(signInBasePath);
    });
  }, [router, verify]);

  function retry() {
    setStatus("checking");
    verify();
  }

  return (
    <SessionGateView status={status} onRetry={retry}>
      {children}
    </SessionGateView>
  );
}
