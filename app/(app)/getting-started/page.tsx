"use client";

import { useCallback, useEffect, useState } from "react";
import { GettingStartedView } from "@/app/(app)/getting-started/getting-started-view";
import { applyGettingStartedLoad, initialGettingStarted, openGettingStarted, saveBaselineDelay, startReloadingGettingStarted } from "@/lib/getting-started";
import { supabase } from "@/lib/supabase";

export default function GettingStartedPage() {
  const [state, setState] = useState(initialGettingStarted);
  const [baselineDelayDays, setBaselineDelayDays] = useState<number | null>(null);

  const load = useCallback(() => {
    void openGettingStarted(supabase).then((result) => {
      setState((current) => applyGettingStartedLoad(current, result));
      if (result.ok) setBaselineDelayDays(result.progress.baselineDelayDays);
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

  return <GettingStartedView state={state} onRetry={retry} baselineDelayDays={baselineDelayDays} onSaveBaselineDelay={saveBaseline} />;
}
