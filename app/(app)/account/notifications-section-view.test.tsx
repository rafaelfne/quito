import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { PushStatus } from "@/lib/push-subscription";
import { NotificationsSectionView } from "./notifications-section-view";

function render(status: PushStatus, busy = false) {
  return renderToStaticMarkup(<NotificationsSectionView status={status} busy={busy} onEnable={vi.fn()} />);
}

describe("notificações na tela de conta", () => {
  test("mostra quando estão ativas, sem botão", () => {
    const html = render("active");
    expect(html).toContain("Notificações neste aparelho");
    expect(html).toContain("As notificações estão ativas neste aparelho.");
    expect(html).not.toContain("Ativar as notificações");
  });

  test("desligadas, oferece ativar", () => {
    const html = render("off");
    expect(html).toContain("desligadas");
    expect(html).toContain("Ativar as notificações");
    expect(html).toContain('role="status"');
  });

  test("enquanto ativa, trava o botão", () => {
    const html = render("off", true);
    expect(html).toContain("Ativando...");
    expect(html).toContain("disabled");
  });

  test("falha e bloqueio aparecem como alerta", () => {
    expect(render("failed")).toContain('role="alert"');
    expect(render("failed")).toContain("Ativar as notificações");
    expect(render("blocked")).toContain('role="alert"');
    expect(render("blocked")).not.toContain("Ativar as notificações");
  });

  test("no iPhone sem instalar, explica o caminho sem botão", () => {
    const html = render("needs-install");
    expect(html).toContain("tela de início");
    expect(html).not.toContain("<button");
  });
});
