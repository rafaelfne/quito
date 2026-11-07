"use client";

import { useCallback, useEffect, useState } from "react";
import { StudentImportView } from "@/app/(app)/students/import/import-view";
import { applyImportLoad, changeImportText, initialStudentImport, startReloadingImport, submitImport } from "@/lib/student-import";
import { loadStudents } from "@/lib/students";
import { supabase } from "@/lib/supabase";

export default function StudentImportPage() {
  const [state, setState] = useState(initialStudentImport);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void loadStudents(supabase).then((result) => setState((current) => applyImportLoad(current, result)));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setState(startReloadingImport);
    load();
  }

  function submit() {
    setBusy(true);
    void submitImport(supabase, state).then((next) => {
      setState(next);
      setBusy(false);
    });
  }

  return <StudentImportView state={state} busy={busy} onChange={(text: string) => setState((current) => changeImportText(current, text))} onSubmit={submit} onRetry={retry} />;
}
