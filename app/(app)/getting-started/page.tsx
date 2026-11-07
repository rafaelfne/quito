"use client";

import { useCallback, useEffect, useState } from "react";
import { GettingStartedView } from "@/app/(app)/getting-started/getting-started-view";
import { loadFirstChargePreview, type FirstChargePreview } from "@/lib/first-charge-preview";
import { loadFirstChargeNotice, type FirstChargeNotice } from "@/lib/first-charge";
import { applyGettingStartedLoad, initialGettingStarted, openGettingStarted, saveBaselineDelay, startReloadingGettingStarted } from "@/lib/getting-started";
import { showsNotificationsInvite } from "@/lib/notifications-invite";
import { supabase } from "@/lib/supabase";

export default function GettingStartedPage() {
  const [state, setState] = useState(initialGettingStarted);
  const [baselineDelayDays, setBaselineDelayDays] = useState<number | null>(null);
  const [firstCharge, setFirstCharge] = useState<FirstChargeNotice | null>(null);
  const [firstChargePreview, setFirstChargePreview] = useState<FirstChargePreview | null>(null);

  const load = useCallback(() => {
    void openGettingStarted(supabase).then((result) => {
      setState((current) => applyGettingStartedLoad(current, result));
      if (!result.ok) return;
      setBaselineDelayDays(result.progress.baselineDelayDays);
      void loadFirstChargeNotice(supabase, result.progress.startedAt ?? null).then(setFirstCharge);
      void loadFirstChargePreview(supabase, result.progress.startedAt ?? null).then(setFirstChargePreview);
    });
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingGettingStarted);
    load();
  }

  async function saveBaseline(days: number) {
    if (!(await saveBaselineDelay(supabase, days))) return;
    setBaselineDelayDays(days);
    load();
  }

  return <GettingStartedView state={state} onRetry={retry} baselineDelayDays={baselineDelayDays} onSaveBaselineDelay={saveBaseline} firstCharge={firstCharge} firstChargePreview={firstChargePreview} notificationsInvite={showsNotificationsInvite(state)} />;
}
