import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { chargeMessages, initialCharges, type Charge, type ChargesState, type WaitingGuardian } from "@/lib/charges";
import { ChargesView } from "./charges-view";

function collect(node: unknown, found: { type: unknown; props: Record<string, unknown> }[] = []) {
  if (Array.isArray(node)) node.forEach((child) => collect(child, found));
  else if (node && typeof node === "object" && "props" in node) {
    const element = node as { type: unknown; props: Record<string, unknown> };
    if (typeof element.type === "function") collect((element.type as (props: unknown) => unknown)(element.props), found);
    else {
      found.push(element);
      collect(element.props.children, found);
    }
  }
  return found;
}

const november = { year: 2026, month: 11 };

const charge: Charge = {
  id: "c1",
  charge_month: "2026-11-01",
  guardian_phone: "11987654321",
  guardian_name: "Ana Lima",
  total_cents: 45000,
  account: [
    {
      studentId: "p",
      studentName: "Pedro Lima",
      lines: [
        { label: "Mensalidade", cents: 50000 },
        { label: "Desconto de 10% para irmãos", cents: -5000 },
      ],
      attendance: "4 aulas dadas.",
      packageBalance: "Saldo do mês anterior: 1 aula.",
      credits: ["Crédito de reposição"],
      totalCents: 45000,
    },
    { studentId: "b", studentName: "Bruno Lima", lines: [], attendance: "Nenhuma aula marcada neste mês.", packageBalance: null, credits: [], totalCents: 0 },
  ],
};

const waitingMarks: WaitingGuardian = { phone: "11933334444", guardianName: "Bia Dias", students: [{ studentId: "r", studentName: "Rui Dias", unmarked: 2, missingBilling: false }] };

const waitingBilling: WaitingGuardian = { phone: "11911112222", guardianName: "Caio Melo", students: [{ studentId: "l", studentName: "Lia Melo", unmarked: 0, missingBilling: true }] };

function ready(overrides: Partial<ChargesState> = {}): ChargesState {
  return { ...initialCharges(november), status: "ready", ...overrides };
}

function render(state: ChargesState) {
  return renderToStaticMarkup(<ChargesView state={state} onRetry={vi.fn()} onConfirmPreview={vi.fn()} onSend={vi.fn()} onUndoSend={vi.fn()} />);
}

describe("tela de cobranças", () => {
  test("mostra o mês, os links e carrega", () => {
    const html = render(initialCharges(november));
    expect(html).toContain("Cobranças");
    expect(html).toContain("Novembro de 2026");
    expect(html).toContain("Carregando");
    for (const path of ["/students", "/lessons", "/closing", "/rules", "/payment", "/account"]) expect(html).toContain(`href="${path}"`);
  });

  test("mostra a mensagem montada de cada responsável", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!\njoao@email.com" } }));
    expect(html).toContain(chargeMessages.messageTitle);
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("Oi, Ana!\njoao@email.com");
    expect(html).not.toContain(chargeMessages.messageNeedsPayment);
  });

  test("na primeira vez pede para passar pela mensagem antes de enviar", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" } }));
    expect(html).toContain("Antes do primeiro envio, leia a mensagem");
    expect(html).toContain(chargeMessages.confirmPreview);
    expect(html).toContain("Oi, Ana!");
  });

  test("enquanto guarda, o botão espera", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" }, confirmingPreview: true }));
    expect(html).toContain(chargeMessages.confirmingPreview);
    expect(html).toContain("disabled");
  });

  test("se não deu para guardar, avisa", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" }, previewMessage: chargeMessages.confirmPreviewFailed }));
    expect(html).toContain(chargeMessages.confirmPreviewFailed);
  });

  test("depois da primeira prévia, a mensagem continua à vista sem pedir de novo", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" }, previewConfirmed: true }));
    expect(html).toContain("Oi, Ana!");
    expect(html).not.toContain(chargeMessages.confirmPreview);
    expect(html).not.toContain("Antes do primeiro envio");
  });

  test("do dia 1 até a véspera, mostra pronta para o dia, com a prévia e sem o botão de enviar", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" }, dueDates: { c1: "2026-12-05" }, today: "2026-12-01", previewConfirmed: true }));
    expect(html).toContain("Pronta para o dia 5");
    expect(html).toContain("Oi, Ana!");
    expect(html).toContain(chargeMessages.sendOnDueDay);
    expect(html).not.toContain(chargeMessages.sendOnWhatsApp);
    expect(html).not.toContain("wa.me");
  });

  test("no dia do vencimento, o botão abre o WhatsApp do responsável com a mensagem", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" }, dueDates: { c1: "2026-12-05" }, today: "2026-12-05", previewConfirmed: true }));
    expect(html).toContain(chargeMessages.sendOnWhatsApp);
    expect(html).toContain('href="https://wa.me/5511987654321?text=Oi%2C%20Ana!"');
    expect(html).not.toContain("Pronta para o dia");
    expect(html).not.toContain(chargeMessages.sendOnDueDay);
  });

  test("no dia, sem passar pela prévia, ainda não mostra o botão de enviar", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" }, dueDates: { c1: "2026-12-05" }, today: "2026-12-05" }));
    expect(html).toContain(chargeMessages.confirmPreview);
    expect(html).not.toContain(chargeMessages.sendOnWhatsApp);
  });

  test("sem os dados de recebimento, leva para o Recebimento", () => {
    const html = render(ready({ charges: [charge] }));
    expect(html).toContain(chargeMessages.messageNeedsPayment);
    expect(html).toContain(chargeMessages.fillPayment);
  });

  test("com o acerto cobrindo o mês, não mostra mensagem", () => {
    const html = render(ready({ charges: [{ ...charge, total_cents: 0 }] }));
    expect(html).toContain(chargeMessages.coveredByAdjustment);
    expect(html).not.toContain(chargeMessages.messageTitle);
    expect(html).not.toContain(chargeMessages.messageNeedsPayment);
  });

  test("falha avisa e oferece tentar de novo", () => {
    const html = render({ ...initialCharges(november), status: "failed" });
    expect(html).toContain(chargeMessages.loadFailed);
    expect(html).toContain("Tentar de novo");
  });

  test("sem cobrança nenhuma explica quando elas aparecem", () => {
    expect(render(ready())).toContain(chargeMessages.empty);
  });

  test("mostra a cobrança de um responsável com a conta aberta dos irmãos", () => {
    const html = render(ready({ charges: [charge] }));
    expect(html).toContain("Ana Lima");
    expect(html).toContain("(11) 98765-4321");
    expect(html).toContain("Pedro Lima");
    expect(html).toContain("Bruno Lima");
    expect(html).toContain("Mensalidade");
    expect(html).toContain("Desconto de 10% para irmãos");
    expect(html).toContain("4 aulas dadas.");
    expect(html).toContain("Saldo do mês anterior");
    expect(html).toContain("Crédito de reposição");
    expect(html).toContain(chargeMessages.frozen);
    expect(html).toContain("450,00");
  });

  test("mostra a linha do acerto com o sinal de menos e não fala de valor coberto", () => {
    const withAdjustment = { ...charge, account: [{ ...charge.account[0], lines: [{ label: "Acerto de novembro: 1 falta remarcada como avisada", cents: -8000 }] }] };
    const html = render(ready({ charges: [withAdjustment] }));
    expect(html).toContain("Acerto de novembro: 1 falta remarcada como avisada");
    expect(html).toContain("− R$ 80,00");
    expect(html).not.toContain(chargeMessages.coveredByAdjustment);
  });

  test("cobrança zerada pelo acerto avisa que não há nada a pagar", () => {
    expect(render(ready({ charges: [{ ...charge, total_cents: 0 }] }))).toContain(chargeMessages.coveredByAdjustment);
  });

  test("diz o que falta marcar em cada aluno e leva às aulas do mês cobrado", () => {
    const html = render(ready({ waiting: [waitingMarks] }));
    expect(html).toContain(chargeMessages.waitingTitle);
    expect(html).toContain("Bia Dias");
    expect(html).toContain("Rui Dias: 2 aulas ainda sem marcar.");
    expect(html).toContain('href="/lessons?month=2026-11"');
    expect(html).toContain("Marcar as aulas de novembro de 2026");
    expect(html).not.toContain(chargeMessages.defineBilling);
    expect(html).not.toContain(chargeMessages.monthTotal);
  });

  test("aluno sem forma de cobrança leva a Alunos, sem atalho para as aulas", () => {
    const html = render(ready({ waiting: [waitingBilling] }));
    expect(html).toContain(`Lia Melo: ${chargeMessages.missingBilling}`);
    expect(html).toContain(chargeMessages.defineBilling);
    expect(html).not.toContain("/lessons?month");
  });

  test("com os dois casos mostra os dois atalhos", () => {
    const html = render(ready({ waiting: [waitingMarks, waitingBilling] }));
    expect(html).toContain("/lessons?month=2026-11");
    expect(html).toContain(chargeMessages.defineBilling);
  });

  test("diz quem não tem nada a pagar no mês", () => {
    const html = render(ready({ nothingToCharge: ["Caio Melo"] }));
    expect(html).toContain(chargeMessages.nothingToChargeTitle);
    expect(html).toContain("Caio Melo");
  });
});

describe("envio pelo WhatsApp", () => {
  const confirmed = { charges: [charge], messages: { c1: "Oi, Ana!\njoao@email.com" }, dueDates: { c1: "2026-12-05" }, today: "2026-12-05", previewConfirmed: true };

  test("antes de passar pela prévia, ainda não mostra o envio", () => {
    const html = render(ready({ charges: [charge], messages: { c1: "Oi, Ana!" } }));
    expect(html).not.toContain(chargeMessages.sendOnWhatsApp);
    expect(html).not.toContain("wa.me");
  });

  test("depois da prévia, o toque abre o WhatsApp do responsável com a mensagem escrita", () => {
    const html = render(ready(confirmed));
    expect(html).toContain(chargeMessages.sendOnWhatsApp);
    expect(html).toContain(`href="https://wa.me/5511987654321?text=${encodeURIComponent("Oi, Ana!\njoao@email.com")}"`);
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain(chargeMessages.sent);
  });

  test("tocar em enviar e em desfazer avisam a página com a cobrança certa", () => {
    const onSend = vi.fn();
    const onUndoSend = vi.fn();
    const props = { onRetry: vi.fn(), onConfirmPreview: vi.fn(), onSend, onUndoSend };
    const link = collect(ChargesView({ state: ready(confirmed), ...props })).find((element) => element.type === "a" && String(element.props.href).startsWith("https://wa.me/"));
    (link?.props.onClick as () => void)();
    expect(onSend).toHaveBeenCalledWith("c1");
    const undo = collect(ChargesView({ state: ready({ ...confirmed, charges: [{ ...charge, sent_at: "2026-12-05T13:00:00.000Z" }] }), ...props })).find((element) => element.type === "button" && element.props.children === chargeMessages.undoSend);
    (undo?.props.onClick as () => void)();
    expect(onUndoSend).toHaveBeenCalledWith("c1");
  });

  test("enquanto guarda o envio, o botão espera", () => {
    const html = render(ready({ ...confirmed, savingSends: ["c1"] }));
    expect(html).toContain(chargeMessages.savingSend);
    expect(html).toContain('aria-disabled="true"');
  });

  test("cobrança enviada diz que saiu e oferece desfazer", () => {
    const html = render(ready({ ...confirmed, charges: [{ ...charge, sent_at: "2026-12-05T13:00:00.000Z" }] }));
    expect(html).toContain(chargeMessages.sent);
    expect(html).toContain(chargeMessages.undoHint);
    expect(html).toContain(chargeMessages.undoSend);
    expect(html).not.toContain(chargeMessages.sendOnWhatsApp);
  });

  test("enquanto desfaz, o botão espera", () => {
    const html = render(ready({ ...confirmed, charges: [{ ...charge, sent_at: "2026-12-05T13:00:00.000Z" }], savingSends: ["c1"] }));
    expect(html).toContain(chargeMessages.savingSend);
    expect(html).toContain("disabled");
  });

  test("se não deu para guardar o envio, avisa", () => {
    expect(render(ready({ ...confirmed, sendMessage: chargeMessages.sendFailed }))).toContain(chargeMessages.sendFailed);
  });
});
