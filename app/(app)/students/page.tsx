"use client";

import { useCallback, useEffect, useState } from "react";
import { StudentsView } from "@/app/(app)/students/students-view";
import { applyLoad, cancelEditing, changeDraft, initialStudents, loadStudents, startEditing, startReloading, submitStudent, type Student, type StudentField } from "@/lib/students";
import { calendarMonthOf } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { defaultTeacherRules, loadTeacherRules } from "@/lib/teacher-rules";

export default function StudentsPage() {
  const [state, setState] = useState(initialStudents);
  const [busy, setBusy] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(defaultTeacherRules.sibling_discount_percent);

  const load = useCallback(() => {
    void loadStudents(supabase).then((result) => setState((current) => applyLoad(current, result)));
    void loadTeacherRules(supabase).then((result) => setDiscountPercent(result.ok ? result.rules.sibling_discount_percent : defaultTeacherRules.sibling_discount_percent));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloading);
    load();
  }

  function submit() {
    setBusy(true);
    void submitStudent(supabase, state).then((next) => {
      setState(next);
      setBusy(false);
    });
  }

  return (
    <StudentsView
      state={state}
      month={calendarMonthOf(new Date())}
      busy={busy}
      discountPercent={discountPercent}
      onChange={(field: StudentField, value: string) => setState((current) => changeDraft(current, field, value))}
      onSubmit={submit}
      onEdit={(student: Student) => setState((current) => startEditing(current, student))}
      onCancelEdit={() => setState(cancelEditing)}
      onRetry={retry}
    />
  );
}
