import { describe, expect, test, vi } from "vitest";
import { notificationEventRow, notificationEventsTable, recordNotificationEvent } from "@/lib/notification-events";

const now = new Date(2026, 10, 10, 9, 30);

function clientWith(upsert: ReturnType<typeof vi.fn>) {
  return { from: vi.fn(() => ({ upsert })) } as unknown as Parameters<typeof recordNotificationEvent>[0];
}

describe("registro para medir", () => {
  test("cada registro leva o tipo, o celular, o dia e a hora", () => {
    expect(notificationEventRow("tap", "android", now)).toEqual({ kind: "tap", device: "android", day: "2026-11-10", occurred_at: now.toISOString() });
    expect(notificationEventRow("inactive", "iphone", now, "2026-11-09").day).toBe("2026-11-09");
  });

  test("guarda uma linha por tipo, celular e dia, atualizando a hora", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = clientWith(upsert);
    const row = notificationEventRow("active", "iphone", now);
    expect(await recordNotificationEvent(client, row)).toBe(true);
    expect(client.from).toHaveBeenCalledWith(notificationEventsTable);
    expect(upsert).toHaveBeenCalledWith(row, { onConflict: "owner_id,kind,device,day" });
  });

  test("banco recusando ou internet caída não derruba a tela", async () => {
    const row = notificationEventRow("active", "android", now);
    expect(await recordNotificationEvent(clientWith(vi.fn().mockResolvedValue({ error: { message: "recusado" } })), row)).toBe(false);
    expect(await recordNotificationEvent(clientWith(vi.fn().mockRejectedValue(new Error("sem rede"))), row)).toBe(false);
  });
});
