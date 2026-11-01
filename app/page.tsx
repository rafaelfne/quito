"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OpeningScreen } from "@/app/opening-screen";
import { SignInScreen } from "@/app/sign-in-screen";
import { enterIfSignedIn } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void enterIfSignedIn(supabase.auth, window.location.search, router.replace).then((entered) => {
      if (!entered) setChecking(false);
    });
  }, [router]);

  return checking ? <OpeningScreen /> : <SignInScreen />;
}
