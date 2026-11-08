import { Button } from "@/components/ui/button";
import { formatHour, notificationHours, type NotificationTimeState } from "@/lib/notification-time";

const inputClass = "min-h-11 rounded-sm border bg-background px-3 py-3 text-base text-foreground";

export function NotificationTimeSectionView({ state, onChoose, onRetry }: { state: NotificationTimeState; onChoose: (hour: number) => void; onRetry: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border p-4">
      <h2 className="font-semibold">Horário do aviso</h2>
      <p className="text-sm opacity-70">No dia de cobrar, o Quitô avisa neste horário. Vale o relógio do seu celular.</p>
      {state.status === "loading" ? <p className="text-sm">Carregando...</p> : null}
      {state.status === "failed" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm" role="alert">
            {state.message}
          </p>
          <Button type="button" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <label className="flex flex-col gap-1 text-sm">
          Hora do aviso
          <select className={inputClass} value={state.hour} disabled={state.saving} onChange={(event) => onChoose(Number(event.target.value))}>
            {notificationHours.map((hour) => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {state.status === "ready" && state.message ? (
        <p className="text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.notice ? (
        <p className="text-sm" role="status">
          {state.notice}
        </p>
      ) : null}
    </section>
  );
}
