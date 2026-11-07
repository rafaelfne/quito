import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PushStatus } from "@/lib/push-subscription";

const client = vi.hoisted(() => ({ from: vi.fn() }));
const push = vi.hoisted(() => ({ checkPush: vi.fn(), enablePush: vi.fn(), browserPushEnvironment: vi.fn() }));
const state = vi.hoisted(() => ({ setters: [] as ReturnType<typeof vi.fn>[] }));
const captured: { status?: PushStatus; busy?: boolean; onEnable?: () => void } = {};

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useEffect: (effect: () => void) => effect(),
    useState: (initial: unknown) => {
      const setter = vi.fn();
      state.setters.push(setter);
      return [initial, setter];
    },
  };
});
vi.mock("@/lib/supabase", () => ({ supabase: client }));
vi.mock("@/lib/push-subscription", () => push);
vi.mock("./notifications-section-view", () => ({
  NotificationsSectionView: (props: typeof captured) => {
    Object.assign(captured, props);
    return <p>notificações</p>;
  },
}));

const { NotificationsSection } = await import("./notifications-section");

const environment = { userAgent: "teste" };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  state.setters.length = 0;
  vi.stubGlobal("window", {});
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "chave-publica");
  push.browserPushEnvironment.mockReset().mockReturnValue(environment);
  push.checkPush.mockReset().mockResolvedValue("off");
  push.enablePush.mockReset().mockResolvedValue("active");
});

describe("NotificationsSection", () => {
  test("abre conferindo e mostra o que encontrou, sem pedir a permissão", async () => {
    renderToStaticMarkup(<NotificationsSection />);
    expect(captured.status).toBe("checking");
    expect(captured.busy).toBe(false);
    expect(push.checkPush).toHaveBeenCalledWith(environment, client);
    expect(push.enablePush).not.toHaveBeenCalled();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("off");
  });

  test("ao tocar em ativar, pede a permissão com a chave do Quitô e mostra o resultado", async () => {
    renderToStaticMarkup(<NotificationsSection />);
    const [setStatus, setBusy] = state.setters;
    captured.onEnable!();
    expect(setBusy).toHaveBeenCalledWith(true);
    expect(push.enablePush).toHaveBeenCalledWith(environment, client, "chave-publica");
    await settle();
    expect(setStatus).toHaveBeenCalledWith("active");
    expect(setBusy).toHaveBeenLastCalledWith(false);
  });

  test("sem a chave configurada, ainda tenta e mostra a falha", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", undefined);
    renderToStaticMarkup(<NotificationsSection />);
    captured.onEnable!();
    expect(push.enablePush).toHaveBeenCalledWith(environment, client, "");
    await settle();
  });
});
