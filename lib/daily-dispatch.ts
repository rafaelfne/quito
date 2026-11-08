import type { SupabaseClient } from "@supabase/supabase-js";
import { chargesPath, notificationTapPath } from "@/lib/charges";
import { describeDayWork, loadDayWork, localClock, ownerScoped, type DayWork } from "@/lib/day-work";
import { claimFirstChargeEve, describeFirstChargeEve, loadFirstChargeEve, recordFirstChargeEveReach, type FirstChargeEve } from "@/lib/first-charge-eve";
import { defaultNotificationHour, fallbackTimeZone, isNotificationHour } from "@/lib/notification-time";

export type DispatchClient = Pick<SupabaseClient, "from">;

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushMessage = { title: string; body: string; path: string };

export type PushSender = (target: PushTarget, message: PushMessage) => Promise<"sent" | "gone" | "failed">;

export type TeacherTarget = { ownerId: string; hour: number; timeZone: string; devices: PushTarget[] };

export type DispatchReport = { notified: number; quiet: number; failed: number };

type SubscriptionRow = PushTarget & { owner_id: string };

type SettingsRow = { owner_id: string; hour: number; time_zone: string };

type DispatchRow = { owner_id: string; day: string };

export const dispatchTitle = "Quitô";

const pageSize = 1000;

async function allRows<Row>(client: DispatchClient, table: string, columns: string, order: string): Promise<Row[] | null> {
  const rows: Row[] = [];
  for (;;) {
    const { data, error } = await client.from(table).select(columns).order(order).range(rows.length, rows.length + pageSize - 1);
    if (error) return null;
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function teacherTargets(subscriptions: SubscriptionRow[], settings: SettingsRow[]): TeacherTarget[] {
  const chosen = new Map(settings.map((row) => [row.owner_id, row]));
  const targets = new Map<string, TeacherTarget>();
  for (const { owner_id: ownerId, endpoint, p256dh, auth } of subscriptions) {
    const setting = chosen.get(ownerId);
    const target = targets.get(ownerId) ?? {
      ownerId,
      hour: setting && isNotificationHour(setting.hour) ? setting.hour : defaultNotificationHour,
      timeZone: setting?.time_zone || fallbackTimeZone,
      devices: [],
    };
    target.devices.push({ endpoint, p256dh, auth });
    targets.set(ownerId, target);
  }
  return [...targets.values()];
}

export async function loadTeacherTargets(client: DispatchClient): Promise<TeacherTarget[] | null> {
  const [subscriptions, settings] = await Promise.all([
    allRows<SubscriptionRow>(client, "push_subscriptions", "owner_id, endpoint, p256dh, auth", "id"),
    allRows<SettingsRow>(client, "notification_settings", "owner_id, hour, time_zone", "owner_id"),
  ]);
  if (subscriptions === null || settings === null) return null;
  return teacherTargets(subscriptions, settings);
}

export async function loadRecentDispatches(client: DispatchClient, since: string): Promise<Set<string> | null> {
  const { data, error } = await client.from("notification_dispatches").select("owner_id, day").gte("day", since);
  if (error) return null;
  return new Set(((data ?? []) as DispatchRow[]).map(({ owner_id: ownerId, day }) => `${ownerId}:${day}`));
}

export async function claimDispatch(client: DispatchClient, ownerId: string, day: string, work: DayWork): Promise<boolean> {
  const { data, error } = await client
    .from("notification_dispatches")
    .upsert({ owner_id: ownerId, day, charges: work.charges, reminders: work.reminders }, { onConflict: "owner_id,day", ignoreDuplicates: true })
    .select("owner_id");
  return !error && (data ?? []).length > 0;
}

export async function forgetDevice(client: DispatchClient, ownerId: string, endpoint: string): Promise<void> {
  await client.from("push_subscriptions").delete().eq("owner_id", ownerId).eq("endpoint", endpoint);
}

export function isDispatchDue(target: TeacherTarget, now: Date): boolean {
  return localClock(now, target.timeZone).hour >= target.hour;
}

function dayBefore(now: Date): string {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type DeviceReach = { reached: number; live: PushTarget[] };

async function notifyDevices(client: DispatchClient, send: PushSender, ownerId: string, devices: PushTarget[], message: PushMessage): Promise<DeviceReach> {
  const results = await Promise.all(devices.map((device) => send(device, message)));
  await Promise.all(devices.filter((_, index) => results[index] === "gone").map((device) => forgetDevice(client, ownerId, device.endpoint)));
  return { reached: results.filter((result) => result === "sent").length, live: devices.filter((_, index) => results[index] !== "gone") };
}

async function eveToSend(client: DispatchClient, target: TeacherTarget, eve: FirstChargeEve | null): Promise<FirstChargeEve | null> {
  if (eve === null) return null;
  return (await claimFirstChargeEve(client, target.ownerId, eve, target.devices.length)) ? eve : null;
}

async function dispatchTo(client: DispatchClient, send: PushSender, target: TeacherTarget, today: string): Promise<keyof DispatchReport> {
  const scoped = ownerScoped(client, target.ownerId);
  const [work, eveLoad] = await Promise.all([loadDayWork(scoped, today, target.timeZone), loadFirstChargeEve(scoped, today)]);
  if (work === null || !eveLoad.ok) return "failed";
  if (!(await claimDispatch(client, target.ownerId, today, work))) return "quiet";
  const body = describeDayWork(work);
  const eve = await eveToSend(client, target, eveLoad.eve);
  if (body === null && eve === null) return "quiet";
  let devices = target.devices;
  let reached = 0;
  if (eve !== null) {
    const reach = await notifyDevices(client, send, target.ownerId, devices, { title: dispatchTitle, body: describeFirstChargeEve(eve), path: chargesPath });
    await recordFirstChargeEveReach(client, target.ownerId, reach.reached);
    devices = reach.live;
    reached += reach.reached;
  }
  if (body !== null) {
    const reach = await notifyDevices(client, send, target.ownerId, devices, { title: dispatchTitle, body, path: notificationTapPath });
    reached += reach.reached;
  }
  return reached > 0 ? "notified" : "failed";
}

export async function runDailyDispatch(client: DispatchClient, send: PushSender, now: Date): Promise<DispatchReport | null> {
  const [targets, dispatched] = await Promise.all([loadTeacherTargets(client), loadRecentDispatches(client, dayBefore(now))]);
  if (targets === null || dispatched === null) return null;
  const report: DispatchReport = { notified: 0, quiet: 0, failed: 0 };
  for (const target of targets) {
    if (!isDispatchDue(target, now)) continue;
    const today = localClock(now, target.timeZone).date;
    if (dispatched.has(`${target.ownerId}:${today}`)) continue;
    try {
      report[await dispatchTo(client, send, target, today)] += 1;
    } catch {
      report.failed += 1;
    }
  }
  return report;
}
