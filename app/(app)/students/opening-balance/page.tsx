"use client";

import { useCallback, useEffect, useState } from "react";
import { OpeningBalanceView } from "@/app/(app)/students/opening-balance/opening-balance-view";
import { dateKeyOf } from "@/lib/lessons";
import { applyOpeningLoad, changeOpeningDraft, initialOpeningBalance, loadOpeningBalance, startReloadingOpening, submitOpeningBalance, type OpeningDraft } from "@/lib/opening-balance";
import { supabase } from "@/lib/supabase";

export default function OpeningBalancePage() {
  const [state, setState] = useState(initialOpeningBalance);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void loadOpeningBalance(supabase).then((result) => setState((current) => applyOpeningLoad(current, result)));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingOpening);
    load();
  }

  function confirm() {
    setBusy(true);
    void submitOpeningBalance(supabase, state).then((next) => {
      setState(next);
      setBusy(false);
    });
  }

  return (
    <OpeningBalanceView
      state={state}
      today={dateKeyOf(new Date())}
      busy={busy}
      onChange={(id: string, field: keyof OpeningDraft, value: string) => setState((current) => changeOpeningDraft(current, id, field, value))}
      onConfirm={confirm}
      onRetry={retry}
    />
  );
}
