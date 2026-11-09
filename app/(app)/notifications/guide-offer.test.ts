import { beforeEach, describe, expect, test, vi } from "vitest";

const push = vi.hoisted(() => ({ checkPush: vi.fn(), browserPushEnvironment: vi.fn(), deviceFrom: vi.fn() }));
const state = vi.hoisted(() => ({ setters: [] as ReturnType<typeof vi.fn>[] }));

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
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/push-subscription", () => push);

const { useNotificationsGuideOffer } = await import("./guide-offer");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  state.setters.length = 0;
  vi.stubGlobal("window", {});
  push.browserPushEnvironment.mockReset().mockReturnValue({ userAgent: "Android" });
  push.deviceFrom.mockReset().mockReturnValue("android");
  push.checkPush.mockReset().mockResolvedValue("off");
});

describe("oferta do guia de ativação", () => {
  test("no Android com as notificações desligadas, oferece", async () => {
    expect(useNotificationsGuideOffer()).toBe("none");
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("offer");
  });

  test("no Android com as notificações ativas, não oferece", async () => {
    push.checkPush.mockResolvedValue("active");
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("none");
  });

  test("no iPhone pelo Safari, oferece o guia para adicionar à tela de início", async () => {
    push.deviceFrom.mockReturnValue("iphone");
    push.browserPushEnvironment.mockReturnValue({ userAgent: "iPhone", standalone: false });
    push.checkPush.mockResolvedValue("needs-install");
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("offer");
  });

  test("no iPhone aberto pelo ícone, sem notificações, chama de volta ao guia", async () => {
    push.deviceFrom.mockReturnValue("iphone");
    push.browserPushEnvironment.mockReturnValue({ userAgent: "iPhone", standalone: true });
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("resume");
  });

  test("no computador, nem confere as notificações", async () => {
    push.deviceFrom.mockReturnValue("computer");
    useNotificationsGuideOffer();
    await settle();
    expect(push.checkPush).not.toHaveBeenCalled();
    expect(state.setters[0]).not.toHaveBeenCalled();
  });
});
