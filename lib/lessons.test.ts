import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  applyLessonsLoad,
  beginMark,
  chargeLabel,
  dateKeyOf,
  describeDay,
  describeMonth,
  describeNoticeRule,
  describeSummary,
  lessonsPathFor,
  parseMonthParam,
  describeUnscheduled,
  finishMark,
  groupByDay,
  initialLessons,
  isCharged,
  isCreditStatus,
  lessonKey,
  lessonStatuses,
  loadCreditMarks,
  loadLessonMarks,
  loadLessonsMonth,
  monthLessons,
  monthRange,
  nextStatus,
  persistLessonMark,
  shiftMonth,
  startLessonsMonth,
  startReloadingLessons,
  summarizeLessons,
  todayAnchorDate,
  type LessonMark,
  type LessonsClient,
  type LessonsState,
  type MonthLesson,
} from "./lessons";
import type { Student } from "./students";

const november2026 = { year: 2026, month: 11 };

const pedro: Student = { id: "p", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const bia: Student = { ...pedro, id: "b", name: "Bia Reis", lesson_weekday: 1, lesson_time: "09:00:00" };
const lia: Student = { ...pedro, id: "l", name: "Lia Melo", lesson_weekday: null, lesson_time: null };

const lesson: MonthLesson = { studentId: "p", studentName: "Pedro Lima", date: "2026-11-02", time: "15:00", status: null, makeupDate: null };

const givenMark: LessonMark = { student_id: "p", lesson_date: "2026-11-02", status: "given", makeup_date: null };

function ready(overrides: Partial<LessonsState> = {}): LessonsState {
  return { ...initialLessons(november2026), status: "ready", ...overrides };
}

type Result = { data?: unknown; error: { message: string } | null };

function fakeClient(results: Partial<Record<"students" | "lesson_marks" | "credit_marks" | "teacher_rules", Result>> = {}) {
  const marksQuery = {
    gte: vi.fn(() => marksQuery),
    lte: vi.fn(async () => results.lesson_marks ?? { data: [], error: null }),
    in: vi.fn(async () => results.credit_marks ?? { data: [], error: null }),
  };
  const removal = {
    eq: vi.fn((column: string) => (column === "lesson_date" ? Promise.resolve({ error: null }) : removal)),
  };
  const upsert = vi.fn(async () => ({ error: null as Result["error"] }));
  const remove = vi.fn(() => removal);
  const from = vi.fn((table: string) => {
    if (table === "students") return { select: async () => results.students ?? { data: [], error: null } };
    if (table === "teacher_rules") return { select: () => ({ maybeSingle: async () => results.teacher_rules ?? { data: null, error: null } }) };
    return { select: () => marksQuery, upsert, delete: remove };
  });
  return { client: { from } as unknown as LessonsClient, from, marksQuery, upsert, remove, removal };
}

describe("o que é cobrado", () => {
  test("entre as faltas, só a falta sem aviso é cobrada", () => {
    expect(isCharged("unnotified_absence")).toBe(true);
    expect(isCharged("notified_absence")).toBe(false);
    expect(isCharged("teacher_absence")).toBe(false);
  });

  test("só a falta avisada e a falta do professor viram crédito", () => {
    expect(lessonStatuses.filter(isCreditStatus)).toEqual(["notified_absence", "teacher_absence"]);
  });

  test("a aula dada é cobrada", () => {
    expect(isCharged("given")).toBe(true);
  });

  test("cada aula diz como fica na cobrança", () => {
    expect(chargeLabel(null)).toBe("Ainda sem marcar");
    expect(chargeLabel("given")).toBe("Cobrada");
    expect(chargeLabel("teacher_absence")).toBe("Sem cobrança");
  });

  test("as quatro opções são as que o banco aceita", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261103050000_lesson_marks.sql"), "utf8");
    for (const status of lessonStatuses) expect(migration).toContain(`'${status}'`);
  });
});

describe("mês no endereço da tela", () => {
  test("o atalho leva ao mês pedido, com dois dígitos", () => {
    expect(lessonsPathFor({ year: 2026, month: 3 })).toBe("/lessons?month=2026-03");
  });

  test("lê o mês do endereço", () => {
    expect(parseMonthParam("2026-11")).toEqual({ year: 2026, month: 11 });
    expect(parseMonthParam(lessonsPathFor({ year: 2027, month: 1 }).split("=")[1])).toEqual({ year: 2027, month: 1 });
  });

  test("ignora o que não é um mês", () => {
    for (const value of [null, "", "2026-13", "2026-00", "2026-1", "novembro"]) expect(parseMonthParam(value)).toBeNull();
  });
});

describe("mês", () => {
  test("vai do primeiro ao último dia, inclusive em fevereiro", () => {
    expect(monthRange(november2026)).toEqual({ first: "2026-11-01", last: "2026-11-30" });
    expect(monthRange({ year: 2028, month: 2 }).last).toBe("2028-02-29");
  });

  test("anda para os lados e atravessa o ano", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  test("escreve o mês e o dia em português", () => {
    expect(describeMonth(november2026)).toBe("Novembro de 2026");
    expect(describeDay("2026-11-02")).toBe("Segunda-feira, 2 de novembro");
  });

  test("usa o dia do relógio do aparelho", () => {
    expect(dateKeyOf(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("textos", () => {
  test("a regra de antecedência usa o número do professor", () => {
    expect(describeNoticeRule(48)).toContain("48 horas");
    expect(describeNoticeRule(1)).toContain("1 hora ");
  });

  test("o resumo acerta o singular", () => {
    expect(describeSummary({ charged: 1, free: 2, unmarked: 3 })).toBe("1 aula cobrada, 2 sem cobrança e 3 para marcar.");
    expect(describeSummary({ charged: 2, free: 0, unmarked: 0 })).toBe("2 aulas cobradas, 0 sem cobrança e 0 para marcar.");
  });

  test("avisa de quem está sem horário fixo", () => {
    expect(describeUnscheduled([pedro])).toBeNull();
    expect(describeUnscheduled([pedro, lia])).toBe("1 aluno está sem horário fixo e não aparece aqui.");
    expect(describeUnscheduled([lia, { ...lia, id: "x" }])).toBe("2 alunos estão sem horário fixo e não aparecem aqui.");
  });
});

describe("monthLessons", () => {
  test("gera as aulas previstas de cada aluno, em ordem de dia, hora e nome", () => {
    const lessons = monthLessons([pedro, bia], [], november2026);
    expect(lessons).toHaveLength(10);
    expect(lessons.slice(0, 2).map((item) => [item.date, item.time, item.studentName])).toEqual([
      ["2026-11-02", "09:00", "Bia Reis"],
      ["2026-11-02", "15:00", "Pedro Lima"],
    ]);
    expect(lessons.every((item) => item.status === null)).toBe(true);
  });

  test("no mesmo dia e hora, ordena pelo nome", () => {
    const lessons = monthLessons([pedro, { ...bia, lesson_time: "15:00:00" }], [], november2026);
    expect(lessons[0].studentName).toBe("Bia Reis");
  });

  test("aluno sem horário não gera aula", () => {
    expect(monthLessons([lia], [], november2026)).toEqual([]);
  });

  test("traz a marcação de cada aula", () => {
    const lessons = monthLessons([pedro], [givenMark], november2026);
    expect(lessons[0].status).toBe("given");
    expect(lessons[1].status).toBeNull();
    expect(lessons).toHaveLength(5);
  });

  test("quando o horário muda, a aula já marcada continua na lista, sem hora", () => {
    const moved: Student = { ...pedro, lesson_weekday: 3 };
    const lessons = monthLessons([moved], [givenMark], november2026);
    expect(lessons[0]).toEqual({ studentId: "p", studentName: "Pedro Lima", date: "2026-11-02", time: null, status: "given", makeupDate: null });
    expect(lessons).toHaveLength(5);
  });

  test("falta de outro mês não aparece na lista deste mês", () => {
    const october: LessonMark = { student_id: "p", lesson_date: "2026-10-05", status: "notified_absence", makeup_date: null };
    expect(monthLessons([pedro], [october], november2026).every((item) => item.status === null)).toBe(true);
  });

  test("traz o dia da reposição da falta já reposta", () => {
    const madeUp: LessonMark = { student_id: "p", lesson_date: "2026-11-02", status: "notified_absence", makeup_date: "2026-11-05" };
    expect(monthLessons([pedro], [madeUp], november2026)[0].makeupDate).toBe("2026-11-05");
  });

  test("aula marcada de aluno que ficou sem horário continua na lista", () => {
    expect(monthLessons([{ ...lia, id: "p" }], [givenMark], november2026)).toHaveLength(1);
  });
});

describe("groupByDay", () => {
  test("a reposição entra no dia dela, mesmo sem aula prevista", () => {
    const makeup = { studentId: "p", studentName: "Pedro Lima", date: "2026-11-03", absenceDate: "2026-11-02" };
    const days = groupByDay(monthLessons([pedro], [], november2026), [makeup]);
    expect(days.map((day) => day.date).slice(0, 2)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(days[1]).toEqual({ date: "2026-11-03", lessons: [], makeups: [makeup] });
  });

  test("junta as aulas do mesmo dia", () => {
    const days = groupByDay(monthLessons([pedro, bia], [], november2026));
    expect(days).toHaveLength(5);
    expect(days[0].lessons).toHaveLength(2);
  });
});

describe("todayAnchorDate", () => {
  const days = groupByDay(monthLessons([pedro], [], november2026));

  test("aponta para hoje quando hoje tem aula", () => {
    expect(todayAnchorDate(days, november2026, "2026-11-09")).toBe("2026-11-09");
  });

  test("sem aula hoje, aponta para a próxima", () => {
    expect(todayAnchorDate(days, november2026, "2026-11-03")).toBe("2026-11-09");
  });

  test("depois da última aula do mês, não aponta para nada", () => {
    expect(todayAnchorDate(groupByDay(monthLessons([{ ...pedro, lesson_weekday: 2 }], [], november2026)), november2026, "2026-11-30")).toBeNull();
  });

  test("em outro mês, não aponta para nada", () => {
    expect(todayAnchorDate(days, november2026, "2026-12-01")).toBeNull();
    expect(todayAnchorDate(days, november2026, "2026-10-31")).toBeNull();
  });
});

describe("summarizeLessons", () => {
  test("conta aulas cobradas, sem cobrança e para marcar", () => {
    const statuses = ["given", "unnotified_absence", "notified_absence", "teacher_absence", null] as const;
    expect(summarizeLessons(statuses.map((status) => ({ ...lesson, status })))).toEqual({ charged: 2, free: 2, unmarked: 1 });
  });
});

describe("summarizeLessons com reposição", () => {
  test("a aula de reposição conta como cobrada", () => {
    const makeup = { studentId: "p", studentName: "Pedro Lima", date: "2026-11-03", absenceDate: "2026-11-02" };
    expect(summarizeLessons([{ ...lesson, status: "notified_absence" }], [makeup])).toEqual({ charged: 1, free: 1, unmarked: 0 });
  });
});

describe("loadCreditMarks", () => {
  test("busca as faltas que viram crédito, de qualquer mês", async () => {
    const credit: LessonMark = { student_id: "p", lesson_date: "2026-09-07", status: "teacher_absence", makeup_date: null };
    const { client, marksQuery } = fakeClient({ credit_marks: { data: [credit], error: null } });
    expect(await loadCreditMarks(client)).toEqual({ ok: true, marks: [credit] });
    expect(marksQuery.in).toHaveBeenCalledWith("status", ["notified_absence", "teacher_absence"]);
  });

  test("sem faltas, devolve vazio", async () => {
    expect(await loadCreditMarks(fakeClient({ credit_marks: { data: null, error: null } }).client)).toEqual({ ok: true, marks: [] });
  });

  test("exceção vira falha", async () => {
    const client = { from: () => { throw new Error("sem rede"); } } as unknown as LessonsClient;
    expect(await loadCreditMarks(client)).toEqual({ ok: false });
  });
});

describe("loadLessonMarks", () => {
  test("busca só o mês pedido", async () => {
    const { client, from, marksQuery } = fakeClient({ lesson_marks: { data: [givenMark], error: null } });
    expect(await loadLessonMarks(client, november2026)).toEqual({ ok: true, marks: [givenMark] });
    expect(from).toHaveBeenCalledWith("lesson_marks");
    expect(marksQuery.gte).toHaveBeenCalledWith("lesson_date", "2026-11-01");
    expect(marksQuery.lte).toHaveBeenCalledWith("lesson_date", "2026-11-30");
  });

  test("sem marcações, devolve vazio", async () => {
    expect(await loadLessonMarks(fakeClient({ lesson_marks: { data: null, error: null } }).client, november2026)).toEqual({ ok: true, marks: [] });
  });

  test("erro do banco vira falha", async () => {
    expect(await loadLessonMarks(fakeClient({ lesson_marks: { error: { message: "x" } } }).client, november2026)).toEqual({ ok: false });
  });

  test("exceção vira falha", async () => {
    const client = { from: () => { throw new Error("sem rede"); } } as unknown as LessonsClient;
    expect(await loadLessonMarks(client, november2026)).toEqual({ ok: false });
  });
});

describe("loadLessonsMonth", () => {
  test("junta alunos, marcações e a antecedência do professor", async () => {
    const { client } = fakeClient({
      students: { data: [pedro], error: null },
      lesson_marks: { data: [givenMark], error: null },
      teacher_rules: { data: { notice_hours: 48, makeup_deadline_days: null }, error: null },
    });
    expect(await loadLessonsMonth(client, november2026)).toEqual({ ok: true, month: november2026, students: [pedro], marks: [givenMark], noticeHours: 48, makeupDeadlineDays: null });
  });

  test("junta as faltas de outros meses sem repetir as do mês aberto", async () => {
    const thisMonth: LessonMark = { student_id: "p", lesson_date: "2026-11-02", status: "notified_absence", makeup_date: null };
    const older: LessonMark = { student_id: "p", lesson_date: "2026-10-05", status: "teacher_absence", makeup_date: null };
    const { client } = fakeClient({
      lesson_marks: { data: [thisMonth], error: null },
      credit_marks: { data: [thisMonth, older], error: null },
      teacher_rules: { data: { notice_hours: 24, makeup_deadline_days: 30 }, error: null },
    });
    expect(await loadLessonsMonth(client, november2026)).toMatchObject({ marks: [thisMonth, older], makeupDeadlineDays: 30 });
  });

  test("sem regras guardadas, usa as 24 horas de partida", async () => {
    const result = await loadLessonsMonth(fakeClient().client, november2026);
    expect(result).toMatchObject({ ok: true, noticeHours: 24 });
  });

  test.each(["students", "lesson_marks", "credit_marks", "teacher_rules"] as const)("falha ao buscar %s vira falha", async (table) => {
    const result = await loadLessonsMonth(fakeClient({ [table]: { error: { message: "x" } } }).client, november2026);
    expect(result).toEqual({ ok: false, month: november2026 });
  });
});

describe("persistLessonMark", () => {
  test("guarda a marcação, trocando a anterior da mesma aula", async () => {
    const { client, upsert } = fakeClient();
    expect(await persistLessonMark(client, lesson, "given")).toBe(true);
    expect(upsert).toHaveBeenCalledWith({ student_id: "p", lesson_date: "2026-11-02", status: "given" }, { onConflict: "student_id,lesson_date" });
  });

  test("sem status, apaga só a marcação daquela aula", async () => {
    const { client, remove, removal, upsert } = fakeClient();
    expect(await persistLessonMark(client, lesson, null)).toBe(true);
    expect(remove).toHaveBeenCalled();
    expect(removal.eq).toHaveBeenCalledWith("student_id", "p");
    expect(removal.eq).toHaveBeenCalledWith("lesson_date", "2026-11-02");
    expect(upsert).not.toHaveBeenCalled();
  });

  test("erro do banco devolve falso", async () => {
    const { client, upsert } = fakeClient();
    upsert.mockResolvedValueOnce({ error: { message: "x" } });
    expect(await persistLessonMark(client, lesson, "given")).toBe(false);
  });

  test("exceção devolve falso", async () => {
    const client = { from: () => { throw new Error("sem rede"); } } as unknown as LessonsClient;
    expect(await persistLessonMark(client, lesson, "given")).toBe(false);
  });
});

describe("estado da tela", () => {
  test("nextStatus marca, troca e desfaz com o toque na mesma opção", () => {
    expect(nextStatus(lesson, "given")).toBe("given");
    expect(nextStatus({ ...lesson, status: "given" }, "teacher_absence")).toBe("teacher_absence");
    expect(nextStatus({ ...lesson, status: "given" }, "given")).toBeNull();
  });

  test("trocar de mês limpa a lista e volta a carregar", () => {
    const next = startLessonsMonth(ready({ students: [pedro], marks: [givenMark], pending: ["x"] }), -1);
    expect(next).toEqual(initialLessons({ year: 2026, month: 10 }));
  });

  test("tentar de novo volta a carregar", () => {
    expect(startReloadingLessons(ready()).status).toBe("loading");
  });

  test("resposta que chega aplica alunos, marcações e regra", () => {
    const next = applyLessonsLoad(initialLessons(november2026), { ok: true, month: november2026, students: [pedro], marks: [givenMark], noticeHours: 12, makeupDeadlineDays: 30 });
    expect(next).toMatchObject({ status: "ready", students: [pedro], marks: [givenMark], noticeHours: 12, makeupDeadlineDays: 30 });
  });

  test("falha ao carregar aparece como falha", () => {
    expect(applyLessonsLoad(initialLessons(november2026), { ok: false, month: november2026 }).status).toBe("failed");
  });

  test("resposta atrasada de outro mês é ignorada", () => {
    const state = initialLessons(november2026);
    expect(applyLessonsLoad(state, { ok: false, month: { year: 2026, month: 10 } })).toBe(state);
    expect(applyLessonsLoad(state, { ok: false, month: { year: 2025, month: 11 } })).toBe(state);
  });

  test("o toque aparece na hora e trava a aula enquanto grava", () => {
    const next = beginMark(ready({ failedLesson: "outra" }), lesson, "given");
    expect(next.marks).toEqual([givenMark]);
    expect(next.pending).toEqual([lessonKey(lesson)]);
    expect(next.failedLesson).toBeNull();
  });

  test("trocar a marcação substitui a anterior e não mexe nas outras aulas", () => {
    const other: LessonMark = { student_id: "b", lesson_date: "2026-11-02", status: "given", makeup_date: null };
    const sameStudent: LessonMark = { student_id: "p", lesson_date: "2026-11-09", status: "given", makeup_date: null };
    const next = beginMark(ready({ marks: [givenMark, other, sameStudent] }), { ...lesson, status: "given" }, "teacher_absence");
    expect(next.marks).toEqual([other, sameStudent, { ...givenMark, status: "teacher_absence" }]);
  });

  test("desfazer tira a marcação", () => {
    expect(beginMark(ready({ marks: [givenMark] }), { ...lesson, status: "given" }, null).marks).toEqual([]);
  });

  test("gravou: destrava e mantém a marcação", () => {
    const next = finishMark(beginMark(ready(), lesson, "given"), lesson, true);
    expect(next).toMatchObject({ pending: [], marks: [givenMark], failedLesson: null });
  });

  test("não gravou: volta a marcação de antes e avisa naquela aula", () => {
    const before = { ...lesson, status: "given" } as MonthLesson;
    const next = finishMark(beginMark(ready({ marks: [givenMark] }), before, "teacher_absence"), before, false);
    expect(next).toMatchObject({ pending: [], marks: [givenMark], failedLesson: lessonKey(lesson) });
  });

  test("não gravou uma aula que estava sem marcar: volta a ficar sem marcar", () => {
    expect(finishMark(beginMark(ready(), lesson, "given"), lesson, false).marks).toEqual([]);
  });

  test("resposta que chega depois de trocar de mês é ignorada", () => {
    const moved = startLessonsMonth(beginMark(ready(), lesson, "given"), 1);
    expect(finishMark(moved, lesson, false)).toBe(moved);
  });
});
