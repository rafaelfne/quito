export const testInboxPort = 54624;

const rehearsalHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

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
