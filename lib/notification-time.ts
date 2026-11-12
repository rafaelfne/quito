import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type NotificationTimeClient = Pick<SupabaseClient, "from">;

export type NotificationTimeRow = { hour: number; time_zone: string; updated_at: string };

export type NotificationTimeSettings = Pick<NotificationTimeRow, "hour" | "time_zone">;

export type NotificationTimeLoad = { ok: true; settings: NotificationTimeSettings | null } | { ok: false };

export type NotificationTimeState = {
  status: "loading" | "ready" | "failed";
  hour: number;
  timeZone: string;
  saving: boolean;
  message: string | null;
  notice: string | null;
};

export const defaultNotificationHour = 9;

export const fallbackTimeZone = "America/Sao_Paulo";

export const notificationHours = Array.from({ length: 24 }, (_, hour) => hour);

export const notificationTimeMessages = {
  loadFailed: "Não deu para abrir o horário do aviso agora. Confira a internet e tente de novo.",
  saveFailed: "Não deu para guardar o horário agora. Confira a internet e escolha de novo.",
};

const table = "notification_settings";

const columns = "hour, time_zone";

export function formatHour(hour: number): string {
  return `${hour}h`;
}

export function savedNotice(hour: number): string {
  return `Horário guardado. O aviso chega às ${formatHour(hour)}, no horário deste celular.`;
}

export function isNotificationHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

export function deviceTimeZone(resolve: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  try {
    const zone = resolve();
    return zone && zone.length <= 64 ? zone : fallbackTimeZone;
  } catch {
    return fallbackTimeZone;
  }
}

export function initialNotificationTime(timeZone: string): NotificationTimeState {
  return { status: "loading", hour: defaultNotificationHour, timeZone, saving: false, message: null, notice: null };
}

export function notificationTimeRow(hour: number, timeZone: string, now: Date): NotificationTimeRow {
  return { hour, time_zone: timeZone, updated_at: now.toISOString() };
}

export async function loadNotificationTime(client: NotificationTimeClient): Promise<NotificationTimeLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select(columns).maybeSingle()), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, settings: data as NotificationTimeSettings | null };
  } catch {
    return { ok: false };
  }
}

export async function saveNotificationTime(client: NotificationTimeClient, row: NotificationTimeRow): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).upsert(row, { onConflict: "owner_id" })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export async function openNotificationTime(client: NotificationTimeClient, timeZone: string, now: Date = new Date()): Promise<NotificationTimeState> {
  const state = initialNotificationTime(timeZone);
  const result = await loadNotificationTime(client);
  if (!result.ok) return { ...state, status: "failed", message: notificationTimeMessages.loadFailed };
  const hour = isNotificationHour(result.settings?.hour) ? result.settings.hour : defaultNotificationHour;
  if (result.settings?.time_zone !== timeZone || result.settings.hour !== hour) {
    await saveNotificationTime(client, notificationTimeRow(hour, timeZone, now));
  }
  return { ...state, status: "ready", hour };
}

export async function chooseNotificationHour(client: NotificationTimeClient, state: NotificationTimeState, hour: number, now: Date = new Date()): Promise<NotificationTimeState> {
  if (!isNotificationHour(hour)) return state;
  const saved = await saveNotificationTime(client, notificationTimeRow(hour, state.timeZone, now));
  if (!saved) return { ...state, saving: false, message: notificationTimeMessages.saveFailed, notice: null };
  return { ...state, hour, saving: false, message: null, notice: savedNotice(hour) };
}
