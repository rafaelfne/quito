import type { SupabaseClient } from "@supabase/supabase-js";
import { counted } from "@/lib/day-work";
import { isFirstChargeOver, loadFirstChargeNoticeOn, type FirstChargeNotice } from "@/lib/first-charge";

export type FirstChargeEveClient = Pick<SupabaseClient, "from">;

export type FirstChargeEve = { dueDate: string; charges: number };

export type FirstChargeEveLoad = { ok: true; eve: FirstChargeEve | null } | { ok: false };

const table = "first_charge_eves";

const dayMs = 24 * 60 * 60 * 1000;

export function nextDay(date: string): string {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + dayMs).toISOString().slice(0, 10);
}

export function firstChargeEveOf(notice: FirstChargeNotice | null, today: string): FirstChargeEve | null {
  if (notice === null || notice.missing !== null || notice.guardians.length === 0) return null;
  const dueDate = notice.guardians.map((guardian) => guardian.dueDate).sort()[0];
  if (nextDay(today) !== dueDate) return null;
  return { dueDate, charges: notice.guardians.filter((guardian) => guardian.dueDate === dueDate).length };
}

export function describeFirstChargeEve({ charges }: FirstChargeEve): string {
  return `Amanhã é o dia da sua primeira cobrança: ${counted(charges, "cobrança", "cobranças")} para enviar. As notificações deste celular estão funcionando.`;
}

export async function loadFirstChargeEve(client: FirstChargeEveClient, today: string): Promise<FirstChargeEveLoad> {
  const { data, error } = await client.from("getting_started").select("started_at").maybeSingle();
  if (error) return { ok: false };
  const startedAt = (data as { started_at: string | null } | null)?.started_at ?? null;
  if (startedAt === null || isFirstChargeOver(startedAt, today)) return { ok: true, eve: null };
  const notice = await loadFirstChargeNoticeOn(client, startedAt, today);
  if (notice === null) return { ok: false };
  return { ok: true, eve: firstChargeEveOf(notice, today) };
}

export async function claimFirstChargeEve(client: FirstChargeEveClient, ownerId: string, eve: FirstChargeEve, devices: number): Promise<boolean> {
  const { data, error } = await client
    .from(table)
    .upsert({ owner_id: ownerId, due_date: eve.dueDate, charges: eve.charges, devices }, { onConflict: "owner_id", ignoreDuplicates: true })
    .select("owner_id");
  return !error && (data ?? []).length > 0;
}

export async function recordFirstChargeEveReach(client: FirstChargeEveClient, ownerId: string, reached: number): Promise<void> {
  await client.from(table).update({ reached }).eq("owner_id", ownerId);
}
