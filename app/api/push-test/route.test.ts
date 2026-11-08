import { afterEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/push-test", () => {
  test("sem as chaves de notificação no servidor, não envia", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const response = await POST(new Request("http://localhost/api/push-test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(503);
  });
});
