import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import type { LessonMark, LessonStatus, LessonsClient } from "@/lib/lessons";
import {
  applyOpeningLoad,
  changeOpeningDraft,
  describeCreditsDeadline,
  describeOpeningIntro,
  describeOpeningNotYet,
  describePredictedCredits,
  describePredictedPackage,
  initialOpeningBalance,
  isOpeningConfirmed,
  loadOpeningBalance,
  needsOpeningBalance,
  openingBalanceMessages,
  openingBalancePath,
  openingDayOf,
  openingDraftOf,
  packageBalanceInvalid,
  predictOpening,
  saveOpeningBalance,
  startReloadingOpening,
  submitOpeningBalance,
  trainedStudents,
  validateOpening,
  type OpeningBalanceLoad,
  type OpeningBalanceState,
} from "@/lib/opening-balance";
import type { Student } from "@/lib/students";

type Failure = { message: string } | null;

const november = { year: 2026, month: 11 };
const openingDay = "2026-12-01";

const base: Student = { id: "m", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00", created_at: "2026-11-05T12:00:00Z", package_balance: 0, makeup_credits: 0 };
const packaged: Student = { ...base, id: "p", name: "Rui Dias", guardian_name: "Bia Dias", guardian_phone: "11933334444", billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4, package_balance: 3 };
const late: Student = { ...base, id: "l", name: "Ana Souza", created_at: "2026-12-03T12:00:00Z" };

function mark(studentId: string, date: string, status: LessonStatus, makeupDate: string | null = null): LessonMark {
  return { student_id: studentId, lesson_date: date, status, makeup_date: makeupDate };
}

function loaded(students: Student[] = [packaged, base], marks: LessonMark[] = [], makeupDeadlineDays: number | null = null): OpeningBalanceState {
  return applyOpeningLoad(initialOpeningBalance, { ok: true, trainingMonth: november, students, marks, makeupDeadlineDays });
}

function updateClient(result: (id: string) => Promise<{ data: { id: string }[] | null; error: Failure }> = async (id) => ({ data: [{ id }], error: null })) {
  const calls: { row: unknown; id: string }[] = [];
  const update = vi.fn((row: unknown) => ({
    eq: (_column: string, id: string) => {
      calls.push({ row, id });
      return { select: () => result(id) };
    },
  }));
  return { client: { from: vi.fn(() => ({ update })) } as unknown as LessonsClient, calls };
}

describe("dia do acerto", () => {
  test("é o primeiro dia do mês seguinte ao treino, também na virada do ano", () => {
    expect(openingBalancePath).toBe("/students/opening-balance");
    expect(openingDayOf(november)).toBe("2026-12-01");
    expect(openingDayOf({ year: 2026, month: 12 })).toBe("2027-01-01");
  });

  test("só entram os alunos cadastrados antes do primeiro mês cobrado, em ordem de nome", () => {
    const withoutDate = { ...base, id: "s", name: "Bruno Alves", created_at: undefined };
    expect(trainedStudents([packaged, late, base, withoutDate], openingDay).map((student) => student.id)).toEqual(["s", "m", "p"]);
  });

  test("o aviso aparece a partir do dia do acerto, enquanto falta confirmar algum aluno do treino", () => {
    const confirmed = { ...base, opening_balance_on: openingDay, opening_package_balance: null, opening_makeup_credits: 0 };
    expect(isOpeningConfirmed(confirmed)).toBe(true);
    expect(isOpeningConfirmed(base)).toBe(false);
    expect(needsOpeningBalance([base], null, "2026-12-05")).toBe(false);
    expect(needsOpeningBalance([base], november, "2026-11-30")).toBe(false);
    expect(needsOpeningBalance([base], november, "2026-12-01")).toBe(true);
    expect(needsOpeningBalance([confirmed, late], november, "2026-12-05")).toBe(false);
    expect(needsOpeningBalance([], november, "2026-12-05")).toBe(false);
  });
});

describe("saldo previsto depois do treino", () => {
  test("o pacote parte do saldo inicial e desconta as aulas cobradas do treino", () => {
    const marks = [mark("p", "2026-11-02", "given"), mark("p", "2026-11-09", "notified_absence"), mark("p", "2026-11-16", "unnotified_absence")];
    expect(predictOpening(packaged, marks, null, openingDay)).toEqual({ packageBalance: 1, makeupCredits: 1 });
  });

  test("quando o treino gasta mais que o saldo, conta o pacote novo comprado no meio", () => {
    const marks = ["02", "09", "16", "23", "30"].map((day) => mark("p", `2026-11-${day}`, "given"));
    expect(predictOpening(packaged, marks, null, openingDay).packageBalance).toBe(2);
  });

  test("quem não paga por pacote não tem saldo de pacote", () => {
    expect(predictOpening(base, [], null, openingDay).packageBalance).toBeNull();
    expect(predictOpening({ ...packaged, package_lessons: null }, [], null, openingDay).packageBalance).toBeNull();
    expect(predictOpening({ ...packaged, package_lessons: 0 }, [], null, openingDay).packageBalance).toBeNull();
    expect(predictOpening({ ...packaged, package_balance: undefined }, [], null, openingDay).packageBalance).toBe(0);
  });

  test("os créditos somam as faltas do treino ainda abertas e os créditos iniciais ainda no prazo", () => {
    const student = { ...base, makeup_credits: 2 };
    const marks = [mark("m", "2026-11-09", "teacher_absence"), mark("m", "2026-11-16", "notified_absence", "2026-11-20"), mark("m", "2026-12-07", "notified_absence"), mark("x", "2026-11-09", "notified_absence")];
    expect(predictOpening(student, marks, null, openingDay).makeupCredits).toBe(3);
    expect(predictOpening(student, marks, 30, openingDay).makeupCredits).toBe(3);
    expect(predictOpening(student, marks, 25, openingDay).makeupCredits).toBe(1);
    expect(predictOpening(student, marks, 5, openingDay).makeupCredits).toBe(0);
  });

  test("sem data de cadastro, os créditos iniciais não entram, e o total respeita o limite", () => {
    expect(predictOpening({ ...base, makeup_credits: 2, created_at: undefined }, [], null, openingDay).makeupCredits).toBe(0);
    expect(predictOpening({ ...base, makeup_credits: undefined }, [], null, openingDay).makeupCredits).toBe(0);
    const many = Array.from({ length: 30 }, (_, index) => mark("m", `2026-11-${String(index + 1).padStart(2, "0")}`, "notified_absence"));
    expect(predictOpening({ ...base, makeup_credits: 90 }, many, null, openingDay).makeupCredits).toBe(100);
  });

  test("a previsão ignora um acerto já confirmado, para mostrar o que o treino deixou", () => {
    const confirmed = { ...base, opening_balance_on: openingDay, opening_package_balance: null, opening_makeup_credits: 0 };
    expect(predictOpening(confirmed, [mark("m", "2026-11-09", "notified_absence")], null, openingDay).makeupCredits).toBe(1);
  });
});

describe("estado da tela", () => {
  test("começa carregando e falha sem perder o que estava na tela", () => {
    expect(initialOpeningBalance.status).toBe("loading");
    const state = loaded();
    const reloading = startReloadingOpening(state);
    expect(reloading.status).toBe("loading");
    expect(applyOpeningLoad(reloading, { ok: false })).toMatchObject({ status: "failed", students: state.students });
  });

  test("sem mês de treino, não há alunos para acertar", () => {
    const state = applyOpeningLoad(initialOpeningBalance, { ok: true, trainingMonth: null, students: [base], marks: [], makeupDeadlineDays: 30 });
    expect(state).toMatchObject({ status: "ready", trainingMonth: null, makeupDeadlineDays: 30, students: [], drafts: {} });
  });

  test("cada aluno começa com o previsto, ou com o que já foi confirmado", () => {
    const confirmed = { ...packaged, opening_balance_on: openingDay, opening_package_balance: 2, opening_makeup_credits: 4 };
    const confirmedWithoutPackage = { ...base, opening_balance_on: openingDay, opening_package_balance: null, opening_makeup_credits: undefined };
    const state = loaded([confirmed, confirmedWithoutPackage, late], [mark("m", "2026-11-09", "notified_absence")]);
    expect(state.students.map((student) => student.id)).toEqual(["m", "p"]);
    expect(state.predictions.p).toEqual({ packageBalance: 3, makeupCredits: 0 });
    expect(openingDraftOf(state, "p")).toEqual({ packageBalance: "2", makeupCredits: "4" });
    expect(openingDraftOf(state, "m")).toEqual({ packageBalance: "", makeupCredits: "0" });
    expect(openingDraftOf(loaded([{ ...packaged, opening_balance_on: openingDay, opening_package_balance: null, opening_makeup_credits: 1 }]), "p")).toEqual({ packageBalance: "3", makeupCredits: "1" });
    expect(openingDraftOf(loaded([base]), "m")).toEqual({ packageBalance: "", makeupCredits: "0" });
  });

  test("o que o professor digitou continua depois de carregar de novo", () => {
    const typed = changeOpeningDraft({ ...loaded(), message: "x", notice: "y" }, "p", "packageBalance", "0");
    expect(typed).toMatchObject({ message: null, notice: null });
    const load: OpeningBalanceLoad = { ok: true, trainingMonth: november, students: [packaged], marks: [], makeupDeadlineDays: null };
    expect(openingDraftOf(applyOpeningLoad(typed, load), "p").packageBalance).toBe("0");
    expect(openingDraftOf(changeOpeningDraft(initialOpeningBalance, "z", "makeupCredits", "2"), "z")).toEqual({ packageBalance: "", makeupCredits: "2" });
  });
});

describe("conferir os valores", () => {
  test("o pacote vai de 0 ao tamanho do pacote e os créditos de 0 a 100", () => {
    expect(validateOpening(packaged, { packageBalance: " 4 ", makeupCredits: "100" }, openingDay)).toEqual({ ok: true, row: { opening_balance_on: openingDay, opening_package_balance: 4, opening_makeup_credits: 100 } });
    expect(validateOpening(packaged, { packageBalance: "5", makeupCredits: "101" }, openingDay)).toEqual({ ok: false, errors: { packageBalance: packageBalanceInvalid(4), makeupCredits: openingBalanceMessages.creditsInvalid } });
    expect(validateOpening(packaged, { packageBalance: "-1", makeupCredits: "1" }, openingDay)).toEqual({ ok: false, errors: { packageBalance: "Escreva quantas aulas sobram no pacote, de 0 a 4." } });
    expect(validateOpening({ ...packaged, package_lessons: 200 }, { packageBalance: "150", makeupCredits: "0" }, openingDay).ok).toBe(false);
  });

  test("quem não paga por pacote só confirma os créditos", () => {
    expect(validateOpening(base, { packageBalance: "abc", makeupCredits: "2" }, openingDay)).toEqual({ ok: true, row: { opening_balance_on: openingDay, opening_package_balance: null, opening_makeup_credits: 2 } });
    expect(validateOpening(base, { packageBalance: "", makeupCredits: "" }, openingDay)).toEqual({ ok: false, errors: { makeupCredits: openingBalanceMessages.creditsInvalid } });
  });
});

describe("guardar o acerto", () => {
  const row = { opening_balance_on: openingDay, opening_package_balance: null, opening_makeup_credits: 0 };

  test("grava o saldo só do aluno escolhido", async () => {
    const { client, calls } = updateClient();
    expect(await saveOpeningBalance(client, "m", row)).toBe(true);
    expect(calls).toEqual([{ row, id: "m" }]);
  });

  test("erro, resposta vazia ou queda de rede viram falha", async () => {
    expect(await saveOpeningBalance(updateClient(async () => ({ data: null, error: { message: "x" } })).client, "m", row)).toBe(false);
    expect(await saveOpeningBalance(updateClient(async () => ({ data: null, error: null })).client, "m", row)).toBe(false);
    expect(await saveOpeningBalance(updateClient(async () => Promise.reject(new Error("rede"))).client, "m", row)).toBe(false);
  });

  test("confirma todos os alunos de uma vez e a contagem parte desses valores", async () => {
    const { client, calls } = updateClient();
    const state = changeOpeningDraft(loaded(), "p", "packageBalance", "2");
    const done = await submitOpeningBalance(client, state);
    expect(calls).toEqual([
      { row: { opening_balance_on: openingDay, opening_package_balance: null, opening_makeup_credits: 0 }, id: "m" },
      { row: { opening_balance_on: openingDay, opening_package_balance: 2, opening_makeup_credits: 0 }, id: "p" },
    ]);
    expect(done.students.every(isOpeningConfirmed)).toBe(true);
    expect(done.notice).toBe("Saldo de 2 alunos confirmados. A contagem de dezembro parte destes valores.");
    expect(done.message).toBeNull();
  });

  test("valor errado não grava nada e marca o aluno", async () => {
    const { client, calls } = updateClient();
    const done = await submitOpeningBalance(client, changeOpeningDraft(loaded(), "p", "packageBalance", "9"));
    expect(calls).toEqual([]);
    expect(done.errors).toEqual({ p: { packageBalance: packageBalanceInvalid(4) } });
    expect(done.message).toBe(openingBalanceMessages.invalid);
  });

  test("falha num aluno guarda os outros e diz quem faltou", async () => {
    const { client } = updateClient(async (id) => (id === "p" ? { data: null, error: { message: "x" } } : { data: [{ id }], error: null }));
    const done = await submitOpeningBalance(client, loaded());
    expect(done.students.find((student) => student.id === "m")?.opening_balance_on).toBe(openingDay);
    expect(isOpeningConfirmed(done.students.find((student) => student.id === "p")!)).toBe(false);
    expect(done.notice).toBe("Saldo de 1 aluno confirmado. A contagem de dezembro parte destes valores.");
    expect(done.message).toBe("Não deu para guardar o saldo de Rui Dias. Confira a internet e toque em Confirmar o saldo de novo.");
  });

  test("falha em todos não mostra confirmação", async () => {
    const { client } = updateClient(async () => ({ data: null, error: { message: "x" } }));
    expect((await submitOpeningBalance(client, loaded([base]))).notice).toBeNull();
  });

  test("sem treino ou sem alunos, nada acontece", async () => {
    const { client, calls } = updateClient();
    expect(await submitOpeningBalance(client, initialOpeningBalance)).toBe(initialOpeningBalance);
    const empty = loaded([]);
    expect(await submitOpeningBalance(client, empty)).toBe(empty);
    expect(calls).toEqual([]);
  });
});

describe("carregar o acerto", () => {
  function fullClient(results: Partial<Record<"getting_started" | "students" | "teacher_rules" | "lesson_marks", { data: unknown; error: Failure }>> = {}) {
    const lte = vi.fn(() => marksChain);
    const marksChain = { order: () => marksChain, range: async () => results.lesson_marks ?? { data: [mark("p", "2026-11-02", "given")], error: null } };
    const tables: Record<string, unknown> = {
      getting_started: { select: () => ({ maybeSingle: async () => results.getting_started ?? { data: { started_at: "2026-11-05T12:00:00Z" }, error: null } }) },
      students: { select: async () => results.students ?? { data: [packaged], error: null } },
      teacher_rules: { select: () => ({ maybeSingle: async () => results.teacher_rules ?? { data: null, error: null } }) },
      lesson_marks: { select: () => ({ lte }) },
    };
    return { client: { from: (table: string) => tables[table] } as unknown as LessonsClient, lte };
  }

  test("junta o mês de treino, os alunos, o prazo da reposição e as marcações até o fim do treino", async () => {
    const { client, lte } = fullClient();
    expect(await loadOpeningBalance(client)).toMatchObject({ ok: true, trainingMonth: november, students: [packaged], marks: [mark("p", "2026-11-02", "given")] });
    expect(lte).toHaveBeenCalledWith("lesson_date", "2026-11-30");
  });

  test("sem entrada nos primeiros passos, não busca marcações", async () => {
    const { client, lte } = fullClient({ getting_started: { data: null, error: null } });
    expect(await loadOpeningBalance(client)).toMatchObject({ ok: true, trainingMonth: null, marks: [] });
    expect(lte).not.toHaveBeenCalled();
  });

  test("falha em qualquer parte vira falha", async () => {
    expect(await loadOpeningBalance(fullClient({ getting_started: { data: null, error: { message: "x" } } }).client)).toEqual({ ok: false });
    expect(await loadOpeningBalance(fullClient({ students: { data: null, error: { message: "x" } } }).client)).toEqual({ ok: false });
    expect(await loadOpeningBalance(fullClient({ teacher_rules: { data: null, error: { message: "x" } } }).client)).toEqual({ ok: false });
    expect(await loadOpeningBalance(fullClient({ lesson_marks: { data: null, error: { message: "x" } } }).client)).toEqual({ ok: false });
  });
});

describe("textos", () => {
  test("explicam o acerto, quando ele abre e o prazo dos créditos", () => {
    expect(describeOpeningIntro(november)).toBe("O treino de novembro acabou. A contagem real de dezembro começa do saldo abaixo. O Quitô calculou cada valor com as aulas marcadas no treino: confirme ou corrija o que estiver diferente.");
    expect(describeOpeningNotYet(november)).toBe("O acerto do saldo abre em 1 de dezembro, quando começa o primeiro mês cobrado. Até lá, marque as aulas do treino normalmente.");
    expect(describeCreditsDeadline(november, null)).toBe("Os créditos não têm prazo.");
    expect(describeCreditsDeadline(november, 30)).toBe("Os créditos confirmados valem até 31 de dezembro, pelo prazo de reposição contado do início do mês.");
    expect(describePredictedPackage(1)).toBe("Previsto pelo Quitô: 1 aula.");
    expect(describePredictedCredits(2)).toBe("Previsto pelo Quitô: 2 créditos.");
  });
});

describe("migração", () => {
  test("guarda o dia, o pacote e os créditos do acerto, com os mesmos limites do saldo inicial", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261107050000_student_opening_balance.sql"), "utf8");
    expect(migration).toContain('add column "opening_balance_on" date');
    expect(migration).toContain('check ("opening_package_balance" between 0 and 100)');
    expect(migration).toContain('check ("opening_makeup_credits" between 0 and 100)');
    expect(migration).toContain('check (("opening_balance_on" is null) = ("opening_makeup_credits" is null))');
  });
});
