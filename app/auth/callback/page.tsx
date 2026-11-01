"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleReturnView } from "@/app/auth/callback/google-return-view";
import { handleGoogleReturn } from "@/lib/google-sign-in";
import { supabase } from "@/lib/supabase";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const { search, hash } = window.location;
    void handleGoogleReturn(supabase.auth, { search, hash }, router.replace).then(setMessage);
  }, [router]);

  return <GoogleReturnView message={message} />;
}
