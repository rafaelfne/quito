import { isAuthRetryableFetchError, type SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, withTimeout, type SignInResult } from "@/lib/sign-in";

export type SessionAuth = Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange" | "signOut">;

export type SessionStatus = "signed-in" | "signed-out" | "unreachable";

export const signInBasePath = "/";

export const afterSignInPath = "/notes";

export const googleCallbackPath = "/auth/callback";

export const sessionMessages = {
  unreachable: "Sem conexão agora. Você continua conectado: confira a internet e tente de novo.",
  signOutFailed: "Não deu para sair agora. Confira a internet e tente de novo.",
};

const destinationParam = "next";

const internalOrigin = "https://quito.invalid";

export function safeDestination(raw: string | null): string {
  if (!raw?.startsWith("/")) return afterSignInPath;
  try {
    const url = new URL(raw, internalOrigin);
    if (url.origin !== internalOrigin) return afterSignInPath;
    if (url.pathname === signInBasePath || url.pathname === googleCallbackPath) return afterSignInPath;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return afterSignInPath;
  }
}

export function destinationFrom(search: string): string {
  return safeDestination(new URLSearchParams(search).get(destinationParam));
}

export function withDestination(path: string, destination: string): string {
  const safe = safeDestination(destination);
  return safe === afterSignInPath ? path : `${path}?${destinationParam}=${encodeURIComponent(safe)}`;
}

export function signInPath(destination: string): string {
  return withDestination(signInBasePath, destination);
}

export async function checkSession(auth: Pick<SessionAuth, "getSession">): Promise<SessionStatus> {
  try {
    const { data, error } = await withTimeout(auth.getSession(), requestTimeoutMs);
    if (data.session) return "signed-in";
    return isAuthRetryableFetchError(error) ? "unreachable" : "signed-out";
  } catch {
    return "unreachable";
  }
}

export async function enterIfSignedIn(auth: Pick<SessionAuth, "getSession">, search: string, replace: (path: string) => void): Promise<boolean> {
  const status = await checkSession(auth);
  if (status === "signed-out") return false;
  replace(destinationFrom(search));
  return true;
}

export async function guardPage(auth: Pick<SessionAuth, "getSession">, currentPath: string, replace: (path: string) => void): Promise<SessionStatus> {
  const status = await checkSession(auth);
  if (status === "signed-out") replace(signInPath(currentPath));
  return status;
}

export function watchSignOut(auth: Pick<SessionAuth, "onAuthStateChange">, onSignedOut: () => void): () => void {
  const { data } = auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") onSignedOut();
  });
  return () => data.subscription.unsubscribe();
}

export async function signOutThisDevice(auth: Pick<SessionAuth, "signOut">): Promise<SignInResult> {
  try {
    const { error } = await withTimeout(auth.signOut({ scope: "local" }), requestTimeoutMs);
    return error ? { ok: false, message: sessionMessages.signOutFailed } : { ok: true };
  } catch {
    return { ok: false, message: sessionMessages.signOutFailed };
  }
}
