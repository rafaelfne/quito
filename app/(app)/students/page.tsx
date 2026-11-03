"use client";

import { useCallback, useEffect, useState } from "react";
import { StudentsView } from "@/app/(app)/students/students-view";
import { applyLoad, cancelEditing, changeDraft, initialStudents, loadStudents, startEditing, startReloading, submitStudent, type Student, type StudentField } from "@/lib/students";
import { supabase } from "@/lib/supabase";

export default function StudentsPage() {
  const [state, setState] = useState(initialStudents);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void loadStudents(supabase).then((result) => setState((current) => applyLoad(current, result)));
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
      busy={busy}
      onChange={(field: StudentField, value: string) => setState((current) => changeDraft(current, field, value))}
      onSubmit={submit}
      onEdit={(student: Student) => setState((current) => startEditing(current, student))}
      onCancelEdit={() => setState(cancelEditing)}
      onRetry={retry}
    />
  );
}
