"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignInForm } from "@/app/sign-in-form";
import { googleReturnUrl, realBrowser, startGoogleSignIn } from "@/lib/google-sign-in";
import { cleanCode, editEmail, initialSignIn, resendCode, submitCode, submitEmail, type SignInAuth, type SignInState } from "@/lib/sign-in";
import { supabase } from "@/lib/supabase";

type SignInAction = (auth: SignInAuth, state: SignInState) => Promise<SignInState>;

export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<SignInState>(initialSignIn);
  const [busy, setBusy] = useState(false);

  async function run(action: SignInAction) {
    setBusy(true);
    const next = await action(supabase.auth, state);
    setBusy(false);
    setState(next);
    if (next.signedIn) router.push("/notes");
  }

  async function signInWithGoogle() {
    setBusy(true);
    setState((current) => ({ ...current, message: null }));
    const result = await startGoogleSignIn(supabase.auth, googleReturnUrl(window.location.origin), realBrowser);
    if (result.ok) return;
    setBusy(false);
    setState((current) => ({ ...current, message: result.message }));
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <SignInForm
        state={state}
        busy={busy}
        onEmailChange={(email) => setState((current) => ({ ...current, email }))}
        onCodeChange={(code) => setState((current) => ({ ...current, code: cleanCode(code) }))}
        onSubmitEmail={() => void run(submitEmail)}
        onSubmitCode={() => void run(submitCode)}
        onResend={() => void run(resendCode)}
        onEditEmail={() => setState(editEmail)}
        onGoogle={() => void signInWithGoogle()}
      />
    </main>
  );
}
