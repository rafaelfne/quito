import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { sessionMessages } from "@/lib/session";
import { SessionGateView, type GateStatus } from "./session-gate-view";

function render(status: GateStatus) {
  return renderToStaticMarkup(
    <SessionGateView status={status} onRetry={vi.fn()}>
      <p>dados do professor</p>
    </SessionGateView>,
  );
}

describe("SessionGateView", () => {
  test("só mostra os dados de quem está conectado", () => {
    expect(render("signed-in")).toContain("dados do professor");
  });

  test.each<GateStatus>(["checking", "signed-out"])("esconde os dados enquanto %s", (status) => {
    const html = render(status);
    expect(html).toContain("Abrindo o Quitô...");
    expect(html).not.toContain("dados do professor");
  });

  test("sem internet, avisa e oferece tentar de novo, sem pedir para entrar", () => {
    const onRetry = vi.fn();
    const view = SessionGateView({ status: "unreachable", onRetry, children: null }) as React.ReactElement<{ children: React.ReactElement<{ children: React.ReactElement<{ onClick: () => void }>[] }> }>;
    view.props.children.props.children[1].props.onClick();
    expect(onRetry).toHaveBeenCalled();
    const html = render("unreachable");
    expect(html).toContain(sessionMessages.unreachable);
    expect(html).toContain("Tentar de novo");
    expect(html).not.toContain("dados do professor");
  });
});
