"use client";

import { useCallback, useEffect, useState } from "react";
import { GettingStartedView } from "@/app/(app)/getting-started/getting-started-view";
import { applyGettingStartedLoad, initialGettingStarted, openGettingStarted, startReloadingGettingStarted } from "@/lib/getting-started";
import { supabase } from "@/lib/supabase";

export default function GettingStartedPage() {
  const [state, setState] = useState(initialGettingStarted);

  const load = useCallback(() => {
    void openGettingStarted(supabase).then((result) => setState((current) => applyGettingStartedLoad(current, result)));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingGettingStarted);
    load();
  }

  return <GettingStartedView state={state} onRetry={retry} />;
}
