import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { chargeMessages, initialCharges, type Charge, type ChargesState, type WaitingGuardian } from "@/lib/charges";
import { ChargesView } from "./charges-view";

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
  return renderToStaticMarkup(<ChargesView state={state} onRetry={vi.fn()} />);
}

describe("tela de cobranças", () => {
  test("mostra o mês, os links e carrega", () => {
    const html = render(initialCharges(november));
    expect(html).toContain("Cobranças");
    expect(html).toContain("Novembro de 2026");
    expect(html).toContain("Carregando");
    for (const path of ["/students", "/lessons", "/closing", "/rules", "/payment", "/account"]) expect(html).toContain(`href="${path}"`);
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
