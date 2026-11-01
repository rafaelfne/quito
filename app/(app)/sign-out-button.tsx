"use client";

import { signOutThisDevice } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export function SignOutButton({ onError }: { onError: (message: string) => void }) {
  async function signOut() {
    const result = await signOutThisDevice(supabase.auth);
    if (!result.ok) onError(result.message);
  }

  return (
    <button className="text-sm underline" type="button" onClick={() => void signOut()}>
      Sair
    </button>
  );
}
