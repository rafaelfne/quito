"use client";

import { useEffect, useState } from "react";
import { NotificationTimeSectionView } from "@/app/(app)/account/notification-time-section-view";
import { chooseNotificationHour, deviceTimeZone, initialNotificationTime, openNotificationTime, type NotificationTimeState } from "@/lib/notification-time";
import { supabase } from "@/lib/supabase";

export function NotificationTimeSection() {
  const [state, setState] = useState<NotificationTimeState>(() => initialNotificationTime(deviceTimeZone()));

  useEffect(() => {
    void openNotificationTime(supabase, deviceTimeZone()).then(setState);
  }, []);

  function retry() {
    const timeZone = deviceTimeZone();
    setState(initialNotificationTime(timeZone));
    void openNotificationTime(supabase, timeZone).then(setState);
  }

  async function choose(hour: number) {
    const saving = { ...state, saving: true, notice: null };
    setState(saving);
    setState(await chooseNotificationHour(supabase, saving, hour));
  }

  return <NotificationTimeSectionView state={state} onChoose={(hour) => void choose(hour)} onRetry={retry} />;
}
