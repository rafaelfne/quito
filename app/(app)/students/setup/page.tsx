"use client";

import { useCallback, useEffect, useState } from "react";
import { StudentSetupView } from "@/app/(app)/students/setup/setup-view";
import type { BillingDraft } from "@/lib/billing";
import type { ScheduleDraft } from "@/lib/schedule";
import { applySetupLoad, changeGroupBilling, changeSchedule, clearSelection, initialStudentSetup, selectWithoutBilling, startReloadingSetup, submitGroupBilling, submitStudentSchedule, toggleStudent, type StudentSetupState } from "@/lib/student-setup";
import { loadStudents } from "@/lib/students";
import { supabase } from "@/lib/supabase";

export default function StudentSetupPage() {
  const [state, setState] = useState(initialStudentSetup);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void loadStudents(supabase).then((result) => setState((current) => applySetupLoad(current, result)));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingSetup);
    load();
  }

  function run(submit: Promise<StudentSetupState>) {
    setBusy(true);
    void submit.then((next) => {
      setState(next);
      setBusy(false);
    });
  }

  return (
    <StudentSetupView
      state={state}
      busy={busy}
      onToggle={(id: string) => setState((current) => toggleStudent(current, id))}
      onSelectWithoutBilling={() => setState(selectWithoutBilling)}
      onClearSelection={() => setState(clearSelection)}
      onChangeBilling={(field: keyof BillingDraft, value: string) => setState((current) => changeGroupBilling(current, field, value))}
      onApplyBilling={() => run(submitGroupBilling(supabase, state))}
      onChangeSchedule={(id: string, field: keyof ScheduleDraft, value: string) => setState((current) => changeSchedule(current, id, field, value))}
      onSaveSchedule={(id: string) => run(submitStudentSchedule(supabase, state, id))}
      onRetry={retry}
    />
  );
}
