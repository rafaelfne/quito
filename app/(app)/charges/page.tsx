"use client";

import { useCallback, useEffect, useState } from "react";
import { ChargesView } from "@/app/(app)/charges/charges-view";
import { applyChargesLoad, applyPaidSaved, applyPreviewConfirmation, applyRemindersSaved, applySendSaved, endedMonthOf, initialCharges, startConfirmingPreview, startReloadingCharges, startSavingPayment, startSavingReminder, startSavingSend, syncChargesWithMessages, withoutLastReminder, withReminderSent } from "@/lib/charges";
import { saveChargePaidAt, saveChargeRemindersSentAt, saveChargeSentAt } from "@/lib/charge-sending";
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

  function savePaid(chargeId: string, paidAt: string | null) {
    setState((current) => startSavingPayment(current, chargeId));
    void saveChargePaidAt(supabase, chargeId, paidAt).then((saved) => setState((current) => applyPaidSaved(current, chargeId, paidAt, saved)));
  }

  function saveReminders(chargeId: string, undoing: boolean) {
    const charge = state.charges.find((one) => one.id === chargeId);
    if (!charge) return;
    const remindersSentAt = undoing ? withoutLastReminder(charge) : withReminderSent(charge, new Date().toISOString());
    setState((current) => startSavingReminder(current, chargeId));
    void saveChargeRemindersSentAt(supabase, chargeId, remindersSentAt).then((saved) => setState((current) => applyRemindersSaved(current, chargeId, remindersSentAt, saved, undoing)));
  }

  return (
    <ChargesView
      state={state}
      onRetry={retry}
      onConfirmPreview={confirmPreview}
      onSend={(chargeId) => saveSent(chargeId, new Date().toISOString())}
      onUndoSend={(chargeId) => saveSent(chargeId, null)}
      onMarkPaid={(chargeId) => savePaid(chargeId, new Date().toISOString())}
      onUndoPaid={(chargeId) => savePaid(chargeId, null)}
      onSendReminder={(chargeId) => saveReminders(chargeId, false)}
      onUndoReminder={(chargeId) => saveReminders(chargeId, true)}
    />
  );
}
