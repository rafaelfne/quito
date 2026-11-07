import { describe, expect, test, vi } from "vitest";
import {
  applyChargesLoad,
  applyPreviewConfirmation,
  applySendSaved,
  canSendCharge,
  canSendCharges,
  chargeMessages,
  chargesPath,
  describeMarkLessons,
  describeReadyFor,
  isChargeSent,
  isDueToSend,
  describeWaitingStudent,
  endedMonthOf,
  initialCharges,
  insertNewCharges,
  isGuardianReady,
  loadEarlierCharges,
  loadMonthCharges,
  monthChargesTotal,
  needsFirstPreview,
  planMonthCharges,
  startConfirmingPreview,
  startReloadingCharges,
  startSavingSend,
  syncMonthCharges,
  waitsForBilling,
  waitsForMarks,
  type Charge,
  type WaitingGuardian,
  syncChargesWithMessages,
} from "@/lib/charges";
import { buildMonthClosing, type ClosingData, type ClosingRules } from "@/lib/closing";
import type { LessonMark, LessonsClient } from "@/lib/lessons";
import type { Student } from "@/lib/students";

const november = { year: 2026, month: 11 };
const today = "2026-12-01";
const rules: ClosingRules = { makeup_deadline_days: null, five_week_policy: "same_price", five_week_extra_cents: null, sibling_discount_percent: 10 };

const pedro: Student = { id: "pedro", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
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

type FakeBank = { students: Student[]; marks: LessonMark[]; charges: Charge[]; earlier?: Charge[]; failOn?: "select" | "insert" | "earlier"; failReload?: boolean };

function fakeClient(bank: FakeBank) {
  const upsert = vi.fn(async (...[rows]: [Omit<Charge, "id">[], unknown]) => {
    if (bank.failOn === "insert") return { error: { message: "fora do ar" } };
    bank.charges.push(...rows.map((row, index) => ({ ...row, id: `novo-${index}` })));
    return { error: null };
  });
  let chargeReads = 0;
  const marksChain = { order: () => marksChain, range: async () => ({ data: bank.marks, error: null }) };
  const earlierChain = { order: () => earlierChain, range: async () => (bank.failOn === "earlier" ? { data: null, error: { message: "fora do ar" } } : { data: bank.earlier ?? [], error: null }) };
  const from = vi.fn((table: string) => {
    if (table === "students") return { select: async (columns: string) => (columns === "id, created_at" ? { data: [], error: null } : { data: bank.students, error: null }) };
    if (table === "teacher_rules") return { select: () => ({ maybeSingle: async () => ({ data: rules, error: null }) }) };
    if (table === "lesson_marks") return { select: () => ({ lte: () => marksChain }) };
    return {
      upsert,
      select: () => ({
        lt: () => earlierChain,
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
    expect(Object.keys(charge.account[0]).sort()).toEqual(["attendance", "basis", "credits", "lines", "packageBalance", "settled", "studentId", "studentName", "totalCents"]);
  });
});

describe("cobranças com a mensagem montada", () => {
  test("se a cobrança ou os dados da mensagem não abrem, a tela oferece tentar de novo", async () => {
    const { client } = fakeClient({ students: [pedro], marks: [], charges: [] });
    expect(await syncChargesWithMessages(client, november, today)).toEqual({ ok: false, month: november });
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

describe("acerto no mês seguinte", () => {
  const december = { year: 2026, month: 12 };
  const onJanuary = "2027-01-02";
  const decemberMondays = ["2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"];
  const allGiven = (studentId: string, dates: string[]) => dates.map((date) => given(studentId, date));
  const novemberMarks = allGiven("lia", mondaysOfNovember);
  const decemberMarks = allGiven("lia", decemberMondays);

  async function chargeNovemberThenDecember(correctedNovember: LessonMark[], students: Student[] = [lia]) {
    const bank: FakeBank = { students, marks: novemberMarks, charges: [] };
    await syncMonthCharges(fakeClient(bank).client, november, today);
    const earlier = bank.charges;
    const next: FakeBank = { students, marks: [...correctedNovember, ...decemberMarks], charges: [], earlier };
    await syncMonthCharges(fakeClient(next).client, december, onJanuary);
    return { earlier, novemberCharge: earlier[0], decemberCharge: next.charges[0] };
  }

  test("a cobrança de novembro não muda e a diferença entra em dezembro com a linha explicada", async () => {
    const corrected = [notified("lia", mondaysOfNovember[0]), ...novemberMarks.slice(1)];
    const { novemberCharge, decemberCharge } = await chargeNovemberThenDecember(corrected);
    expect(novemberCharge.total_cents).toBe(40000);
    expect(decemberCharge.total_cents).toBe(32000 - 8000);
    expect(decemberCharge.account[0].lines.at(-1)).toEqual({ label: "Acerto de novembro: 1 aula remarcada como falta avisada", cents: -8000 });
    expect(decemberCharge.account[0].totalCents).toBe(24000);
    expect(decemberCharge.account[0].settled).toEqual([{ month: "2026-11-01", cents: -8000 }]);
  });

  test("sem correção, a cobrança seguinte não tem acerto", async () => {
    const { decemberCharge } = await chargeNovemberThenDecember(novemberMarks);
    expect(decemberCharge.total_cents).toBe(32000);
    expect(decemberCharge.account[0].settled).toEqual([]);
  });

  test("sem correção, pacote e irmãos com desconto também não têm acerto", async () => {
    const packaged = { ...lia, billing_kind: "package" as const, billing_amount_cents: 20000, package_lessons: 2 };
    const sister = { ...lia, id: "eva", name: "Eva Melo" };
    const marks = [...novemberMarks, ...allGiven("eva", mondaysOfNovember)];
    const bank: FakeBank = { students: [packaged, sister], marks, charges: [] };
    await syncMonthCharges(fakeClient(bank).client, november, today);
    const next: FakeBank = { students: [packaged, sister], marks: [...marks, ...decemberMarks, ...allGiven("eva", decemberMondays)], charges: [], earlier: bank.charges };
    await syncMonthCharges(fakeClient(next).client, december, onJanuary);
    expect(next.charges[0].account.flatMap((student) => student.settled)).toEqual([]);
  });

  test("mudar o preço do aluno depois não vira acerto", async () => {
    const bank: FakeBank = { students: [lia], marks: novemberMarks, charges: [] };
    await syncMonthCharges(fakeClient(bank).client, november, today);
    const raised = { ...lia, billing_amount_cents: 10000 };
    const next: FakeBank = { students: [raised], marks: [...novemberMarks, ...decemberMarks], charges: [], earlier: bank.charges };
    await syncMonthCharges(fakeClient(next).client, december, onJanuary);
    expect(next.charges[0].total_cents).toBe(40000);
    expect(next.charges[0].account[0].lines).toHaveLength(1);
  });

  test("telefone corrigido não perde o acerto", async () => {
    const newPhone = { ...lia, guardian_phone: "11955556666" };
    const { decemberCharge } = await chargeNovemberThenDecember([notified("lia", mondaysOfNovember[0]), ...novemberMarks.slice(1)], [newPhone]);
    expect(decemberCharge.guardian_phone).toBe("11955556666");
    expect(decemberCharge.total_cents).toBe(24000);
  });

  test("o acerto entra uma vez só", async () => {
    const corrected = [notified("lia", mondaysOfNovember[0]), ...novemberMarks.slice(1)];
    const { earlier, decemberCharge } = await chargeNovemberThenDecember(corrected);
    const januaryMondays = ["2027-01-04", "2027-01-11", "2027-01-18", "2027-01-25"];
    const next: FakeBank = { students: [lia], marks: [...corrected, ...decemberMarks, ...allGiven("lia", januaryMondays)], charges: [], earlier: [...earlier, decemberCharge] };
    await syncMonthCharges(fakeClient(next).client, { year: 2027, month: 1 }, "2027-02-01");
    expect(next.charges[0].total_cents).toBe(32000);
    expect(next.charges[0].account[0].settled).toEqual([]);
  });

  test("responsável sem nada no mês recebe cobrança só com o acerto a mais", async () => {
    const paused = decemberMondays.map((date) => notified("lia", date));
    const bank: FakeBank = { students: [lia], marks: [notified("lia", mondaysOfNovember[0]), ...novemberMarks.slice(1)], charges: [] };
    await syncMonthCharges(fakeClient(bank).client, november, today);
    const next: FakeBank = { students: [lia], marks: [...novemberMarks, ...paused], charges: [], earlier: bank.charges };
    const result = await syncMonthCharges(fakeClient(next).client, december, onJanuary);
    expect(result.ok && result.nothingToCharge).toEqual([]);
    expect(next.charges[0].total_cents).toBe(8000);
    expect(next.charges[0].account[0].lines.at(-1)).toEqual({ label: "Acerto de novembro: 1 falta remarcada como dada", cents: 8000 });
  });

  test("acerto a menos sem nada a cobrar no mês espera a próxima cobrança", async () => {
    const paused = decemberMondays.map((date) => notified("lia", date));
    const bank: FakeBank = { students: [lia], marks: novemberMarks, charges: [] };
    await syncMonthCharges(fakeClient(bank).client, november, today);
    const next: FakeBank = { students: [lia], marks: [notified("lia", mondaysOfNovember[0]), ...novemberMarks.slice(1), ...paused], charges: [], earlier: bank.charges };
    const result = await syncMonthCharges(fakeClient(next).client, december, onJanuary);
    expect(result.ok && result.nothingToCharge).toEqual(["Caio Melo"]);
    expect(next.charges).toEqual([]);
  });

  test("falha ao ler as cobranças anteriores não cria nada", async () => {
    const { client, upsert } = fakeClient({ students: [lia], marks: novemberMarks, charges: [], failOn: "earlier" });
    expect(await syncMonthCharges(client, november, today)).toEqual({ ok: false, month: november });
    expect(upsert).not.toHaveBeenCalled();
  });

  test("responsável esperando marcação não usa o acerto ainda", () => {
    const adjustments = new Map([["lia", [{ studentId: "lia", month: "2026-10-01", cents: -8000, label: "Acerto de outubro: x" }]]]);
    const plan = planMonthCharges(closingOf({ students: [lia] }), november, [], adjustments);
    expect(plan.newCharges).toEqual([]);
    expect(plan.waiting).toHaveLength(1);
  });
});

describe("leitura e gravação", () => {
  test("cobranças anteriores são lidas em páginas até acabar", async () => {
    const pages = [Array.from({ length: 1000 }, (_, index) => saved({ id: `c${index}` })), [saved({ id: "fim" })]];
    const range = vi.fn(async () => ({ data: pages.shift() ?? [], error: null }));
    const chain = { order: () => chain, range };
    const client = { from: () => ({ select: () => ({ lt: () => chain }) }) } as unknown as LessonsClient;
    expect(await loadEarlierCharges(client, november)).toHaveLength(1001);
    expect(range).toHaveBeenCalledTimes(2);
  });

  test("cobranças anteriores sem nenhuma linha devolvem lista vazia", async () => {
    const chain = { order: () => chain, range: async () => ({ data: null, error: null }) };
    const client = { from: () => ({ select: () => ({ lt: () => chain }) }) } as unknown as LessonsClient;
    expect(await loadEarlierCharges(client, november)).toEqual([]);
  });

  test("erro inesperado ao ler as cobranças anteriores devolve falha", async () => {
    const client = {
      from: () => {
        throw new Error("sem rede");
      },
    } as unknown as LessonsClient;
    expect(await loadEarlierCharges(client, november)).toBeNull();
  });

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
    expect(initialCharges(november)).toEqual({ month: november, status: "loading", charges: [], waiting: [], nothingToCharge: [], messages: {}, dueDates: {}, today: "", previewConfirmed: false, confirmingPreview: false, previewMessage: null, savingSends: [], sendMessage: null });
  });

  test("recarregar mantém o que já estava na tela", () => {
    const ready = { ...initialCharges(november), status: "ready" as const, charges: [saved()] };
    expect(startReloadingCharges(ready)).toEqual({ ...ready, status: "loading" });
  });

  test("aplica o resultado", () => {
    const result = { ok: true as const, month: november, charges: [saved()], waiting: [bia], nothingToCharge: ["Caio"] };
    expect(applyChargesLoad(initialCharges(november), result)).toEqual({ month: november, status: "ready", charges: [saved()], waiting: [bia], nothingToCharge: ["Caio"], messages: {}, dueDates: {}, today: "", previewConfirmed: false, confirmingPreview: false, previewMessage: null, savingSends: [], sendMessage: null });
  });

  test("traz se o professor já passou pela prévia", () => {
    const result = { ok: true as const, month: november, charges: [saved()], waiting: [], nothingToCharge: [], messages: { c1: "Oi" }, previewConfirmed: true };
    expect(applyChargesLoad(initialCharges(november), result).previewConfirmed).toBe(true);
  });

  test("falha marca a tela", () => {
    expect(applyChargesLoad(initialCharges(november), { ok: false, month: november }).status).toBe("failed");
  });
});

describe("prévia antes do primeiro envio", () => {
  const withMessage = { ...initialCharges(november), status: "ready" as const, charges: [saved()], messages: { c1: "Oi, Ana!" } };

  test("na primeira vez o professor passa pela mensagem antes de enviar", () => {
    expect(needsFirstPreview(withMessage)).toBe(true);
    expect(canSendCharges(withMessage)).toBe(false);
  });

  test("sem mensagem montada não pede a prévia", () => {
    expect(needsFirstPreview({ ...withMessage, messages: {} })).toBe(false);
  });

  test("depois de confirmar, libera o envio e não pede de novo", () => {
    const confirming = startConfirmingPreview(withMessage);
    expect(confirming).toMatchObject({ confirmingPreview: true, previewMessage: null });
    const confirmed = applyPreviewConfirmation(confirming, true);
    expect(confirmed).toMatchObject({ confirmingPreview: false, previewConfirmed: true, previewMessage: null });
    expect(needsFirstPreview(confirmed)).toBe(false);
    expect(canSendCharges(confirmed)).toBe(true);
  });

  test("se não deu para guardar, avisa e continua pedindo a prévia", () => {
    const failed = applyPreviewConfirmation(startConfirmingPreview(withMessage), false);
    expect(failed).toMatchObject({ confirmingPreview: false, previewConfirmed: false, previewMessage: chargeMessages.confirmPreviewFailed });
    expect(canSendCharges(failed)).toBe(false);
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

describe("envio pelo WhatsApp", () => {
  const ready = { ...initialCharges(november), status: "ready" as const, charges: [saved(), saved({ id: "c2" })], messages: { c1: "Oi", c2: "Oi" }, previewConfirmed: true };
  const sentAt = "2026-12-05T13:00:00.000Z";

  test("cobrança nova ainda não foi enviada", () => {
    expect(isChargeSent(saved())).toBe(false);
    expect(isChargeSent(saved({ sent_at: null }))).toBe(false);
    expect(isChargeSent(saved({ sent_at: sentAt }))).toBe(true);
  });

  test("o toque guarda a cobrança como enviada só naquele responsável", () => {
    const saving = startSavingSend({ ...ready, sendMessage: chargeMessages.undoFailed }, "c1");
    expect(saving).toMatchObject({ savingSends: ["c1"], sendMessage: null });
    expect(startSavingSend(saving, "c1").savingSends).toEqual(["c1"]);
    const sent = applySendSaved(saving, "c1", sentAt, true);
    expect(sent.savingSends).toEqual([]);
    expect(sent.charges.map(isChargeSent)).toEqual([true, false]);
    expect(sent.charges[0].sent_at).toBe(sentAt);
  });

  test("desfazer volta a cobrança para esperar o envio", () => {
    const sent = applySendSaved(ready, "c1", sentAt, true);
    const undone = applySendSaved(startSavingSend(sent, "c1"), "c1", null, true);
    expect(undone.charges.map(isChargeSent)).toEqual([false, false]);
    expect(undone.savingSends).toEqual([]);
  });

  test("se não deu para guardar o envio, avisa e a cobrança continua como estava", () => {
    const failed = applySendSaved(startSavingSend(ready, "c1"), "c1", sentAt, false);
    expect(failed).toMatchObject({ savingSends: [], sendMessage: chargeMessages.sendFailed });
    expect(isChargeSent(failed.charges[0])).toBe(false);
  });

  test("se não deu para desfazer, avisa e a cobrança continua enviada", () => {
    const sent = applySendSaved(ready, "c1", sentAt, true);
    const failed = applySendSaved(startSavingSend(sent, "c1"), "c1", null, false);
    expect(failed.sendMessage).toBe(chargeMessages.undoFailed);
    expect(isChargeSent(failed.charges[0])).toBe(true);
  });
});

describe("envio só no dia do vencimento", () => {
  const base = { ...initialCharges(november), status: "ready" as const, charges: [saved()], messages: { c1: "Oi, Ana!" }, dueDates: { c1: "2026-12-05" }, previewConfirmed: true };

  test("do dia 1 até a véspera, a cobrança fica pronta para o dia, sem envio", () => {
    for (const today of ["2026-12-01", "2026-12-04"]) {
      expect(isDueToSend({ ...base, today }, "c1")).toBe(false);
      expect(canSendCharge({ ...base, today }, "c1")).toBe(false);
    }
    expect(describeReadyFor("2026-12-05")).toBe("Pronta para o dia 5");
  });

  test("no dia do vencimento, libera o envio", () => {
    expect(isDueToSend({ ...base, today: "2026-12-05" }, "c1")).toBe(true);
    expect(canSendCharge({ ...base, today: "2026-12-05" }, "c1")).toBe(true);
  });

  test("depois do dia, o envio continua liberado", () => {
    expect(canSendCharge({ ...base, today: "2026-12-09" }, "c1")).toBe(true);
  });

  test("no dia, sem passar pela prévia, não libera", () => {
    expect(canSendCharge({ ...base, today: "2026-12-05", previewConfirmed: false }, "c1")).toBe(false);
  });

  test("sem vencimento ou sem mensagem, não libera", () => {
    expect(canSendCharge({ ...base, today: "2026-12-05", dueDates: {} }, "c1")).toBe(false);
    expect(canSendCharge({ ...base, today: "2026-12-05", messages: {} }, "c1")).toBe(false);
    expect(isDueToSend({ ...base, today: "" }, "c1")).toBe(false);
  });

  test("aplica o vencimento e o dia de hoje que vieram da carga", () => {
    const result = { ok: true as const, month: november, charges: [saved()], waiting: [], nothingToCharge: [], dueDates: { c1: "2026-12-05" }, today: "2026-12-02" };
    expect(applyChargesLoad(initialCharges(november), result)).toMatchObject({ dueDates: { c1: "2026-12-05" }, today: "2026-12-02" });
  });
});
