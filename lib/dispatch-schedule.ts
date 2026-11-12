import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";
import { runDailyDispatch, type DispatchClient, type PushSender } from "@/lib/daily-dispatch";

export type DispatchConfig = { supabaseUrl: string; serviceRoleKey: string; vapidPublicKey: string; vapidPrivateKey: string; vapidSubject: string };

export type VapidConfig = Pick<DispatchConfig, "vapidPublicKey" | "vapidPrivateKey" | "vapidSubject">;

export type DispatchEnv = Record<string, string | undefined>;

export type Notify = typeof webPush.sendNotification;

export const dispatchIntervalMs = 5 * 60 * 1000;

const pushTtlSeconds = 12 * 60 * 60;

const goneStatuses = [404, 410];

export function dispatchConfigFrom(env: DispatchEnv): DispatchConfig | null {
  const config = {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    vapidPublicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY,
    vapidSubject: env.VAPID_SUBJECT,
  };
  return Object.values(config).every(Boolean) ? (config as DispatchConfig) : null;
}

export function vapidConfigFrom(env: DispatchEnv): VapidConfig | null {
  const config = { vapidPublicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, vapidPrivateKey: env.VAPID_PRIVATE_KEY, vapidSubject: env.VAPID_SUBJECT };
  return Object.values(config).every(Boolean) ? (config as VapidConfig) : null;
}

function statusOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : undefined;
}

export function webPushSender(config: VapidConfig, notify: Notify = webPush.sendNotification): PushSender {
  const vapidDetails = { subject: config.vapidSubject, publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey };
  return async ({ endpoint, p256dh, auth }, message) => {
    try {
      await notify({ endpoint, keys: { p256dh, auth } }, JSON.stringify(message), { vapidDetails, TTL: pushTtlSeconds, urgency: "high" });
      return "sent";
    } catch (error) {
      return goneStatuses.includes(statusOf(error) ?? 0) ? "gone" : "failed";
    }
  };
}

export function adminClient(config: DispatchConfig): DispatchClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function dispatchTicker(run: () => Promise<unknown>): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    await run().catch(() => null);
    running = false;
  };
}

export function startDailyDispatch(env: DispatchEnv = process.env, every: typeof setInterval = setInterval): ReturnType<typeof setInterval> | null {
  const config = dispatchConfigFrom(env);
  if (config === null) return null;
  const client = adminClient(config);
  const send = webPushSender(config);
  const tick = dispatchTicker(() => runDailyDispatch(client, send, new Date()));
  void tick();
  const timer = every(() => void tick(), dispatchIntervalMs);
  timer.unref?.();
  return timer;
}
