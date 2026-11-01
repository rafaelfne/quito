"use client";

import { useState } from "react";
import { DeleteAccountView, type DeleteStep } from "@/app/(app)/account/delete-account-view";
import { deleteAccount } from "@/lib/account";
import { supabase } from "@/lib/supabase";

export function DeleteAccount({ email }: { email: string }) {
  const [step, setStep] = useState<DeleteStep>("closed");
  const [message, setMessage] = useState<string | null>(null);

  function cancel() {
    setMessage(null);
    setStep("closed");
  }

  async function confirm() {
    setMessage(null);
    setStep("deleting");
    const result = await deleteAccount(supabase);
    if (result.ok) return;
    setMessage(result.message);
    setStep("confirming");
  }

  return <DeleteAccountView email={email} step={step} message={message} onOpen={() => setStep("confirming")} onCancel={cancel} onConfirm={() => void confirm()} />;
}
