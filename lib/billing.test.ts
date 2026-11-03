import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  billingAmountLimitCents,
  billingDraftFrom,
  billingKinds,
  billingMessages,
  describeBilling,
  emptyBillingDraft,
  formatAmount,
  formatCurrency,
  isBillingKind,
  packageLessonsLimit,
  parseAmount,
  validateBilling,
} from "./billing";

describe("parseAmount", () => {
  test.each([
    ["150", 15000],
    ["150,5", 15050],
    ["150,50", 15050],
    ["150.50", 15050],
    ["1.500", 150000],
    ["1.500,00", 150000],
    ["1.234.567,89", 123456789],
    ["R$ 80,00", 8000],
    ["r$80", 8000],
    ["  90 ", 9000],
    ["0,07", 7],
    ["0", 0],
  ])("entende %s", (raw, cents) => {
    expect(parseAmount(raw)).toBe(cents);
  });

  test.each([[""], ["abc"], ["1,500"], ["12,345"], ["-50"], ["1.50.00"], ["50 reais"], ["1.5000"]])("recusa %s", (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});

describe("formatação do valor", () => {
  test("mostra o valor do jeito que se lê no Brasil", () => {
    expect(formatAmount(150000)).toBe("1.500,00");
    expect(formatCurrency(8050)).toBe("R$ 80,50");
  });

  test("o valor mostrado volta a ser entendido igual", () => {
    expect(parseAmount(formatAmount(123456))).toBe(123456);
    expect(parseAmount(formatCurrency(billingAmountLimitCents))).toBe(billingAmountLimitCents);
  });
});

describe("isBillingKind", () => {
  test("só reconhece as três formas de cobrança", () => {
    expect(billingKinds.every(isBillingKind)).toBe(true);
    expect(isBillingKind("")).toBe(false);
    expect(isBillingKind("yearly")).toBe(false);
  });
});

describe("validateBilling", () => {
  test("sem forma escolhida, pede só a forma", () => {
    expect(validateBilling(emptyBillingDraft)).toEqual({ ok: false, errors: { billingKind: billingMessages.kindMissing } });
  });

  test("mensalidade e valor por aula guardam só o valor, mesmo com aulas digitadas antes de trocar a forma", () => {
    expect(validateBilling({ billingKind: "monthly", billingAmount: "300,00", packageLessons: "4" })).toEqual({
      ok: true,
      row: { billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null },
    });
    expect(validateBilling({ billingKind: "per_class", billingAmount: "80", packageLessons: "" })).toEqual({
      ok: true,
      row: { billing_kind: "per_class", billing_amount_cents: 8000, package_lessons: null },
    });
  });

  test("pacote guarda o valor e a quantidade de aulas", () => {
    expect(validateBilling({ billingKind: "package", billingAmount: "300", packageLessons: " 4 " })).toEqual({
      ok: true,
      row: { billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4 },
    });
  });

  test.each([[""], ["0"], ["101"], ["4 aulas"], ["1,5"]])("pacote recusa a quantidade %s", (packageLessons) => {
    expect(validateBilling({ billingKind: "package", billingAmount: "300", packageLessons })).toEqual({
      ok: false,
      errors: { packageLessons: billingMessages.lessonsInvalid },
    });
  });

  test("aceita pacote nos limites de aulas", () => {
    expect(validateBilling({ billingKind: "package", billingAmount: "300", packageLessons: "1" }).ok).toBe(true);
    expect(validateBilling({ billingKind: "package", billingAmount: "300", packageLessons: String(packageLessonsLimit) }).ok).toBe(true);
  });

  test.each([[""], ["0"], ["0,00"], ["abc"]])("recusa o valor %s", (billingAmount) => {
    expect(validateBilling({ billingKind: "monthly", billingAmount, packageLessons: "" })).toEqual({
      ok: false,
      errors: { billingAmount: billingMessages.amountInvalid },
    });
  });

  test("aceita o valor no limite e recusa o que passa dele", () => {
    expect(validateBilling({ billingKind: "monthly", billingAmount: formatAmount(billingAmountLimitCents), packageLessons: "" }).ok).toBe(true);
    expect(validateBilling({ billingKind: "monthly", billingAmount: formatAmount(billingAmountLimitCents + 1), packageLessons: "" })).toEqual({
      ok: false,
      errors: { billingAmount: billingMessages.amountTooHigh },
    });
  });

  test("no pacote, aponta valor e aulas ao mesmo tempo", () => {
    expect(validateBilling({ billingKind: "package", billingAmount: "", packageLessons: "" })).toEqual({
      ok: false,
      errors: { billingAmount: billingMessages.amountInvalid, packageLessons: billingMessages.lessonsInvalid },
    });
  });
});

describe("billingDraftFrom", () => {
  test("abre o que está guardado para corrigir", () => {
    expect(billingDraftFrom({ billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4 })).toEqual({
      billingKind: "package",
      billingAmount: "300,00",
      packageLessons: "4",
    });
  });

  test("aluno antigo, sem forma definida, abre em branco", () => {
    expect(billingDraftFrom({ billing_kind: null, billing_amount_cents: null, package_lessons: null })).toEqual(emptyBillingDraft);
  });
});

describe("describeBilling", () => {
  test.each([
    [{ billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null }, "Mensalidade de R$ 300,00"],
    [{ billing_kind: "per_class", billing_amount_cents: 8000, package_lessons: null }, "R$ 80,00 por aula"],
    [{ billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4 }, "Pacote de 4 aulas por R$ 300,00"],
    [{ billing_kind: "package", billing_amount_cents: 8000, package_lessons: 1 }, "Pacote de 1 aula por R$ 80,00"],
    [{ billing_kind: null, billing_amount_cents: null, package_lessons: null }, "Forma de cobrança ainda não definida"],
  ] as const)("descreve %j", (billing, text) => {
    expect(describeBilling(billing)).toBe(text);
  });
});

describe("regra do banco", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261103010000_student_billing.sql"), "utf8");

  test("aceita as mesmas formas e os mesmos limites da tela", () => {
    for (const kind of billingKinds) expect(migration).toContain(`'${kind}'`);
    expect(migration).toContain(`"billing_amount_cents" between 1 and ${billingAmountLimitCents}`);
    expect(migration).toContain(`"package_lessons" between 1 and ${packageLessonsLimit}`);
  });

  test("não deixa a cobrança pela metade, nem em aluno antigo", () => {
    expect(migration).toContain(`("billing_kind" is null) = ("billing_amount_cents" is null)`);
    expect(migration).toContain(`("package_lessons" is not null) = ("billing_kind" is not distinct from 'package')`);
  });
});
