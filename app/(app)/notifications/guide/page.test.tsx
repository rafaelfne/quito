import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GuideViewProps } from "./guide-view";

const hooks = vi.hoisted(() => {
  let slots: unknown[] = [];
  let cursor = 0;
  return {
    reset() {
      slots = [];
      cursor = 0;
    },
    rewind() {
      cursor = 0;
    },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value: unknown) => {
          slots[index] = typeof value === "function" ? (value as (current: unknown) => unknown)(slots[index]) : value;
        },
      ];
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const index = cursor++;
      const previous = slots[index] as unknown[] | undefined;
      slots[index] = deps;
      if (!previous || deps.some((dep, position) => dep !== previous[position])) cleanups.push(effect());
    },
  };
});
const cleanups: (void | (() => void))[] = [];

const push = vi.hoisted(() => ({ checkPush: vi.fn(), enablePush: vi.fn(), currentEndpoint: vi.fn(), browserPushEnvironment: vi.fn() }));
const getSession = vi.fn();
const requestedParams = { current: "" };

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useState: hooks.useState, useEffect: hooks.useEffect }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(requestedParams.current) }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(), auth: { getSession } } }));
vi.mock("@/lib/push-subscription", async (original) => ({ ...(await original<typeof import("@/lib/push-subscription")>()), ...push }));

const { default: NotificationsGuidePage } = await import("./page");

const androidAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130 Mobile Safari/537.36";
const listeners = new Map<string, (event: Event) => void>();
const fetcher = vi.fn();

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): GuideViewProps {
  hooks.rewind();
  return NotificationsGuidePage().props as GuideViewProps;
}

function installEvent(outcome: "accepted" | "dismissed") {
  return { preventDefault: vi.fn(), prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome }) };
}

beforeEach(() => {
  hooks.reset();
  cleanups.length = 0;
  listeners.clear();
  requestedParams.current = "";
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "chave-publica");
  vi.stubGlobal("window", {
    location: { origin: "https://quito.exemplo" },
    addEventListener: vi.fn((name: string, listener: (event: Event) => void) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
  });
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset().mockResolvedValue({ ok: true, json: async () => ({ result: "sent" }) });
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "token" } } });
  push.browserPushEnvironment.mockReset().mockReturnValue({ userAgent: androidAgent, standalone: false });
  push.checkPush.mockReset().mockResolvedValue("off");
  push.enablePush.mockReset().mockResolvedValue("active");
  push.currentEndpoint.mockReset().mockResolvedValue("https://push.exemplo/a");
});

describe("página do guia de ativação", () => {
  test("abre conferindo o aparelho e as notificações, sem pedir a permissão", async () => {
    expect(view()).toMatchObject({ device: null, push: "checking", install: "manual", test: "idle" });
    await settle();
    expect(view()).toMatchObject({ device: "android", push: "off", install: "manual" });
    expect(push.enablePush).not.toHaveBeenCalled();
  });

  test("monta o link do guia com o endereço do Quitô aberto, para o código do computador", async () => {
    expect(view().guideLink).toBe("");
    await settle();
    expect(view().guideLink).toBe("https://quito.exemplo/notifications/guide");
  });

  test("ao sair da tela, para de ouvir o Chrome", () => {
    view();
    expect(listeners.size).toBe(2);
    for (const cleanup of cleanups) cleanup?.();
    expect(listeners.size).toBe(0);
  });

  test("quando o Chrome oferece, instala com o botão", async () => {
    view();
    const event = installEvent("accepted");
    listeners.get("beforeinstallprompt")?.(event as unknown as Event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(view().install).toBe("can-prompt");
    view().onInstall();
    await settle();
    expect(event.prompt).toHaveBeenCalled();
    expect(view().install).toBe("installed");
  });

  test("se o professor desiste de instalar, volta ao passo pelo menu", async () => {
    view();
    listeners.get("beforeinstallprompt")?.(installEvent("dismissed") as unknown as Event);
    view().onInstall();
    await settle();
    expect(view().install).toBe("manual");
  });

  test("sem a oferta do Chrome, o botão não faz nada", async () => {
    view();
    view().onInstall();
    await settle();
    expect(view().install).toBe("manual");
  });

  test("instalado pelo menu, o passo fica feito", () => {
    view();
    listeners.get("appinstalled")?.({} as Event);
    expect(view().install).toBe("installed");
  });

  test("aberto pelo ícone, o passo de instalar já vem feito", async () => {
    push.browserPushEnvironment.mockReturnValue({ userAgent: androidAgent, standalone: true });
    view();
    await settle();
    expect(view().install).toBe("installed");
  });

  test("ativa as notificações com a chave do Quitô", async () => {
    view();
    await settle();
    view().onEnable();
    expect(view().enabling).toBe(true);
    await settle();
    expect(push.enablePush).toHaveBeenCalledWith(expect.anything(), expect.anything(), "chave-publica");
    expect(view()).toMatchObject({ enabling: false, push: "active" });
  });

  test("bloqueada, confere de novo depois de liberar nos ajustes", async () => {
    push.checkPush.mockResolvedValueOnce("blocked").mockResolvedValueOnce("off");
    view();
    await settle();
    expect(view().push).toBe("blocked");
    view().onRecheck();
    expect(view().push).toBe("checking");
    await settle();
    expect(view().push).toBe("off");
  });

  test("envia a notificação de teste para este aparelho e pergunta se chegou", async () => {
    view();
    view().onSendTest();
    expect(view().test).toBe("sending");
    await settle();
    expect(fetcher).toHaveBeenCalledWith("/api/push-test", expect.objectContaining({ body: JSON.stringify({ endpoint: "https://push.exemplo/a" }) }));
    expect(view().test).toBe("sent");
    view().onArrived();
    expect(view().test).toBe("arrived");
  });

  test("quando não chega, mostra o que conferir", async () => {
    view();
    view().onSendTest();
    await settle();
    view().onNotArrived();
    expect(view().test).toBe("not-arrived");
  });

  test("inscrição vencida volta para o passo de ativar", async () => {
    push.checkPush.mockResolvedValue("active");
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ result: "gone" }) });
    view();
    await settle();
    view().onSendTest();
    await settle();
    expect(view()).toMatchObject({ test: "gone", push: "off" });
  });

  test("sem sessão, o teste aparece como falha", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    view();
    view().onSendTest();
    await settle();
    expect(view().test).toBe("failed");
  });

  test("aberta pelo toque na notificação de teste, o guia termina", () => {
    requestedParams.current = "from=test";
    expect(view().test).toBe("arrived");
  });
});
