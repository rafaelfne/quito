import { afterEach, describe, expect, test, vi } from "vitest";

const startDailyDispatch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dispatch-schedule", () => ({ startDailyDispatch }));

import { register } from "@/instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("ao ligar o servidor", () => {
  test("liga o disparo diário no servidor Node", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await register();
    expect(startDailyDispatch).toHaveBeenCalledTimes(1);
  });

  test("fora do servidor Node, não liga", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(startDailyDispatch).not.toHaveBeenCalled();
  });
});
