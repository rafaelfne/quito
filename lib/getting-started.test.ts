import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  applyGettingStartedLoad,
  currentStep,
  describeRemaining,
  finishGettingStarted,
  gettingStartedPath,
  initialGettingStarted,
  loadGettingStarted,
  noReminder,
  openGettingStarted,
  remainingSteps,
  reminderFor,
  saveBaselineDelay,
  startGettingStarted,
  startReloadingGettingStarted,
  tracksReminder,
  type GettingStartedClient,
  type GettingStartedLoad,
  type GettingStartedStep,
} from "./getting-started";
import type { Student } from "./students";

type Failure = { message: string } | null;
type RecordResult = { data: { finished_at: string | null; baseline_delay_days: number | null } | null; error: Failure };
type StudentsResult = { data: Student[] | null; error: Failure };

const complete: Student = { id: "p", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const withoutBilling: Student = { ...complete, id: "m", name: "Maria", billing_kind: null, billing_amount_cents: null };
const withoutSchedule: Student = { ...complete, id: "j", name: "João", lesson_weekday: null, lesson_time: null };

function fakeClient(overrides: { record?: () => Promise<RecordResult>; students?: () => Promise<StudentsResult>; upsert?: () => Promise<{ error: Failure }> } = {}) {
  const maybeSingle = vi.fn(overrides.record ?? (async () => ({ data: { finished_at: null, baseline_delay_days: null }, error: null } as RecordResult)));
  const students = vi.fn(overrides.students ?? (async () => ({ data: [], error: null } as StudentsResult)));
  const upsert = vi.fn(overrides.upsert ?? (async () => ({ error: null as Failure })));
  const from = vi.fn((name: string) => (name === "students" ? { select: students } : { select: () => ({ maybeSingle }), upsert }));
  return { client: { from } as unknown as GettingStartedClient, from, maybeSingle, students, upsert };
}

function step(id: string, done: boolean): GettingStartedStep {
  return { id, title: `Passo ${id}`, hint: "dica", path: "/students", done };
}

async function progressOf(load: Promise<GettingStartedLoad>) {
  const result = await load;
  if (!result.ok) throw new Error("não abriu");
  return result.progress;
}

describe("tabela no banco", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261104030000_getting_started.sql"), "utf8");

  test("guarda uma linha por professor, com o início e o fim da sequência", () => {
    expect(migration).toContain('"owner_id" uuid primary key default auth.uid()');
    expect(migration).toContain('"started_at" timestamptz not null default now()');
    expect(migration).toContain('"finished_at" timestamptz');
    expect(readFileSync(join(process.cwd(), "supabase/migrations/20261104040000_getting_started_baseline_delay.sql"), "utf8")).toContain('"baseline_delay_days" integer check');
  });
});

describe("loadGettingStarted", () => {
  test("quem nunca abriu a sequência aparece como não começado, com tudo por fazer", async () => {
    const { client, from } = fakeClient({ record: async () => ({ data: null, error: null }) });
    const progress = await progressOf(loadGettingStarted(client));
    expect(from).toHaveBeenCalledWith("getting_started");
    expect(progress.started).toBe(false);
    expect(progress.finished).toBe(false);
    expect(progress.steps.map((item) => item.done)).toEqual([false, false, false]);
  });

  test("os passos saem dos dados de verdade: aluno sem cobrança ou sem horário deixa o segundo passo pendente", async () => {
    for (const incomplete of [withoutBilling, withoutSchedule]) {
      const { client } = fakeClient({ students: async () => ({ data: [complete, incomplete], error: null }) });
      const progress = await progressOf(loadGettingStarted(client));
      expect(progress.steps.map((item) => item.done)).toEqual([false, true, false]);
    }
  });

  test("o passo de cadastrar alunos lembra que dá para colar a lista", async () => {
    const { client } = fakeClient();
    const progress = await progressOf(loadGettingStarted(client));
    expect(progress.steps.find((item) => item.id === "students")?.hint).toContain("colar a lista");
  });

  test("todos os alunos completos fecham os dois passos", async () => {
    const { client } = fakeClient({ students: async () => ({ data: [complete], error: null }) });
    const progress = await progressOf(loadGettingStarted(client));
    expect(progress.steps.map((item) => item.done)).toEqual([false, true, true]);
    expect(progress.started).toBe(true);
    expect(progress.finished).toBe(false);
  });

  test("quem terminou continua terminado, sem buscar os alunos", async () => {
    const { client, students } = fakeClient({ record: async () => ({ data: { finished_at: "2026-11-04T10:00:00Z", baseline_delay_days: null }, error: null }) });
    const progress = await progressOf(loadGettingStarted(client));
    expect(progress.finished).toBe(true);
    expect(remainingSteps(progress.steps)).toBe(0);
    expect(students).not.toHaveBeenCalled();
  });

  test("a resposta de partida fica disponível e marca a pergunta como feita", async () => {
    const { client } = fakeClient({ record: async () => ({ data: { finished_at: null, baseline_delay_days: 7 }, error: null }) });
    const progress = await progressOf(loadGettingStarted(client));
    expect(progress.baselineDelayDays).toBe(7);
    expect(progress.steps[0].done).toBe(true);
  });

  test("erro do banco, queda da conexão ou lista de alunos que não abre viram falha", async () => {
    expect(await loadGettingStarted(fakeClient({ record: async () => ({ data: null, error: { message: "negado" } }) }).client)).toEqual({ ok: false });
    expect(
      await loadGettingStarted(
        fakeClient({
          record: async () => {
            throw new Error("sem rede");
          },
        }).client,
      ),
    ).toEqual({ ok: false });
    expect(await loadGettingStarted(fakeClient({ students: async () => ({ data: null, error: { message: "negado" } }) }).client)).toEqual({ ok: false });
  });
});

describe("gravar o início e o fim", () => {
  test("começar não troca a data de quem já começou", async () => {
    const { client, upsert } = fakeClient();
    expect(await startGettingStarted(client)).toBe(true);
    expect(upsert).toHaveBeenCalledWith({ started_at: expect.any(String) }, { onConflict: "owner_id", ignoreDuplicates: true });
  });

  test("terminar grava só a data do fim", async () => {
    const { client, upsert } = fakeClient();
    expect(await finishGettingStarted(client)).toBe(true);
    expect(upsert).toHaveBeenCalledWith({ finished_at: expect.any(String) }, { onConflict: "owner_id" });
  });

  test("a resposta aceita dias inteiros entre zero e 365", async () => {
    const { client, upsert } = fakeClient();
    expect(await saveBaselineDelay(client, 0)).toBe(true);
    expect(upsert).toHaveBeenCalledWith({ baseline_delay_days: 0 }, { onConflict: "owner_id" });
    expect(await saveBaselineDelay(client, 1.5)).toBe(false);
    expect(await saveBaselineDelay(client, 366)).toBe(false);
  });

  test("erro do banco ou queda da conexão vira falha", async () => {
    expect(await finishGettingStarted(fakeClient({ upsert: async () => ({ error: { message: "negado" } }) }).client)).toBe(false);
    expect(
      await startGettingStarted(
        fakeClient({
          upsert: async () => {
            throw new Error("sem rede");
          },
        }).client,
      ),
    ).toBe(false);
  });
});

describe("openGettingStarted", () => {
  test("na primeira abertura grava o começo, e na volta não grava de novo", async () => {
    const first = fakeClient({ record: async () => ({ data: null, error: null }) });
    expect(await progressOf(openGettingStarted(first.client))).toMatchObject({ started: true, finished: false });
    expect(first.upsert).toHaveBeenCalledTimes(1);
    const back = fakeClient();
    expect(await progressOf(openGettingStarted(back.client))).toMatchObject({ started: true, finished: false });
    expect(back.upsert).not.toHaveBeenCalled();
  });

  test("com todos os passos feitos, grava o fim uma vez", async () => {
    const { client, upsert } = fakeClient({ students: async () => ({ data: [complete], error: null }), record: async () => ({ data: { finished_at: null, baseline_delay_days: 0 }, error: null }) });
    expect((await progressOf(openGettingStarted(client))).finished).toBe(true);
    expect(upsert).toHaveBeenCalledWith({ finished_at: expect.any(String) }, { onConflict: "owner_id" });
    const done = fakeClient({ record: async () => ({ data: { finished_at: "2026-11-04T10:00:00Z", baseline_delay_days: null }, error: null }) });
    await openGettingStarted(done.client);
    expect(done.upsert).not.toHaveBeenCalled();
  });

  test("se o fim não gravar, os passos seguem feitos e o Quitô tenta de novo na próxima abertura", async () => {
    const { client } = fakeClient({ students: async () => ({ data: [complete], error: null }), record: async () => ({ data: { finished_at: null, baseline_delay_days: 0 }, error: null }), upsert: async () => ({ error: { message: "negado" } }) });
    const progress = await progressOf(openGettingStarted(client));
    expect(progress.finished).toBe(false);
    expect(remainingSteps(progress.steps)).toBe(0);
  });

  test("falha ao ler ou ao gravar o começo vira falha", async () => {
    expect(await openGettingStarted(fakeClient({ record: async () => ({ data: null, error: { message: "negado" } }) }).client)).toEqual({ ok: false });
    expect(await openGettingStarted(fakeClient({ record: async () => ({ data: null, error: null }), upsert: async () => ({ error: { message: "negado" } }) }).client)).toEqual({ ok: false });
  });
});

describe("quanto falta", () => {
  test("conta os passos pendentes e aponta o primeiro deles", () => {
    const steps = [step("a", true), step("b", false), step("c", false)];
    expect(remainingSteps(steps)).toBe(2);
    expect(currentStep(steps)?.id).toBe("b");
    expect(currentStep([step("a", true)])).toBeUndefined();
  });

  test("escreve no singular e no plural", () => {
    expect(describeRemaining([step("a", true), step("b", false)])).toBe("Falta 1 de 2 passos.");
    expect(describeRemaining([step("a", false), step("b", false)])).toBe("Faltam 2 de 2 passos.");
    expect(describeRemaining([step("a", false)])).toBe("Falta 1 de 1 passo.");
  });
});

describe("estado da tela", () => {
  test("começa carregando, e tentar de novo volta a carregar", () => {
    expect(initialGettingStarted.status).toBe("loading");
    expect(startReloadingGettingStarted({ status: "failed", steps: [] }).status).toBe("loading");
  });

  test("a resposta mostra os passos, e a falha avisa", () => {
    const steps = [step("a", true)];
    expect(applyGettingStartedLoad(initialGettingStarted, { ok: true, progress: { started: true, finished: false, baselineDelayDays: null, steps } })).toEqual({ status: "ready", steps });
    expect(applyGettingStartedLoad(initialGettingStarted, { ok: false }).status).toBe("failed");
  });
});

describe("lembrete", () => {
  const steps = [step("a", false)];
  const pending: GettingStartedLoad = { ok: true, progress: { started: true, finished: false, baselineDelayDays: null, steps } };
  const neverStarted: GettingStartedLoad = { ok: true, progress: { started: false, finished: false, baselineDelayDays: null, steps } };
  const finished: GettingStartedLoad = { ok: true, progress: { started: true, finished: true, baselineDelayDays: null, steps: [step("a", true)] } };

  test("só olha o progresso na tela inicial e nas telas dos passos", () => {
    expect(tracksReminder("/notes")).toBe(true);
    expect(tracksReminder("/students")).toBe(true);
    expect(tracksReminder("/lessons")).toBe(false);
    expect(tracksReminder(gettingStartedPath)).toBe(false);
  });

  test("a primeira entrada leva para a sequência só a partir da tela inicial", () => {
    expect(reminderFor("/notes", neverStarted)).toEqual({ kind: "first-entry" });
    expect(reminderFor("/students", neverStarted)).toEqual(noReminder);
  });

  test("com passo pendente, a tela inicial mostra quanto falta e a tela do passo oferece a volta", () => {
    expect(reminderFor("/notes", pending)).toEqual({ kind: "progress", steps });
    expect(reminderFor("/students", pending)).toEqual({ kind: "back" });
    expect(reminderFor("/lessons", pending)).toEqual(noReminder);
  });

  test("quem terminou não é mais lembrado, e falha ao carregar não atrapalha a tela", () => {
    expect(reminderFor("/notes", finished)).toEqual(noReminder);
    expect(reminderFor("/notes", { ok: false })).toEqual(noReminder);
  });
});
