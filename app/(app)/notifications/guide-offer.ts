"use client";

import { useEffect, useState } from "react";
import { offersNotificationsGuide } from "@/lib/activation-guide";
import { browserPushEnvironment, checkPush, deviceFrom } from "@/lib/push-subscription";
import { supabase } from "@/lib/supabase";

export function useNotificationsGuideOffer(): boolean {
  const [offered, setOffered] = useState(false);

  useEffect(() => {
    const environment = browserPushEnvironment(window);
    const device = deviceFrom(environment.userAgent);
    if (device !== "android") return;
    void checkPush(environment, supabase).then((status) => setOffered(offersNotificationsGuide(device, status)));
  }, []);

  return offered;
}
