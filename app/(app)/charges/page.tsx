"use client";

import { useCallback, useEffect, useState } from "react";
import { ChargesView } from "@/app/(app)/charges/charges-view";
import { applyChargesLoad, endedMonthOf, initialCharges, startReloadingCharges, syncChargesWithMessages } from "@/lib/charges";
import { dateKeyOf } from "@/lib/lessons";
import { supabase } from "@/lib/supabase";

export default function ChargesPage() {
  const [state, setState] = useState(initialCharges(endedMonthOf(new Date())));
  const { month } = state;

  const load = useCallback(() => {
    void syncChargesWithMessages(supabase, month, dateKeyOf(new Date())).then((result) => setState((current) => applyChargesLoad(current, result)));
  }, [month]);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingCharges);
    load();
  }

  return <ChargesView state={state} onRetry={retry} />;
}
