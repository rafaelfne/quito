"use client";

import { useCallback, useEffect, useState } from "react";
import { ChargesView } from "@/app/(app)/charges/charges-view";
import { applyChargesLoad, applyPreviewConfirmation, applySendSaved, endedMonthOf, initialCharges, startConfirmingPreview, startReloadingCharges, startSavingSend, syncChargesWithMessages } from "@/lib/charges";
import { saveChargeSentAt } from "@/lib/charge-sending";
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

  function saveSent(chargeId: string, sentAt: string | null) {
    setState((current) => startSavingSend(current, chargeId));
    void saveChargeSentAt(supabase, chargeId, sentAt).then((saved) => setState((current) => applySendSaved(current, chargeId, sentAt, saved)));
  }

  return <ChargesView state={state} onRetry={retry} onConfirmPreview={confirmPreview} onSend={(chargeId) => saveSent(chargeId, new Date().toISOString())} onUndoSend={(chargeId) => saveSent(chargeId, null)} />;
}
