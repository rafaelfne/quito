import { Button } from "@/components/ui/button";
import { offersPushAction, pushActionLabel, pushStatusMessages, type PushStatus } from "@/lib/push-subscription";

export function NotificationsSectionView({ status, busy, onEnable }: { status: PushStatus; busy: boolean; onEnable: () => void }) {
  const alert = status === "failed" || status === "blocked";
  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border p-4">
      <h2 className="font-semibold">Notificações neste aparelho</h2>
      <p className="text-sm" role={alert ? "alert" : "status"}>
        {pushStatusMessages[status]}
      </p>
      {offersPushAction(status) ? (
        <Button type="button" disabled={busy} onClick={onEnable}>
          {busy ? "Ativando..." : pushActionLabel}
        </Button>
      ) : null}
    </section>
  );
}
