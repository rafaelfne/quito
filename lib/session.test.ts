import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  afterSignInPath,
  checkSession,
  destinationFrom,
  enterIfSignedIn,
  guardPage,
  safeDestination,
  sessionMessages,
  signInPath,
  signOutThisDevice,
  watchSignOut,
  type SessionAuth,
} from "./session";
import { requestTimeoutMs } from "./sign-in";

function authWith(result: { session?: boolean; error?: Error | null } | "throws" | "hangs") {
  const getSession = vi.fn(() => {
    if (result === "throws") return Promise.reject(new Error("offline"));
    if (result === "hangs") return new Promise(() => {});
    return Promise.resolve({ data: { session: result.session ? { access_token: "t" } : null }, error: result.error ?? null });
  });
  return { getSession } as unknown as Pick<SessionAuth, "getSession">;
}

const offline = new AuthRetryableFetchError("Failed to fetch", 0);
const revoked = new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found");

afterEach(() => {
  vi.useRealTimers();
});

describe("safeDestination", () => {
  test.each(["/notes", "/alunos/42?mes=3#aula", "/alunos"])("aceita um caminho do próprio app: %s", (path) => {
    expect(safeDestination(path)).toBe(path);
  });

  test.each([
    null,
    "",
    "notes",
    "https://golpe.com",
    "//golpe.com",
    "/\\golpe.com",
    "/\t/golpe.com",
    "javascript:alert(1)",
    "/",
    "/?next=/alunos",
    "/auth/callback",
    "/auth/callback?next=/alunos",
    "http://[",
    "//[",
  ])("nunca manda para fora do app nem de volta para a entrada: %s", (path) => {
    expect(safeDestination(path)).toBe(afterSignInPath);
  });
});

describe("caminho de volta", () => {
  test("a entrada guarda para onde o professor ia e devolve o mesmo caminho", () => {
    const path = signInPath("/alunos/42?mes=3");
    expect(path).toBe("/?next=%2Falunos%2F42%3Fmes%3D3");
    expect(destinationFrom(path.slice(1))).toBe("/alunos/42?mes=3");
  });

  test("sem destino especial, a entrada fica sem nada no endereço", () => {
    expect(signInPath(afterSignInPath)).toBe("/");
    expect(destinationFrom("")).toBe(afterSignInPath);
  });
});

describe("checkSession", () => {
  test("com sessão, está conectado", async () => {
    await expect(checkSession(authWith({ session: true }))).resolves.toBe("signed-in");
  });

  test("sem sessão guardada, não está conectado", async () => {
    await expect(checkSession(authWith({}))).resolves.toBe("signed-out");
  });

  test("sessão recusada pelo servidor conta como não conectado", async () => {
    await expect(checkSession(authWith({ error: revoked }))).resolves.toBe("signed-out");
  });

  test("queda de internet não desconecta", async () => {
    await expect(checkSession(authWith({ error: offline }))).resolves.toBe("unreachable");
    await expect(checkSession(authWith("throws"))).resolves.toBe("unreachable");
  });

  test("para de esperar quando o servidor não responde", async () => {
    vi.useFakeTimers();
    const pending = checkSession(authWith("hangs"));
    await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    await expect(pending).resolves.toBe("unreachable");
  });
});

describe("enterIfSignedIn", () => {
  test("quem já entrou pula a tela de entrada e vai para onde ia", async () => {
    const replace = vi.fn();
    await expect(enterIfSignedIn(authWith({ session: true }), "?next=%2Falunos", replace)).resolves.toBe(true);
    expect(replace).toHaveBeenCalledWith("/alunos");
  });

  test("sem internet, também não pede para entrar de novo", async () => {
    const replace = vi.fn();
    await expect(enterIfSignedIn(authWith({ error: offline }), "", replace)).resolves.toBe(true);
    expect(replace).toHaveBeenCalledWith(afterSignInPath);
  });

  test("quem não entrou fica na tela de entrada", async () => {
    const replace = vi.fn();
    await expect(enterIfSignedIn(authWith({}), "", replace)).resolves.toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("guardPage", () => {
  test("quem não entrou cai na entrada, lembrando para onde ia", async () => {
    const replace = vi.fn();
    await expect(guardPage(authWith({}), "/alunos/42", replace)).resolves.toBe("signed-out");
    expect(replace).toHaveBeenCalledWith("/?next=%2Falunos%2F42");
  });

  test.each([
    [{ session: true }, "signed-in"],
    [{ error: offline }, "unreachable"],
  ])("não manda para a entrada quem está conectado ou sem internet %#", async (result, status) => {
    const replace = vi.fn();
    await expect(guardPage(authWith(result), "/alunos", replace)).resolves.toBe(status);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("watchSignOut", () => {
  function watching() {
    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn<(listener: (event: string) => void) => unknown>(() => ({ data: { subscription: { unsubscribe } } }));
    const onSignedOut = vi.fn();
    const stop = watchSignOut({ onAuthStateChange } as unknown as Pick<SessionAuth, "onAuthStateChange">, onSignedOut);
    return { emit: onAuthStateChange.mock.calls[0][0], onSignedOut, stop, unsubscribe };
  }

  test("avisa só quando a sessão termina", () => {
    const { emit, onSignedOut } = watching();
    emit("INITIAL_SESSION");
    emit("TOKEN_REFRESHED");
    expect(onSignedOut).not.toHaveBeenCalled();
    emit("SIGNED_OUT");
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  test("para de escutar quando a tela sai", () => {
    const { stop, unsubscribe } = watching();
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe("signOutThisDevice", () => {
  test("sai só deste aparelho, sem desconectar os outros", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    await expect(signOutThisDevice({ signOut } as unknown as Pick<SessionAuth, "signOut">)).resolves.toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  test.each([
    [async () => ({ error: offline })],
    [async () => { throw new Error("offline"); }],
  ])("avisa quando não deu para sair %#", async (signOut) => {
    await expect(signOutThisDevice({ signOut } as unknown as Pick<SessionAuth, "signOut">)).resolves.toEqual({ ok: false, message: sessionMessages.signOutFailed });
  });
});
