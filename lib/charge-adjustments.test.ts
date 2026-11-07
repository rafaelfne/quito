import { describe, expect, test } from "vitest";
import { describeAdjustment, pendingAdjustments, settleAdjustments, type ChargedMonth, type PendingAdjustment } from "@/lib/charge-adjustments";
import type { ChargeBasis, FrozenMark } from "@/lib/closing";
import type { LessonMark, LessonStatus } from "@/lib/lessons";

const november = { year: 2026, month: 11 };

function frozen(lesson_date: string, status: LessonStatus, makeup_date: string | null = null): FrozenMark {
  return { lesson_date, status, makeup_date };
}

function mark(studentId: string, lesson_date: string, status: LessonStatus, makeup_date: string | null = null): LessonMark {
  return { student_id: studentId, lesson_date, status, makeup_date };
}

function perClass(marks: FrozenMark[], overrides: Partial<ChargeBasis> = {}): ChargeBasis {
  return { billingKind: "per_class", amountCents: 8000, packageLessons: null, discountPercent: 0, monthCents: 8000 * marks.filter((item) => item.status === "given" || item.status === "unnotified_absence").length, marks, ...overrides };
}

function charged(charge_month: string, studentId: string, basis: ChargeBasis | null, settled: ChargedMonth["account"][number]["settled"] = []): ChargedMonth {
  return { charge_month, account: [{ studentId, basis, settled }] };
}

function pending(cents: number, label = "Acerto de novembro: x"): PendingAdjustment {
  return { studentId: "a", month: "2026-11-01", cents, label };
}

const twoGiven = [frozen("2026-11-02", "given"), frozen("2026-11-09", "given")];

describe("texto do acerto", () => {
  test.each([
    ["unnotified_absence", "notified_absence", "1 falta remarcada como avisada"],
    ["unnotified_absence", "teacher_absence", "1 falta remarcada como do professor"],
    ["notified_absence", "given", "1 falta remarcada como dada"],
    ["teacher_absence", "unnotified_absence", "1 falta remarcada como sem aviso"],
    ["given", "notified_absence", "1 aula remarcada como falta avisada"],
    ["given", "teacher_absence", "1 aula remarcada como falta do professor"],
  ] as [LessonStatus, LessonStatus, string][])("de %s para %s", (from, to, text) => {
    expect(describeAdjustment([frozen("2026-11-02", from)], [frozen("2026-11-02", to)], november)).toBe(`Acerto de novembro: ${text}`);
  });

  test("junta as aulas iguais e usa o plural", () => {
    const before = [frozen("2026-11-02", "unnotified_absence"), frozen("2026-11-09", "unnotified_absence")];
    const after = [frozen("2026-11-02", "notified_absence"), frozen("2026-11-09", "notified_absence")];
    expect(describeAdjustment(before, after, november)).toBe("Acerto de novembro: 2 faltas remarcadas como avisadas");
  });

  test("usa o plural quando as aulas viram falta", () => {
    const after = [frozen("2026-11-02", "notified_absence"), frozen("2026-11-09", "notified_absence")];
    expect(describeAdjustment(twoGiven, after, november)).toBe("Acerto de novembro: 2 aulas remarcadas como falta avisada");
  });

  test("aula marcada só depois da cobrança", () => {
    expect(describeAdjustment([], [frozen("2026-11-02", "given")], november)).toBe("Acerto de novembro: 1 aula marcada como dada");
    expect(describeAdjustment([], [frozen("2026-11-02", "unnotified_absence"), frozen("2026-11-09", "unnotified_absence")], november)).toBe("Acerto de novembro: 2 aulas marcadas como falta sem aviso");
  });

  test("reposição incluída e retirada", () => {
    const absence = frozen("2026-11-02", "notified_absence");
    expect(describeAdjustment([absence], [{ ...absence, makeup_date: "2026-11-20" }], november)).toBe("Acerto de novembro: 1 reposição incluída");
    expect(describeAdjustment([{ ...absence, makeup_date: "2026-11-20" }], [absence], november)).toBe("Acerto de novembro: 1 reposição retirada");
  });

  test("troca que não muda o valor não entra no texto", () => {
    expect(describeAdjustment([frozen("2026-11-02", "given")], [frozen("2026-11-02", "unnotified_absence")], november)).toBe("Acerto de novembro: correção nas aulas");
  });

  test("aula de outro mês não entra no texto", () => {
    expect(describeAdjustment([], [frozen("2026-10-26", "given")], november)).toBe("Acerto de novembro: correção nas aulas");
  });
});

describe("acertos pendentes", () => {
  test("aula corrigida gera a diferença", () => {
    const result = pendingAdjustments([charged("2026-11-01", "a", perClass(twoGiven))], [mark("a", "2026-11-02", "notified_absence"), mark("a", "2026-11-09", "given")]);
    expect(result.get("a")).toEqual([{ studentId: "a", month: "2026-11-01", cents: -8000, label: "Acerto de novembro: 1 aula remarcada como falta avisada" }]);
  });

  test("marcação igual à da cobrança não gera nada", () => {
    expect(pendingAdjustments([charged("2026-11-01", "a", perClass(twoGiven))], [mark("a", "2026-11-02", "given"), mark("a", "2026-11-09", "given")]).size).toBe(0);
  });

  test("troca entre aula dada e falta sem aviso não muda o valor", () => {
    expect(pendingAdjustments([charged("2026-11-01", "a", perClass(twoGiven))], [mark("a", "2026-11-02", "unnotified_absence"), mark("a", "2026-11-09", "given")]).size).toBe(0);
  });

  test("aula que ficou sem marcar não é correção", () => {
    expect(pendingAdjustments([charged("2026-11-01", "a", perClass(twoGiven))], [mark("a", "2026-11-09", "given")]).size).toBe(0);
  });

  test("reposição incluída no mês cobrado soma", () => {
    const basis = perClass([frozen("2026-11-02", "notified_absence"), frozen("2026-11-09", "given")]);
    const result = pendingAdjustments([charged("2026-11-01", "a", basis)], [mark("a", "2026-11-02", "notified_absence", "2026-11-20"), mark("a", "2026-11-09", "given")]);
    expect(result.get("a")?.[0]).toMatchObject({ cents: 8000, label: "Acerto de novembro: 1 reposição incluída" });
  });

  test("reposição marcada para o mês seguinte não mexe no mês cobrado", () => {
    const basis = perClass([frozen("2026-11-02", "notified_absence"), frozen("2026-11-09", "given")]);
    expect(pendingAdjustments([charged("2026-11-01", "a", basis)], [mark("a", "2026-11-02", "notified_absence", "2026-12-07"), mark("a", "2026-11-09", "given")]).size).toBe(0);
  });

  test("usa o preço e o desconto guardados na cobrança", () => {
    const basis = perClass(twoGiven, { amountCents: 10000, discountPercent: 10, monthCents: 18000 });
    const result = pendingAdjustments([charged("2026-11-01", "a", basis)], [mark("a", "2026-11-02", "notified_absence"), mark("a", "2026-11-09", "given")]);
    expect(result.get("a")?.[0].cents).toBe(-9000);
  });

  test("mensalidade nunca gera acerto", () => {
    const basis = perClass(twoGiven, { billingKind: "monthly", monthCents: 30000 });
    expect(pendingAdjustments([charged("2026-11-01", "a", basis)], [mark("a", "2026-11-02", "notified_absence"), mark("a", "2026-11-09", "given")]).size).toBe(0);
  });

  test("pacote só muda quando muda a quantidade de pacotes", () => {
    const marks = [frozen("2026-11-02", "given"), frozen("2026-11-09", "given"), frozen("2026-11-16", "given")];
    const basis = perClass(marks, { billingKind: "package", amountCents: 20000, packageLessons: 2, monthCents: 40000 });
    const oneLess = [mark("a", "2026-11-02", "notified_absence"), mark("a", "2026-11-09", "given"), mark("a", "2026-11-16", "given")];
    expect(pendingAdjustments([charged("2026-11-01", "a", basis)], oneLess).get("a")?.[0]).toMatchObject({ cents: -20000, label: "Acerto de novembro: 1 aula remarcada como falta avisada" });
    const sameBasis = perClass(marks, { billingKind: "package", amountCents: 20000, packageLessons: 4, monthCents: 20000 });
    expect(pendingAdjustments([charged("2026-11-01", "a", sameBasis)], oneLess).size).toBe(0);
  });

  test("correção em outubro muda o pacote de novembro, e cada mês fica com a própria conta", () => {
    const octoberMarks = [frozen("2026-10-05", "given"), frozen("2026-10-12", "given")];
    const novemberMarks = [frozen("2026-11-02", "given")];
    const october = charged("2026-10-01", "a", perClass(octoberMarks, { billingKind: "package", amountCents: 20000, packageLessons: 2, monthCents: 20000 }));
    const novemberCharge = charged("2026-11-01", "a", perClass(novemberMarks, { billingKind: "package", amountCents: 20000, packageLessons: 2, monthCents: 20000 }));
    const result = pendingAdjustments([novemberCharge, october], [mark("a", "2026-10-05", "notified_absence"), mark("a", "2026-10-12", "given"), mark("a", "2026-11-02", "given")]);
    expect(result.get("a")).toEqual([{ studentId: "a", month: "2026-11-01", cents: -20000, label: "Acerto de novembro: correção nas aulas" }]);
  });

  test("acerto já lançado não volta, e desfazer a correção devolve a diferença", () => {
    const earlier = charged("2026-11-01", "a", perClass(twoGiven));
    const settledIn = { charge_month: "2026-12-01", account: [{ studentId: "a", settled: [{ month: "2026-11-01", cents: -8000 }] }] };
    const corrected = [mark("a", "2026-11-02", "notified_absence"), mark("a", "2026-11-09", "given")];
    expect(pendingAdjustments([earlier, settledIn], corrected).size).toBe(0);
    expect(pendingAdjustments([earlier, settledIn], [mark("a", "2026-11-02", "given"), mark("a", "2026-11-09", "given")]).get("a")).toEqual([{ studentId: "a", month: "2026-11-01", cents: 8000, label: "Acerto de novembro: correção nas aulas" }]);
  });

  test("resto de acerto lançado em parte continua pendente", () => {
    const earlier = charged("2026-11-01", "a", perClass(twoGiven));
    const settledIn = { charge_month: "2026-12-01", account: [{ studentId: "a", settled: [{ month: "2026-11-01", cents: -3000 }] }] };
    const result = pendingAdjustments([earlier, settledIn], [mark("a", "2026-11-02", "notified_absence"), mark("a", "2026-11-09", "given")]);
    expect(result.get("a")?.[0].cents).toBe(-5000);
  });

  test("cobrança antiga sem a base guardada não gera acerto", () => {
    expect(pendingAdjustments([charged("2026-11-01", "a", null), { charge_month: "2026-11-01", account: [{ studentId: "b" }] }], [mark("a", "2026-11-02", "given")]).size).toBe(0);
  });
});

describe("acertos dentro da cobrança", () => {
  test("acerto a mais entra inteiro", () => {
    expect(settleAdjustments(0, [pending(8000)])).toEqual([pending(8000)]);
  });

  test("acerto a menos cabe no valor do mês", () => {
    expect(settleAdjustments(8000, [pending(-8000)])).toEqual([pending(-8000)]);
  });

  test("acerto a menos maior que o mês entra em parte e avisa do restante", () => {
    expect(settleAdjustments(3000, [pending(-8000)])).toEqual([{ ...pending(-3000), label: "Acerto de novembro: x (o restante fica para o próximo mês)" }]);
  });

  test("sem valor no mês, o acerto a menos espera", () => {
    expect(settleAdjustments(0, [pending(-8000)])).toEqual([]);
  });

  test("acerto a mais abre espaço para o acerto a menos", () => {
    expect(settleAdjustments(0, [pending(-5000), pending(8000)])).toEqual([pending(-5000), pending(8000)]);
  });
});
