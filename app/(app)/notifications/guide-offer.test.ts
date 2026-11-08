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
    expect(useNotificationsGuideOffer()).toBe(false);
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith(true);
  });

  test("no Android com as notificações ativas, não oferece", async () => {
    push.checkPush.mockResolvedValue("active");
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith(false);
  });

  test("fora do Android, nem confere as notificações", async () => {
    push.deviceFrom.mockReturnValue("iphone");
    useNotificationsGuideOffer();
    await settle();
    expect(push.checkPush).not.toHaveBeenCalled();
    expect(state.setters[0]).not.toHaveBeenCalled();
  });
});
