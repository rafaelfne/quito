import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { supabaseServer } from "./supabase-server";

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const original = await importOriginal<typeof import("@supabase/supabase-js")>();
  return { ...original, createClient: vi.fn(original.createClient) };
});

const url = "http://banco-de-teste.invalid";
const publicKey = "chave-publica-de-teste";

describe("supabaseServer", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", publicKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("conecta no endereço configurado com a chave pública, que respeita a regra de acesso", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-secreta-de-teste");

    supabaseServer();

    const [usedUrl, usedKey] = vi.mocked(createClient).mock.calls[0];
    expect(usedUrl).toBe(url);
    expect(usedKey).toBe(publicKey);
  });

  test("não guarda a sessão de ninguém no servidor nem a renova por conta própria", () => {
    supabaseServer();

    const options = vi.mocked(createClient).mock.calls[0][2];
    expect(options?.auth).toEqual({ persistSession: false, autoRefreshToken: false });
  });

  test("cada chamada recebe uma conexão própria, sem dividir nada entre professores", () => {
    expect(supabaseServer()).not.toBe(supabaseServer());
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  test("devolve uma conexão pronta para consultar o banco e conferir a sessão", () => {
    const client = supabaseServer();

    expect(client.from).toBeTypeOf("function");
    expect(client.auth.getUser).toBeTypeOf("function");
  });

  test("avisa com erro quando falta o endereço do banco", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);

    expect(() => supabaseServer()).toThrow("supabaseUrl is required");
  });

  test("avisa com erro quando falta a chave pública", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    expect(() => supabaseServer()).toThrow("supabaseKey is required");
  });
});
