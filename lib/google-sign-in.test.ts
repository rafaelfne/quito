import { afterEach, describe, expect, test, vi } from "vitest";
import {
  finishGoogleSignIn,
  googleMessages,
  googleReturnUrl,
  handleGoogleReturn,
  providerAnswers,
  realBrowser,
  startGoogleSignIn,
  type GoogleAuth,
} from "./google-sign-in";
import { afterSignInPath } from "./session";
import { requestTimeoutMs, signInMessages } from "./sign-in";

const googleUrl = "http://127.0.0.1:54621/auth/v1/authorize?provider=google";

function fakeAuth(options: { url?: string | null; oauthError?: boolean; session?: boolean; sessionError?: boolean; throws?: boolean } = {}) {
  const signInWithOAuth = vi.fn(async () => {
    if (options.throws) throw new Error("offline");
    return { data: { provider: "google", url: options.url === undefined ? googleUrl : options.url }, error: options.oauthError ? { message: "x" } : null };
  });
  const getSession = vi.fn(async () => {
    if (options.throws) throw new Error("offline");
    return { data: { session: options.session ? { access_token: "t" } : null }, error: options.sessionError ? { message: "x" } : null };
  });
  return { auth: { signInWithOAuth, getSession } as unknown as GoogleAuth, signInWithOAuth, getSession };
}

function fakeBrowser(available: boolean | Promise<boolean> = true) {
  return { probe: vi.fn(() => Promise.resolve(available)), go: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("googleReturnUrl", () => {
  test("volta para a tela que termina a entrada", () => {
    expect(googleReturnUrl("https://quito.app", afterSignInPath)).toBe("https://quito.app/auth/callback");
  });

  test("leva junto para onde o professor ia", () => {
    expect(googleReturnUrl("https://quito.app", "/alunos/42")).toBe("https://quito.app/auth/callback?next=%2Falunos%2F42");
  });
});

describe("startGoogleSignIn", () => {
  test("pede ao Google para escolher a conta e leva o professor para lá", async () => {
    const { auth, signInWithOAuth } = fakeAuth();
    const browser = fakeBrowser();
    await expect(startGoogleSignIn(auth, "https://quito.app/auth/callback", browser)).resolves.toEqual({ ok: true });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://quito.app/auth/callback", skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    expect(browser.probe).toHaveBeenCalledWith(googleUrl);
    expect(browser.go).toHaveBeenCalledWith(googleUrl);
  });

  test("avisa quando o Google ainda não está ligado, sem sair do app", async () => {
    const { auth } = fakeAuth();
    const browser = fakeBrowser(false);
    await expect(startGoogleSignIn(auth, "x", browser)).resolves.toEqual({ ok: false, message: googleMessages.unavailable });
    expect(browser.go).not.toHaveBeenCalled();
  });

  test.each([[{ oauthError: true }], [{ url: null }]])("avisa quando não dá para começar %o", async (options) => {
    const { auth } = fakeAuth(options);
    const browser = fakeBrowser();
    await expect(startGoogleSignIn(auth, "x", browser)).resolves.toEqual({ ok: false, message: googleMessages.failed });
    expect(browser.probe).not.toHaveBeenCalled();
  });

  test("avisa quando a internet falha", async () => {
    const { auth } = fakeAuth({ throws: true });
    await expect(startGoogleSignIn(auth, "x", fakeBrowser())).resolves.toEqual({ ok: false, message: signInMessages.unexpected });
  });

  test("para de esperar quando o servidor não responde", async () => {
    vi.useFakeTimers();
    const { auth } = fakeAuth();
    const browser = fakeBrowser(new Promise<boolean>(() => {}));
    const pending = startGoogleSignIn(auth, "x", browser);
    await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    await expect(pending).resolves.toEqual({ ok: false, message: signInMessages.timedOut });
    expect(browser.go).not.toHaveBeenCalled();
  });
});

describe("providerAnswers", () => {
  test("considera ligado quando o servidor manda para o Google", async () => {
    const fetchMock = vi.fn(async () => ({ type: "opaqueredirect", status: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(providerAnswers(googleUrl)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(googleUrl, { redirect: "manual", credentials: "omit" });
  });

  test("aceita um redirecionamento visível", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ type: "basic", status: 302 })));
    await expect(providerAnswers(googleUrl)).resolves.toBe(true);
  });

  test("considera desligado quando o servidor recusa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ type: "cors", status: 400 })));
    await expect(providerAnswers(googleUrl)).resolves.toBe(false);
  });
});

describe("realBrowser", () => {
  test("abre o endereço na mesma janela, para funcionar no app instalado", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    realBrowser.go(googleUrl);
    expect(assign).toHaveBeenCalledWith(googleUrl);
    expect(realBrowser.probe).toBe(providerAnswers);
  });
});

describe("finishGoogleSignIn", () => {
  test("entra quando a sessão chegou", async () => {
    const { auth } = fakeAuth({ session: true });
    await expect(finishGoogleSignIn(auth, { search: "", hash: "#access_token=t" })).resolves.toEqual({ ok: true });
  });

  test("avisa quando o professor cancelou no Google", async () => {
    const { auth, getSession } = fakeAuth({ session: true });
    await expect(finishGoogleSignIn(auth, { search: "?error=access_denied", hash: "" })).resolves.toEqual({ ok: false, message: googleMessages.cancelled });
    expect(getSession).not.toHaveBeenCalled();
  });

  test("avisa quando o Google devolve outro erro, mesmo depois do #", async () => {
    const { auth } = fakeAuth({ session: true });
    await expect(finishGoogleSignIn(auth, { search: "", hash: "#error=server_error" })).resolves.toEqual({ ok: false, message: googleMessages.failed });
  });

  test.each([[{ session: false }], [{ session: true, sessionError: true }]])("avisa quando a sessão não veio %o", async (options) => {
    const { auth } = fakeAuth(options);
    await expect(finishGoogleSignIn(auth, { search: "", hash: "" })).resolves.toEqual({ ok: false, message: googleMessages.failed });
  });

  test("avisa quando a internet falha", async () => {
    const { auth } = fakeAuth({ throws: true });
    await expect(finishGoogleSignIn(auth, { search: "", hash: "" })).resolves.toEqual({ ok: false, message: signInMessages.unexpected });
  });
});

describe("handleGoogleReturn", () => {
  test("abre o app depois de entrar", async () => {
    const { auth } = fakeAuth({ session: true });
    const replace = vi.fn();
    await expect(handleGoogleReturn(auth, { search: "", hash: "" }, replace)).resolves.toBeNull();
    expect(replace).toHaveBeenCalledWith(afterSignInPath);
  });

  test("volta para onde o professor ia", async () => {
    const { auth } = fakeAuth({ session: true });
    const replace = vi.fn();
    await handleGoogleReturn(auth, { search: "?next=%2Falunos%2F42", hash: "#access_token=t" }, replace);
    expect(replace).toHaveBeenCalledWith("/alunos/42");
  });

  test("devolve a mensagem e fica na tela quando não entrou", async () => {
    const { auth } = fakeAuth();
    const replace = vi.fn();
    await expect(handleGoogleReturn(auth, { search: "", hash: "" }, replace)).resolves.toBe(googleMessages.failed);
    expect(replace).not.toHaveBeenCalled();
  });
});
