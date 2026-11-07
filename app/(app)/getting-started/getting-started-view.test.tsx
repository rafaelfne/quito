import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { firstChargePreviewMessages, type FirstChargePreview } from "@/lib/first-charge-preview";
import { firstChargeMessages, type FirstChargeNotice } from "@/lib/first-charge";
import { notificationsGuidePath, notificationsInviteMessages } from "@/lib/notifications-invite";
import { gettingStartedMessages, initialGettingStarted, type GettingStartedStep } from "@/lib/getting-started";
import { GettingStartedView, NotificationsInvite, StepAction } from "./getting-started-view";

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

  test("pede a média de atraso e deixa guardar dias inteiros", () => {
    const html = renderToStaticMarkup(<GettingStartedView state={{ status: "ready", steps: [{ id: "baseline-delay", title: "Quantos dias os pais costumam atrasar, em média?", hint: "Essa resposta será comparada com os atrasos medidos pelo Quitô.", path: "/getting-started", action: "baseline-delay", done: false }] }} onRetry={vi.fn()} />);
    expect(html).toContain("Dias de atraso");
    expect(html).toContain('type="number" min="0" max="365" step="1" required');
    expect(html).toContain("Salvar resposta");
  });

  test("envia os dias escolhidos no formulário de atraso", () => {
    const onSaveBaselineDelay = vi.fn();
    const form = StepAction({ step: { id: "baseline-delay", title: "Atraso médio", hint: "Informe os dias", path: "/getting-started", action: "baseline-delay", done: false }, isCurrent: true, baselineDelayDays: 12, onSaveBaselineDelay });
    const formData = new FormData();
    formData.set("baseline-delay-days", "12");
    form.props.action(formData);
    expect(onSaveBaselineDelay).toHaveBeenCalledWith(12);
  });

  test("usa valores padrão quando não há média cadastrada", () => {
    const view = GettingStartedView({ state: { status: "ready", steps: [{ id: "baseline-delay", title: "Atraso médio", hint: "Informe os dias", path: "/getting-started", action: "baseline-delay", done: false }] }, onRetry: vi.fn() });
    expect(view.type).toBe("main");
    const readyContent = view.props.children[3];
    readyContent.props.children[1].props.onSaveBaselineDelay(12);
  });

  test("diz que dá para sair e continuar depois", () => {
    const html = render({ status: "ready", steps });
    expect(html).toContain(gettingStartedMessages.leaveHint);
    expect(html).toMatch(/href="\/charges"[^>]*>Continuar depois</);
  });

  test("com tudo feito, comemora e leva para o início", () => {
    const html = render({ status: "ready", steps: steps.map((step) => ({ ...step, done: true })) });
    expect(html).toContain(gettingStartedMessages.finished);
    expect(html).toMatch(/href="\/charges"[^>]*>Ir para o início</);
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

  test("mostra o primeiro mês cobrado e o dia da primeira cobrança de cada responsável", () => {
    const firstCharge: FirstChargeNotice = {
      entryMonth: { year: 2026, month: 11 },
      firstMonth: { year: 2026, month: 12 },
      missing: null,
      guardians: [
        { phone: "11987654321", guardianName: "Ana Lima", studentNames: ["Bia Lima", "Pedro Lima"], dueDate: "2027-01-05" },
        { phone: "11912345678", guardianName: "Rita Souza", studentNames: ["Caio Souza"], dueDate: "2027-01-20" },
      ],
    };
    const html = renderToStaticMarkup(<GettingStartedView state={{ status: "ready", steps }} onRetry={vi.fn()} firstCharge={firstCharge} />);
    expect(html).toContain(firstChargeMessages.title);
    expect(html).toContain("O primeiro mês cobrado pelo Quitô é dezembro de 2026");
    expect(html).toContain("A cobrança de dezembro sai em janeiro de 2027");
    expect(html).toContain("Ana Lima (Bia Lima, Pedro Lima): primeira cobrança em 5 de janeiro.");
    expect(html).toContain("Rita Souza (Caio Souza): primeira cobrança em 20 de janeiro.");
  });

  test("sem dia de vencimento, leva para o recebimento; sem aviso, não mostra a seção", () => {
    const firstCharge: FirstChargeNotice = { entryMonth: { year: 2026, month: 11 }, firstMonth: { year: 2026, month: 12 }, missing: "payment", guardians: [] };
    const html = renderToStaticMarkup(<GettingStartedView state={{ status: "ready", steps }} onRetry={vi.fn()} firstCharge={firstCharge} />);
    expect(html).toMatch(new RegExp(`href="/payment"[^>]*>${firstChargeMessages.missingPayment}<`));
    expect(html).not.toContain("primeira cobrança em");
    expect(render({ status: "ready", steps })).not.toContain(firstChargeMessages.title);
  });

  test("no fim da sequência, mostra a mensagem pronta da primeira cobrança e avisa que ela não é enviada agora", () => {
    const preview: FirstChargePreview = { kind: "ready", firstMonth: { year: 2026, month: 12 }, guardianName: "Rita Souza", dueDate: "2027-01-05", message: "Oi, Rita Souza! Tudo bem?\n*Total: R$ 200,00*" };
    const firstCharge: FirstChargeNotice = { entryMonth: { year: 2026, month: 11 }, firstMonth: { year: 2026, month: 12 }, missing: "payment", guardians: [] };
    const html = renderToStaticMarkup(<GettingStartedView state={{ status: "ready", steps }} onRetry={vi.fn()} firstCharge={firstCharge} firstChargePreview={preview} />);
    expect(html).toContain(firstChargePreviewMessages.title);
    expect(html).toContain("Esta é a mensagem que Rita Souza recebe em 5 de janeiro, com o valor previsto para dezembro");
    expect(html).toContain("Oi, Rita Souza! Tudo bem?\n*Total: R$ 200,00*");
    expect(html).toContain(firstChargePreviewMessages.notSent);
    expect(html.indexOf(firstChargeMessages.title)).toBeLessThan(html.indexOf(firstChargePreviewMessages.title));
  });

  test("sem como montar a mensagem, leva ao que falta; sem prévia, não mostra a seção", () => {
    const preview: FirstChargePreview = { kind: "missing", firstMonth: { year: 2026, month: 12 }, missing: "billing" };
    const html = renderToStaticMarkup(<GettingStartedView state={{ status: "ready", steps }} onRetry={vi.fn()} firstChargePreview={preview} />);
    expect(html).toMatch(new RegExp(`href="/students/setup"[^>]*>${firstChargePreviewMessages.missing.billing}<`));
    expect(html).not.toContain(firstChargePreviewMessages.notSent);
    expect(render({ status: "ready", steps })).not.toContain(firstChargePreviewMessages.title);
  });
});

describe("convite para as notificações", () => {
  const finishedSteps = steps.map((step) => ({ ...step, done: true }));

  test("leva ao guia de ativação no fim da sequência quando ligado", () => {
    const html = renderToStaticMarkup(<GettingStartedView state={{ status: "ready", steps: finishedSteps }} onRetry={vi.fn()} notificationsInvite />);
    expect(html).toContain(notificationsInviteMessages.title);
    expect(html).toContain(notificationsInviteMessages.text);
    expect(html).toMatch(new RegExp(`href="${notificationsGuidePath}"[^>]*>${notificationsInviteMessages.action}<`));
  });

  test("não aparece quando desligado", () => {
    const html = render({ status: "ready", steps: finishedSteps });
    expect(html).not.toContain(notificationsInviteMessages.title);
    expect(html).not.toContain(notificationsGuidePath);
  });

  test("o convite sozinho tem título, texto e o link do guia", () => {
    const html = renderToStaticMarkup(<NotificationsInvite />);
    expect(html).toContain('aria-labelledby="notifications-invite-title"');
    expect(html).toContain(`href="${notificationsGuidePath}"`);
  });

  test("com a prévia da primeira cobrança, o convite vem depois dela", () => {
    const preview: FirstChargePreview = { kind: "ready", firstMonth: { year: 2026, month: 12 }, guardianName: "Rita Souza", dueDate: "2027-01-05", message: "Oi, Rita Souza!" };
    const html = renderToStaticMarkup(<GettingStartedView state={{ status: "ready", steps: finishedSteps }} onRetry={vi.fn()} firstChargePreview={preview} notificationsInvite />);
    expect(html).toContain(firstChargePreviewMessages.title);
    expect(html.indexOf(firstChargePreviewMessages.title)).toBeLessThan(html.indexOf(notificationsInviteMessages.title));
  });
});
