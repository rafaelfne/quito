"use client";

import { useCallback, useEffect, useState } from "react";
import { SignOutButton } from "@/app/(app)/sign-out-button";
import { cleanNote } from "@/lib/notes";
import { supabase } from "@/lib/supabase";

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
    if (!text) return;
    const { error } = await supabase.from("notes").insert({ body: text });
    if (error) {
      setMessage(error.message);
      return;
    }
    setBody("");
    show(await fetchNotes());
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Minhas notas</h1>
        <SignOutButton onError={setMessage} />
      </header>
      <form className="flex gap-2" onSubmit={(event) => void add(event)}>
        <input className="flex-1 rounded border px-3 py-2" required value={body} placeholder="Escreva uma nota" onChange={(e) => setBody(e.target.value)} />
        <button className="rounded bg-foreground px-3 py-2 text-background" type="submit">
          Guardar
        </button>
      </form>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      <ul className="flex flex-col gap-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded border px-3 py-2">
            {note.body}
          </li>
        ))}
      </ul>
    </main>
  );
}
