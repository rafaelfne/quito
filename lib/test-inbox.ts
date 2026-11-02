import { codeLength } from "@/lib/sign-in";

export const testInboxPort = 54624;

export const testCodePath = "/api/test-code";

export const testCodeAttempts = 10;

export const testCodeIntervalMs = 500;

export type TestMail = { id: string; code: string };

type InboxMessage = { ID: string; To: { Address: string }[]; Snippet: string };

const rehearsalHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

const codePattern = new RegExp(`\\b\\d{${codeLength}}\\b`);

function hostnameOf(address: string): string | null {
  try {
    return new URL(address).hostname;
  } catch {
    return null;
  }
}

export function testInboxUrl(supabaseUrl: string | undefined): string | null {
  const hostname = hostnameOf(supabaseUrl ?? "");
  if (hostname === null || !rehearsalHosts.has(hostname)) return null;
  return `http://${hostname}:${testInboxPort}`;
}

export function serverTestInboxUrl(env: { NODE_ENV?: string; NEXT_PUBLIC_SUPABASE_URL?: string }): string | null {
  return env.NODE_ENV === "production" ? null : testInboxUrl(env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function latestTestMail(inboxUrl: string, email: string): Promise<TestMail | null> {
  try {
    const response = await fetch(`${inboxUrl}/api/v1/messages?limit=50`, { cache: "no-store" });
    if (!response.ok) return null;
    const { messages } = (await response.json()) as { messages: InboxMessage[] };
    const message = messages.find(({ To }) => To.some(({ Address }) => Address === email));
    const code = message?.Snippet.match(codePattern)?.[0];
    return message && code ? { id: message.ID, code } : null;
  } catch {
    return null;
  }
}

export async function askTestMail(email: string): Promise<TestMail | null> {
  try {
    const response = await fetch(`${testCodePath}?email=${encodeURIComponent(email)}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as TestMail | null) : null;
  } catch {
    return null;
  }
}

export async function waitForNewTestCode(email: string, previousId: string | null): Promise<string | null> {
  for (let attempt = 0; attempt < testCodeAttempts; attempt += 1) {
    const mail = await askTestMail(email);
    if (mail && mail.id !== previousId) return mail.code;
    await new Promise((resolve) => setTimeout(resolve, testCodeIntervalMs));
  }
  return null;
}
