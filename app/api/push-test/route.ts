import { handlePushTest } from "@/lib/push-test";

export async function POST(request: Request) {
  return handlePushTest(request, process.env);
}
