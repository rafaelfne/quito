import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type ChargeSendingClient = Pick<SupabaseClient, "from">;

const brazilCountryCode = "55";

export function whatsAppLinkFor(phone: string, message: string): string {
  return `https://wa.me/${brazilCountryCode}${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export async function saveChargeSentAt(client: ChargeSendingClient, chargeId: string, sentAt: string | null): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from("charges").update({ sent_at: sentAt }).eq("id", chargeId)), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}
