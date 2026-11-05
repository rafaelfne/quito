"use client";

import { useCallback, useEffect, useState } from "react";
import { PaymentSettingsView } from "@/app/(app)/payment/payment-view";
import {
  applyGuardianDueDaysLoad,
  changeGuardianDueDay,
  guardianDueGroupsFrom,
  initialGuardianDueDays,
  loadGuardianDueDays,
  overridesByPhone,
  startReloadingGuardianDueDays,
  submitGuardianDueDay,
} from "@/lib/guardian-due-days";
import { dateKeyOf } from "@/lib/lessons";
import {
  applyMessageSettingsLoad,
  changeMessageSetting,
  initialMessageSettings,
  loadMessageSettings,
  startReloadingMessageSettings,
  submitMessageSettings,
} from "@/lib/message-settings";
import {
  applyPaymentSettingsLoad,
  changePaymentSetting,
  defaultDueDay,
  initialPaymentSettings,
  loadPaymentSettings,
  startReloadingPaymentSettings,
  submitPaymentSettings,
  type PaymentSettingsField,
} from "@/lib/payment-settings";
import { loadStudents } from "@/lib/students";
import { supabase } from "@/lib/supabase";

export default function PaymentSettingsPage() {
  const [state, setState] = useState(initialPaymentSettings);
  const [guardianDueDays, setGuardianDueDays] = useState(initialGuardianDueDays);
  const [busy, setBusy] = useState(false);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);
  const [messageSettings, setMessageSettings] = useState(initialMessageSettings);
  const [messageBusy, setMessageBusy] = useState(false);

  const loadGuardians = useCallback((dueDay: number) => {
    setGuardianDueDays((current) => startReloadingGuardianDueDays(current, dueDay));
    void Promise.all([loadStudents(supabase), loadGuardianDueDays(supabase)]).then(([studentsResult, overridesResult]) => {
      if (!studentsResult.ok || !overridesResult.ok) {
        setGuardianDueDays((current) => applyGuardianDueDaysLoad(current, { ok: false }, dueDay));
        return;
      }
      const groups = guardianDueGroupsFrom(studentsResult.students, overridesByPhone(overridesResult.rows));
      setGuardianDueDays((current) => applyGuardianDueDaysLoad(current, { ok: true, groups }, dueDay));
    });
  }, []);

  const load = useCallback(() => {
    void loadPaymentSettings(supabase).then((result) => {
      setState((current) => applyPaymentSettingsLoad(current, result));
      const dueDay = result.ok ? (result.settings?.due_day ?? defaultDueDay) : defaultDueDay;
      loadGuardians(dueDay);
    });
  }, [loadGuardians]);

  useEffect(load, [load]);

  const loadMessage = useCallback(() => {
    void loadMessageSettings(supabase).then((result) => setMessageSettings((current) => applyMessageSettingsLoad(current, result)));
  }, []);

  useEffect(loadMessage, [loadMessage]);

  function retry() {
    setState(startReloadingPaymentSettings);
    load();
  }

  function retryGuardians() {
    const dueDay = Number(state.draft.dueDay) || defaultDueDay;
    loadGuardians(dueDay);
  }

  function submit() {
    setBusy(true);
    void submitPaymentSettings(supabase, state).then((next) => {
      setState(next);
      setBusy(false);
      if (!next.message && Object.keys(next.errors).length === 0) {
        const dueDay = Number(next.draft.dueDay) || defaultDueDay;
        loadGuardians(dueDay);
      }
    });
  }

  function submitGuardian(phone: string) {
    setBusyPhone(phone);
    void submitGuardianDueDay(supabase, guardianDueDays, phone).then((next) => {
      setGuardianDueDays(next);
      setBusyPhone(null);
    });
  }

  function retryMessage() {
    setMessageSettings(startReloadingMessageSettings);
    loadMessage();
  }

  function submitMessage() {
    setMessageBusy(true);
    void submitMessageSettings(supabase, messageSettings).then((next) => {
      setMessageSettings(next);
      setMessageBusy(false);
    });
  }

  return (
    <PaymentSettingsView
      state={state}
      guardianDueDays={guardianDueDays}
      messageSettings={messageSettings}
      busy={busy}
      busyPhone={busyPhone}
      messageBusy={messageBusy}
      today={dateKeyOf(new Date())}
      onChange={(field: PaymentSettingsField, value: string) => setState((current) => changePaymentSetting(current, field, value))}
      onSubmit={submit}
      onRetry={retry}
      onGuardianDueChange={(phone, dueDay) => setGuardianDueDays((current) => changeGuardianDueDay(current, phone, dueDay))}
      onGuardianDueSubmit={submitGuardian}
      onGuardianDueRetry={retryGuardians}
      onMessageChange={(changes) => setMessageSettings((current) => changeMessageSetting(current, changes))}
      onMessageSubmit={submitMessage}
      onMessageRetry={retryMessage}
    />
  );
}
