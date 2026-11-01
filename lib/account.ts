import type { SupabaseClient } from "@supabase/supabase-js";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

type Auth = SupabaseClient["auth"];

export type AccountAuth = Pick<Auth, "getSession"> & { mfa: Pick<Auth["mfa"], "getAuthenticatorAssuranceLevel"> };

export type SignInMethod = "email-code" | "google";

export type AccountDetails = { ok: true; email: string; method: SignInMethod | null };

export type AccountResult = AccountDetails | { ok: false; message: string };

export const accountPath = "/account";

export const signInMethodLabels: Record<SignInMethod, string> = {
  "email-code": "Código por e-mail",
  google: "Google",
};

export const accountMessages = {
  loadFailed: "Não deu para mostrar os dados da conta agora. Confira a internet e tente de novo.",
};

const methodBySignInRecord = new Map<string, SignInMethod>([
  ["otp", "email-code"],
  ["email", "email-code"],
  ["oauth", "google"],
  ["google", "google"],
]);

export function signInMethodFrom(sessionMethods: readonly (string | { method: string })[], accountProvider: unknown): SignInMethod | null {
  const records = [...sessionMethods.map((entry) => (typeof entry === "string" ? entry : entry.method)), String(accountProvider)];
  for (const record of records) {
    const method = methodBySignInRecord.get(record);
    if (method) return method;
  }
  return null;
}

export async function loadAccount(auth: AccountAuth): Promise<AccountResult> {
  const failed: AccountResult = { ok: false, message: accountMessages.loadFailed };
  try {
    const [{ data: sessionData }, { data: assurance }] = await withTimeout(
      Promise.all([auth.getSession(), auth.mfa.getAuthenticatorAssuranceLevel()]),
      requestTimeoutMs,
    );
    const user = sessionData.session?.user;
    if (!user?.email) return failed;
    return { ok: true, email: user.email, method: signInMethodFrom(assurance?.currentAuthenticationMethods ?? [], user.app_metadata.provider) };
  } catch {
    return failed;
  }
}
