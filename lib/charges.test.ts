import { describe, expect, test, vi } from "vitest";
import {
  applyChargesLoad,
  chargeMessages,
  chargesPath,
  describeMarkLessons,
  describeWaitingStudent,
  endedMonthOf,
  initialCharges,
  insertNewCharges,
  isGuardianReady,
  loadMonthCharges,
  monthChargesTotal,
  planMonthCharges,
  startReloadingCharges,
  syncMonthCharges,
  waitsForBilling,
  waitsForMarks,
  type Charge,
  type WaitingGuardian,
} from "@/lib/charges";
import { buildMonthClosing, type ClosingData, type ClosingRules } from "@/lib/closing";
import type { LessonMark, LessonsClient } from "@/lib/lessons";
import type { Student } from "@/lib/students";

const november = { year: 2026, month: 11 };
const today = "2026-12-01";
const rules: ClosingRules = { makeup_deadline_days: null, five_week_policy: "same_price", five_week_extra_cents: null, sibling_discount_percent: 10 };

const pedro: Student = { id: "pedro", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const bruno: Student = { ...pedro, id: "bruno", name: "Bruno Lima", billing_amount_cents: 20000 };
const lia: Student = { ...pedro, id: "lia", name: "Lia Melo", guardian_name: "Caio Melo", guardian_phone: "11911112222", billing_kind: "per_class", billing_amount_cents: 8000 };
const noBilling: Student = { ...pedro, id: "rui", name: "Rui Dias", guardian_name: "Bia Dias", guardian_phone: "11933334444", billing_kind: null, billing_amount_cents: null };

const mondaysOfNovember = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"];

function given(studentId: string, date: string): LessonMark {
  return { student_id: studentId, lesson_date: date, status: "given", makeup_date: null };
}

function notified(studentId: string, date: string): LessonMark {
  return { student_id: studentId, lesson_date: date, status: "notified_absence", makeup_date: null };
}

function closingData(overrides: Partial<ClosingData> = {}): ClosingData {
  return { students: [pedro], enrollments: [], marks: [], rules, ...overrides };
}

function closingOf(overrides: Partial<ClosingData> = {}) {
  return buildMonthClosing(closingData(overrides), november, today);
}

function saved(overrides: Partial<Charge> = {}): Charge {
  return {
    id: "c1",
    charge_month: "2026-11-01",
    guardian_phone: pedro.guardian_phone,
    guardian_name: pedro.guardian_name,
    total_cents: 30000,
    account: [{ studentId: pedro.id, studentName: pedro.name, lines: [{ label: "Mensalidade", cents: 30000 }], attendance: "", packageBalance: null, credits: [], totalCents: 30000 }],
    ...overrides,
  };
}

type FakeBank = { students: Student[]; marks: LessonMark[]; charges: Charge[]; failOn?: "select" | "insert"; failReload?: boolean };

function fakeClient(bank: FakeBank) {
  const upsert = vi.fn(async (...[rows]: [Omit<Charge, "id">[], unknown]) => {
    if (bank.failOn === "insert") return { error: { message: "fora do ar" } };
    bank.charges.push(...rows.map((row, index) => ({ ...row, id: `novo-${index}` })));
    return { error: null };
  });
  let chargeReads = 0;
  const marksChain = { order: () => marksChain, range: async () => ({ data: bank.marks, error: null }) };
  const from = vi.fn((table: string) => {
    if (table === "students") return { select: async (columns: string) => (columns === "id, created_at" ? { data: [], error: null } : { data: bank.students, error: null }) };
    if (table === "teacher_rules") return { select: () => ({ maybeSingle: async () => ({ data: rules, error: null }) }) };
    if (table === "lesson_marks") return { select: () => ({ lte: () => marksChain }) };
    return {
      upsert,
      select: () => ({
        eq: async () => {
          chargeReads += 1;
          if (bank.failOn === "select" || (bank.failReload && chargeReads > 1)) return { data: null, error: { message: "fora do ar" } };
          return { data: [...bank.charges], error: null };
        },
      }),
    };
  });
  return { client: { from } as unknown as LessonsClient, upsert };
}

describe("mês cobrado", () => {
  test("é sempre o mês que terminou", () => {
    expect(endedMonthOf(new Date(2026, 11, 1))).toEqual(november);
    expect(endedMonthOf(new Date(2026, 11, 31))).toEqual(november);
    expect(endedMonthOf(new Date(2027, 0, 1))).toEqual({ year: 2026, month: 12 });
  });

  test("o endereço da tela é o das cobranças", () => {
    expect(chargesPath).toBe("/charges");
  });
});

describe("responsável pronto para cobrar", () => {
  test("mensalidade fica pronta mesmo com aula sem marcar", () => {
    expect(isGuardianReady(closingOf().guardians[0])).toBe(true);
  });

  test("aula sem marcar de quem paga por aula segura a cobrança", () => {
    expect(isGuardianReady(closingOf({ students: [lia], marks: [given("lia", "2026-11-02")] }).guardians[0])).toBe(false);
  });

  test("aluno sem forma de cobrança segura a cobrança", () => {
    expect(isGuardianReady(closingOf({ students: [noBilling] }).guardians[0])).toBe(false);
  });
});

describe("plano das cobranças", () => {
  test("cria uma cobrança só para irmãos, com a conta de cada um e o desconto", () => {
    const { newCharges, waiting, nothingToCharge } = planMonthCharges(closingOf({ students: [pedro, bruno] }), november, []);
    expect(waiting).toEqual([]);
    expect(nothingToCharge).toEqual([]);
    expect(newCharges).toHaveLength(1);
    expect(newCharges[0]).toMatchObject({ charge_month: "2026-11-01", guardian_phone: pedro.guardian_phone, guardian_name: "Ana Lima", total_cents: 45000 });
    expect(newCharges[0].account.map((student) => student.studentName)).toEqual(["Bruno Lima", "Pedro Lima"]);
    expect(newCharges[0].account[1].lines).toEqual([
      { label: "Mensalidade", cents: 30000 },
      { label: "Desconto de 10% para irmãos", cents: -3000 },
    ]);
  });

  test("cada responsável tem a própria cobrança", () => {
    const marks = mondaysOfNovember.map((date) => given("lia", date));
    const { newCharges } = planMonthCharges(closingOf({ students: [pedro, lia], marks }), november, []);
    expect(newCharges.map((charge) => [charge.guardian_name, charge.total_cents])).toEqual([
      ["Ana Lima", 30000],
      ["Caio Melo", 40000],
    ]);
  });

  test("irmão com aula sem marcar segura a cobrança inteira do responsável", () => {
    const sister = { ...lia, guardian_name: pedro.guardian_name, guardian_phone: pedro.guardian_phone };
    const plan = planMonthCharges(closingOf({ students: [pedro, sister] }), november, []);
    expect(plan.newCharges).toEqual([]);
    expect(plan.waiting).toEqual([{ phone: pedro.guardian_phone, guardianName: "Ana Lima", students: [{ studentId: "lia", studentName: "Lia Melo", unmarked: 5, missingBilling: false }] }]);
  });

  test("diz quantas aulas faltam marcar em cada aluno", () => {
    const { waiting } = planMonthCharges(closingOf({ students: [lia], marks: mondaysOfNovember.slice(0, 3).map((date) => given("lia", date)) }), november, []);
    expect(waiting[0].students).toEqual([{ studentId: "lia", studentName: "Lia Melo", unmarked: 2, missingBilling: false }]);
  });

  test("mensalidade com aula sem marcar não aparece no que falta", () => {
    const sister = { ...lia, guardian_name: pedro.guardian_name, guardian_phone: pedro.guardian_phone };
    const { waiting } = planMonthCharges(closingOf({ students: [pedro, sister] }), november, []);
    expect(waiting[0].students.map((student) => student.studentId)).toEqual(["lia"]);
  });

  test("aluno sem forma de cobrança pede a forma de cobrança, não as aulas", () => {
    const { waiting } = planMonthCharges(closingOf({ students: [noBilling] }), november, []);
    expect(waiting[0].students).toEqual([{ studentId: "rui", studentName: "Rui Dias", unmarked: 0, missingBilling: true }]);
  });

  test("responsável com os dois problemas mostra os dois alunos", () => {
    const sister = { ...lia, guardian_name: noBilling.guardian_name, guardian_phone: noBilling.guardian_phone };
    const { waiting } = planMonthCharges(closingOf({ students: [noBilling, sister] }), november, []);
    expect(waitsForMarks(waiting)).toBe(true);
    expect(waitsForBilling(waiting)).toBe(true);
    expect(waiting).toHaveLength(1);
  });

  test("responsável sem nada a pagar não vira cobrança de zero reais", () => {
    const marks = mondaysOfNovember.map((date) => notified("lia", date));
    const plan = planMonthCharges(closingOf({ students: [lia], marks }), november, []);
    expect(plan.newCharges).toEqual([]);
    expect(plan.nothingToCharge).toEqual(["Caio Melo"]);
  });

  test("não cria de novo a cobrança que já existe", () => {
    const plan = planMonthCharges(closingOf(), november, [saved()]);
    expect(plan).toEqual({ newCharges: [], waiting: [], nothingToCharge: [] });
  });

  test("telefone corrigido depois da cobrança não cria uma segunda cobrança para o mesmo aluno", () => {
    const newPhone = { ...pedro, guardian_phone: "11955556666" };
    expect(planMonthCharges(closingOf({ students: [newPhone] }), november, [saved()]).newCharges).toEqual([]);
  });

  test("a conta guardada não leva o que só serve para o fechamento", () => {
    const [charge] = planMonthCharges(closingOf(), november, []).newCharges;
    expect(Object.keys(charge.account[0]).sort()).toEqual(["attendance", "credits", "lines", "packageBalance", "studentId", "studentName", "totalCents"]);
  });
});

describe("sincronizar as cobranças do mês", () => {
  test("cria a cobrança pronta e devolve a lista guardada", async () => {
    const { client, upsert } = fakeClient({ students: [pedro], marks: [], charges: [] });
    const result = await syncMonthCharges(client, november, today);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "owner_id,charge_month,guardian_phone", ignoreDuplicates: true });
    expect(result).toMatchObject({ ok: true, month: november, waiting: [], nothingToCharge: [] });
    expect(result.ok && result.charges.map((charge) => charge.total_cents)).toEqual([30000]);
  });

  test("corrigir a aula depois não muda o valor guardado", async () => {
    const bank: FakeBank = { students: [lia], marks: mondaysOfNovember.map((date) => given("lia", date)), charges: [] };
    const { client, upsert } = fakeClient(bank);
    await syncMonthCharges(client, november, today);
    bank.marks = [notified("lia", mondaysOfNovember[0]), ...mondaysOfNovember.slice(1).map((date) => given("lia", date))];
    const result = await syncMonthCharges(client, november, today);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(result.ok && result.charges[0].total_cents).toBe(40000);
  });

  test("aluno apagado depois continua na cobrança guardada", async () => {
    const bank: FakeBank = { students: [pedro], marks: [], charges: [] };
    const { client } = fakeClient(bank);
    await syncMonthCharges(client, november, today);
    bank.students = [];
    const result = await syncMonthCharges(client, november, today);
    expect(result.ok && result.charges[0].account[0].studentName).toBe("Pedro Lima");
  });

  test("não pede para guardar nada quando não há cobrança nova e ordena por nome", async () => {
    const carlos = saved({ id: "c2", guardian_name: "Carlos", guardian_phone: "11911112222" });
    const ana = saved({ id: "c3", guardian_name: "Ana", guardian_phone: "11987654321" });
    const { client, upsert } = fakeClient({ students: [], marks: [], charges: [carlos, ana] });
    const result = await syncMonthCharges(client, november, today);
    expect(upsert).not.toHaveBeenCalled();
    expect(result.ok && result.charges.map((charge) => charge.guardian_name)).toEqual(["Ana", "Carlos"]);
  });

  test("avisa quem ainda não ficou pronto e cria só o resto", async () => {
    const { client } = fakeClient({ students: [pedro, noBilling], marks: [], charges: [] });
    const result = await syncMonthCharges(client, november, today);
    expect(result.ok && result.waiting.map((guardian) => guardian.guardianName)).toEqual(["Bia Dias"]);
    expect(result.ok && result.charges.map((charge) => charge.guardian_name)).toEqual(["Ana Lima"]);
  });

  test("falha ao ler as cobranças não cria nada", async () => {
    const { client, upsert } = fakeClient({ students: [pedro], marks: [], charges: [], failOn: "select" });
    expect(await syncMonthCharges(client, november, today)).toEqual({ ok: false, month: november });
    expect(upsert).not.toHaveBeenCalled();
  });

  test("falha ao ler o fechamento não cria nada", async () => {
    const { client, upsert } = fakeClient({ students: [pedro], marks: [], charges: [] });
    const from = vi.mocked(client.from);
    const original = from.getMockImplementation()!;
    from.mockImplementation(((table: string) => (table === "teacher_rules" ? { select: () => ({ maybeSingle: async () => ({ data: null, error: { message: "fora do ar" } }) }) } : original(table))) as never);
    expect(await syncMonthCharges(client, november, today)).toEqual({ ok: false, month: november });
    expect(upsert).not.toHaveBeenCalled();
  });

  test("falha ao guardar avisa", async () => {
    const { client } = fakeClient({ students: [pedro], marks: [], charges: [], failOn: "insert" });
    expect(await syncMonthCharges(client, november, today)).toEqual({ ok: false, month: november });
  });

  test("falha ao reler depois de guardar avisa", async () => {
    const { client } = fakeClient({ students: [pedro], marks: [], charges: [], failReload: true });
    expect(await syncMonthCharges(client, november, today)).toEqual({ ok: false, month: november });
  });
});

describe("leitura e gravação", () => {
  test("ler cobranças sem nenhuma linha devolve lista vazia", async () => {
    const client = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: null }) }) }) } as unknown as LessonsClient;
    expect(await loadMonthCharges(client, november)).toEqual([]);
  });

  test("erro inesperado ao ler devolve falha", async () => {
    const client = {
      from: () => {
        throw new Error("sem rede");
      },
    } as unknown as LessonsClient;
    expect(await loadMonthCharges(client, november)).toBeNull();
  });

  test("erro inesperado ao guardar devolve falha", async () => {
    const client = {
      from: () => {
        throw new Error("sem rede");
      },
    } as unknown as LessonsClient;
    expect(await insertNewCharges(client, [])).toBe(false);
  });
});

const bia: WaitingGuardian = { phone: "11933334444", guardianName: "Bia", students: [{ studentId: "rui", studentName: "Rui", unmarked: 0, missingBilling: true }] };

describe("estado da tela", () => {
  test("começa carregando o mês", () => {
    expect(initialCharges(november)).toEqual({ month: november, status: "loading", charges: [], waiting: [], nothingToCharge: [] });
  });

  test("recarregar mantém o que já estava na tela", () => {
    const ready = { ...initialCharges(november), status: "ready" as const, charges: [saved()] };
    expect(startReloadingCharges(ready)).toEqual({ ...ready, status: "loading" });
  });

  test("aplica o resultado", () => {
    const result = { ok: true as const, month: november, charges: [saved()], waiting: [bia], nothingToCharge: ["Caio"] };
    expect(applyChargesLoad(initialCharges(november), result)).toEqual({ month: november, status: "ready", charges: [saved()], waiting: [bia], nothingToCharge: ["Caio"] });
  });

  test("falha marca a tela", () => {
    expect(applyChargesLoad(initialCharges(november), { ok: false, month: november }).status).toBe("failed");
  });
});

describe("textos", () => {
  test("soma o total do mês", () => {
    expect(monthChargesTotal([saved(), saved({ id: "c2", total_cents: 1000 })])).toBe(31000);
  });

  test("o atalho diz o mês das aulas", () => {
    expect(describeMarkLessons(november)).toBe("Marcar as aulas de novembro de 2026");
  });

  test("diz o que falta em cada aluno", () => {
    expect(describeWaitingStudent({ studentId: "a", studentName: "A", unmarked: 1, missingBilling: false })).toBe("1 aula ainda sem marcar.");
    expect(describeWaitingStudent({ studentId: "a", studentName: "A", unmarked: 3, missingBilling: false })).toBe("3 aulas ainda sem marcar.");
    expect(describeWaitingStudent({ studentId: "a", studentName: "A", unmarked: 0, missingBilling: true })).toBe(chargeMessages.missingBilling);
  });
});
