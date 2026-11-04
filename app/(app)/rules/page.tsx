"use client";

import { useCallback, useEffect, useState } from "react";
import { TeacherRulesView } from "@/app/(app)/rules/rules-view";
import { supabase } from "@/lib/supabase";
import { applyTeacherRulesLoad, changeTeacherRule, initialTeacherRules, loadTeacherRules, startReloadingTeacherRules, submitTeacherRules, type TeacherRulesField } from "@/lib/teacher-rules";

export default function TeacherRulesPage() {
  const [state, setState] = useState(initialTeacherRules);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void loadTeacherRules(supabase).then((result) => setState((current) => applyTeacherRulesLoad(current, result)));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingTeacherRules);
    load();
  }

  function submit() {
    setBusy(true);
    void submitTeacherRules(supabase, state).then((next) => {
      setState(next);
      setBusy(false);
    });
  }

  return (
    <TeacherRulesView
      state={state}
      busy={busy}
      onChange={(field: TeacherRulesField, value: string) => setState((current) => changeTeacherRule(current, field, value))}
      onSubmit={submit}
      onRetry={retry}
    />
  );
}
