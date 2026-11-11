import { beforeEach, describe, expect, test, vi } from "vitest";

const permission = vi.hoisted(() => ({ value: "default" }));
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
  permission.value = "default";
  push.browserPushEnvironment.mockReset().mockImplementation(() => ({ userAgent: "Android", standalone: false, permission: () => permission.value }));
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
    push.browserPushEnvironment.mockReturnValue({ userAgent: "iPhone", standalone: false, permission: () => "default" });
    push.checkPush.mockResolvedValue("needs-install");
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("offer");
  });

  test("no iPhone aberto pelo ícone, sem notificações, chama de volta ao guia", async () => {
    push.deviceFrom.mockReturnValue("iphone");
    push.browserPushEnvironment.mockReturnValue({ userAgent: "iPhone", standalone: true, permission: () => permission.value });
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("resume");
  });

  test("no Android, com a permissão dada e a inscrição sumida, avisa que a notificação parou", async () => {
    permission.value = "granted";
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("lost");
  });

  test("no Android, com a permissão negada, avisa que a notificação está bloqueada", async () => {
    permission.value = "denied";
    push.checkPush.mockResolvedValue("blocked");
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("blocked");
  });

  test("no iPhone aberto pelo ícone, com a inscrição sumida, avisa em vez de só chamar de volta ao guia", async () => {
    permission.value = "granted";
    push.deviceFrom.mockReturnValue("iphone");
    push.browserPushEnvironment.mockReturnValue({ userAgent: "iPhone", standalone: true, permission: () => permission.value });
    useNotificationsGuideOffer();
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith("lost");
  });

  test("no computador, nem confere as notificações", async () => {
    push.deviceFrom.mockReturnValue("computer");
    useNotificationsGuideOffer();
    await settle();
    expect(push.checkPush).not.toHaveBeenCalled();
    expect(state.setters[0]).not.toHaveBeenCalled();
  });
});
