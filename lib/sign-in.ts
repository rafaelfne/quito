import type { SupabaseClient } from "@supabase/supabase-js";

export type SignInAuth = Pick<SupabaseClient["auth"], "signInWithOtp" | "verifyOtp">;

export type SignInResult = { ok: true } | { ok: false; message: string };

export const codeLength = 6;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signInMessages = {
  invalidEmail: "Confira o e-mail: parece que falta alguma coisa.",
  invalidCode: `O código tem ${codeLength} números.`,
  wrongCode: "Código errado ou vencido. Confira ou peça um novo.",
  tooManyEmails: "Já enviamos alguns códigos agora há pouco. Espere um minutinho e peça de novo.",
  tooManyTries: "Muitas tentativas seguidas. Espere um minutinho e tente de novo.",
  unexpected: "Não deu para entrar agora. Tente de novo em instantes.",
  timedOut: "Está demorando demais para responder. Confira a internet e tente de novo.",
};

export const requestTimeoutMs = 15_000;

class SignInTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SignInTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function thrownMessage(error: unknown): string {
  return error instanceof SignInTimeout ? signInMessages.timedOut : signInMessages.unexpected;
}

type AuthFailure = { code?: string; status?: number };

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return emailPattern.test(email) ? email : null;
}

export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, codeLength);
}

function failureMessage(error: AuthFailure): string {
  if (error.code === "over_email_send_rate_limit") return signInMessages.tooManyEmails;
  if (error.code === "over_request_rate_limit" || error.status === 429) return signInMessages.tooManyTries;
  if (error.code === "otp_expired" || error.code === "invalid_credentials") return signInMessages.wrongCode;
  if (error.code === "email_address_invalid") return signInMessages.invalidEmail;
  return signInMessages.unexpected;
}

export async function requestCode(auth: SignInAuth, rawEmail: string): Promise<SignInResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, message: signInMessages.invalidEmail };
  try {
    const { error } = await withTimeout(auth.signInWithOtp({ email, options: { shouldCreateUser: true } }), requestTimeoutMs);
    return error ? { ok: false, message: failureMessage(error) } : { ok: true };
  } catch (error) {
    return { ok: false, message: thrownMessage(error) };
  }
}

export async function confirmCode(auth: SignInAuth, rawEmail: string, rawCode: string): Promise<SignInResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, message: signInMessages.invalidEmail };
  const token = cleanCode(rawCode);
  if (token.length !== codeLength) return { ok: false, message: signInMessages.invalidCode };
  try {
    const { error } = await withTimeout(auth.verifyOtp({ email, token, type: "email" }), requestTimeoutMs);
    return error ? { ok: false, message: failureMessage(error) } : { ok: true };
  } catch (error) {
    return { ok: false, message: thrownMessage(error) };
  }
}

export type SignInStep = "email" | "code";

export type SignInState = {
  step: SignInStep;
  email: string;
  code: string;
  message: string | null;
  notice: string | null;
  signedIn: boolean;
};

export const initialSignIn: SignInState = {
  step: "email",
  email: "",
  code: "",
  message: null,
  notice: null,
  signedIn: false,
};

export function codeSentNotice(email: string): string {
  return `Enviamos um código de ${codeLength} números para ${email}. Ele chega em instantes; se não aparecer, olhe também a caixa de spam.`;
}

export async function submitEmail(auth: SignInAuth, state: SignInState): Promise<SignInState> {
  const result = await requestCode(auth, state.email);
  if (!result.ok) return { ...state, message: result.message, notice: null };
  const email = normalizeEmail(state.email) ?? state.email;
  return { ...state, step: "code", email, code: "", message: null, notice: codeSentNotice(email) };
}

export async function submitCode(auth: SignInAuth, state: SignInState): Promise<SignInState> {
  const result = await confirmCode(auth, state.email, state.code);
  if (!result.ok) return { ...state, message: result.message };
  return { ...state, message: null, signedIn: true };
}

export async function resendCode(auth: SignInAuth, state: SignInState): Promise<SignInState> {
  const result = await requestCode(auth, state.email);
  if (!result.ok) return { ...state, message: result.message };
  return { ...state, code: "", message: null, notice: codeSentNotice(state.email) };
}

export function editEmail(state: SignInState): SignInState {
  return { ...state, step: "email", code: "", message: null, notice: null };
}
