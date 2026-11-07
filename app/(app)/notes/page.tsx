"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { accountPath } from "@/lib/account";
import { chargesPath } from "@/lib/charges";
import { closingPath } from "@/lib/closing";
import { lessonsPath } from "@/lib/lessons";
import { cleanNote, noteWarning } from "@/lib/notes";
import { paymentSettingsPath } from "@/lib/payment-settings";
import { studentsPath } from "@/lib/students";
import { supabase } from "@/lib/supabase";
import { teacherRulesPath } from "@/lib/teacher-rules";

type Note = { id: string; body: string; created_at: string };

function fetchNotes() {
  return supabase.from("notes").select("id, body, created_at").order("created_at", { ascending: false });
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback(({ data, error }: Awaited<ReturnType<typeof fetchNotes>>) => {
    if (error) setMessage(error.message);
    else setNotes(data ?? []);
  }, []);

  useEffect(() => {
    void fetchNotes().then(show);
  }, [show]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const text = cleanNote(body);
    if (!text) {
      setMessage(noteWarning(body));
      return;
    }
    const { error } = await supabase.from("notes").insert({ body: text });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(null);
    setBody("");
    show(await fetchNotes());
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Minhas notas</h1>
        <nav className="flex flex-wrap gap-4">
          <Link className="text-sm underline" href={studentsPath}>
            Alunos
          </Link>
          <Link className="text-sm underline" href={lessonsPath}>
            Aulas
          </Link>
          <Link className="text-sm underline" href={closingPath}>
            Fechamento
          </Link>
          <Link className="text-sm underline" href={teacherRulesPath}>
            Regras
          </Link>
          <Link className="text-sm underline" href={paymentSettingsPath}>
            Recebimento
          </Link>
          <Link className="text-sm underline" href={chargesPath}>
            Cobranças
          </Link>
          <Link className="text-sm underline" href={accountPath}>
            Conta
          </Link>
        </nav>
      </header>
      <form className="flex gap-2" onSubmit={(event) => void add(event)}>
        <input className="flex-1 rounded-sm border px-3 py-2" required value={body} placeholder="Escreva uma nota" onChange={(e) => setBody(e.target.value)} />
        <Button type="submit">Guardar</Button>
      </form>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      <ul className="flex flex-col gap-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded-sm border px-3 py-2">
            {note.body}
          </li>
        ))}
      </ul>
    </main>
  );
}
