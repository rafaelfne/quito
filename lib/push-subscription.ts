import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type PushSubscriptionClient = Pick<SupabaseClient, "from">;

export type PushDevice = "android" | "iphone" | "computer";

export type PushStatus = "checking" | "unsupported" | "needs-install" | "off" | "blocked" | "active" | "failed";

export type PushPermission = "default" | "granted" | "denied";

export type PushSubscriptionData = { endpoint?: string; keys?: Record<string, string> };

export type PushSubscriptionHandle = { toJSON(): PushSubscriptionData };

export type PushManagerHandle = {
  getSubscription(): Promise<PushSubscriptionHandle | null>;
  subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array<ArrayBuffer> }): Promise<PushSubscriptionHandle>;
};

export type PushEnvironment = {
  userAgent: string;
  standalone: boolean;
  supported: boolean;
  permission(): PushPermission;
  requestPermission(): Promise<PushPermission>;
  pushManager(): Promise<PushManagerHandle>;
};

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  device: PushDevice;
  seen_at: string;
};

export const serviceWorkerPath = "/sw.js";

export const pushStatusMessages: Record<PushStatus, string> = {
  checking: "Conferindo as notificações deste aparelho...",
  unsupported: "Este navegador não recebe notificações do Quitô. No celular, abra o Quitô pelo Chrome (Android) ou pelo Safari (iPhone).",
  "needs-install": "No iPhone, as notificações só chegam com o Quitô instalado. Adicione o Quitô à tela de início pelo Safari, abra pelo ícone e ative aqui.",
  off: "As notificações estão desligadas neste aparelho.",
  blocked: "As notificações foram bloqueadas neste aparelho. Libere nos ajustes do navegador e volte aqui.",
  active: "As notificações estão ativas neste aparelho.",
  failed: "Não deu para ativar as notificações agora. Confira a internet e tente de novo.",
};

export const pushActionLabel = "Ativar as notificações";

const table = "push_subscriptions";

export function deviceFrom(userAgent: string): PushDevice {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iphone";
  if (/Android/.test(userAgent)) return "android";
  return "computer";
}

export function offersPushAction(status: PushStatus): boolean {
  return status === "off" || status === "failed";
}

export function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function subscriptionRow(subscription: PushSubscriptionHandle, device: PushDevice, now: Date): PushSubscriptionRow | null {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) return null;
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth, device, seen_at: now.toISOString() };
}

export async function saveSubscription(client: PushSubscriptionClient, row: PushSubscriptionRow): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).upsert(row, { onConflict: "owner_id,endpoint" })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

function blockedStatus(environment: PushEnvironment): PushStatus | null {
  if (deviceFrom(environment.userAgent) === "iphone" && !environment.standalone) return "needs-install";
  return environment.supported ? null : "unsupported";
}

async function keep(client: PushSubscriptionClient, environment: PushEnvironment, subscription: PushSubscriptionHandle, now: Date): Promise<PushStatus> {
  const row = subscriptionRow(subscription, deviceFrom(environment.userAgent), now);
  if (!row) return "failed";
  return (await saveSubscription(client, row)) ? "active" : "failed";
}

export async function checkPush(environment: PushEnvironment, client: PushSubscriptionClient, now: Date = new Date()): Promise<PushStatus> {
  const blocked = blockedStatus(environment);
  if (blocked) return blocked;
  const permission = environment.permission();
  if (permission === "denied") return "blocked";
  if (permission === "default") return "off";
  try {
    const manager = await withTimeout(environment.pushManager(), requestTimeoutMs);
    const subscription = await manager.getSubscription();
    return subscription ? await keep(client, environment, subscription, now) : "off";
  } catch {
    return "failed";
  }
}

export async function enablePush(environment: PushEnvironment, client: PushSubscriptionClient, publicKey: string, now: Date = new Date()): Promise<PushStatus> {
  const blocked = blockedStatus(environment);
  if (blocked) return blocked;
  if (!publicKey) return "failed";
  try {
    const permission = await environment.requestPermission();
    if (permission === "denied") return "blocked";
    if (permission === "default") return "off";
    const manager = await withTimeout(environment.pushManager(), requestTimeoutMs);
    const existing = await manager.getSubscription();
    const subscription = existing ?? (await manager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    return await keep(client, environment, subscription, now);
  } catch {
    return "failed";
  }
}

export async function currentEndpoint(environment: PushEnvironment): Promise<string | null> {
  if (blockedStatus(environment) || environment.permission() !== "granted") return null;
  try {
    const manager = await withTimeout(environment.pushManager(), requestTimeoutMs);
    const subscription = await manager.getSubscription();
    return subscription?.toJSON().endpoint ?? null;
  } catch {
    return null;
  }
}

type PushWindow = {
  navigator: Navigator & { standalone?: boolean };
  matchMedia?: (query: string) => { matches: boolean };
  Notification?: { permission: PushPermission; requestPermission(): Promise<PushPermission> };
  PushManager?: unknown;
};

export function browserPushEnvironment(view: PushWindow): PushEnvironment {
  const { navigator } = view;
  const notification = view.Notification;
  const supported = "serviceWorker" in navigator && view.PushManager !== undefined && notification !== undefined;
  return {
    userAgent: navigator.userAgent,
    standalone: navigator.standalone === true || view.matchMedia?.("(display-mode: standalone)").matches === true,
    supported,
    permission: () => notification?.permission ?? "denied",
    requestPermission: () => notification?.requestPermission() ?? Promise.resolve("denied"),
    pushManager: async () => {
      await navigator.serviceWorker.register(serviceWorkerPath);
      const registration = await navigator.serviceWorker.ready;
      return registration.pushManager as unknown as PushManagerHandle;
    },
  };
}
