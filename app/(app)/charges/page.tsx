"use client";

import { useCallback, useEffect, useState } from "react";
import { ChargesView } from "@/app/(app)/charges/charges-view";
import { applyChargesLoad, applyPreviewConfirmation, endedMonthOf, initialCharges, startConfirmingPreview, startReloadingCharges, syncChargesWithMessages } from "@/lib/charges";
import { confirmMessagePreview } from "@/lib/message-preview";
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

  function confirmPreview() {
    setState(startConfirmingPreview);
    void confirmMessagePreview(supabase).then((saved) => setState((current) => applyPreviewConfirmation(current, saved)));
  }

  return <ChargesView state={state} onRetry={retry} onConfirmPreview={confirmPreview} />;
}
