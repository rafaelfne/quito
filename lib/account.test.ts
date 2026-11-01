import { afterEach, describe, expect, test, vi } from "vitest";
import { accountMessages, deleteAccount, loadAccount, signInMethodFrom, type AccountAuth, type AccountDeletionClient } from "./account";
import { requestTimeoutMs } from "./sign-in";

type Scenario = {
  email?: string;
  provider?: string;
  noSession?: boolean;
  methods?: unknown[];
  noAssurance?: boolean;
  session?: "throws" | "hangs";
};

function authWith({ email = "ana@escola.com", provider = "email", noSession, methods = [], noAssurance, session }: Scenario) {
  return {
    getSession: () => {
      if (session === "throws") return Promise.reject(new Error("offline"));
      if (session === "hangs") return new Promise(() => {});
      return Promise.resolve({ data: { session: noSession ? null : { user: { email, app_metadata: { provider } } } }, error: null });
    },
    mfa: {
      getAuthenticatorAssuranceLevel: () =>
        Promise.resolve(noAssurance ? { data: null, error: new Error("falhou") } : { data: { currentAuthenticationMethods: methods }, error: null }),
    },
  } as unknown as AccountAuth;
}

const failed = { ok: false, message: accountMessages.loadFailed };

afterEach(() => {
  vi.useRealTimers();
});

describe("signInMethodFrom", () => {
  test.each([
    [[{ method: "otp" }], "email-code"],
    [[{ method: "oauth" }], "google"],
    [["otp"], "email-code"],
    [["oauth"], "google"],
  ])("reconhece o jeito de entrar registrado na sessão: %j", (methods, expected) => {
    expect(signInMethodFrom(methods, undefined)).toBe(expected);
  });

  test("a sessão deste aparelho vale mais que o jeito do primeiro cadastro", () => {
    expect(signInMethodFrom([{ method: "oauth" }], "email")).toBe("google");
    expect(signInMethodFrom([{ method: "otp" }], "google")).toBe("email-code");
  });

  test.each([
    ["email", "email-code"],
    ["google", "google"],
  ])("sem registro na sessão, usa o cadastro da conta: %s", (provider, expected) => {
    expect(signInMethodFrom([], provider)).toBe(expected);
    expect(signInMethodFrom([{ method: "desconhecido" }], provider)).toBe(expected);
  });

  test("sem nenhuma pista, não inventa um jeito de entrar", () => {
    expect(signInMethodFrom([], undefined)).toBeNull();
    expect(signInMethodFrom([{ method: "constructor" }], "toString")).toBeNull();
  });
});

describe("loadAccount", () => {
  test("traz o e-mail e como o professor entrou neste aparelho", async () => {
    await expect(loadAccount(authWith({ methods: [{ method: "oauth" }] }))).resolves.toEqual({ ok: true, email: "ana@escola.com", method: "google" });
  });

  test("sem a leitura da sessão, ainda mostra a conta pelo cadastro", async () => {
    await expect(loadAccount(authWith({ noAssurance: true }))).resolves.toEqual({ ok: true, email: "ana@escola.com", method: "email-code" });
  });

  test.each<Scenario>([{ noSession: true }, { email: "" }, { session: "throws" }])("avisa quando não dá para mostrar a conta %#", async (scenario) => {
    await expect(loadAccount(authWith(scenario))).resolves.toEqual(failed);
  });

  test("para de esperar quando nada responde", async () => {
    vi.useFakeTimers();
    const pending = loadAccount(authWith({ session: "hangs" }));
    await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    await expect(pending).resolves.toEqual(failed);
  });
});

describe("deleteAccount", () => {
  function clientWith(rpc: () => unknown, signOut: () => unknown = () => Promise.resolve({ error: null })) {
    const spies = { rpc: vi.fn(rpc), signOut: vi.fn(signOut) };
    return { spies, client: { rpc: spies.rpc, auth: { signOut: spies.signOut } } as unknown as AccountDeletionClient };
  }

  const deleted = () => Promise.resolve({ error: null });

  test("apaga a conta e depois sai deste aparelho", async () => {
    const { client, spies } = clientWith(deleted);
    await expect(deleteAccount(client)).resolves.toEqual({ ok: true });
    expect(spies.rpc).toHaveBeenCalledWith("delete_own_account");
    expect(spies.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  test.each([
    ["o banco recusa", () => Promise.resolve({ error: new Error("recusou") })],
    ["a internet cai", () => Promise.reject(new Error("offline"))],
  ])("quando %s, avisa e continua conectado", async (_name, rpc) => {
    const { client, spies } = clientWith(rpc);
    await expect(deleteAccount(client)).resolves.toEqual({ ok: false, message: accountMessages.deleteFailed });
    expect(spies.signOut).not.toHaveBeenCalled();
  });

  test("para de esperar quando nada responde", async () => {
    vi.useFakeTimers();
    const { client } = clientWith(() => new Promise(() => {}));
    const pending = deleteAccount(client);
    await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    await expect(pending).resolves.toEqual({ ok: false, message: accountMessages.deleteFailed });
  });

  test("conta apagada que não conseguiu sair avisa o que falta, sem dizer que nada mudou", async () => {
    const { client } = clientWith(deleted, () => Promise.resolve({ error: new Error("offline") }));
    await expect(deleteAccount(client)).resolves.toEqual({ ok: false, message: accountMessages.deletedButStillSignedIn });
  });
});
