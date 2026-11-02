import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { testInboxPort, testInboxUrl } from "./test-inbox";

describe("testInboxUrl", () => {
  test.each([
    ["http://127.0.0.1:54621", "http://127.0.0.1:54624"],
    ["http://localhost:54621", "http://localhost:54624"],
    ["http://[::1]:54621", "http://[::1]:54624"],
  ])("no ensaio (%s), aponta para a caixa de e-mails de teste", (supabaseUrl, inbox) => {
    expect(testInboxUrl(supabaseUrl)).toBe(inbox);
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
