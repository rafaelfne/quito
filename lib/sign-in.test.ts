import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanCode,
  codeSentNotice,
  confirmCode,
  editEmail,
  initialSignIn,
  normalizeEmail,
  requestCode,
  requestTimeoutMs,
  resendCode,
  signInMessages,
  submitCode,
  submitEmail,
  type SignInAuth,
  type SignInState,
} from "./sign-in";

type FakeError = { code?: string; status?: number } | null;

function fakeAuth(options: { sendError?: FakeError; verifyError?: FakeError; throws?: boolean } = {}) {
  const signInWithOtp = vi.fn(async () => {
    if (options.throws) throw new Error("offline");
    return { data: { user: null, session: null }, error: options.sendError ?? null };
  });
  const verifyOtp = vi.fn(async () => {
    if (options.throws) throw new Error("offline");
    return { data: { user: null, session: null }, error: options.verifyError ?? null };
  });
  return { auth: { signInWithOtp, verifyOtp } as unknown as SignInAuth, signInWithOtp, verifyOtp };
}

const codeStep: SignInState = { ...initialSignIn, step: "code", email: "ana@exemplo.com", code: "123456" };

describe("normalizeEmail", () => {
  test("tira espaços e deixa em minúsculas", () => {
    expect(normalizeEmail("  Ana@Exemplo.COM ")).toBe("ana@exemplo.com");
  });

  test("recusa e-mail sem arroba ou sem domínio", () => {
    expect(normalizeEmail("ana")).toBeNull();
    expect(normalizeEmail("ana@exemplo")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });
});

describe("cleanCode", () => {
  test("guarda só os números, até 6", () => {
    expect(cleanCode(" 12 34-56 ")).toBe("123456");
    expect(cleanCode("1234567")).toBe("123456");
    expect(cleanCode("abc")).toBe("");
  });
});

describe("requestCode", () => {
  test("pede o código e deixa criar a conta na primeira vez", async () => {
    const { auth, signInWithOtp } = fakeAuth();
    await expect(requestCode(auth, " Ana@Exemplo.com ")).resolves.toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({ email: "ana@exemplo.com", options: { shouldCreateUser: true } });
  });

  test("não chama o servidor com e-mail inválido", async () => {
    const { auth, signInWithOtp } = fakeAuth();
    await expect(requestCode(auth, "ana")).resolves.toEqual({ ok: false, message: signInMessages.invalidEmail });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  test.each([
    [{ code: "over_email_send_rate_limit", status: 429 }, signInMessages.tooManyEmails],
    [{ code: "over_request_rate_limit" }, signInMessages.tooManyTries],
    [{ status: 429 }, signInMessages.tooManyTries],
    [{ code: "email_address_invalid" }, signInMessages.invalidEmail],
    [{ code: "unexpected_failure", status: 500 }, signInMessages.unexpected],
  ])("traduz o erro %o", async (sendError, message) => {
    const { auth } = fakeAuth({ sendError });
    await expect(requestCode(auth, "ana@exemplo.com")).resolves.toEqual({ ok: false, message });
  });

  test("avisa quando a internet falha", async () => {
    const { auth } = fakeAuth({ throws: true });
    await expect(requestCode(auth, "ana@exemplo.com")).resolves.toEqual({ ok: false, message: signInMessages.unexpected });
  });
});

describe("confirmCode", () => {
  test("confere o código digitado", async () => {
    const { auth, verifyOtp } = fakeAuth();
    await expect(confirmCode(auth, "ana@exemplo.com", "123 456")).resolves.toEqual({ ok: true });
    expect(verifyOtp).toHaveBeenCalledWith({ email: "ana@exemplo.com", token: "123456", type: "email" });
  });

  test("recusa código incompleto sem chamar o servidor", async () => {
    const { auth, verifyOtp } = fakeAuth();
    await expect(confirmCode(auth, "ana@exemplo.com", "123")).resolves.toEqual({ ok: false, message: signInMessages.invalidCode });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  test("recusa e-mail inválido", async () => {
    const { auth } = fakeAuth();
    await expect(confirmCode(auth, "ana", "123456")).resolves.toEqual({ ok: false, message: signInMessages.invalidEmail });
  });

  test.each(["otp_expired", "invalid_credentials"])("explica código errado ou vencido (%s)", async (code) => {
    const { auth } = fakeAuth({ verifyError: { code, status: 403 } });
    await expect(confirmCode(auth, "ana@exemplo.com", "123456")).resolves.toEqual({ ok: false, message: signInMessages.wrongCode });
  });

  test("avisa quando a internet falha", async () => {
    const { auth } = fakeAuth({ throws: true });
    await expect(confirmCode(auth, "ana@exemplo.com", "123456")).resolves.toEqual({ ok: false, message: signInMessages.unexpected });
  });
});

describe("passos da entrada", () => {
  test("depois do e-mail, vai para o código com aviso", async () => {
    const { auth } = fakeAuth();
    const next = await submitEmail(auth, { ...initialSignIn, email: " Ana@Exemplo.com" });
    expect(next).toMatchObject({ step: "code", email: "ana@exemplo.com", code: "", message: null, notice: codeSentNotice("ana@exemplo.com") });
  });

  test("com e-mail errado, fica no mesmo passo e mostra o problema", async () => {
    const { auth } = fakeAuth();
    const next = await submitEmail(auth, { ...initialSignIn, email: "ana" });
    expect(next).toMatchObject({ step: "email", message: signInMessages.invalidEmail, notice: null });
  });

  test("código certo marca como dentro", async () => {
    const { auth } = fakeAuth();
    await expect(submitCode(auth, codeStep)).resolves.toMatchObject({ signedIn: true, message: null });
  });

  test("código errado mostra a mensagem e continua fora", async () => {
    const { auth } = fakeAuth({ verifyError: { code: "otp_expired" } });
    await expect(submitCode(auth, codeStep)).resolves.toMatchObject({ signedIn: false, message: signInMessages.wrongCode });
  });

  test("enviar outro código limpa o que foi digitado", async () => {
    const { auth, signInWithOtp } = fakeAuth();
    const next = await resendCode(auth, { ...codeStep, message: signInMessages.wrongCode });
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    expect(next).toMatchObject({ step: "code", code: "", message: null, notice: codeSentNotice("ana@exemplo.com") });
  });

  test("enviar outro código cedo demais avisa para esperar", async () => {
    const { auth } = fakeAuth({ sendError: { code: "over_email_send_rate_limit" } });
    await expect(resendCode(auth, codeStep)).resolves.toMatchObject({ code: "123456", message: signInMessages.tooManyEmails });
  });

  test("trocar e-mail volta ao primeiro passo mantendo o e-mail", () => {
    expect(editEmail({ ...codeStep, notice: "x", message: "y" })).toEqual({ ...initialSignIn, email: "ana@exemplo.com" });
  });
});

describe("quando o servidor não responde", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function silentAuth() {
    const never = () => new Promise<never>(() => {});
    return { signInWithOtp: vi.fn(never), verifyOtp: vi.fn(never) } as unknown as SignInAuth;
  }

  test("desiste de enviar o código e avisa", async () => {
    vi.useFakeTimers();
    const pending = requestCode(silentAuth(), "ana@exemplo.com");
    await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    await expect(pending).resolves.toEqual({ ok: false, message: signInMessages.timedOut });
  });

  test("desiste de conferir o código e avisa", async () => {
    vi.useFakeTimers();
    const pending = confirmCode(silentAuth(), "ana@exemplo.com", "123456");
    await vi.advanceTimersByTimeAsync(requestTimeoutMs);
    await expect(pending).resolves.toEqual({ ok: false, message: signInMessages.timedOut });
  });

  test("não avisa antes do tempo", async () => {
    vi.useFakeTimers();
    let settled = false;
    void requestCode(silentAuth(), "ana@exemplo.com").then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(requestTimeoutMs - 1);
    expect(settled).toBe(false);
  });
});
