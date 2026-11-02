"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SignInForm } from "@/app/sign-in-form";
import { googleReturnUrl, realBrowser, startGoogleSignIn } from "@/lib/google-sign-in";
import { cleanCode, editEmail, initialSignIn, normalizeEmail, resendCode, submitCode, submitEmail, type SignInAuth, type SignInState } from "@/lib/sign-in";
import { destinationFrom } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { askTestMail, testInboxUrl, waitForNewTestCode } from "@/lib/test-inbox";

type SignInAction = (auth: SignInAuth, state: SignInState) => Promise<SignInState>;

export function SignInScreen() {
  const router = useRouter();
  const [state, setState] = useState<SignInState>(initialSignIn);
  const [busy, setBusy] = useState(false);
  const [testCode, setTestCode] = useState<string | null>(null);
  const codeRequest = useRef(0);
  const inboxUrl = testInboxUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  async function run(action: SignInAction) {
    setBusy(true);
    const next = await action(supabase.auth, state);
    setBusy(false);
    setState(next);
    if (next.signedIn) router.replace(destinationFrom(window.location.search));
    return next;
  }

  async function sendCode(action: SignInAction) {
    codeRequest.current += 1;
    const request = codeRequest.current;
    setTestCode(null);
    const email = normalizeEmail(state.email);
    const previous = inboxUrl && email ? await askTestMail(email) : null;
    const next = await run(action);
    if (!inboxUrl || !email || next.step !== "code" || next.message) return;
    const code = await waitForNewTestCode(email, previous?.id ?? null);
    if (request === codeRequest.current) setTestCode(code);
  }

  function changeEmail() {
    codeRequest.current += 1;
    setTestCode(null);
    setState(editEmail);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setState((current) => ({ ...current, message: null }));
    const result = await startGoogleSignIn(supabase.auth, googleReturnUrl(window.location.origin, destinationFrom(window.location.search)), realBrowser);
    if (result.ok) return;
    setBusy(false);
    setState((current) => ({ ...current, message: result.message }));
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <SignInForm
        state={state}
        busy={busy}
        testInboxUrl={inboxUrl}
        testCode={testCode}
        onEmailChange={(email) => setState((current) => ({ ...current, email }))}
        onCodeChange={(code) => setState((current) => ({ ...current, code: cleanCode(code) }))}
        onSubmitEmail={() => void sendCode(submitEmail)}
        onSubmitCode={() => void run(submitCode)}
        onResend={() => void sendCode(resendCode)}
        onEditEmail={changeEmail}
        onGoogle={() => void signInWithGoogle()}
      />
    </main>
  );
}
