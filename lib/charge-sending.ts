import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type ChargeSendingClient = Pick<SupabaseClient, "from">;

const brazilCountryCode = "55";

export function whatsAppLinkFor(phone: string, message: string): string {
  return `https://wa.me/${brazilCountryCode}${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

async function updateCharge(client: ChargeSendingClient, chargeId: string, changes: { sent_at: string | null } | { paid_at: string | null } | { reminders_sent_at: string[] }): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from("charges").update(changes).eq("id", chargeId)), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export function saveChargeSentAt(client: ChargeSendingClient, chargeId: string, sentAt: string | null): Promise<boolean> {
  return updateCharge(client, chargeId, { sent_at: sentAt });
}

export function saveChargePaidAt(client: ChargeSendingClient, chargeId: string, paidAt: string | null): Promise<boolean> {
  return updateCharge(client, chargeId, { paid_at: paidAt });
}

export function saveChargeRemindersSentAt(client: ChargeSendingClient, chargeId: string, remindersSentAt: string[]): Promise<boolean> {
  return updateCharge(client, chargeId, { reminders_sent_at: remindersSentAt });
}
