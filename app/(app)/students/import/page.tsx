"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { StudentImportView } from "@/app/(app)/students/import/import-view";
import { contactsPickerOf, pickContacts, type ContactsPicker } from "@/lib/contact-picker";
import { addPickedContacts, applyImportLoad, changeImportLine, changeImportText, failPickingContacts, initialStudentImport, startReloadingImport, submitImport } from "@/lib/student-import";
import { loadStudents } from "@/lib/students";
import { supabase } from "@/lib/supabase";

function ignoreChanges() {
  return () => {};
}

function readContactsPicker() {
  return contactsPickerOf(globalThis.navigator);
}

function noContactsPicker() {
  return null;
}

export default function StudentImportPage() {
  const [state, setState] = useState(initialStudentImport);
  const [busy, setBusy] = useState(false);
  const picker = useSyncExternalStore(ignoreChanges, readContactsPicker, noContactsPicker);

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

  function chooseContacts(from: ContactsPicker) {
    void pickContacts(from).then((result) => setState((current) => (result.ok ? addPickedContacts(current, result.contacts) : failPickingContacts(current))));
  }

  return (
    <StudentImportView
      state={state}
      busy={busy}
      onChange={(text: string) => setState((current) => changeImportText(current, text))}
      onEditLine={(line: number, field: "name" | "guardianName" | "phone", value: string) => setState((current) => changeImportLine(current, line, field, value))}
      onSubmit={submit}
      onRetry={retry}
      onPickContacts={picker ? () => chooseContacts(picker) : undefined}
    />
  );
}
