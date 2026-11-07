"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GettingStartedReminderView } from "@/app/(app)/getting-started/reminder-view";
import { gettingStartedPath, loadGettingStarted, noReminder, reminderFor, tracksReminder, type GettingStartedReminder as Reminder } from "@/lib/getting-started";
import { supabase } from "@/lib/supabase";

export function GettingStartedReminder() {
  const pathname = usePathname();
  const router = useRouter();
  const [shown, setShown] = useState<{ pathname: string; reminder: Reminder } | null>(null);

  useEffect(() => {
    if (!tracksReminder(pathname)) return;
    let stale = false;
    void loadGettingStarted(supabase).then((load) => {
      if (stale) return;
      const reminder = reminderFor(pathname, load);
      if (reminder.kind === "first-entry") router.replace(gettingStartedPath);
      setShown({ pathname, reminder });
    });
    return () => {
      stale = true;
    };
  }, [pathname, router]);

  return <GettingStartedReminderView reminder={shown?.pathname === pathname ? shown.reminder : noReminder} />;
}
