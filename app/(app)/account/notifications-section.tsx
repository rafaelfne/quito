"use client";

import { useEffect, useState } from "react";
import { NotificationsSectionView } from "@/app/(app)/account/notifications-section-view";
import { browserPushEnvironment, checkPush, enablePush, type PushStatus } from "@/lib/push-subscription";
import { supabase } from "@/lib/supabase";

export function NotificationsSection() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void checkPush(browserPushEnvironment(window), supabase).then(setStatus);
  }, []);

  async function enable() {
    setBusy(true);
    setStatus(await enablePush(browserPushEnvironment(window), supabase, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""));
    setBusy(false);
  }

  return <NotificationsSectionView status={status} busy={busy} onEnable={() => void enable()} />;
}
