import { describe, expect, test, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ from: vi.fn() })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));

const { bearerToken, handlePushTest, pushTestMessage, sendPushTest } = await import("./push-test");
import type { DispatchClient, PushSender } from "./daily-dispatch";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://banco.exemplo",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anonima",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "publica",
  VAPID_PRIVATE_KEY: "privada",
  VAPID_SUBJECT: "mailto:contato@exemplo.com",
};

const device = { endpoint: "https://push.exemplo/a", p256dh: "k", auth: "s" };

function database(found: unknown = device, error: unknown = null) {
  const removed = vi.fn(async () => ({ error: null }));
  const lookups: string[] = [];
  const client = {
    from: vi.fn(() => ({
      select: () => ({
        eq: (_column: string, value: string) => {
          lookups.push(value);
          return { maybeSingle: async () => ({ data: found, error }) };
        },
      }),
      delete: () => ({ eq: removed }),
    })),
  } as unknown as DispatchClient;
  return { client, removed, lookups };
}

function request(body: unknown, token: string | null = "token") {
  return new Request("http://localhost/api/push-test", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("notificação de teste", () => {
  test("abre o guia ao ser tocada e não traz nome nem valor", () => {
    expect(pushTestMessage).toEqual({ title: "Quitô", body: "Notificação de teste: as notificações deste celular estão funcionando.", path: "/notifications/guide?from=test" });
  });

  test("vai só para o aparelho do professor que pediu", async () => {
    const { client, lookups } = database();
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await sendPushTest(client, device.endpoint, send)).toBe("sent");
    expect(lookups).toEqual([device.endpoint]);
    expect(send).toHaveBeenCalledWith(device, pushTestMessage);
  });

  test("aparelho sem inscrição guardada volta como vencido, sem enviar", async () => {
    const { client } = database(null);
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await sendPushTest(client, device.endpoint, send)).toBe("gone");
    expect(send).not.toHaveBeenCalled();
  });

  test("inscrição que o celular desfez sai do banco", async () => {
    const { client, removed } = database();
    expect(await sendPushTest(client, device.endpoint, async () => "gone")).toBe("gone");
    expect(removed).toHaveBeenCalledWith("endpoint", device.endpoint);
  });

  test("banco fora do ar aparece como falha", async () => {
    const { client } = database(null, { message: "fora do ar" });
    expect(await sendPushTest(client, device.endpoint, async () => "sent")).toBe("failed");
  });
});

describe("pedido da notificação de teste", () => {
  test("sem as chaves de notificação no servidor, não envia", async () => {
    const response = await handlePushTest(request({ endpoint: device.endpoint }), { ...env, VAPID_PRIVATE_KEY: "" });
    expect(response.status).toBe(503);
  });

  test("sem a sessão do professor, recusa", async () => {
    expect((await handlePushTest(request({ endpoint: device.endpoint }, null), env)).status).toBe(401);
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer abc")).toBe("abc");
  });

  test("sem um endereço de aparelho válido, recusa", async () => {
    expect((await handlePushTest(request({ endpoint: "http://inseguro" }), env)).status).toBe(400);
    expect((await handlePushTest(request({}), env)).status).toBe(400);
    expect((await handlePushTest(request("não é json"), env)).status).toBe(400);
  });

  test("com tudo certo, envia como o professor e devolve o resultado", async () => {
    const { client } = database();
    const connect = vi.fn(() => client);
    const sender = vi.fn(() => async () => "sent" as const);
    const response = await handlePushTest(request({ endpoint: device.endpoint }), env, { connect, sender });
    expect(await response.json()).toEqual({ result: "sent" });
    expect(connect).toHaveBeenCalledWith(env, "token");
    expect(sender).toHaveBeenCalledWith({ vapidPublicKey: "publica", vapidPrivateKey: "privada", vapidSubject: env.VAPID_SUBJECT });
  });

  test("por padrão, entra no banco com a sessão do professor", async () => {
    await handlePushTest(request({ endpoint: device.endpoint }), env);
    expect(createClient).toHaveBeenCalledWith("https://banco.exemplo", "anonima", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: "Bearer token" } },
    });
  });

  test("erro inesperado vira falha", async () => {
    const connect = () => {
      throw new Error("quebrou");
    };
    const response = await handlePushTest(request({ endpoint: device.endpoint }), env, { connect, sender: vi.fn() });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ result: "failed" });
  });
});
