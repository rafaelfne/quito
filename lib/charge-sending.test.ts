import { describe, expect, test, vi } from "vitest";
import { saveChargePaidAt, saveChargeSentAt, whatsAppLinkFor, type ChargeSendingClient } from "@/lib/charge-sending";

function clientWith(result: { error: { message: string } | null }) {
  const eq = vi.fn(async () => result);
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { client: { from } as unknown as ChargeSendingClient, from, update, eq };
}

describe("link do WhatsApp", () => {
  test("abre a conversa com o telefone do responsável e a mensagem já escrita", () => {
    const link = whatsAppLinkFor("11987654321", "Oi, Ana!\nPix: joao@email.com\nR$ 300,00 & 😊");
    expect(link.startsWith("https://wa.me/5511987654321?text=")).toBe(true);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe("Oi, Ana!\nPix: joao@email.com\nR$ 300,00 & 😊");
  });

  test("usa só os números do telefone", () => {
    expect(whatsAppLinkFor("(11) 3333-4444", "Oi")).toBe("https://wa.me/551133334444?text=Oi");
  });
});

describe("guardar o envio", () => {
  test("marca a cobrança como enviada", async () => {
    const { client, from, update, eq } = clientWith({ error: null });
    expect(await saveChargeSentAt(client, "c1", "2026-12-05T13:00:00.000Z")).toBe(true);
    expect(from).toHaveBeenCalledWith("charges");
    expect(update).toHaveBeenCalledWith({ sent_at: "2026-12-05T13:00:00.000Z" });
    expect(eq).toHaveBeenCalledWith("id", "c1");
  });

  test("desfazer apaga o momento do envio", async () => {
    const { client, update } = clientWith({ error: null });
    expect(await saveChargeSentAt(client, "c1", null)).toBe(true);
    expect(update).toHaveBeenCalledWith({ sent_at: null });
  });

  test("erro do banco devolve falha", async () => {
    expect(await saveChargeSentAt(clientWith({ error: { message: "fora do ar" } }).client, "c1", null)).toBe(false);
  });

  test("erro inesperado devolve falha", async () => {
    const client = {
      from: () => {
        throw new Error("sem rede");
      },
    } as unknown as ChargeSendingClient;
    expect(await saveChargeSentAt(client, "c1", null)).toBe(false);
  });
});

describe("guardar o pagamento", () => {
  test("marca a cobrança como paga", async () => {
    const { client, from, update, eq } = clientWith({ error: null });
    expect(await saveChargePaidAt(client, "c1", "2026-12-07T13:00:00.000Z")).toBe(true);
    expect(from).toHaveBeenCalledWith("charges");
    expect(update).toHaveBeenCalledWith({ paid_at: "2026-12-07T13:00:00.000Z" });
    expect(eq).toHaveBeenCalledWith("id", "c1");
  });

  test("desfazer apaga o momento do pagamento", async () => {
    const { client, update } = clientWith({ error: null });
    expect(await saveChargePaidAt(client, "c1", null)).toBe(true);
    expect(update).toHaveBeenCalledWith({ paid_at: null });
  });

  test("erro do banco devolve falha", async () => {
    expect(await saveChargePaidAt(clientWith({ error: { message: "fora do ar" } }).client, "c1", null)).toBe(false);
  });
});
