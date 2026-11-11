import type { SupabaseClient } from "@supabase/supabase-js";
import { dateKeyOf } from "@/lib/lessons";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type NotificationEventClient = Pick<SupabaseClient, "from">;

export type NotificationEventKind = "active" | "inactive" | "tap";

export type NotificationEventDevice = "android" | "iphone" | "computer";

export type NotificationEventRow = {
  owner_id?: string;
  kind: NotificationEventKind;
  device: NotificationEventDevice;
  day: string;
  occurred_at: string;
};

export const notificationEventsTable = "notification_events";

export function notificationEventRow(kind: NotificationEventKind, device: NotificationEventDevice, now: Date, day: string = dateKeyOf(now)): NotificationEventRow {
  return { kind, device, day, occurred_at: now.toISOString() };
}

export async function recordNotificationEvent(client: NotificationEventClient, row: NotificationEventRow): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(notificationEventsTable).upsert(row, { onConflict: "owner_id,kind,device,day" })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}
