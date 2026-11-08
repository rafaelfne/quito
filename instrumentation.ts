export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDailyDispatch } = await import("@/lib/dispatch-schedule");
  startDailyDispatch();
}
