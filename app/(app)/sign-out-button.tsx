"use client";

import { Button } from "@/components/ui/button";
import { signOutThisDevice } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export function SignOutButton({ onError }: { onError: (message: string) => void }) {
  async function signOut() {
    const result = await signOutThisDevice(supabase.auth);
    if (!result.ok) onError(result.message);
  }

  return (
    <Button variant="outline" type="button" onClick={() => void signOut()}>
      Sair deste aparelho
    </Button>
  );
}
