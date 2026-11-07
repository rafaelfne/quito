import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type MessagePreviewClient = Pick<SupabaseClient, "from">;

export type MessagePreviewLoad = { ok: true; confirmed: boolean } | { ok: false };

const table = "message_previews";

export async function loadMessagePreview(client: MessagePreviewClient): Promise<MessagePreviewLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select("confirmed_at").maybeSingle()), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, confirmed: data !== null };
  } catch {
    return { ok: false };
  }
}

export async function confirmMessagePreview(client: MessagePreviewClient): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).upsert({ confirmed_at: new Date().toISOString() }, { onConflict: "owner_id", ignoreDuplicates: true })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}
