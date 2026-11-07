import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { creditStatuses, initialLessons, type LessonMark, type LessonsClient, type LessonsState, type MonthLesson } from "./lessons";
import {
  beginMakeup,
  changeMakeupDraft,
  creditExpiresOn,
  creditKey,
  describeCredit,
  describeLessonCredit,
  finishMakeup,
  makeupDateDraft,
  makeupDateError,
  makeupMessages,
  monthMakeups,
  openCredits,
  persistMakeup,
  rejectMakeup,
  type LessonCredit,
} from "./makeups";
import type { Student } from "./students";

const november2026 = { year: 2026, month: 11 };
const pedro: Student = { id: "p", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const bia: Student = { ...pedro, id: "b", name: "Bia Reis" };

function mark(overrides: Partial<LessonMark> = {}): LessonMark {
  return { student_id: "p", lesson_date: "2026-11-02", status: "notified_absence", makeup_date: null, ...overrides };
}

const credit: LessonCredit = { studentId: "p", studentName: "Pedro Lima", absenceDate: "2026-11-02", status: "notified_absence", expiresOn: "2026-12-02" };
const key = creditKey(credit);

function ready(overrides: Partial<LessonsState> = {}): LessonsState {
  return { ...initialLessons(november2026), status: "ready", students: [pedro], marks: [mark()], ...overrides };
}

const lesson: MonthLesson = { studentId: "p", studentName: "Pedro Lima", date: "2026-11-02", time: "15:00", status: "notified_absence", makeupDate: null };

describe("prazo do crédito", () => {
  test("sem prazo, não vence", () => {
    expect(creditExpiresOn("2026-11-02", null)).toBeNull();
  });

  test("conta os dias a partir da falta, atravessando mês e ano", () => {
    expect(creditExpiresOn("2026-11-02", 30)).toBe("2026-12-02");
    expect(creditExpiresOn("2026-12-20", 15)).toBe("2027-01-04");
  });
});

describe("openCredits", () => {
  test("a falta avisada e a falta do professor viram crédito", () => {
    const credits = openCredits([pedro], [mark(), mark({ lesson_date: "2026-11-09", status: "teacher_absence" })], null, "2026-11-20");
    expect(credits.map((item) => item.status)).toEqual(["notified_absence", "teacher_absence"]);
  });

  test("aula dada, falta sem aviso e crédito já usado não contam", () => {
    const marks = [mark({ status: "given" }), mark({ lesson_date: "2026-11-09", status: "unnotified_absence" }), mark({ lesson_date: "2026-11-16", makeup_date: "2026-11-18" })];
    expect(openCredits([pedro], marks, null, "2026-11-20")).toEqual([]);
  });

  test("depois do acerto do saldo, as faltas do treino saem dos créditos e as novas continuam", () => {
    const confirmed = { ...pedro, opening_balance_on: "2026-12-01", opening_package_balance: null, opening_makeup_credits: 1 };
    const marks = [mark(), mark({ lesson_date: "2026-12-07" })];
    expect(openCredits([confirmed], marks, null, "2026-12-10").map((item) => item.absenceDate)).toEqual(["2026-12-07"]);
    expect(openCredits([confirmed], [mark()], null, "2026-11-30")).toHaveLength(1);
  });

  test("sem prazo, o crédito fica aberto para sempre", () => {
    expect(openCredits([pedro], [mark()], null, "2030-01-01")).toHaveLength(1);
  });

  test("vale até o último dia do prazo e some no dia seguinte", () => {
    expect(openCredits([pedro], [mark()], 30, "2026-12-02")).toEqual([credit]);
    expect(openCredits([pedro], [mark()], 30, "2026-12-03")).toEqual([]);
  });

  test("o crédito que venceu depois de usado continua usado, sem voltar a aparecer", () => {
    expect(openCredits([pedro], [mark({ makeup_date: "2026-11-10" })], 1, "2026-11-03")).toEqual([]);
  });

  test("ordena da falta mais antiga para a mais nova e, no mesmo dia, pelo nome", () => {
    const marks = [mark({ lesson_date: "2026-11-09" }), mark(), mark({ student_id: "b" })];
    expect(openCredits([pedro, bia], marks, null, "2026-11-20").map((item) => [item.absenceDate, item.studentName])).toEqual([
      ["2026-11-02", "Bia Reis"],
      ["2026-11-02", "Pedro Lima"],
      ["2026-11-09", "Pedro Lima"],
    ]);
  });

  test("ignora marcação de aluno que não está na lista", () => {
    expect(openCredits([], [mark()], null, "2026-11-20")).toEqual([]);
  });
});

describe("monthMakeups", () => {
  test("a reposição aparece no mês em que acontece, mesmo com a falta em outro mês", () => {
    const marks = [mark({ lesson_date: "2026-10-26", makeup_date: "2026-11-05" })];
    expect(monthMakeups([pedro], marks, november2026)).toEqual([{ studentId: "p", studentName: "Pedro Lima", date: "2026-11-05", absenceDate: "2026-10-26" }]);
    expect(monthMakeups([pedro], marks, { year: 2026, month: 10 })).toEqual([]);
  });

  test("crédito aberto e aluno fora da lista não geram reposição", () => {
    expect(monthMakeups([pedro], [mark()], november2026)).toEqual([]);
    expect(monthMakeups([], [mark({ makeup_date: "2026-11-05" })], november2026)).toEqual([]);
  });
});

describe("textos", () => {
  test("o crédito conta de que falta veio e até quando vale", () => {
    expect(describeCredit(credit)).toBe("Falta avisada de 2 de novembro, vale até 2 de dezembro");
    expect(describeCredit({ ...credit, status: "teacher_absence", expiresOn: null })).toBe("Falta do professor de 2 de novembro, sem prazo");
  });

  test("a falta na lista conta como está o crédito dela", () => {
    expect(describeLessonCredit(lesson, null, "2026-11-03")).toBe("Virou crédito de reposição, sem prazo.");
    expect(describeLessonCredit(lesson, 30, "2026-11-03")).toBe("Virou crédito de reposição, vale até 2 de dezembro.");
    expect(describeLessonCredit(lesson, 30, "2026-12-03")).toBe("O crédito de reposição venceu em 2 de dezembro.");
    expect(describeLessonCredit({ ...lesson, makeupDate: "2026-11-05" }, 1, "2026-12-03")).toContain("Reposta em 5 de novembro.");
  });

  test("aula sem marcar, dada ou falta sem aviso não falam de crédito", () => {
    expect(describeLessonCredit({ ...lesson, status: null }, null, "2026-11-03")).toBeNull();
    expect(describeLessonCredit({ ...lesson, status: "given" }, null, "2026-11-03")).toBeNull();
    expect(describeLessonCredit({ ...lesson, status: "unnotified_absence" }, null, "2026-11-03")).toBeNull();
  });
});

describe("dia da reposição", () => {
  test("sugere hoje, ou o dia da falta quando ela ainda vai acontecer", () => {
    expect(makeupDateDraft(ready(), credit, "2026-11-10")).toBe("2026-11-10");
    expect(makeupDateDraft(ready(), credit, "2026-10-30")).toBe("2026-11-02");
  });

  test("usa o dia que o professor escolheu", () => {
    expect(makeupDateDraft(ready({ makeupDrafts: { [key]: "2026-11-20" } }), credit, "2026-11-10")).toBe("2026-11-20");
  });

  test("aceita do dia da falta até o último dia do prazo", () => {
    expect(makeupDateError(credit, "2026-11-02")).toBeNull();
    expect(makeupDateError(credit, "2026-12-02")).toBeNull();
  });

  test("recusa dia vazio, antes da falta ou depois do prazo", () => {
    expect(makeupDateError(credit, "")).toBe(makeupMessages.dateMissing);
    expect(makeupDateError(credit, "2026-11-01")).toBe(makeupMessages.dateBeforeAbsence);
    expect(makeupDateError(credit, "2026-12-03")).toBe("O crédito vale até 2 de dezembro. Escolha um dia até lá.");
  });

  test("sem prazo, qualquer dia depois da falta serve", () => {
    expect(makeupDateError({ ...credit, expiresOn: null }, "2030-01-01")).toBeNull();
  });
});

describe("persistMakeup", () => {
  function fake(result: { error: { message: string } | null }) {
    const eq = vi.fn((column: string) => (column === "lesson_date" ? Promise.resolve(result) : { eq }));
    const update = vi.fn(() => ({ eq }));
    return { client: { from: vi.fn(() => ({ update })) } as unknown as LessonsClient, update, eq };
  }

  test("guarda o dia só na falta daquele aluno", async () => {
    const { client, update, eq } = fake({ error: null });
    expect(await persistMakeup(client, credit, "2026-11-05")).toBe(true);
    expect(update).toHaveBeenCalledWith({ makeup_date: "2026-11-05" });
    expect(eq).toHaveBeenCalledWith("student_id", "p");
    expect(eq).toHaveBeenCalledWith("lesson_date", "2026-11-02");
  });

  test("erro do banco devolve falso", async () => {
    expect(await persistMakeup(fake({ error: { message: "x" } }).client, credit, null)).toBe(false);
  });

  test("exceção devolve falso", async () => {
    const client = { from: () => { throw new Error("sem rede"); } } as unknown as LessonsClient;
    expect(await persistMakeup(client, credit, null)).toBe(false);
  });
});

describe("estado da tela", () => {
  test("trocar o dia guarda o rascunho e limpa o aviso daquele crédito", () => {
    const next = changeMakeupDraft(ready({ makeupErrors: { [key]: "x", outra: "y" } }), credit, "2026-11-20");
    expect(next.makeupDrafts[key]).toBe("2026-11-20");
    expect(next.makeupErrors).toEqual({ outra: "y" });
  });

  test("dia recusado avisa naquele crédito", () => {
    expect(rejectMakeup(ready(), credit, "x").makeupErrors[key]).toBe("x");
  });

  test("usar o crédito aparece na hora, trava e não mexe nas outras faltas", () => {
    const other = mark({ lesson_date: "2026-11-09" });
    const next = beginMakeup(ready({ marks: [mark(), other], makeupErrors: { [key]: "x" } }), credit, "2026-11-05");
    expect(next.marks).toEqual([mark({ makeup_date: "2026-11-05" }), other]);
    expect(next.pending).toEqual([key]);
    expect(next.makeupErrors).toEqual({});
  });

  test("gravou: destrava e mantém", () => {
    const next = finishMakeup(beginMakeup(ready(), credit, "2026-11-05"), credit, null, true);
    expect(next.pending).toEqual([]);
    expect(next.marks[0].makeup_date).toBe("2026-11-05");
  });

  test("não gravou: volta como estava e avisa", () => {
    const next = finishMakeup(beginMakeup(ready(), credit, "2026-11-05"), credit, null, false);
    expect(next.pending).toEqual([]);
    expect(next.marks[0].makeup_date).toBeNull();
    expect(next.makeupErrors[key]).toBe(makeupMessages.saveFailed);
  });

  test("resposta que chega depois de trocar de mês é ignorada", () => {
    const state = ready();
    expect(finishMakeup(state, credit, null, false)).toBe(state);
  });
});

describe("banco", () => {
  test("o banco só aceita reposição das faltas que viram crédito, no dia da falta ou depois", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261103060000_lesson_makeups.sql"), "utf8");
    for (const status of creditStatuses) expect(migration).toContain(`'${status}'`);
    expect(migration).toContain('"makeup_date" >= "lesson_date"');
  });
});
