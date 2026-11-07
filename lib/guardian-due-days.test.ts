import { describe, expect, test, vi } from "vitest";
import {
  applyGuardianDueDaysLoad,
  changeGuardianDueDay,
  clearGuardianDueDay,
  describeGuardianDue,
  describeGuardianStudents,
  dueDayForGuardian,
  guardianDueDaysMessages,
  guardianDueGroupsFrom,
  initialGuardianDueDays,
  loadGuardianDueDays,
  overridesByPhone,
  saveGuardianDueDay,
  startReloadingGuardianDueDays,
  submitGuardianDueDay,
  validateGuardianDueDay,
  type GuardianDueDaysClient,
  type GuardianDueDaysState,
  type GuardianDueDayRow,
} from "./guardian-due-days";
import type { Student } from "./students";

type Failure = { message: string } | null;

const anaPhone = "11987654321";
const biaPhone = "2134567890";

const pedro: Student = {
  id: "1",
  name: "Pedro Lima",
  gender: "male", called_as: null, guardian_name: "Ana Lima",
  guardian_phone: anaPhone,
  billing_kind: "monthly",
  billing_amount_cents: 30000,
  package_lessons: null,
  lesson_weekday: 1,
  lesson_time: "15:00:00",
};

const lia: Student = { ...pedro, id: "2", name: "Lia Lima" };

const alvaro: Student = {
  id: "3",
  name: "Álvaro Reis",
  gender: "male", called_as: null, guardian_name: "Bia Reis",
  guardian_phone: biaPhone,
  billing_kind: "per_class",
  billing_amount_cents: 8000,
  package_lessons: null,
  lesson_weekday: 2,
  lesson_time: "16:00:00",
};

const overrideRow: GuardianDueDayRow = { guardian_phone: anaPhone, due_day: 10 };

function fakeClient(overrides: {
  load?: () => Promise<{ data: GuardianDueDayRow[] | null; error: Failure }>;
  upsert?: () => Promise<{ error: Failure }>;
  delete?: () => Promise<{ error: Failure }>;
} = {}) {
  const eq = vi.fn(overrides.delete ?? (async () => ({ error: null as Failure })));
  const del = vi.fn(() => ({ eq }));
  const upsert = vi.fn(overrides.upsert ?? (async () => ({ error: null as Failure })));
  const select = vi.fn(overrides.load ?? (async () => ({ data: [] as GuardianDueDayRow[], error: null as Failure })));
  const from = vi.fn(() => ({ select, upsert, delete: del }));
  return { client: { from } as unknown as GuardianDueDaysClient, from, select, upsert, del, eq };
}

function ready(groups = guardianDueGroupsFrom([pedro, lia, alvaro], overridesByPhone([overrideRow]))): GuardianDueDaysState {
  return { ...initialGuardianDueDays, status: "ready", groups, defaultDueDay: 5 };
}

describe("dueDayForGuardian", () => {
  test("usa o dia do responsável quando existe, senão o padrão", () => {
    expect(dueDayForGuardian(5, 10)).toBe(10);
    expect(dueDayForGuardian(5, null)).toBe(5);
    expect(dueDayForGuardian(5, undefined)).toBe(5);
  });
});

describe("guardianDueGroupsFrom", () => {
  test("junta irmãos no mesmo responsável e mostra o dia só quando há troca", () => {
    const groups = guardianDueGroupsFrom([lia, alvaro, pedro], overridesByPhone([overrideRow]));
    expect(groups).toEqual([
      { phone: biaPhone, guardianName: "Bia Reis", studentNames: ["Álvaro Reis"], dueDay: "" },
      { phone: anaPhone, guardianName: "Ana Lima", studentNames: ["Lia Lima", "Pedro Lima"], dueDay: "10" },
    ]);
  });
});

describe("describeGuardianStudents", () => {
  test("lista um, dois ou vários alunos", () => {
    expect(describeGuardianStudents(["Pedro"])).toBe("Aluno: Pedro.");
    expect(describeGuardianStudents(["Pedro", "Lia"])).toBe("Alunos: Pedro e Lia.");
    expect(describeGuardianStudents(["Pedro", "Lia", "Rui"])).toBe("Alunos: Pedro, Lia e Rui.");
  });
});

describe("describeGuardianDue", () => {
  test("com o campo vazio, usa o dia padrão", () => {
    expect(describeGuardianDue("2026-11-04", "", 5)).toBe("Próximo vencimento: 5 de novembro.");
  });

  test("com o dia do responsável, usa esse dia", () => {
    expect(describeGuardianDue("2026-11-04", "31", 5)).toBe("Próximo vencimento: 30 de novembro.");
  });

  test("com o dia inválido, não diz nada", () => {
    expect(describeGuardianDue("2026-11-04", "40", 5)).toBeNull();
  });
});

describe("validateGuardianDueDay", () => {
  test("vazio volta ao padrão", () => {
    expect(validateGuardianDueDay("")).toEqual({ ok: true, dueDay: null });
    expect(validateGuardianDueDay("  ")).toEqual({ ok: true, dueDay: null });
  });

  test("aceita um dia válido", () => {
    expect(validateGuardianDueDay("10")).toEqual({ ok: true, dueDay: 10 });
  });

  test("rejeita dia inválido", () => {
    expect(validateGuardianDueDay("0")).toEqual({ ok: false, error: guardianDueDaysMessages.dueDayInvalid });
    expect(validateGuardianDueDay("32")).toEqual({ ok: false, error: guardianDueDaysMessages.dueDayInvalid });
  });
});

describe("loadGuardianDueDays", () => {
  test("lê as trocas guardadas", async () => {
    const { client, from, select } = fakeClient({ load: async () => ({ data: [overrideRow], error: null }) });
    await expect(loadGuardianDueDays(client)).resolves.toEqual({ ok: true, rows: [overrideRow] });
    expect(from).toHaveBeenCalledWith("guardian_due_days");
    expect(select).toHaveBeenCalledWith("guardian_phone, due_day");
  });

  test("falha quando o banco ou a rede caem", async () => {
    const broken = fakeClient({ load: async () => ({ data: null, error: { message: "sem rede" } }) });
    await expect(loadGuardianDueDays(broken.client)).resolves.toEqual({ ok: false });
    const throwing = fakeClient({
      load: async () => {
        throw new Error("timeout");
      },
    });
    await expect(loadGuardianDueDays(throwing.client)).resolves.toEqual({ ok: false });
  });

  test("sem resposta de linhas, entende que não há troca guardada", async () => {
    const { client } = fakeClient({ load: async () => ({ data: null, error: null }) });
    await expect(loadGuardianDueDays(client)).resolves.toEqual({ ok: true, rows: [] });
  });
});

describe("saveGuardianDueDay e clearGuardianDueDay", () => {
  test("guarda o dia no telefone do responsável", async () => {
    const { client, upsert } = fakeClient();
    await expect(saveGuardianDueDay(client, anaPhone, 10)).resolves.toBe(true);
    expect(upsert).toHaveBeenCalledWith({ guardian_phone: anaPhone, due_day: 10 }, { onConflict: "owner_id,guardian_phone" });
  });

  test("apaga a troca para voltar ao padrão", async () => {
    const { client, eq } = fakeClient();
    await expect(clearGuardianDueDay(client, anaPhone)).resolves.toBe(true);
    expect(eq).toHaveBeenCalledWith("guardian_phone", anaPhone);
  });

  test("falha quando o banco recusa", async () => {
    const saveFail = fakeClient({ upsert: async () => ({ error: { message: "falhou" } }) });
    await expect(saveGuardianDueDay(saveFail.client, anaPhone, 10)).resolves.toBe(false);
    const clearFail = fakeClient({ delete: async () => ({ error: { message: "falhou" } }) });
    await expect(clearGuardianDueDay(clearFail.client, anaPhone)).resolves.toBe(false);
  });

  test("falha quando a rede cai", async () => {
    const networkDown = async () => {
      throw new Error("timeout");
    };
    const saveFail = fakeClient({ upsert: networkDown });
    await expect(saveGuardianDueDay(saveFail.client, anaPhone, 10)).resolves.toBe(false);
    const clearFail = fakeClient({ delete: networkDown });
    await expect(clearGuardianDueDay(clearFail.client, anaPhone)).resolves.toBe(false);
  });
});

describe("estado da tela", () => {
  test("trocar o dia limpa o aviso daquele responsável", () => {
    const dirty = {
      ...ready(),
      errors: { [anaPhone]: "antes" },
      notices: { [anaPhone]: "ok", [biaPhone]: "outro" },
      messages: { [anaPhone]: "falhou" },
    };
    const next = changeGuardianDueDay(dirty, anaPhone, "12");
    expect(next.groups.find((group) => group.phone === anaPhone)?.dueDay).toBe("12");
    expect(next.errors).toEqual({});
    expect(next.notices).toEqual({ [biaPhone]: "outro" });
    expect(next.messages).toEqual({});
  });

  test("recarregar e aplicar a carga", () => {
    const loading = startReloadingGuardianDueDays(ready(), 8);
    expect(loading).toMatchObject({ status: "loading", defaultDueDay: 8, errors: {}, notices: {}, messages: {} });
    const groups = guardianDueGroupsFrom([pedro], overridesByPhone([]));
    expect(applyGuardianDueDaysLoad(loading, { ok: true, groups }, 8)).toMatchObject({
      status: "ready",
      groups,
      defaultDueDay: 8,
    });
    expect(applyGuardianDueDaysLoad(loading, { ok: false }, 8).status).toBe("failed");
  });
});

describe("submitGuardianDueDay", () => {
  test("dia inválido fica no campo e não grava", async () => {
    const { client, upsert } = fakeClient();
    const state = changeGuardianDueDay(ready(), anaPhone, "40");
    const next = await submitGuardianDueDay(client, state, anaPhone);
    expect(upsert).not.toHaveBeenCalled();
    expect(next.errors[anaPhone]).toBe(guardianDueDaysMessages.dueDayInvalid);
  });

  test("guarda o dia novo e avisa", async () => {
    const { client } = fakeClient();
    const state = changeGuardianDueDay(ready(), biaPhone, "15");
    const next = await submitGuardianDueDay(client, state, biaPhone);
    expect(next.notices[biaPhone]).toBe(guardianDueDaysMessages.saved);
    expect(next.groups.find((group) => group.phone === biaPhone)?.dueDay).toBe("15");
  });

  test("campo vazio apaga a troca e volta ao padrão", async () => {
    const { client, eq } = fakeClient();
    const state = changeGuardianDueDay(ready(), anaPhone, "");
    const next = await submitGuardianDueDay(client, state, anaPhone);
    expect(eq).toHaveBeenCalledWith("guardian_phone", anaPhone);
    expect(next.notices[anaPhone]).toBe(guardianDueDaysMessages.cleared);
    expect(next.groups.find((group) => group.phone === anaPhone)?.dueDay).toBe("");
  });

  test("falha ao guardar aparece na mensagem", async () => {
    const { client } = fakeClient({ upsert: async () => ({ error: { message: "falhou" } }) });
    const state = changeGuardianDueDay(ready(), biaPhone, "15");
    const next = await submitGuardianDueDay(client, state, biaPhone);
    expect(next.messages[biaPhone]).toBe(guardianDueDaysMessages.saveFailed);
  });

  test("responsável que saiu da lista não grava nada", async () => {
    const { client, upsert, eq } = fakeClient();
    const state = ready();
    await expect(submitGuardianDueDay(client, state, "11900000000")).resolves.toBe(state);
    expect(upsert).not.toHaveBeenCalled();
    expect(eq).not.toHaveBeenCalled();
  });
});
