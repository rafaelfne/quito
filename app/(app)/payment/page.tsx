"use client";

import { useCallback, useEffect, useState } from "react";
import { PaymentSettingsView } from "@/app/(app)/payment/payment-view";
import { dateKeyOf } from "@/lib/lessons";
import { applyPaymentSettingsLoad, changePaymentSetting, initialPaymentSettings, loadPaymentSettings, startReloadingPaymentSettings, submitPaymentSettings, type PaymentSettingsField } from "@/lib/payment-settings";
import { supabase } from "@/lib/supabase";

export default function PaymentSettingsPage() {
  const [state, setState] = useState(initialPaymentSettings);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void loadPaymentSettings(supabase).then((result) => setState((current) => applyPaymentSettingsLoad(current, result)));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingPaymentSettings);
    load();
  }

  function submit() {
    setBusy(true);
    void submitPaymentSettings(supabase, state).then((next) => {
      setState(next);
      setBusy(false);
    });
  }

  return (
    <PaymentSettingsView
      state={state}
      busy={busy}
      today={dateKeyOf(new Date())}
      onChange={(field: PaymentSettingsField, value: string) => setState((current) => changePaymentSetting(current, field, value))}
      onSubmit={submit}
      onRetry={retry}
    />
  );
}
