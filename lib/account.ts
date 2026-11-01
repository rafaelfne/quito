import type { SupabaseClient } from "@supabase/supabase-js";
import { signOutThisDevice, type SessionAuth } from "@/lib/session";
import { requestTimeoutMs, withTimeout, type SignInResult } from "@/lib/sign-in";

type Auth = SupabaseClient["auth"];

export type AccountAuth = Pick<Auth, "getSession"> & { mfa: Pick<Auth["mfa"], "getAuthenticatorAssuranceLevel"> };

export type AccountDeletionClient = Pick<SupabaseClient, "rpc"> & { auth: Pick<SessionAuth, "signOut"> };

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
  deleteFailed: "Não deu para confirmar que a conta foi apagada. Confira a internet e tente de novo.",
  deletedButStillSignedIn: "Sua conta foi apagada, mas falta sair deste aparelho. Confira a internet e toque em Sair deste aparelho.",
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

export async function deleteAccount(client: AccountDeletionClient): Promise<SignInResult> {
  const failed: SignInResult = { ok: false, message: accountMessages.deleteFailed };
  try {
    const { error } = await withTimeout(Promise.resolve(client.rpc("delete_own_account")), requestTimeoutMs);
    if (error) return failed;
  } catch {
    return failed;
  }
  const signedOut = await signOutThisDevice(client.auth);
  return signedOut.ok ? signedOut : { ok: false, message: accountMessages.deletedButStillSignedIn };
}
