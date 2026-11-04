import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { gettingStartedMessages, type GettingStartedStep } from "@/lib/getting-started";
import { GettingStartedReminderView } from "./reminder-view";

const steps: GettingStartedStep[] = [
  { id: "a", title: "Cadastre seus alunos", hint: "Dica", path: "/students", done: true },
  { id: "b", title: "Defina o horário", hint: "Dica", path: "/students", done: false },
];

describe("lembrete dos primeiros passos", () => {
  test("mostra quanto falta, o próximo passo e o caminho de volta", () => {
    const html = renderToStaticMarkup(<GettingStartedReminderView reminder={{ kind: "progress", steps }} />);
    expect(html).toContain("Primeiros passos: Falta 1 de 2 passos.");
    expect(html).toContain("Próximo passo: Defina o horário.");
    expect(html).toMatch(/href="\/getting-started"[^>]*>Continuar</);
  });

  test("com tudo feito e a sequência ainda não aberta, chama para ver o fim", () => {
    const html = renderToStaticMarkup(<GettingStartedReminderView reminder={{ kind: "progress", steps: steps.map((step) => ({ ...step, done: true })) }} />);
    expect(html).toContain(gettingStartedMessages.allDoneReminder);
    expect(html).toMatch(/href="\/getting-started"[^>]*>Ver</);
    expect(html).not.toContain("Próximo passo");
  });

  test("na tela de um passo, oferece só a volta", () => {
    const html = renderToStaticMarkup(<GettingStartedReminderView reminder={{ kind: "back" }} />);
    expect(html).toMatch(/href="\/getting-started"[^>]*>Voltar aos primeiros passos</);
  });

  test.each([{ kind: "none" }, { kind: "first-entry" }] as const)("não mostra nada em $kind", (reminder) => {
    expect(renderToStaticMarkup(<GettingStartedReminderView reminder={reminder} />)).toBe("");
  });
});
