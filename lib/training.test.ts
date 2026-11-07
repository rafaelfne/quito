import { describe, expect, test, vi } from "vitest";
import { describeTrainingCharges, describeTrainingNotice, describeTrainingSummary, firstChargedMonth, isTrainingMonth, loadTrainingMonth, type TrainingClient } from "./training";

const november = { year: 2026, month: 11 };

function fakeClient(result: () => Promise<{ data: unknown; error: { message: string } | null }>) {
  const select = vi.fn(() => ({ maybeSingle: result }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as TrainingClient, from, select };
}

describe("mês de treino", () => {
  test("vai da entrada até o fim do mês, e os meses antes dele também não são cobrados", () => {
    expect(isTrainingMonth(november, november)).toBe(true);
    expect(isTrainingMonth({ year: 2026, month: 10 }, november)).toBe(true);
    expect(isTrainingMonth({ year: 2025, month: 12 }, november)).toBe(true);
    expect(isTrainingMonth({ year: 2026, month: 12 }, november)).toBe(false);
    expect(isTrainingMonth({ year: 2027, month: 1 }, november)).toBe(false);
  });

  test("sem entrada guardada, nenhum mês é de treino", () => {
    expect(isTrainingMonth(november, null)).toBe(false);
  });

  test("a primeira cobrança é do mês seguinte, inclusive na virada do ano", () => {
    expect(firstChargedMonth(november)).toEqual({ year: 2026, month: 12 });
    expect(firstChargedMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
  });
});

describe("textos do treino", () => {
  test("o aviso nas aulas diz que nada gera cobrança e quando começa a cobrança", () => {
    expect(describeTrainingNotice(november)).toBe("Mês de treino: marque as aulas como em qualquer mês. Até o fim de novembro de 2026, nenhuma aula marcada gera cobrança. A primeira cobrança pelo Quitô é de dezembro de 2026.");
  });

  test("a tela de cobranças explica por que o mês de treino não tem cobrança", () => {
    expect(describeTrainingCharges({ year: 2026, month: 12 })).toBe("As aulas até dezembro de 2026 são de treino e não geram cobrança. A primeira cobrança pelo Quitô é de janeiro de 2027.");
  });

  test("o resumo do mês conta as aulas e lembra que nenhuma gera cobrança", () => {
    expect(describeTrainingSummary({ charged: 3, free: 1, unmarked: 2 })).toBe("Treino: 3 aulas seriam cobradas, 1 sem cobrança e 2 para marcar. Nenhuma gera cobrança.");
    expect(describeTrainingSummary({ charged: 1, free: 0, unmarked: 0 })).toBe("Treino: 1 aula seria cobrada, 0 sem cobrança e 0 para marcar. Nenhuma gera cobrança.");
  });
});

describe("loadTrainingMonth", () => {
  test("o mês de treino é o mês da entrada nos primeiros passos", async () => {
    const { client, from, select } = fakeClient(async () => ({ data: { started_at: "2026-11-07T15:00:00" }, error: null }));
    expect(await loadTrainingMonth(client)).toEqual({ ok: true, trainingMonth: november });
    expect(from).toHaveBeenCalledWith("getting_started");
    expect(select).toHaveBeenCalledWith("started_at");
  });

  test("sem entrada guardada, não há mês de treino", async () => {
    expect(await loadTrainingMonth(fakeClient(async () => ({ data: null, error: null })).client)).toEqual({ ok: true, trainingMonth: null });
    expect(await loadTrainingMonth(fakeClient(async () => ({ data: { started_at: null }, error: null })).client)).toEqual({ ok: true, trainingMonth: null });
  });

  test("erro do banco ou queda da conexão vira falha", async () => {
    expect(await loadTrainingMonth(fakeClient(async () => ({ data: null, error: { message: "x" } })).client)).toEqual({ ok: false });
    expect(await loadTrainingMonth(fakeClient(async () => Promise.reject(new Error("rede"))).client)).toEqual({ ok: false });
  });
});
