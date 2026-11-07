import { describe, expect, test } from "vitest";
import { exampleMessageParts, quitoFooter, type MessageAdjustments, type MessageTone } from "@/lib/message-templates";
import {
  addDays,
  composeReminder,
  defaultReminderDays,
  describeReminderDay,
  describeReminderName,
  exampleReminder,
  reminderCountLimit,
  reminderDraftFrom,
  reminderMessages,
  reminderProgress,
  resizeReminderDrafts,
  sanitizedReminderDays,
  validateReminderDrafts,
} from "@/lib/reminders";

function adjustments(tone: MessageTone, changes: Partial<MessageAdjustments> = {}): MessageAdjustments {
  return { tone, greeting: null, thanks: null, signature: null, footer: true, ...changes };
}

const parts = { ...exampleMessageParts, duePassed: true };

describe("modelo de lembrete", () => {
  test("cada tom tem um texto gentil diferente para cada lembrete", () => {
    for (const tone of ["friendly", "direct", "formal"] as const) {
      const texts = [0, 1, 2].map((index) => composeReminder(adjustments(tone), parts, index));
      expect(new Set(texts).size).toBe(3);
      for (const text of texts) {
        expect(text).toContain(parts.total);
        expect(text.split("\n")).toContain(parts.pixKey);
        expect(text).toMatch(/desconsider/);
      }
    }
  });

  test("o Próximo lembra com carinho, com o valor, o vencimento e a chave Pix sozinha numa linha", () => {
    const text = composeReminder(adjustments("friendly"), parts, 0);
    expect(text).toContain(`Passando para lembrar da conta de ${parts.month} ${parts.studentsWithArticles}, de *${parts.total}*, que venceu em ${parts.dueShort}.`);
    expect(text).toContain("Se já pagou, pode desconsiderar.");
    expect(text.endsWith(quitoFooter)).toBe(true);
  });

  test("o Direto numera os lembretes", () => {
    expect(composeReminder(adjustments("direct"), parts, 0)).toContain("Lembrete: cobrança");
    expect(composeReminder(adjustments("direct"), parts, 1)).toContain("Segundo lembrete: cobrança");
    expect(composeReminder(adjustments("direct"), parts, 2)).toContain("Terceiro lembrete: cobrança");
    expect(composeReminder(adjustments("direct"), parts, 5)).toContain("Lembrete: cobrança");
  });

  test("o Formal usa o vencimento por extenso", () => {
    expect(composeReminder(adjustments("formal"), parts, 1)).toContain(`com vencimento em ${parts.dueLong}`);
    expect(composeReminder(adjustments("formal"), parts, 2)).toContain("Fico à disposição");
  });

  test("usa a saudação, o agradecimento e a assinatura do professor, e respeita a linha do Quitô", () => {
    const text = composeReminder(adjustments("friendly", { greeting: "Bom dia", thanks: "Valeu", signature: "Tio João", footer: false }), parts, 0);
    expect(text.startsWith(`Bom dia, ${parts.guardianName}!`)).toBe(true);
    expect(text).toContain("Valeu!");
    expect(text.endsWith("Tio João")).toBe(true);
    expect(text).not.toContain(quitoFooter);
  });

  test("o exemplo usa a chave Pix e o nome do professor quando já existem", () => {
    expect(exampleReminder(adjustments("formal"), { pixKey: " joao@email.com ", displayName: " João Silva " }, 0)).toContain("Titular: João Silva");
    expect(exampleReminder(adjustments("formal"), { pixKey: "", displayName: "" }, 0).split("\n")).toContain(exampleMessageParts.pixKey);
  });
});

describe("dias dos lembretes", () => {
  test("de partida, dois lembretes: 3 e 7 dias depois do envio", () => {
    expect(defaultReminderDays).toEqual([3, 7]);
    expect(reminderDraftFrom(defaultReminderDays)).toEqual(["3", "7"]);
  });

  test("o que vem do banco fora da regra é descartado", () => {
    expect(sanitizedReminderDays(null)).toEqual(defaultReminderDays);
    expect(sanitizedReminderDays([])).toEqual([]);
    expect(sanitizedReminderDays([2, 2, 0, 5, 70, 9, 12])).toEqual([2, 5, 9]);
    expect(sanitizedReminderDays([1.5, 4])).toEqual([4]);
  });

  test("mudar quantos lembretes sugere dias depois do anterior e respeita o máximo", () => {
    expect(resizeReminderDrafts([], 3)).toEqual(["3", "7", "14"]);
    expect(resizeReminderDrafts(["3", "20"], 3)).toEqual(["3", "20", "21"]);
    expect(resizeReminderDrafts(["3", "7"], 1)).toEqual(["3"]);
    expect(resizeReminderDrafts(["3"], 0)).toEqual([]);
    expect(resizeReminderDrafts(["3"], 9)).toHaveLength(reminderCountLimit);
    expect(resizeReminderDrafts(["60"], 2)).toEqual(["60", "60"]);
  });

  test("aceita dias inteiros, crescentes, de 1 a 60", () => {
    expect(validateReminderDrafts([" 2 ", "5", "60"])).toEqual({ ok: true, days: [2, 5, 60] });
    expect(validateReminderDrafts([])).toEqual({ ok: true, days: [] });
    for (const drafts of [["0"], ["61"], ["3", "3"], ["7", "3"], ["dois"], [""], ["2.5"]]) expect(validateReminderDrafts(drafts)).toEqual({ ok: false, error: reminderMessages.invalidDays });
  });
});

describe("quando sai cada lembrete", () => {
  const sentAt = "2026-12-05T13:00:00.000Z";

  test("o primeiro sai os dias combinados depois do envio da cobrança", () => {
    expect(reminderProgress(sentAt, [], [3, 7])).toEqual({ sent: 0, total: 2, next: { index: 0, due: "2026-12-08" }, lastSentIndex: null });
  });

  test("cobrança enviada com atraso conta a partir do dia do envio", () => {
    expect(reminderProgress("2026-12-09T13:00:00.000Z", [], [3]).next).toEqual({ index: 0, due: "2026-12-12" });
  });

  test("o seguinte respeita a distância entre os lembretes quando o anterior saiu atrasado", () => {
    expect(reminderProgress(sentAt, ["2026-12-08T13:00:00.000Z"], [3, 7]).next).toEqual({ index: 1, due: "2026-12-12" });
    expect(reminderProgress(sentAt, ["2026-12-10T13:00:00.000Z"], [3, 7]).next).toEqual({ index: 1, due: "2026-12-14" });
  });

  test("depois do último, não há próximo", () => {
    expect(reminderProgress(sentAt, ["2026-12-08T13:00:00.000Z", "2026-12-12T13:00:00.000Z"], [3, 7])).toEqual({ sent: 2, total: 2, next: null, lastSentIndex: 1 });
    expect(reminderProgress(sentAt, [], [])).toEqual({ sent: 0, total: 0, next: null, lastSentIndex: null });
  });

  test("passa a data por cima do fim do mês e do ano", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  test("descreve o dia e o lembrete para o professor", () => {
    expect(describeReminderDay("2027-01-02")).toBe("2/1");
    expect(describeReminderName(1, 3)).toBe("Lembrete 2 de 3");
  });
});
