import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, thrownMessage, withTimeout, type SignInResult } from "@/lib/sign-in";

export type GoogleAuth = Pick<SupabaseClient["auth"], "signInWithOAuth" | "getSession">;

export type GoogleBrowser = {
  probe: (url: string) => Promise<boolean>;
  go: (url: string) => void;
};

export type ReturnLocation = { search: string; hash: string };

export const googleCallbackPath = "/auth/callback";

export const afterSignInPath = "/notes";

export const googleMessages = {
  unavailable: "Entrar com Google ainda não está ligado. Por enquanto, entre com o código por e-mail.",
  failed: "Não deu para entrar com o Google. Tente de novo ou entre com o código por e-mail.",
  cancelled: "A entrada com o Google foi cancelada. Tente de novo ou entre com o código por e-mail.",
};

export async function providerAnswers(url: string): Promise<boolean> {
  const response = await fetch(url, { redirect: "manual", credentials: "omit" });
  return response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400);
}

export const realBrowser: GoogleBrowser = {
  probe: providerAnswers,
  go: (url) => window.location.assign(url),
};

export function googleReturnUrl(origin: string): string {
  return `${origin}${googleCallbackPath}`;
}

export async function startGoogleSignIn(auth: GoogleAuth, redirectTo: string, browser: GoogleBrowser): Promise<SignInResult> {
  try {
    const { data, error } = await auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (error || !data.url) return { ok: false, message: googleMessages.failed };
    const available = await withTimeout(browser.probe(data.url), requestTimeoutMs);
    if (!available) return { ok: false, message: googleMessages.unavailable };
    browser.go(data.url);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: thrownMessage(error) };
  }
}

function returnParams(location: ReturnLocation): URLSearchParams {
  const params = new URLSearchParams(location.search);
  new URLSearchParams(location.hash.replace(/^#/, "")).forEach((value, key) => params.set(key, value));
  return params;
}

export async function finishGoogleSignIn(auth: GoogleAuth, location: ReturnLocation): Promise<SignInResult> {
  const providerError = returnParams(location).get("error");
  if (providerError === "access_denied") return { ok: false, message: googleMessages.cancelled };
  if (providerError) return { ok: false, message: googleMessages.failed };
  try {
    const { data, error } = await withTimeout(auth.getSession(), requestTimeoutMs);
    return !error && data.session ? { ok: true } : { ok: false, message: googleMessages.failed };
  } catch (error) {
    return { ok: false, message: thrownMessage(error) };
  }
}

export async function handleGoogleReturn(auth: GoogleAuth, location: ReturnLocation, replace: (path: string) => void): Promise<string | null> {
  const result = await finishGoogleSignIn(auth, location);
  if (!result.ok) return result.message;
  replace(afterSignInPath);
  return null;
}
