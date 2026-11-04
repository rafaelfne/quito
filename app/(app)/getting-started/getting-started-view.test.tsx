import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { gettingStartedMessages, initialGettingStarted, type GettingStartedStep } from "@/lib/getting-started";
import { GettingStartedView } from "./getting-started-view";

const steps: GettingStartedStep[] = [
  { id: "a", title: "Cadastre seus alunos", hint: "Dica um", path: "/students", done: true },
  { id: "b", title: "Defina o horário", hint: "Dica dois", path: "/students", done: false },
  { id: "c", title: "Veja a prévia", hint: "Dica três", path: "/closing", done: false },
];

function render(state: Parameters<typeof GettingStartedView>[0]["state"]) {
  return renderToStaticMarkup(<GettingStartedView state={state} onRetry={vi.fn()} />);
}

describe("tela de primeiros passos", () => {
  test("enquanto carrega, avisa e já deixa sair", () => {
    const html = render(initialGettingStarted);
    expect(html).toContain("Carregando");
    expect(html).toContain("Continuar depois");
  });

  test("mostra os passos, quanto falta e onde o professor parou", () => {
    const html = render({ status: "ready", steps });
    expect(html).toContain("Faltam 2 de 3 passos.");
    expect(html).toContain('value="1"');
    expect(html).toContain("1. Cadastre seus alunos");
    expect(html).toContain("Feito");
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="step"[\s\S]*Defina o horário[\s\S]*href="\/students"[^>]*>Continuar</);
    expect(html).toMatch(/href="\/closing"[^>]*>Abrir</);
  });

  test("diz que dá para sair e continuar depois", () => {
    const html = render({ status: "ready", steps });
    expect(html).toContain(gettingStartedMessages.leaveHint);
    expect(html).toMatch(/href="\/notes"[^>]*>Continuar depois</);
  });

  test("com tudo feito, comemora e leva para o início", () => {
    const html = render({ status: "ready", steps: steps.map((step) => ({ ...step, done: true })) });
    expect(html).toContain(gettingStartedMessages.finished);
    expect(html).toMatch(/href="\/notes"[^>]*>Ir para o início</);
    expect(html).not.toContain("Continuar depois");
    expect(html).not.toContain("aria-current");
  });

  test("se não abriu, avisa e deixa tentar de novo", () => {
    const onRetry = vi.fn();
    const html = render({ status: "failed", steps: [] });
    expect(html).toContain(gettingStartedMessages.loadFailed);
    expect(html).toContain("Continuar depois");
    const main = GettingStartedView({ state: { status: "failed", steps: [] }, onRetry });
    const failure = main.props.children[2];
    failure.props.children[1].props.onClick();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
