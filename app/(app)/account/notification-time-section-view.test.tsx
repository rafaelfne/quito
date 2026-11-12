import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialNotificationTime, type NotificationTimeState } from "@/lib/notification-time";
import { NotificationTimeSectionView } from "./notification-time-section-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const loading = initialNotificationTime("America/Sao_Paulo");

function findElement(node: ReactNode, type: string): ReactElement<AnyProps> | undefined {
  let found: ReactElement<AnyProps> | undefined;
  Children.forEach(node, (child) => {
    if (found || !isValidElement<AnyProps>(child)) return;
    found = child.type === type ? child : findElement(child.props.children, type);
  });
  return found;
}

function render(changes: Partial<NotificationTimeState> = {}) {
  return renderToStaticMarkup(<NotificationTimeSectionView state={{ ...loading, ...changes }} onChoose={vi.fn()} onRetry={vi.fn()} />);
}

describe("horário do aviso na tela de conta", () => {
  test("enquanto carrega, avisa e não mostra a escolha", () => {
    const html = render();
    expect(html).toContain("Horário do aviso");
    expect(html).toContain("Carregando...");
    expect(html).not.toContain("<select");
  });

  test("pronto, mostra as 24 horas cheias com 9h escolhida", () => {
    const html = render({ status: "ready" });
    expect(html).toContain("Hora do aviso");
    expect(html.match(/<option/g)).toHaveLength(24);
    expect(html).toContain('<option value="9" selected="">9h</option>');
    expect(html).toContain('<option value="0">0h</option>');
    expect(html).toContain('<option value="23">23h</option>');
    expect(html).toContain("relógio do seu celular");
  });

  test("enquanto guarda, trava a escolha", () => {
    expect(render({ status: "ready", saving: true })).toContain("disabled");
  });

  test("confirma o horário guardado", () => {
    const html = render({ status: "ready", hour: 7, notice: "Horário guardado." });
    expect(html).toContain('<option value="7" selected="">7h</option>');
    expect(html).toContain('role="status"');
    expect(html).toContain("Horário guardado.");
  });

  test("falha ao guardar aparece como alerta, sem esconder a escolha", () => {
    const html = render({ status: "ready", message: "Não deu para guardar." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("<select");
  });

  test("escolher outra hora na lista entrega a hora como número", () => {
    const onChoose = vi.fn();
    const select = findElement(NotificationTimeSectionView({ state: { ...loading, status: "ready" }, onChoose, onRetry: vi.fn() }), "select");
    (select!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "7" } });
    expect(onChoose).toHaveBeenCalledWith(7);
  });

  test("falha ao abrir oferece tentar de novo", () => {
    const html = render({ status: "failed", message: "Não deu para abrir." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Não deu para abrir.");
    expect(html).toContain("Tentar de novo");
    expect(html).not.toContain("<select");
  });
});
