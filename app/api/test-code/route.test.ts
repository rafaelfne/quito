import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

const inboxFetch = vi.fn();

function request(query = "?email=ana%40exemplo.com") {
  return new Request(`http://localhost:3001/api/test-code${query}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", inboxFetch);
  inboxFetch.mockReset().mockResolvedValue(
    Response.json({ messages: [{ ID: "m1", To: [{ Address: "ana@exemplo.com" }], Snippet: "Seu código: 123456" }] }),
  );
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54621");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("rota do código no ensaio", () => {
  test("no ensaio, devolve o último código do e-mail pedido", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "m1", code: "123456" });
  });

  test("sem e-mail, recusa o pedido", async () => {
    const response = await GET(request(""));
    expect(response.status).toBe(400);
    expect(inboxFetch).not.toHaveBeenCalled();
  });

  test("com outro Supabase, fica fechada", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(inboxFetch).not.toHaveBeenCalled();
  });

  test("em produção, fica fechada mesmo com endereço do ensaio", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(inboxFetch).not.toHaveBeenCalled();
  });
});
