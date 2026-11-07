import { describe, expect, test, vi } from "vitest";
import { confirmMessagePreview, loadMessagePreview, type MessagePreviewClient } from "./message-preview";

type Failure = { message: string } | null;

function fakeClient(overrides: { load?: () => Promise<{ data: unknown; error: Failure }>; upsert?: () => Promise<{ error: Failure }> } = {}) {
  const maybeSingle = vi.fn(overrides.load ?? (async () => ({ data: null as unknown, error: null as Failure })));
  const select = vi.fn(() => ({ maybeSingle }));
  const upsert = vi.fn(overrides.upsert ?? (async () => ({ error: null as Failure })));
  const from = vi.fn(() => ({ select, upsert }));
  return { client: { from } as unknown as MessagePreviewClient, from, upsert };
}

describe("prévia da mensagem guardada", () => {
  test("sem registro, o professor ainda não passou pela prévia", async () => {
    const { client, from } = fakeClient();
    expect(await loadMessagePreview(client)).toEqual({ ok: true, confirmed: false });
    expect(from).toHaveBeenCalledWith("message_previews");
  });

  test("com registro, a prévia já foi confirmada", async () => {
    const { client } = fakeClient({ load: async () => ({ data: { confirmed_at: "2026-12-05T12:00:00Z" }, error: null }) });
    expect(await loadMessagePreview(client)).toEqual({ ok: true, confirmed: true });
  });

  test("erro ou queda ao ler avisa a tela", async () => {
    expect(await loadMessagePreview(fakeClient({ load: async () => ({ data: null, error: { message: "fora do ar" } }) }).client)).toEqual({ ok: false });
    expect(await loadMessagePreview(fakeClient({ load: async () => Promise.reject(new Error("sem rede")) }).client)).toEqual({ ok: false });
  });

  test("confirmar guarda uma vez só por professor", async () => {
    const { client, upsert } = fakeClient();
    expect(await confirmMessagePreview(client)).toBe(true);
    expect(upsert.mock.calls[0]).toEqual([{ confirmed_at: expect.any(String) }, { onConflict: "owner_id", ignoreDuplicates: true }]);
  });

  test("erro ou queda ao confirmar devolve falso", async () => {
    expect(await confirmMessagePreview(fakeClient({ upsert: async () => ({ error: { message: "fora do ar" } }) }).client)).toBe(false);
    expect(await confirmMessagePreview(fakeClient({ upsert: async () => Promise.reject(new Error("sem rede")) }).client)).toBe(false);
  });
});
