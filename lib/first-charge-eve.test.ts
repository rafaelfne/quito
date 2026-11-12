import { describe, expect, test } from "vitest";
import { describeFirstChargeEve, firstChargeEveOf, nextDay } from "@/lib/first-charge-eve";
import type { FirstChargeNotice } from "@/lib/first-charge";

function guardian(phone: string, dueDate: string) {
  return { phone, guardianName: "Ana Lima", studentNames: ["Pedro Lima"], dueDate };
}

function notice(overrides: Partial<FirstChargeNotice> = {}): FirstChargeNotice {
  return { firstMonth: { year: 2026, month: 11 }, entryMonth: { year: 2026, month: 10 }, guardians: [guardian("1", "2026-12-10"), guardian("2", "2026-12-05"), guardian("3", "2026-12-05")], missing: null, ...overrides };
}

describe("dia seguinte", () => {
  test("vira o mês e o ano", () => {
    expect(nextDay("2026-12-04")).toBe("2026-12-05");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2027-02-28")).toBe("2027-03-01");
  });
});

describe("véspera da primeira cobrança", () => {
  test("é o dia anterior ao primeiro vencimento do primeiro mês cobrado e conta os responsáveis daquele dia", () => {
    expect(firstChargeEveOf(notice(), "2026-12-04")).toEqual({ dueDate: "2026-12-05", charges: 2 });
  });

  test("a véspera de um vencimento mais tarde não conta, porque a primeira cobrança já passou", () => {
    expect(firstChargeEveOf(notice(), "2026-12-09")).toBeNull();
  });

  test("outros dias não são véspera", () => {
    expect(firstChargeEveOf(notice(), "2026-12-03")).toBeNull();
    expect(firstChargeEveOf(notice(), "2026-12-05")).toBeNull();
  });

  test("sem alunos, sem dia de vencimento ou fora do prazo, não há véspera", () => {
    expect(firstChargeEveOf(null, "2026-12-04")).toBeNull();
    expect(firstChargeEveOf(notice({ missing: "payment", guardians: [] }), "2026-12-04")).toBeNull();
    expect(firstChargeEveOf(notice({ guardians: [] }), "2026-12-04")).toBeNull();
  });

  test("o texto lembra o dia seguinte e confirma que a notificação chega, sem nome nem valor", () => {
    expect(describeFirstChargeEve({ dueDate: "2026-12-05", charges: 2 })).toBe("Amanhã é o dia da sua primeira cobrança: 2 cobranças para enviar. As notificações deste celular estão funcionando.");
    expect(describeFirstChargeEve({ dueDate: "2026-12-05", charges: 1 })).toBe("Amanhã é o dia da sua primeira cobrança: 1 cobrança para enviar. As notificações deste celular estão funcionando.");
  });
});
