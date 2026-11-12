import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { NotificationTimeState } from "@/lib/notification-time";

const client = vi.hoisted(() => ({ from: vi.fn() }));
const time = vi.hoisted(() => ({ openNotificationTime: vi.fn(), chooseNotificationHour: vi.fn(), deviceTimeZone: vi.fn() }));
const state = vi.hoisted(() => ({ setters: [] as ReturnType<typeof vi.fn>[] }));
const captured: { state?: NotificationTimeState; onChoose?: (hour: number) => void; onRetry?: () => void } = {};

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void) => effect(),
    useState: (initial: unknown) => {
      const setter = vi.fn();
      state.setters.push(setter);
      return [typeof initial === "function" ? initial() : initial, setter];
    },
  };
});
vi.mock("@/lib/supabase", () => ({ supabase: client }));
vi.mock("@/lib/notification-time", async (original) => ({ ...(await original<typeof import("@/lib/notification-time")>()), ...time }));
vi.mock("./notification-time-section-view", () => ({
  NotificationTimeSectionView: (props: typeof captured) => {
    Object.assign(captured, props);
    return <p>horário</p>;
  },
}));

const { NotificationTimeSection } = await import("./notification-time-section");

const zone = "America/Manaus";
const ready: NotificationTimeState = { status: "ready", hour: 9, timeZone: zone, saving: false, message: null, notice: null };
const saved: NotificationTimeState = { ...ready, hour: 7, notice: "Horário guardado." };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  state.setters.length = 0;
  time.deviceTimeZone.mockReset().mockReturnValue(zone);
  time.openNotificationTime.mockReset().mockResolvedValue(ready);
  time.chooseNotificationHour.mockReset().mockResolvedValue(saved);
});

describe("NotificationTimeSection", () => {
  test("abre carregando com o fuso do celular e mostra o que leu", async () => {
    renderToStaticMarkup(<NotificationTimeSection />);
    expect(captured.state).toMatchObject({ status: "loading", hour: 9, timeZone: zone });
    expect(time.openNotificationTime).toHaveBeenCalledWith(client, zone);
    await settle();
    expect(state.setters[0]).toHaveBeenLastCalledWith(ready);
  });

  test("ao escolher a hora, trava enquanto guarda e mostra o resultado", async () => {
    renderToStaticMarkup(<NotificationTimeSection />);
    const [setState] = state.setters;
    captured.onChoose!(7);
    expect(setState).toHaveBeenCalledWith(expect.objectContaining({ saving: true, notice: null }));
    expect(time.chooseNotificationHour).toHaveBeenCalledWith(client, expect.objectContaining({ saving: true }), 7);
    await settle();
    expect(setState).toHaveBeenLastCalledWith(saved);
  });

  test("tentar de novo volta a carregar", () => {
    renderToStaticMarkup(<NotificationTimeSection />);
    captured.onRetry!();
    expect(state.setters[0]).toHaveBeenCalledWith(expect.objectContaining({ status: "loading", timeZone: zone }));
    expect(time.openNotificationTime).toHaveBeenCalledTimes(2);
  });
});
