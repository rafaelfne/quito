import { beforeEach, describe, expect, test, vi } from "vitest";

type Listener = (event: Record<string, unknown>) => void;

const { listeners, worker } = vi.hoisted(() => {
  const listeners = new Map<string, Listener>();
  const worker = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(() => "claimed"), openWindow: vi.fn((path: string) => `opened ${path}`) },
    registration: { showNotification: vi.fn((title: string) => `shown ${title}`) },
  };
  vi.stubGlobal("self", worker);
  return { listeners, worker };
});

import "@/public/sw.js";

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
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Quitô", { body: "", data: { path: "/charges" } });
    pushWith({ json: () => { throw new Error("quebrado"); } });
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Quitô", { body: "", data: { path: "/charges" } });
  });

  test("não abre endereço de fora do Quitô", () => {
    pushWith({ json: () => ({ title: "Oi", path: "//outro.site" }) });
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Oi", { body: "", data: { path: "/charges" } });
    pushWith({ json: () => ({ path: "https://outro.site" }) });
    expect(worker.registration.showNotification).toHaveBeenLastCalledWith("Quitô", { body: "", data: { path: "/charges" } });
  });

  test("o toque fecha a notificação e abre o caminho dela", () => {
    const close = vi.fn();
    const waitUntil = fire("notificationclick", { notification: { close, data: { path: "/charges" } } });
    expect(close).toHaveBeenCalled();
    expect(waitUntil).toHaveBeenCalledWith("opened /charges");
  });

  test("toque sem caminho abre o painel", () => {
    fire("notificationclick", { notification: { close: vi.fn(), data: null } });
    expect(worker.clients.openWindow).toHaveBeenCalledWith("/charges");
  });
});
