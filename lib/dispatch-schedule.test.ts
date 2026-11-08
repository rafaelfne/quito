import { afterEach, describe, expect, test, vi } from "vitest";

const runDailyDispatch = vi.hoisted(() => vi.fn(async () => ({ notified: 0, quiet: 0, failed: 0 })));
const createClient = vi.hoisted(() => vi.fn(() => ({ from: vi.fn() })));
const sendNotification = vi.hoisted(() => vi.fn(async () => ({ statusCode: 201, body: "", headers: {} })));

vi.mock("@/lib/daily-dispatch", () => ({ runDailyDispatch }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("web-push", () => ({ default: { sendNotification } }));

import { vapidConfigFrom, dispatchConfigFrom, dispatchIntervalMs, dispatchTicker, startDailyDispatch, webPushSender, type DispatchConfig, type Notify } from "@/lib/dispatch-schedule";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://banco.exemplo",
  SUPABASE_SERVICE_ROLE_KEY: "chave-do-servidor",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "publica",
  VAPID_PRIVATE_KEY: "privada",
  VAPID_SUBJECT: "mailto:contato@exemplo.com",
};

const config: DispatchConfig = { supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, vapidPublicKey: "publica", vapidPrivateKey: "privada", vapidSubject: env.VAPID_SUBJECT };

const device = { endpoint: "https://push.exemplo/a", p256dh: "k", auth: "s" };

const message = { title: "Quitô", body: "1 cobrança para enviar hoje", path: "/charges" };

afterEach(() => vi.clearAllMocks());

describe("configuração do disparo", () => {
  test("com todas as chaves, monta a configuração", () => {
    expect(dispatchConfigFrom(env)).toEqual(config);
  });

  test("faltando uma chave, o disparo fica desligado", () => {
    expect(dispatchConfigFrom({ ...env, VAPID_PRIVATE_KEY: "" })).toBeNull();
    expect(dispatchConfigFrom({ ...env, SUPABASE_SERVICE_ROLE_KEY: undefined })).toBeNull();
  });
});

describe("chaves das notificações", () => {
  test("bastam as três chaves VAPID, sem a chave do servidor", () => {
    expect(vapidConfigFrom({ ...env, SUPABASE_SERVICE_ROLE_KEY: undefined })).toEqual({ vapidPublicKey: "publica", vapidPrivateKey: "privada", vapidSubject: env.VAPID_SUBJECT });
    expect(vapidConfigFrom({ ...env, VAPID_SUBJECT: "" })).toBeNull();
  });
});

describe("envio da notificação", () => {
  test("manda a mensagem assinada para o aparelho", async () => {
    const notify = vi.fn(async () => ({ statusCode: 201, body: "", headers: {} }));
    expect(await webPushSender(config, notify as unknown as Notify)(device, message)).toBe("sent");
    expect(notify).toHaveBeenCalledWith({ endpoint: device.endpoint, keys: { p256dh: "k", auth: "s" } }, JSON.stringify(message), {
      vapidDetails: { subject: env.VAPID_SUBJECT, publicKey: "publica", privateKey: "privada" },
      TTL: 43200,
      urgency: "high",
    });
  });

  test("usa a biblioteca de notificações quando nada é passado", async () => {
    expect(await webPushSender(config)(device, message)).toBe("sent");
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  test("aparelho que saiu da inscrição é marcado para sair da lista", async () => {
    for (const statusCode of [404, 410]) {
      const notify = vi.fn(async () => Promise.reject(Object.assign(new Error("sumiu"), { statusCode })));
      expect(await webPushSender(config, notify as unknown as Notify)(device, message)).toBe("gone");
    }
  });

  test("outro erro só conta como falha", async () => {
    const withStatus = vi.fn(async () => Promise.reject(Object.assign(new Error("fora do ar"), { statusCode: 500 })));
    expect(await webPushSender(config, withStatus as unknown as Notify)(device, message)).toBe("failed");
    const withoutStatus = vi.fn(async () => Promise.reject(new Error("rede")));
    expect(await webPushSender(config, withoutStatus as unknown as Notify)(device, message)).toBe("failed");
  });
});

describe("volta do disparo", () => {
  test("não roda duas voltas ao mesmo tempo", async () => {
    let finish: () => void = () => undefined;
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const tick = dispatchTicker(run);
    const first = tick();
    await tick();
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await first;
    void tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  test("um erro numa volta não impede a próxima", async () => {
    const run = vi.fn(async () => Promise.reject(new Error("fora do ar")));
    const tick = dispatchTicker(run);
    await tick();
    await tick();
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("ligar o disparo com o servidor", () => {
  test("sem as chaves, não liga", () => {
    const every = vi.fn();
    expect(startDailyDispatch({}, every as unknown as typeof setInterval)).toBeNull();
    expect(every).not.toHaveBeenCalled();
  });

  test("com as chaves, roda logo e depois a cada cinco minutos", async () => {
    const unref = vi.fn();
    let repeat: () => void = () => undefined;
    const every = vi.fn((callback: () => void) => ((repeat = callback), { unref }));
    const timer = startDailyDispatch(env, every as unknown as typeof setInterval);
    expect(timer).toEqual({ unref });
    expect(createClient).toHaveBeenCalledWith(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    expect(every).toHaveBeenCalledWith(expect.any(Function), dispatchIntervalMs);
    expect(dispatchIntervalMs).toBe(300000);
    expect(unref).toHaveBeenCalled();
    await vi.waitFor(() => expect(runDailyDispatch).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    repeat();
    await vi.waitFor(() => expect(runDailyDispatch).toHaveBeenCalledTimes(2));
  });

  test("lê as chaves do servidor quando nada é passado", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(startDailyDispatch()).toBeNull();
    vi.unstubAllEnvs();
  });
});
