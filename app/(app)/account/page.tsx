"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountView } from "@/app/(app)/account/account-view";
import { loadAccount, type AccountResult } from "@/lib/account";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  const [account, setAccount] = useState<AccountResult | null>(null);
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    void loadAccount(supabase.auth).then(setAccount);
  }, []);

  useEffect(load, [load]);

  function retry() {
    setAccount(null);
    load();
  }

  return <AccountView account={account} signOutMessage={signOutMessage} onRetry={retry} onSignOutError={setSignOutMessage} />;
}
