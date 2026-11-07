import { describe, expect, test, vi } from "vitest";
import {
  describeFirstChargeGuardian,
  describeFirstChargeTiming,
  describeFirstMonth,
  firstChargedMonth,
  firstChargeMessages,
  firstChargeMissingMessage,
  firstChargeMissingPaths,
  firstChargeNoticeFrom,
  loadFirstChargeNotice,
  type FirstChargeClient,
  type FirstChargeFacts,
  type FirstChargeNotice,
} from "./first-charge";
import type { Student } from "./students";

type Failure = { message: string } | null;

const pedro: Student = { id: "p", name: "Pedro Lima", gender: null, called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const bia: Student = { ...pedro, id: "b", name: "Bia Lima" };
const caio: Student = { ...pedro, id: "c", name: "Caio Souza", guardian_name: "Rita Souza", guardian_phone: "11912345678" };

const facts: FirstChargeFacts = { startedAt: "2026-11-07T15:00:00Z", today: "2026-11-07", students: [pedro, bia, caio], defaultDueDay: 5, dueDayOverrides: new Map() };

function notice(overrides: Partial<FirstChargeFacts> = {}): FirstChargeNotice {
  const result = firstChargeNoticeFrom({ ...facts, ...overrides });
  if (result === null) throw new Error("sem aviso");
  return result;
}

describe("primeiro mês cobrado", () => {
  test("é sempre o mês seguinte ao da entrada, também na virada do ano", () => {
    expect(firstChargedMonth({ year: 2026, month: 11 })).toEqual({ year: 2026, month: 12 });
    expect(firstChargedMonth({ year: 2026, month: 12 })).toEqual({ year: 2027, month: 1 });
  });

  test("parte do dia em que o professor começou os primeiros passos", () => {
    const result = notice({ startedAt: "2026-10-20T15:00:00Z" });
    expect(result.entryMonth).toEqual({ year: 2026, month: 10 });
    expect(result.firstMonth).toEqual({ year: 2026, month: 11 });
  });

  test("sem data de entrada guardada, a entrada é hoje", () => {
    expect(notice({ startedAt: null }).firstMonth).toEqual({ year: 2026, month: 12 });
  });

  test("avisa o mês em palavras", () => {
    expect(describeFirstMonth(notice())).toBe("O primeiro mês cobrado pelo Quitô é dezembro de 2026, o mês seguinte ao da sua entrada, em novembro.");
    expect(describeFirstChargeTiming(notice())).toBe("A cobrança de dezembro sai em janeiro de 2027, no dia de vencimento de cada responsável:");
  });

  test("some depois que o mês da primeira cobrança acaba", () => {
    expect(firstChargeNoticeFrom({ ...facts, today: "2027-01-31" })).not.toBeNull();
    expect(firstChargeNoticeFrom({ ...facts, today: "2027-02-01" })).toBeNull();
  });
});

describe("dia da primeira cobrança de cada responsável", () => {
  test("agrupa os irmãos no mesmo responsável e usa o dia de vencimento padrão no mês seguinte ao cobrado", () => {
    expect(notice().guardians).toEqual([
      { phone: "11987654321", guardianName: "Ana Lima", studentNames: ["Bia Lima", "Pedro Lima"], dueDate: "2027-01-05" },
      { phone: "11912345678", guardianName: "Rita Souza", studentNames: ["Caio Souza"], dueDate: "2027-01-05" },
    ]);
    expect(notice().missing).toBeNull();
  });

  test("usa o dia próprio do responsável quando o professor trocou", () => {
    const result = notice({ dueDayOverrides: new Map([["11912345678", 20]]) });
    expect(result.guardians.map((guardian) => guardian.dueDate)).toEqual(["2027-01-05", "2027-01-20"]);
  });

  test("em mês mais curto que o dia escolhido, cai no último dia do mês", () => {
    const result = notice({ startedAt: "2027-01-10T15:00:00Z", today: "2027-01-10", defaultDueDay: 31 });
    expect(result.guardians[0].dueDate).toBe("2027-03-31");
    const february = notice({ startedAt: "2026-12-10T15:00:00Z", today: "2026-12-10", defaultDueDay: 31 });
    expect(february.guardians[0].dueDate).toBe("2027-02-28");
  });

  test("descreve o responsável, os alunos e o dia", () => {
    expect(describeFirstChargeGuardian(notice().guardians[0])).toBe("Ana Lima (Bia Lima, Pedro Lima): primeira cobrança em 5 de janeiro.");
  });

  test("sem alunos, pede o cadastro; sem dia de vencimento, pede o recebimento", () => {
    const withoutStudents = notice({ students: [] });
    expect(withoutStudents.missing).toBe("students");
    expect(withoutStudents.guardians).toEqual([]);
    const withoutPayment = notice({ defaultDueDay: null });
    expect(withoutPayment.missing).toBe("payment");
    expect(withoutPayment.guardians).toEqual([]);
    expect(firstChargeMissingMessage("students")).toBe(firstChargeMessages.missingStudents);
    expect(firstChargeMissingMessage("payment")).toBe(firstChargeMessages.missingPayment);
    expect(firstChargeMissingPaths).toEqual({ students: "/students", payment: "/payment" });
  });
});

function fakeClient(overrides: { students?: () => Promise<{ data: Student[] | null; error: Failure }>; payment?: () => Promise<{ data: { due_day: number } | null; error: Failure }>; dueDays?: () => Promise<{ data: { guardian_phone: string; due_day: number }[] | null; error: Failure }> } = {}) {
  const students = vi.fn(overrides.students ?? (async () => ({ data: [pedro], error: null })));
  const payment = vi.fn(overrides.payment ?? (async () => ({ data: { due_day: 10 }, error: null })));
  const dueDays = vi.fn(overrides.dueDays ?? (async () => ({ data: [], error: null })));
  const from = vi.fn((name: string) => {
    if (name === "students") return { select: students };
    if (name === "payment_settings") return { select: () => ({ maybeSingle: payment }) };
    return { select: dueDays };
  });
  return { from } as unknown as FirstChargeClient;
}

describe("loadFirstChargeNotice", () => {
  const now = new Date(2026, 10, 7, 12);

  test("junta alunos, recebimento e vencimento por responsável", async () => {
    const result = await loadFirstChargeNotice(fakeClient({ dueDays: async () => ({ data: [{ guardian_phone: "11987654321", due_day: 15 }], error: null }) }), "2026-11-07T15:00:00Z", now);
    expect(result?.guardians).toEqual([{ phone: "11987654321", guardianName: "Ana Lima", studentNames: ["Pedro Lima"], dueDate: "2027-01-15" }]);
  });

  test("sem recebimento guardado, pede o dia de vencimento", async () => {
    const result = await loadFirstChargeNotice(fakeClient({ payment: async () => ({ data: null, error: null }) }), null, now);
    expect(result?.missing).toBe("payment");
  });

  test("quando algo não abre, não mostra o aviso", async () => {
    const denied = async () => ({ data: null, error: { message: "negado" } });
    expect(await loadFirstChargeNotice(fakeClient({ students: denied }), null, now)).toBeNull();
    expect(await loadFirstChargeNotice(fakeClient({ payment: denied }), null, now)).toBeNull();
    expect(await loadFirstChargeNotice(fakeClient({ dueDays: denied }), null, now)).toBeNull();
  });

  test("usa a data de hoje quando nenhuma é passada", async () => {
    expect(await loadFirstChargeNotice(fakeClient(), null)).not.toBeNull();
  });
});
