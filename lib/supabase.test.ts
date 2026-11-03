import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const original = await importOriginal<typeof import("@supabase/supabase-js")>();
  return { ...original, createClient: vi.fn(original.createClient) };
});

const url = "http://banco-de-teste.invalid";
const publicKey = "chave-publica-de-teste";

async function loadFreshConnection() {
  vi.resetModules();
  const { createClient } = await import("@supabase/supabase-js");
  const { supabase } = await import("./supabase");
  const connect = vi.mocked(createClient);
  connect.mockClear();
  return { supabase, connect };
}

describe("supabase", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", publicKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("não conecta ao abrir o app, só quando uma tela usa o banco", async () => {
    const { supabase, connect } = await loadFreshConnection();

    expect(connect).not.toHaveBeenCalled();

    void supabase.from;

    expect(connect).toHaveBeenCalledOnce();
  });

  test("conecta no endereço configurado com a chave pública, que respeita a regra de acesso", async () => {
    const { supabase, connect } = await loadFreshConnection();

    void supabase.auth;

    const [usedUrl, usedKey] = connect.mock.calls[0];
    expect(usedUrl).toBe(url);
    expect(usedKey).toBe(publicKey);
  });

  test("abre uma única conexão e reaproveita em todas as telas", async () => {
    const { supabase, connect } = await loadFreshConnection();

    const firstAuth = supabase.auth;
    void supabase.from;
    const secondAuth = supabase.auth;

    expect(connect).toHaveBeenCalledOnce();
    expect(secondAuth).toBe(firstAuth);
  });

  test("entrega os mesmos dados da conexão de verdade", async () => {
    const { supabase, connect } = await loadFreshConnection();

    const auth = supabase.auth;

    const realClient = connect.mock.results[0].value;
    expect(auth).toBe(realClient.auth);
  });

  test("uma função guardada à parte continua funcionando quando é chamada depois", async () => {
    const { supabase } = await loadFreshConnection();

    const { from } = supabase;

    expect(() => from("notes")).not.toThrow();
    expect(from("notes").select).toBeTypeOf("function");
  });

  test("consultar uma tabela e conferir a sessão funcionam pela conexão das telas", async () => {
    const { supabase } = await loadFreshConnection();

    expect(supabase.from("notes").select).toBeTypeOf("function");
    expect(supabase.auth.getSession).toBeTypeOf("function");
  });

  test("um dado que a conexão não tem vem vazio, sem quebrar a tela", async () => {
    const { supabase } = await loadFreshConnection();

    expect((supabase as unknown as Record<string, unknown>).naoExiste).toBeUndefined();
  });

  test("sem o endereço do banco, abrir o app não quebra, mas usar o banco avisa com erro", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);

    const { supabase } = await loadFreshConnection();

    expect(() => supabase.from).toThrow("supabaseUrl is required");
  });

  test("sem a chave pública, abrir o app não quebra, mas usar o banco avisa com erro", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);

    const { supabase } = await loadFreshConnection();

    expect(() => supabase.from).toThrow("supabaseKey is required");
  });

  test("depois de falhar por falta de configuração, conecta assim que ela aparece", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    const { supabase, connect } = await loadFreshConnection();
    expect(() => supabase.from).toThrow();

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);

    expect(supabase.from).toBeTypeOf("function");
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
