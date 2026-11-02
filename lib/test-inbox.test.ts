import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  askTestMail,
  latestTestMail,
  serverTestInboxUrl,
  testCodeAttempts,
  testCodeIntervalMs,
  testCodePath,
  testInboxPort,
  testInboxUrl,
  waitForNewTestCode,
} from "./test-inbox";

const inbox = "http://127.0.0.1:54624";
const fetchMock = vi.fn();

function message(id: string, address: string, snippet: string) {
  return { ID: id, To: [{ Address: address }], Snippet: snippet };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("testInboxUrl", () => {
  test.each([
    ["http://127.0.0.1:54621", "http://127.0.0.1:54624"],
    ["http://localhost:54621", "http://localhost:54624"],
    ["http://[::1]:54621", "http://[::1]:54624"],
  ])("no ensaio (%s), aponta para a caixa de e-mails de teste", (supabaseUrl, expected) => {
    expect(testInboxUrl(supabaseUrl)).toBe(expected);
  });

  test.each([
    ["https://abcdefgh.supabase.co"],
    ["https://127.0.0.1.exemplo.com"],
    ["https://localhost.exemplo.com"],
    ["endereço inválido"],
    [""],
    [undefined],
  ])("fora do ensaio (%s), não aponta para lugar nenhum", (supabaseUrl) => {
    expect(testInboxUrl(supabaseUrl)).toBeNull();
  });

  test("usa a mesma porta da configuração do Supabase", () => {
    const config = readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");
    const port = config.match(/\[local_smtp\][^[]*?\nport = (\d+)/)?.[1];
    expect(Number(port)).toBe(testInboxPort);
  });
});

describe("serverTestInboxUrl", () => {
  test("abre só fora de produção e com o endereço do ensaio", () => {
    const rehearsal = "http://127.0.0.1:54621";
    expect(serverTestInboxUrl({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: rehearsal })).toBe(inbox);
    expect(serverTestInboxUrl({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: rehearsal })).toBeNull();
    expect(serverTestInboxUrl({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co" })).toBeNull();
  });
});

describe("latestTestMail", () => {
  test("pega o e-mail mais novo do endereço pedido", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        messages: [
          message("outro", "bia@exemplo.com", "código: 999999"),
          message("novo", "ana@exemplo.com", "Código: 123456. Digite estes 6 números."),
          message("velho", "ana@exemplo.com", "Código: 654321"),
        ],
      }),
    );
    await expect(latestTestMail(inbox, "ana@exemplo.com")).resolves.toEqual({ id: "novo", code: "123456" });
    expect(fetchMock).toHaveBeenCalledWith(`${inbox}/api/v1/messages?limit=50`, { cache: "no-store" });
  });

  test("sem e-mail daquele endereço, não devolve nada", async () => {
    fetchMock.mockResolvedValue(Response.json({ messages: [message("outro", "bia@exemplo.com", "código: 999999")] }));
    await expect(latestTestMail(inbox, "ana@exemplo.com")).resolves.toBeNull();
  });

  test("com e-mail sem código, não devolve nada", async () => {
    fetchMock.mockResolvedValue(Response.json({ messages: [message("link", "ana@exemplo.com", "Your sign-in link")] }));
    await expect(latestTestMail(inbox, "ana@exemplo.com")).resolves.toBeNull();
  });

  test("com a caixa recusando o pedido, não devolve nada", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    await expect(latestTestMail(inbox, "ana@exemplo.com")).resolves.toBeNull();
  });

  test("com a caixa desligada, não devolve nada", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(latestTestMail(inbox, "ana@exemplo.com")).resolves.toBeNull();
  });
});

describe("askTestMail", () => {
  test("pergunta à rota do app", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "m1", code: "123456" }));
    await expect(askTestMail("ana+1@exemplo.com")).resolves.toEqual({ id: "m1", code: "123456" });
    expect(fetchMock).toHaveBeenCalledWith(`${testCodePath}?email=ana%2B1%40exemplo.com`, { cache: "no-store" });
  });

  test("com a rota fechada, não devolve nada", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(askTestMail("ana@exemplo.com")).resolves.toBeNull();
  });

  test("sem resposta da rota, não devolve nada", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(askTestMail("ana@exemplo.com")).resolves.toBeNull();
  });
});

describe("waitForNewTestCode", () => {
  test("ignora o e-mail anterior e espera o novo", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(Response.json({ id: "velho", code: "654321" }))
      .mockResolvedValueOnce(Response.json({ id: "novo", code: "123456" }));
    const pending = waitForNewTestCode("ana@exemplo.com", "velho");
    await vi.advanceTimersByTimeAsync(testCodeIntervalMs);
    await expect(pending).resolves.toBe("123456");
  });

  test("desiste depois de algumas tentativas", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => Response.json(null));
    const pending = waitForNewTestCode("ana@exemplo.com", null);
    await vi.advanceTimersByTimeAsync(testCodeAttempts * testCodeIntervalMs);
    await expect(pending).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(testCodeAttempts);
  });
});
