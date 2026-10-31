"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(mode: "signIn" | "signUp") {
    setBusy(true);
    setMessage(null);
    const { error } = mode === "signIn"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (mode === "signUp") {
      setMessage("Conta criada. Confira o seu e-mail para confirmar e depois entre.");
      return;
    }
    router.push("/notes");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <form
        className="flex w-full max-w-sm flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit("signIn");
        }}
      >
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input className="rounded border px-3 py-2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Senha
          <input className="rounded border px-3 py-2" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="rounded bg-foreground px-3 py-2 text-background disabled:opacity-50" type="submit" disabled={busy}>
          Entrar
        </button>
        <button className="rounded border px-3 py-2 disabled:opacity-50" type="button" disabled={busy} onClick={() => void submit("signUp")}>
          Criar conta
        </button>
        {message ? <p className="text-sm" role="status">{message}</p> : null}
      </form>
    </main>
  );
}
