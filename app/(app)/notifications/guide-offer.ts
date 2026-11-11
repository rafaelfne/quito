"use client";

import { useEffect, useState } from "react";
import { guideOfferOf, type GuideOffer } from "@/lib/activation-guide";
import { browserPushEnvironment, checkPush, deviceFrom } from "@/lib/push-subscription";
import { supabase } from "@/lib/supabase";

export function useNotificationsGuideOffer(): GuideOffer {
  const [offer, setOffer] = useState<GuideOffer>("none");

  useEffect(() => {
    const environment = browserPushEnvironment(window);
    const device = deviceFrom(environment.userAgent);
    if (device === "computer") return;
    void checkPush(environment, supabase).then((status) => setOffer(guideOfferOf(device, environment.standalone, status, environment.permission())));
  }, []);

  return offer;
}
