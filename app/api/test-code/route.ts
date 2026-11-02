import { latestTestMail, serverTestInboxUrl } from "@/lib/test-inbox";

export async function GET(request: Request) {
  const inboxUrl = serverTestInboxUrl({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  if (!inboxUrl) return new Response(null, { status: 404 });
  const email = new URL(request.url).searchParams.get("email");
  if (!email) return new Response(null, { status: 400 });
  return Response.json(await latestTestMail(inboxUrl, email));
}
