import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  browserPushEnvironment,
  checkPush,
  currentEndpoint,
  deviceFrom,
  enablePush,
  keyBytes,
  offersPushAction,
  pushStatusMessages,
  saveSubscription,
  serviceWorkerPath,
  subscriptionRow,
  type PushEnvironment,
  type PushManagerHandle,
  type PushSubscriptionHandle,
} from "./push-subscription";

const androidAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const iphoneAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const computerAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const now = new Date("2026-11-07T12:00:00.000Z");
const publicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function handle(data: { endpoint?: string; keys?: Record<string, string> }): PushSubscriptionHandle {
  return { toJSON: () => data };
}

const subscription = handle({ endpoint: "https://push.example/abc", keys: { p256dh: "chave", auth: "segredo" } });

function manager(existing: PushSubscriptionHandle | null = null): PushManagerHandle & { subscribe: ReturnType<typeof vi.fn> } {
  return { getSubscription: vi.fn().mockResolvedValue(existing), subscribe: vi.fn().mockResolvedValue(subscription) };
}

function environment(overrides: Partial<PushEnvironment> = {}): PushEnvironment {
  return {
    userAgent: androidAgent,
    standalone: true,
    supported: true,
    permission: () => "granted",
    requestPermission: vi.fn().mockResolvedValue("granted"),
    pushManager: vi.fn().mockResolvedValue(manager(subscription)),
    ...overrides,
  };
}

const upsert = vi.fn();
const client = { from: vi.fn(() => ({ upsert })) } as unknown as Parameters<typeof saveSubscription>[0];

beforeEach(() => {
  upsert.mockReset().mockResolvedValue({ error: null });
});

describe("tipo de aparelho", () => {
  test("reconhece Android, iPhone e computador", () => {
    expect(deviceFrom(androidAgent)).toBe("android");
    expect(deviceFrom(iphoneAgent)).toBe("iphone");
    expect(deviceFrom("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)")).toBe("iphone");
    expect(deviceFrom(computerAgent)).toBe("computer");
  });
});

describe("botão de ativar", () => {
  test("aparece só quando dá para ativar agora", () => {
    expect(offersPushAction("off")).toBe(true);
    expect(offersPushAction("failed")).toBe(true);
    for (const status of ["checking", "unsupported", "needs-install", "blocked", "active"] as const) expect(offersPushAction(status)).toBe(false);
  });

  test("cada situação tem uma explicação", () => {
    expect(pushStatusMessages.active).toBe("As notificações estão ativas neste aparelho.");
    expect(pushStatusMessages["needs-install"]).toContain("tela de início");
  });
});

describe("chave pública", () => {
  test("vira os bytes que o navegador pede", () => {
    const bytes = keyBytes(publicKey);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
    expect(Array.from(keyBytes("-_8"))).toEqual([251, 255]);
  });
});

describe("inscrição guardada", () => {
  test("leva o endereço, as chaves, o aparelho e quando foi vista", () => {
    expect(subscriptionRow(subscription, "android", now)).toEqual({
      endpoint: "https://push.example/abc",
      p256dh: "chave",
      auth: "segredo",
      device: "android",
      seen_at: "2026-11-07T12:00:00.000Z",
    });
  });

  test("sem endereço ou sem chaves, não serve", () => {
    expect(subscriptionRow(handle({ keys: { p256dh: "a", auth: "b" } }), "android", now)).toBeNull();
    expect(subscriptionRow(handle({ endpoint: "https://x" }), "android", now)).toBeNull();
    expect(subscriptionRow(handle({ endpoint: "https://x", keys: { p256dh: "a" } }), "android", now)).toBeNull();
  });

  test("guarda uma linha por aparelho do professor", async () => {
    const row = subscriptionRow(subscription, "iphone", now)!;
    expect(await saveSubscription(client, row)).toBe(true);
    expect(client.from).toHaveBeenCalledWith("push_subscriptions");
    expect(upsert).toHaveBeenCalledWith(row, { onConflict: "owner_id,endpoint" });
  });

  test("avisa quando o banco recusa ou a internet cai", async () => {
    const row = subscriptionRow(subscription, "android", now)!;
    upsert.mockResolvedValueOnce({ error: { message: "recusado" } });
    expect(await saveSubscription(client, row)).toBe(false);
    upsert.mockRejectedValueOnce(new Error("sem rede"));
    expect(await saveSubscription(client, row)).toBe(false);
  });
});

describe("conferir as notificações ao abrir", () => {
  test("no iPhone fora do app instalado, pede para instalar antes", async () => {
    expect(await checkPush(environment({ userAgent: iphoneAgent, standalone: false, supported: false }), client, now)).toBe("needs-install");
  });

  test("navegador sem notificação não oferece ativar", async () => {
    expect(await checkPush(environment({ supported: false }), client, now)).toBe("unsupported");
  });

  test("permissão negada aparece como bloqueada", async () => {
    expect(await checkPush(environment({ permission: () => "denied" }), client, now)).toBe("blocked");
  });

  test("sem pedir a permissão, fica desligada e não pergunta nada sozinho", async () => {
    const ask = vi.fn();
    const env = environment({ permission: () => "default", requestPermission: ask });
    expect(await checkPush(env, client, now)).toBe("off");
    expect(ask).not.toHaveBeenCalled();
    expect(env.pushManager).not.toHaveBeenCalled();
  });

  test("com a permissão dada mas sem inscrição, fica desligada", async () => {
    expect(await checkPush(environment({ pushManager: vi.fn().mockResolvedValue(manager(null)) }), client, now)).toBe("off");
    expect(upsert).not.toHaveBeenCalled();
  });

  test("com inscrição, confirma no banco e mostra ativa", async () => {
    expect(await checkPush(environment(), client, now)).toBe("active");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.example/abc", device: "android", seen_at: now.toISOString() }), expect.anything());
  });

  test("inscrição que não dá para guardar aparece como falha", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "recusado" } });
    expect(await checkPush(environment(), client, now)).toBe("failed");
    expect(await checkPush(environment({ pushManager: vi.fn().mockResolvedValue(manager(handle({}))) }), client, now)).toBe("failed");
  });

  test("quando o navegador falha, aparece como falha", async () => {
    expect(await checkPush(environment({ pushManager: vi.fn().mockRejectedValue(new Error("sem worker")) }), client, now)).toBe("failed");
  });

  test("usa a hora de agora quando não recebe outra", async () => {
    expect(await checkPush(environment(), client)).toBe("active");
  });
});

describe("ativar as notificações", () => {
  test("no iPhone fora do app instalado, não pede a permissão", async () => {
    const ask = vi.fn();
    expect(await enablePush(environment({ userAgent: iphoneAgent, standalone: false, requestPermission: ask }), client, publicKey, now)).toBe("needs-install");
    expect(ask).not.toHaveBeenCalled();
  });

  test("no iPhone com o app instalado, pede a permissão", async () => {
    expect(await enablePush(environment({ userAgent: iphoneAgent, standalone: true }), client, publicKey, now)).toBe("active");
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ device: "iphone" }), expect.anything());
  });

  test("sem a chave pública, não dá para ativar", async () => {
    const ask = vi.fn();
    expect(await enablePush(environment({ requestPermission: ask }), client, "", now)).toBe("failed");
    expect(ask).not.toHaveBeenCalled();
  });

  test("quem nega fica bloqueado e quem fecha a pergunta fica desligado", async () => {
    expect(await enablePush(environment({ requestPermission: vi.fn().mockResolvedValue("denied") }), client, publicKey, now)).toBe("blocked");
    expect(await enablePush(environment({ requestPermission: vi.fn().mockResolvedValue("default") }), client, publicKey, now)).toBe("off");
    expect(upsert).not.toHaveBeenCalled();
  });

  test("com a permissão, inscreve o aparelho com a chave do Quitô e guarda", async () => {
    const fresh = manager(null);
    const env = environment({ pushManager: vi.fn().mockResolvedValue(fresh) });
    expect(await enablePush(env, client, publicKey, now)).toBe("active");
    expect(fresh.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.example/abc" }), expect.anything());
  });

  test("aproveita a inscrição que o aparelho já tem", async () => {
    const existing = manager(subscription);
    expect(await enablePush(environment({ pushManager: vi.fn().mockResolvedValue(existing) }), client, publicKey, now)).toBe("active");
    expect(existing.subscribe).not.toHaveBeenCalled();
  });

  test("quando a inscrição ou o banco falham, aparece como falha", async () => {
    const broken = manager(null);
    broken.subscribe.mockRejectedValue(new Error("recusado"));
    expect(await enablePush(environment({ pushManager: vi.fn().mockResolvedValue(broken) }), client, publicKey, now)).toBe("failed");
    upsert.mockResolvedValueOnce({ error: { message: "recusado" } });
    expect(await enablePush(environment(), client, publicKey, now)).toBe("failed");
  });

  test("usa a hora de agora quando não recebe outra", async () => {
    expect(await enablePush(environment(), client, publicKey)).toBe("active");
  });
});

describe("ambiente do navegador", () => {
  function browser(overrides: Record<string, unknown> = {}) {
    const pushManager = manager(null);
    const serviceWorker = { register: vi.fn().mockResolvedValue({}), ready: Promise.resolve({ pushManager }) };
    const navigator = { userAgent: androidAgent, serviceWorker, ...overrides } as unknown as Navigator;
    return { navigator, serviceWorker, pushManager };
  }

  test("com tudo o que a notificação precisa, registra o worker e entrega a inscrição", async () => {
    const { navigator, serviceWorker, pushManager } = browser();
    const Notification = { permission: "granted" as const, requestPermission: vi.fn().mockResolvedValue("granted") };
    const env = browserPushEnvironment({ navigator, Notification, PushManager: {}, matchMedia: () => ({ matches: true }) });
    expect(env.supported).toBe(true);
    expect(env.standalone).toBe(true);
    expect(env.userAgent).toBe(androidAgent);
    expect(env.permission()).toBe("granted");
    expect(await env.requestPermission()).toBe("granted");
    expect(await env.pushManager()).toBe(pushManager);
    expect(serviceWorker.register).toHaveBeenCalledWith(serviceWorkerPath);
    expect(serviceWorkerPath).toBe("/sw.js");
  });

  test("reconhece o app instalado no iPhone", () => {
    const { navigator } = browser({ standalone: true });
    expect(browserPushEnvironment({ navigator }).standalone).toBe(true);
  });

  test("sem notificação no navegador, não é suportado e trata como negada", async () => {
    const { navigator } = browser();
    const env = browserPushEnvironment({ navigator, matchMedia: () => ({ matches: false }) });
    expect(env.supported).toBe(false);
    expect(env.standalone).toBe(false);
    expect(env.permission()).toBe("denied");
    expect(await env.requestPermission()).toBe("denied");
  });

  test("sem service worker, não é suportado", () => {
    const navigator = { userAgent: computerAgent } as Navigator;
    const Notification = { permission: "default" as const, requestPermission: vi.fn() };
    expect(browserPushEnvironment({ navigator, Notification, PushManager: {} }).supported).toBe(false);
  });
});

describe("endereço deste aparelho", () => {
  test("com a inscrição ativa, devolve o endereço dela", async () => {
    expect(await currentEndpoint(environment())).toBe("https://push.example/abc");
  });

  test("sem permissão, sem inscrição, no iPhone fora do app ou com o navegador falhando, não tem endereço", async () => {
    expect(await currentEndpoint(environment({ permission: () => "default" }))).toBeNull();
    expect(await currentEndpoint(environment({ pushManager: vi.fn().mockResolvedValue(manager(null)) }))).toBeNull();
    expect(await currentEndpoint(environment({ userAgent: iphoneAgent, standalone: false }))).toBeNull();
    expect(await currentEndpoint(environment({ pushManager: vi.fn().mockRejectedValue(new Error("sem worker")) }))).toBeNull();
  });
});
