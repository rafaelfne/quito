import { beforeEach, describe, expect, test, vi } from "vitest";

type Listener = (event: Record<string, unknown>) => void;

const { listeners, worker } = vi.hoisted(() => {
  const listeners = new Map<string, Listener>();
  const worker = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(() => "claimed"), openWindow: vi.fn(async (path: string) => `opened ${path}`), matchAll: vi.fn(async (): Promise<unknown[]> => []) },
    registration: { showNotification: vi.fn((title: string) => `shown ${title}`) },
  };
  vi.stubGlobal("self", worker);
  return { listeners, worker };
});

import "@/public/sw.js";
import { notificationTapPath } from "@/lib/charges";

function fire(type: string, event: Record<string, unknown>) {
  const waitUntil = vi.fn();
  listeners.get(type)!({ ...event, waitUntil });
  return waitUntil;
}

function pushWith(data: unknown) {
  return fire("push", { data });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("service worker do Quitô", () => {
  test("assume o aparelho assim que instala", () => {
    listeners.get("install")!({});
    expect(worker.skipWaiting).toHaveBeenCalled();
    expect(fire("activate", {})).toHaveBeenCalledWith("claimed");
  });

  test("mostra a notificação com o texto e o caminho recebidos", () => {
    const waitUntil = pushWith({ json: () => ({ title: "Quitô", body: "3 cobranças para enviar hoje", path: "/charges?day=2026-11-07" }) });
    expect(worker.registration.showNotification).toHaveBeenCalledWith("Quitô", { body: "3 cobranças para enviar hoje", data: { path: "/charges?day=2026-11-07" } });
    expect(waitUntil).toHaveBeenCalledWith("shown Quitô");
  });

  test("sem dados, ou com dados quebrados, mostra o aviso padrão e leva ao painel", () => {
    pushWith(null);
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Quitô", { body: "", data: { path: notificationTapPath } });
    pushWith({ json: () => { throw new Error("quebrado"); } });
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Quitô", { body: "", data: { path: notificationTapPath } });
  });

  test("não abre endereço de fora do Quitô", () => {
    pushWith({ json: () => ({ title: "Oi", path: "//outro.site" }) });
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Oi", { body: "", data: { path: notificationTapPath } });
    pushWith({ json: () => ({ path: "https://outro.site" }) });
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Quitô", { body: "", data: { path: notificationTapPath } });
  });

  test("o toque fecha a notificação e abre o caminho dela", async () => {
    const close = vi.fn();
    const waitUntil = fire("notificationclick", { notification: { close, data: { path: "/charges" } } });
    expect(close).toHaveBeenCalled();
    expect(await waitUntil.mock.calls[0][0]).toBe("opened /charges");
    expect(worker.clients.matchAll).toHaveBeenCalledWith({ type: "window", includeUncontrolled: true });
  });

  test("toque sem caminho abre o painel do dia vindo da notificação", async () => {
    const waitUntil = fire("notificationclick", { notification: { close: vi.fn(), data: null } });
    await waitUntil.mock.calls[0][0];
    expect(worker.clients.openWindow).toHaveBeenCalledWith(notificationTapPath);
    expect(notificationTapPath).toBe("/charges?from=notification");
  });

  test("com o Quitô já aberto, leva aquela janela ao painel e traz para a frente", async () => {
    const focus = vi.fn(async () => "focused");
    const navigate = vi.fn(async () => ({ focus }));
    worker.clients.matchAll.mockResolvedValueOnce([{ navigate }]);
    const waitUntil = fire("notificationclick", { notification: { close: vi.fn(), data: { path: notificationTapPath } } });
    expect(await waitUntil.mock.calls[0][0]).toBe("focused");
    expect(navigate).toHaveBeenCalledWith(notificationTapPath);
    expect(worker.clients.openWindow).not.toHaveBeenCalled();
  });

  test("se a janela aberta não muda de endereço, abre uma nova", async () => {
    const focus = vi.fn(async () => "focused");
    worker.clients.matchAll.mockResolvedValueOnce([{ navigate: vi.fn(async () => null), focus }]);
    expect(await fire("notificationclick", { notification: { close: vi.fn(), data: null } }).mock.calls[0][0]).toBe("focused");
    worker.clients.matchAll.mockResolvedValueOnce([{ navigate: vi.fn(async () => { throw new TypeError("não controlada"); }) }]);
    expect(await fire("notificationclick", { notification: { close: vi.fn(), data: null } }).mock.calls[0][0]).toBe(`opened ${notificationTapPath}`);
  });
});
