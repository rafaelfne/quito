import { describe, expect, test, vi } from "vitest";
import {
  applyClosingLoad,
  buildMonthClosing,
  chargedLessonsBefore,
  closingPath,
  describeAttendance,
  describeMissingBillingWarning,
  describeSignedAmount,
  describeUnmarked,
  describeValueWarning,
  initialClosing,
  loadClosingMonth,
  loadEnrollments,
  loadMarksThrough,
  packageUsage,
  startClosingMonth,
  startReloadingClosing,
  type ClosingData,
  type ClosingRules,
} from "@/lib/closing";
import type { LessonMark, LessonStatus, LessonsClient } from "@/lib/lessons";
import type { Student } from "@/lib/students";

const november = { year: 2026, month: 11 };
const today = "2026-11-30";

const rules: ClosingRules = { makeup_deadline_days: null, five_week_policy: "same_price", five_week_extra_cents: null, sibling_discount_percent: 0 };

const monthly: Student = { id: "m", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const perClass: Student = { ...monthly, id: "c", name: "Lia Melo", guardian_name: "Caio Melo", guardian_phone: "11911112222", billing_kind: "per_class", billing_amount_cents: 8000 };
const packaged: Student = { ...monthly, id: "p", name: "Rui Dias", guardian_name: "Bia Dias", guardian_phone: "11933334444", billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4 };

function mark(studentId: string, date: string, status: LessonStatus, makeupDate: string | null = null): LessonMark {
  return { student_id: studentId, lesson_date: date, status, makeup_date: makeupDate };
}

function data(overrides: Partial<ClosingData> = {}): ClosingData {
  return { students: [monthly], enrollments: [], marks: [], rules, ...overrides };
}

function close(overrides: Partial<ClosingData> = {}, month = november, on = today) {
  return buildMonthClosing(data(overrides), month, on);
}

function only(overrides: Partial<ClosingData> = {}, month = november, on = today) {
  return close(overrides, month, on).guardians[0].students[0];
}

describe("mensalidade fixa", () => {
  test("cobra o valor fixo, com falta avisada ou sem marcação", () => {
    const student = only({ marks: [mark("m", "2026-11-02", "notified_absence")] });
    expect(student.lines).toEqual([{ label: "Mensalidade", cents: 30000 }]);
    expect(student.totalCents).toBe(30000);
    expect(student.dependsOnMarks).toBe(false);
    expect(student.unmarked).toBe(4);
  });

  test("mês com 5 semanas custa igual quando a regra é essa", () => {
    expect(only().lines).toHaveLength(1);
    expect(only().totalCents).toBe(30000);
  });

  test("mês com 5 semanas soma uma aula avulsa quando a regra manda", () => {
    const addLesson: ClosingRules = { ...rules, five_week_policy: "add_lesson", five_week_extra_cents: 8000 };
    const student = only({ rules: addLesson });
    expect(student.lines[1]).toEqual({ label: "Mês com 5 semanas: uma aula avulsa a mais", cents: 8000 });
    expect(student.totalCents).toBe(38000);
  });

  test("mês com 4 semanas não soma a aula avulsa", () => {
    const addLesson: ClosingRules = { ...rules, five_week_policy: "add_lesson", five_week_extra_cents: 8000 };
    const thursday = { ...monthly, lesson_weekday: 4 };
    expect(only({ students: [thursday], rules: addLesson }).totalCents).toBe(30000);
  });

  test("regra de somar sem valor guardado não muda a conta", () => {
    expect(only({ rules: { ...rules, five_week_policy: "add_lesson" } }).totalCents).toBe(30000);
  });

  test("a reposição não soma na mensalidade", () => {
    expect(only({ marks: [mark("m", "2026-11-02", "notified_absence", "2026-11-05")] }).totalCents).toBe(30000);
  });
});

describe("valor por aula", () => {
  test("cobra aula dada, falta sem aviso e reposição, e não cobra as outras faltas", () => {
    const student = only({
      students: [perClass],
      marks: [mark("c", "2026-11-02", "given"), mark("c", "2026-11-09", "unnotified_absence"), mark("c", "2026-11-16", "notified_absence", "2026-11-20"), mark("c", "2026-11-23", "teacher_absence")],
    });
    expect(student.lines).toEqual([
      { label: "1 aula dada × R$ 80,00", cents: 8000 },
      { label: "1 falta sem aviso × R$ 80,00", cents: 8000 },
      { label: "1 reposição × R$ 80,00", cents: 8000 },
    ]);
    expect(student.totalCents).toBe(24000);
    expect(student.dependsOnMarks).toBe(true);
  });

  test("sem aula cobrada, o valor é zero e a conta diz isso", () => {
    expect(only({ students: [perClass] }).lines).toEqual([{ label: "Nenhuma aula cobrada neste mês", cents: 0 }]);
  });

  test("a reposição é cobrada no mês em que acontece", () => {
    const marks = [mark("c", "2026-10-26", "notified_absence", "2026-11-03")];
    expect(only({ students: [perClass], marks }, { year: 2026, month: 10 }).totalCents).toBe(0);
    expect(only({ students: [perClass], marks }).totalCents).toBe(8000);
  });
});

describe("pacote", () => {
  function lessons(count: number, month = "11"): LessonMark[] {
    return Array.from({ length: count }, (_, index) => mark("p", `2026-${month}-${String(index + 1).padStart(2, "0")}`, "given"));
  }

  test("cobra o pacote quando as aulas começam e passa a sobra para o mês seguinte", () => {
    const student = only({ students: [packaged], marks: lessons(1) });
    expect(student.lines).toEqual([{ label: "1 pacote de 4 aulas × R$ 300,00", cents: 30000 }]);
    expect(student.packageBalance).toBe("Saldo do mês anterior: 0 aulas. Usadas neste mês: 1. Passam para o mês seguinte: 3.");
  });

  test("a sobra de antes paga o mês, sem pacote novo", () => {
    const student = only({ students: [packaged], marks: [...lessons(1, "10"), ...lessons(3)] });
    expect(student.lines).toEqual([{ label: "Nenhum pacote novo neste mês", cents: 0 }]);
    expect(student.totalCents).toBe(0);
    expect(student.packageBalance).toBe("Saldo do mês anterior: 3 aulas. Usadas neste mês: 3. Passam para o mês seguinte: 0.");
  });

  test("mês com mais aulas que o pacote cobra quantos pacotes precisar", () => {
    const student = only({ students: [packaged], marks: lessons(5) });
    expect(student.lines[0]).toEqual({ label: "2 pacotes de 4 aulas × R$ 300,00", cents: 60000 });
    expect(student.totalCents).toBe(60000);
  });

  test("pacote sem número de aulas fica como cobrança por definir", () => {
    expect(only({ students: [{ ...packaged, package_lessons: null }] }).missingBilling).toBe(true);
  });

  test("uso conta aula dada, falta sem aviso e reposição até o limite", () => {
    const marks = [mark("p", "2026-10-01", "given"), mark("p", "2026-10-02", "unnotified_absence"), mark("p", "2026-10-03", "notified_absence", "2026-11-03"), mark("p", "2026-10-04", "teacher_absence"), mark("x", "2026-10-05", "given")];
    expect(chargedLessonsBefore(marks, "p", "2026-11-01")).toBe(2);
    expect(chargedLessonsBefore(marks, "p", "2026-12-01")).toBe(3);
    expect(packageUsage(marks, "p", 2, november)).toEqual({ bought: 1, carriedIn: 0, used: 1, carriedOut: 1 });
  });
});

describe("desconto e agrupamento", () => {
  const sibling: Student = { ...monthly, id: "s", name: "Bruno Lima", billing_amount_cents: 20000 };
  const discount: ClosingRules = { ...rules, sibling_discount_percent: 10 };

  test("irmãos ficam juntos, com desconto em cada aluno e total do responsável", () => {
    const [guardian] = close({ students: [monthly, sibling], rules: discount }).guardians;
    expect(guardian.guardianName).toBe("Ana Lima");
    expect(guardian.students.map((student) => student.studentName)).toEqual(["Bruno Lima", "Pedro Lima"]);
    expect(guardian.students[0].lines[1]).toEqual({ label: "Desconto de 10% para irmãos", cents: -2000 });
    expect(guardian.totalCents).toBe(45000);
  });

  test("aluno sozinho não recebe desconto", () => {
    expect(only({ rules: discount }).totalCents).toBe(30000);
  });

  test("o desconto incide também sobre a aula somada do mês com 5 semanas", () => {
    const addLesson: ClosingRules = { ...discount, five_week_policy: "add_lesson", five_week_extra_cents: 10000 };
    const [guardian] = close({ students: [monthly, sibling], rules: addLesson }).guardians;
    expect(guardian.students[1].totalCents).toBe(36000);
  });

  test("desconto sobre valor zero não aparece na conta", () => {
    const cheap = { ...perClass, guardian_phone: monthly.guardian_phone };
    const [guardian] = close({ students: [monthly, cheap], rules: discount }).guardians;
    expect(guardian.students[0].lines).toEqual([{ label: "Nenhuma aula cobrada neste mês", cents: 0 }]);
  });

  test("responsáveis saem em ordem de nome e o mês soma todos", () => {
    const closing = close({ students: [perClass, monthly, packaged], marks: [mark("c", "2026-11-02", "given")] });
    expect(closing.guardians.map((guardian) => guardian.guardianName)).toEqual(["Ana Lima", "Bia Dias", "Caio Melo"]);
    expect(closing.totalCents).toBe(38000);
  });
});

describe("avisos", () => {
  test("aluno sem forma de cobrança fica fora do total e é contado", () => {
    const closing = close({ students: [{ ...monthly, billing_kind: null, billing_amount_cents: null }] });
    expect(closing.totalCents).toBe(0);
    expect(closing.missingBilling).toBe(1);
    expect(closing.guardians[0].students[0]).toMatchObject({ missingBilling: true, lines: [], dependsOnMarks: false });
  });

  test("só conta como aviso a aula sem marcar que muda valor", () => {
    expect(close().unmarkedAffectingValue).toBe(0);
    expect(close({ students: [perClass] }).unmarkedAffectingValue).toBe(5);
  });
});

describe("alunos do mês", () => {
  test("aluno cadastrado depois do mês não aparece nele", () => {
    const closing = close({ enrollments: [{ id: "m", created_at: "2026-11-10T12:00:00Z" }] }, { year: 2026, month: 10 }, "2026-11-30");
    expect(closing.guardians).toEqual([]);
  });

  test("aluno cadastrado no meio do mês aparece", () => {
    expect(close({ enrollments: [{ id: "m", created_at: "2026-11-10T12:00:00Z" }] }).guardians).toHaveLength(1);
  });

  test("aula marcada antes do cadastro mantém o aluno no mês", () => {
    const enrollments = [{ id: "m", created_at: "2026-11-10T12:00:00Z" }];
    const october = { year: 2026, month: 10 };
    expect(close({ enrollments, marks: [mark("m", "2026-10-05", "given")] }, october).guardians).toHaveLength(1);
    expect(close({ enrollments, marks: [mark("m", "2026-09-28", "notified_absence", "2026-10-02")] }, october).guardians).toHaveLength(1);
    expect(close({ enrollments, marks: [mark("x", "2026-10-05", "given"), mark("m", "2026-09-28", "given")] }, october).guardians).toEqual([]);
  });
});

describe("créditos de reposição", () => {
  const credit = mark("m", "2026-11-02", "notified_absence");

  test("crédito aberto aparece na conta com a origem", () => {
    expect(only({ marks: [credit] }).credits).toEqual(["Falta avisada de 2 de novembro, sem prazo"]);
  });

  test("crédito vencido some do fechamento", () => {
    const withDeadline = { ...rules, makeup_deadline_days: 5 };
    expect(only({ marks: [credit], rules: withDeadline }, november, "2026-11-07").credits).toEqual(["Falta avisada de 2 de novembro, vale até 7 de novembro"]);
    expect(only({ marks: [credit], rules: withDeadline }, november, "2026-11-08").credits).toEqual([]);
  });

  test("crédito usado no próprio mês não aparece, mesmo com a reposição à frente", () => {
    expect(only({ marks: [{ ...credit, makeup_date: "2026-11-20" }] }, november, "2026-11-03").credits).toEqual([]);
  });

  test("mês passado mostra o crédito como estava no fim dele", () => {
    const marks = [mark("m", "2026-10-26", "notified_absence", "2026-11-03")];
    expect(only({ marks }, { year: 2026, month: 10 }, "2026-11-30").credits).toEqual(["Falta avisada de 26 de outubro, sem prazo"]);
  });

  test("falta depois do fim do mês não entra como crédito dele", () => {
    expect(only({ marks: [credit] }, { year: 2026, month: 10 }, "2026-11-30").credits).toEqual([]);
  });

  test("mais de um crédito do mesmo aluno entram juntos", () => {
    expect(only({ marks: [credit, mark("m", "2026-11-09", "teacher_absence")] }).credits).toHaveLength(2);
  });
});

describe("textos", () => {
  const empty = { given: 0, notified_absence: 0, unnotified_absence: 0, teacher_absence: 0, makeups: 0, unmarked: 0 };

  test("resume as aulas, no singular e no plural", () => {
    expect(describeAttendance(empty)).toBe("Nenhuma aula marcada neste mês.");
    expect(describeAttendance({ ...empty, given: 1, unnotified_absence: 1, makeups: 1, notified_absence: 1, teacher_absence: 1 })).toBe("1 aula dada; 1 falta sem aviso, cobrada; 1 reposição; 1 falta avisada, sem cobrança; 1 falta do professor, sem cobrança.");
    expect(describeAttendance({ ...empty, given: 2, unnotified_absence: 2, makeups: 2, notified_absence: 2, teacher_absence: 2 })).toBe("2 aulas dadas; 2 faltas sem aviso, cobradas; 2 reposições; 2 faltas avisadas, sem cobrança; 2 faltas do professor, sem cobrança.");
  });

  test("avisos no singular e no plural", () => {
    expect(describeUnmarked(1)).toBe("1 aula ainda sem marcar.");
    expect(describeUnmarked(2)).toBe("2 aulas ainda sem marcar.");
    expect(describeValueWarning(1)).toContain("pode mudar");
    expect(describeValueWarning(2)).toContain("podem mudar");
    expect(describeMissingBillingWarning(1)).toContain("1 aluno está");
    expect(describeMissingBillingWarning(2)).toContain("2 alunos estão");
  });

  test("valor negativo sai com o sinal na frente", () => {
    expect(describeSignedAmount(-1000)).toBe("− R$ 10,00");
    expect(describeSignedAmount(1000)).toBe("R$ 10,00");
  });

  test("o endereço da tela é o do fechamento", () => {
    expect(closingPath).toBe("/closing");
  });
});

function pagedClient(pages: { data: unknown[] | null; error: { message: string } | null }[]) {
  const range = vi.fn(async () => pages.shift() ?? { data: [], error: null });
  const order = vi.fn(() => ({ order, range }));
  const lte = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ lte }));
  return { client: { from: vi.fn(() => ({ select })) } as unknown as LessonsClient, range, lte };
}

describe("buscar as marcações", () => {
  test("busca todas as páginas até a última vir incompleta", async () => {
    const full = Array.from({ length: 1000 }, () => mark("m", "2026-11-02", "given"));
    const { client, range, lte } = pagedClient([{ data: full, error: null }, { data: [mark("m", "2026-11-09", "given")], error: null }]);
    expect(await loadMarksThrough(client, "2026-11-30")).toHaveLength(1001);
    expect(lte).toHaveBeenCalledWith("lesson_date", "2026-11-30");
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  test("resposta vazia vira lista vazia", async () => {
    expect(await loadMarksThrough(pagedClient([{ data: null, error: null }]).client, "2026-11-30")).toEqual([]);
  });

  test("erro numa página cancela tudo, para não mostrar conta errada", async () => {
    const full = Array.from({ length: 1000 }, () => mark("m", "2026-11-02", "given"));
    expect(await loadMarksThrough(pagedClient([{ data: full, error: null }, { data: null, error: { message: "negado" } }]).client, "2026-11-30")).toBeNull();
  });

  test("queda de rede vira falha", async () => {
    const client = { from: () => { throw new Error("sem rede"); } } as unknown as LessonsClient;
    expect(await loadMarksThrough(client, "2026-11-30")).toBeNull();
    expect(await loadEnrollments(client)).toBeNull();
  });
});

describe("carregar o mês", () => {
  const enrollments = [{ id: "m", created_at: "2026-01-01T00:00:00Z" }];

  function fullClient(overrides: Record<string, unknown> = {}) {
    const marksChain = { order: () => marksChain, range: async () => ({ data: [mark("m", "2026-11-02", "given")], error: null }) };
    const tables: Record<string, unknown> = {
      students: { select: async (columns: string) => (columns === "id, created_at" ? { data: enrollments, error: null } : { data: [monthly], error: null }) },
      lesson_marks: { select: () => ({ lte: () => marksChain }) },
      teacher_rules: { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) },
      ...overrides,
    };
    return { from: (table: string) => tables[table] } as unknown as LessonsClient;
  }

  test("junta alunos, cadastros, marcações e regras", async () => {
    const result = await loadClosingMonth(fullClient(), november);
    expect(result).toMatchObject({ ok: true, month: november, students: [monthly], enrollments, rules: { sibling_discount_percent: 0 } });
  });

  test("falha em qualquer parte vira falha do mês", async () => {
    const refusedRules = { teacher_rules: { select: () => ({ maybeSingle: async () => ({ data: null, error: { message: "negado" } }) }) } };
    expect(await loadClosingMonth(fullClient(refusedRules), november)).toEqual({ ok: false, month: november });
  });

  test("cadastros: erro vira falha e vazio vira lista vazia", async () => {
    const answer = (data: unknown, error: unknown) => ({ from: () => ({ select: async () => ({ data, error }) }) }) as unknown as LessonsClient;
    expect(await loadEnrollments(answer(null, { message: "negado" }))).toBeNull();
    expect(await loadEnrollments(answer(null, null))).toEqual([]);
  });
});

describe("estado da tela", () => {
  const ready = { ok: true as const, month: november, ...data() };

  test("começa carregando", () => {
    expect(initialClosing(november)).toEqual({ month: november, status: "loading", data: null });
  });

  test("trocar de mês volta a carregar, inclusive virando o ano", () => {
    const loaded = applyClosingLoad(initialClosing(november), ready);
    expect(startClosingMonth(loaded, 2)).toEqual({ month: { year: 2027, month: 1 }, status: "loading", data: null });
  });

  test("tentar de novo mantém o mês", () => {
    expect(startReloadingClosing({ month: november, status: "failed", data: null })).toEqual({ month: november, status: "loading", data: null });
  });

  test("guarda o resultado do mês aberto", () => {
    expect(applyClosingLoad(initialClosing(november), ready)).toEqual({ month: november, status: "ready", data: data() });
  });

  test("ignora resposta de outro mês", () => {
    const state = initialClosing(november);
    expect(applyClosingLoad(state, { ...ready, month: { year: 2026, month: 10 } })).toBe(state);
    expect(applyClosingLoad(state, { ...ready, month: { year: 2025, month: 11 } })).toBe(state);
  });

  test("falha aparece na tela", () => {
    expect(applyClosingLoad(initialClosing(november), { ok: false, month: november }).status).toBe("failed");
  });
});
