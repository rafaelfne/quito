import { describe, expect, test, vi } from "vitest";
import { accountLinesOf, chargeDueDate, chargeMessageOf, chargeMessageParts, composedMessagesFor, loadChargeMessageContext, type ChargeMessageContext } from "@/lib/charge-message";
import type { Charge, ChargeStudent } from "@/lib/charges";
import type { LessonsClient } from "@/lib/lessons";
import { composeMessage, exampleMessageParts, messageTones, quitoFooter, type MessageTone } from "@/lib/message-templates";

function student(studentId: string, studentName: string, lines: ChargeStudent["lines"], attendance = "Nenhuma aula marcada neste mês."): ChargeStudent {
  return { studentId, studentName, lines, attendance, packageBalance: null, credits: [], totalCents: lines.reduce((total, line) => total + line.cents, 0) };
}

const pedro = student(
  "p",
  "Pedro",
  [
    { label: "4 aulas dadas × R$ 50,00", cents: 20000 },
    { label: "1 reposição × R$ 50,00", cents: 5000 },
    { label: "Desconto de 10% para irmãos", cents: -2500 },
  ],
  "4 aulas dadas; 1 reposição.",
);

const ana = student(
  "a",
  "Ana",
  [
    { label: "Mensalidade", cents: 20000 },
    { label: "Desconto de 10% para irmãos", cents: -2000 },
  ],
  "3 aulas dadas; 1 falta avisada, sem cobrança.",
);

const carla: Charge = { id: "c1", charge_month: "2026-11-01", guardian_phone: "11987654321", guardian_name: "Carla", total_cents: 40500, account: [pedro, ana] };

const context: ChargeMessageContext = {
  adjustments: { tone: "friendly", greeting: null, thanks: null, signature: null, footer: true },
  payment: { pix_key: "joao.violao@email.com", display_name: "João Silva", due_day: 5 },
  dueDayOverrides: new Map(),
  students: [
    { id: "p", gender: "male", called_as: null },
    { id: "a", gender: "female", called_as: null },
  ],
};

const dueDay = "2026-12-05";

function single(lines: ChargeStudent["lines"], attendance?: string): Charge {
  return { ...carla, account: [student("p", "Pedro", lines, attendance)] };
}

describe("mensagem montada", () => {
  test.each(messageTones)("no tom $label, a cobrança real sai igual ao texto da descoberta", ({ id }: { id: MessageTone }) => {
    const adjustments = { ...context.adjustments, tone: id };
    expect(chargeMessageOf(carla, { ...context, adjustments }, dueDay)).toBe(composeMessage(adjustments, exampleMessageParts));
  });

  test.each(messageTones)("no tom $label, a chave Pix fica sozinha numa linha", ({ id }: { id: MessageTone }) => {
    const message = chargeMessageOf(carla, { ...context, adjustments: { ...context.adjustments, tone: id } }, dueDay);
    expect(message?.split("\n")).toContain("joao.violao@email.com");
  });

  test("usa os ajustes do professor e termina no rodapé", () => {
    const message = chargeMessageOf(carla, { ...context, adjustments: { tone: "friendly", greeting: "Bom dia", thanks: "Obrigada", signature: "Tia Bia", footer: true } }, dueDay) ?? "";
    expect(message.startsWith("Bom dia, Carla! Tudo bem?")).toBe(true);
    expect(message).toContain("Obrigada!\nTia Bia\n");
    expect(message.endsWith(quitoFooter)).toBe(true);
  });

  test("com a linha do Quitô desligada, termina na assinatura", () => {
    const message = chargeMessageOf(carla, { ...context, adjustments: { ...context.adjustments, footer: false } }, dueDay) ?? "";
    expect(message).not.toContain(quitoFooter);
    expect(message.endsWith("Prof. João")).toBe(true);
  });

  test("sem os dados de recebimento, não monta a mensagem", () => {
    expect(chargeMessageParts(carla, { ...context, payment: null }, dueDay)).toBeNull();
    expect(chargeMessageOf(carla, { ...context, payment: null }, dueDay)).toBeNull();
  });
});

describe("nomes dos alunos", () => {
  test("três irmãos ficam em lista, cada um com o seu artigo", () => {
    const parts = chargeMessageParts({ ...carla, account: [pedro, ana, student("r", "Rui", [])] }, { ...context, students: [...context.students, { id: "r", gender: "male", called_as: null }] }, dueDay);
    expect(parts?.studentsWithArticles).toBe("do Pedro, da Ana e do Rui");
    expect(parts?.studentNames).toBe("Pedro, Ana e Rui");
  });

  test("com gênero outro, usa de e o jeito como o aluno quer ser chamado", () => {
    const parts = chargeMessageParts({ ...carla, account: [student("p", "Pedro Lima", [])] }, { ...context, students: [{ id: "p", gender: "other", called_as: "Alex" }] }, dueDay);
    expect(parts?.studentsWithArticles).toBe("de Alex");
    expect(parts?.studentNames).toBe("Alex");
  });

  test.each([
    ["sem gênero no cadastro", [{ id: "p", gender: null, called_as: null }]],
    ["com o aluno fora do cadastro", []],
  ])("%s, usa de e o nome guardado na cobrança", (_case, students) => {
    expect(chargeMessageParts({ ...carla, account: [pedro] }, { ...context, students }, dueDay)?.studentsWithArticles).toBe("de Pedro");
  });
});

describe("conta aberta", () => {
  test("junta as aulas, as faltas cobradas e as reposições do mesmo valor", () => {
    const charge = single([
      { label: "2 aulas dadas × R$ 50,00", cents: 10000 },
      { label: "1 falta sem aviso × R$ 50,00", cents: 5000 },
      { label: "1 reposição × R$ 50,00", cents: 5000 },
    ]);
    expect(accountLinesOf(charge, context.students)).toEqual(["Pedro: 2 aulas, 1 falta sem aviso e 1 reposição × R$ 50,00 = R$ 200,00"]);
  });

  test("uma aula só fica no singular e o pacote mostra o preço", () => {
    expect(accountLinesOf(single([{ label: "1 aula dada × R$ 50,00", cents: 5000 }]), context.students)).toEqual(["Pedro: 1 aula × R$ 50,00 = R$ 50,00"]);
    expect(accountLinesOf(single([{ label: "1 pacote de 4 aulas × R$ 200,00", cents: 20000 }]), context.students)).toEqual(["Pedro: 1 pacote de 4 aulas × R$ 200,00 = R$ 200,00"]);
  });

  test("mostra a falta sem cobrança de quem paga por aula", () => {
    const charge = single([{ label: "Nenhuma aula cobrada neste mês", cents: 0 }], "1 falta avisada, sem cobrança; 1 falta do professor, sem cobrança.");
    expect(accountLinesOf(charge, context.students)).toEqual(["Pedro: nenhuma aula cobrada neste mês", "Pedro: 1 falta avisada, sem cobrança", "Pedro: 1 falta do professor, sem cobrança"]);
  });

  test("a mensalidade não fala de falta, porque ela é paga do mesmo jeito", () => {
    expect(accountLinesOf({ ...carla, account: [ana] }, context.students)).toEqual(["Ana: mensalidade R$ 200,00", "Desconto de 10% para irmãos: − R$ 20,00"]);
  });

  test("o mês com 5 semanas entra com o valor", () => {
    expect(accountLinesOf(single([{ label: "Mês com 5 semanas: uma aula avulsa a mais", cents: 5000 }]), context.students)).toEqual(["Pedro: mês com 5 semanas: uma aula avulsa a mais: R$ 50,00"]);
  });

  test("o acerto entra por último, para mais ou para menos", () => {
    const charge = single(
      [
        { label: "Acerto de outubro: 1 falta remarcada como avisada", cents: -5000 },
        { label: "Acerto de setembro: 1 reposição incluída", cents: 5000 },
        { label: "4 aulas dadas × R$ 50,00", cents: 20000 },
      ],
      "4 aulas dadas; 1 falta avisada, sem cobrança.",
    );
    expect(accountLinesOf(charge, context.students)).toEqual([
      "Pedro: 4 aulas × R$ 50,00 = R$ 200,00",
      "Pedro: 1 falta avisada, sem cobrança",
      "Pedro: acerto de outubro: 1 falta remarcada como avisada: − R$ 50,00",
      "Pedro: acerto de setembro: 1 reposição incluída: R$ 50,00",
    ]);
  });
});

describe("vencimento", () => {
  test("é no mês seguinte ao das aulas", () => {
    expect(chargeMessageParts(carla, context, dueDay)).toMatchObject({ month: "novembro", dueDay: "5", dueShort: "5/12", dueLong: "5 de dezembro", duePassed: false });
  });

  test("o dia do responsável vale no lugar do padrão", () => {
    expect(chargeDueDate(carla, 5, new Map([[carla.guardian_phone, 20]]))).toBe("2026-12-20");
  });

  test("em mês mais curto, cai no último dia", () => {
    expect(chargeDueDate({ ...carla, charge_month: "2027-01-01" }, 31, new Map())).toBe("2027-02-28");
  });

  test("antes do dia, a mensagem já é a do dia do vencimento", () => {
    expect(chargeMessageOf(carla, context, "2026-12-01")).toContain("Vence hoje, dia 5.");
  });

  test("enviada depois do dia, não diz que vence hoje", () => {
    const friendly = chargeMessageOf(carla, context, "2026-12-08") ?? "";
    expect(friendly).toContain("Venceu em 5/12. A chave Pix é:");
    expect(friendly).not.toContain("Vence hoje");
    const direct = chargeMessageOf(carla, { ...context, adjustments: { ...context.adjustments, tone: "direct" } }, "2026-12-08") ?? "";
    expect(direct).toContain("*R$ 405,00*, venceu em 5/12.");
  });
});

describe("mensagens das cobranças do mês", () => {
  test("monta só as cobranças com valor a pagar", () => {
    const covered = { ...carla, id: "c2", total_cents: 0 };
    expect(Object.keys(composedMessagesFor([carla, covered], context, dueDay))).toEqual(["c1"]);
  });

  test("sem os dados de recebimento, não há mensagem", () => {
    expect(composedMessagesFor([carla], { ...context, payment: null }, dueDay)).toEqual({});
  });
});

describe("carregar o que a mensagem usa", () => {
  function clientWith(overrides: { paymentError?: boolean } = {}): LessonsClient {
    const single = (data: unknown, error: unknown = null) => ({ select: () => ({ maybeSingle: async () => ({ data, error }) }) });
    const from = vi.fn((table: string) => {
      if (table === "payment_settings") return single(context.payment, overrides.paymentError ? { message: "sem rede" } : null);
      if (table === "message_settings") return single({ tone: "formal", greeting: "Bom dia", thanks: null, signature: null, footer: true });
      if (table === "guardian_due_days") return { select: async () => ({ data: [{ guardian_phone: "11987654321", due_day: 20 }], error: null }) };
      return { select: async () => ({ data: [{ id: "p", name: "Pedro", gender: "male", called_as: null }], error: null }) };
    });
    return { from } as unknown as LessonsClient;
  }

  test("reúne o recebimento, o tom, os vencimentos e os alunos", async () => {
    const loaded = await loadChargeMessageContext(clientWith());
    expect(loaded?.payment).toEqual(context.payment);
    expect(loaded?.adjustments).toEqual({ tone: "formal", greeting: "Bom dia", thanks: null, signature: null, footer: true });
    expect(loaded?.dueDayOverrides.get("11987654321")).toBe(20);
    expect(loaded?.students.map((one) => one.id)).toEqual(["p"]);
  });

  test("se algo não abre, avisa com vazio", async () => {
    expect(await loadChargeMessageContext(clientWith({ paymentError: true }))).toBeNull();
  });
});
