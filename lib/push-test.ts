import { createClient } from "@supabase/supabase-js";
import { dispatchTitle, type DispatchClient, type PushMessage, type PushSender, type PushTarget } from "@/lib/daily-dispatch";
import { vapidConfigFrom, webPushSender, type DispatchEnv, type VapidConfig } from "@/lib/dispatch-schedule";
import { guideTestOrigin, type PushTestResult } from "@/lib/push-test-request";

export type PushTestDeps = { connect: (env: DispatchEnv, token: string) => DispatchClient; sender: (config: VapidConfig) => PushSender };

export const pushTestMessage: PushMessage = {
  title: dispatchTitle,
  body: "Notificação de teste: as notificações deste celular estão funcionando.",
  path: `/notifications/guide?from=${guideTestOrigin}`,
};

const table = "push_subscriptions";

export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer (\S+)$/);
  return match ? match[1] : null;
}

export async function sendPushTest(client: DispatchClient, endpoint: string, send: PushSender): Promise<PushTestResult> {
  const { data, error } = await client.from(table).select("endpoint, p256dh, auth").eq("endpoint", endpoint).maybeSingle();
  if (error) return "failed";
  if (!data) return "gone";
  const result = await send(data as PushTarget, pushTestMessage);
  if (result === "gone") await client.from(table).delete().eq("endpoint", endpoint);
  return result;
}

function connectAs(env: DispatchEnv, token: string): DispatchClient {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL ?? "", env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function endpointOf(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { endpoint?: unknown };
    return typeof body.endpoint === "string" && body.endpoint.startsWith("https://") ? body.endpoint : null;
  } catch {
    return null;
  }
}

export async function handlePushTest(request: Request, env: DispatchEnv, deps: PushTestDeps = { connect: connectAs, sender: webPushSender }): Promise<Response> {
  const config = vapidConfigFrom(env);
  if (config === null) return Response.json({ result: "failed" }, { status: 503 });
  const token = bearerToken(request.headers.get("authorization"));
  if (token === null) return Response.json({ result: "failed" }, { status: 401 });
  const endpoint = await endpointOf(request);
  if (endpoint === null) return Response.json({ result: "failed" }, { status: 400 });
  try {
    return Response.json({ result: await sendPushTest(deps.connect(env, token), endpoint, deps.sender(config)) });
  } catch {
    return Response.json({ result: "failed" }, { status: 500 });
  }
}
