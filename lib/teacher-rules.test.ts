import { describe, expect, test, vi } from "vitest";
import { billingMessages } from "./billing";
import {
  applyTeacherRulesLoad,
  changeTeacherRule,
  defaultTeacherRules,
  initialTeacherRules,
  loadTeacherRules,
  makeupDaysLimit,
  noticeHoursLimit,
  saveTeacherRules,
  startReloadingTeacherRules,
  submitTeacherRules,
  teacherRulesDraftFrom,
  teacherRulesMessages,
  validateTeacherRules,
  type TeacherRulesClient,
  type TeacherRulesRow,
  type TeacherRulesState,
} from "./teacher-rules";

type Failure = { message: string } | null;
type LoadResult = { data: TeacherRulesRow | null; error: Failure };

const strictRules: TeacherRulesRow = { notice_hours: 48, makeup_deadline_days: 30, five_week_policy: "add_lesson", five_week_extra_cents: 8000 };
const strictDraft = { noticeHours: "48", makeupPolicy: "deadline", makeupDays: "30", fiveWeekPolicy: "add_lesson", fiveWeekExtra: "80,00" };
const defaultDraft = { noticeHours: "24", makeupPolicy: "none", makeupDays: "", fiveWeekPolicy: "same_price", fiveWeekExtra: "" };

function fakeClient(overrides: { load?: () => Promise<LoadResult>; upsert?: () => Promise<{ error: Failure }> } = {}) {
  const maybeSingle = vi.fn(overrides.load ?? (async () => ({ data: null, error: null } as LoadResult)));
  const select = vi.fn(() => ({ maybeSingle }));
  const upsert = vi.fn(overrides.upsert ?? (async () => ({ error: null as Failure })));
  const from = vi.fn(() => ({ select, upsert }));
  return { client: { from } as unknown as TeacherRulesClient, from, select, maybeSingle, upsert };
}

function ready(draft = strictDraft): TeacherRulesState {
  return { ...initialTeacherRules, status: "ready", draft };
}

describe("regras de partida", () => {
  test("a falta conta como avisada com 24 horas, a reposição não tem prazo e o mês com 5 semanas custa igual", () => {
    expect(defaultTeacherRules).toEqual({ notice_hours: 24, makeup_deadline_days: null, five_week_policy: "same_price", five_week_extra_cents: null });
    expect(initialTeacherRules.draft).toEqual(defaultDraft);
    expect(initialTeacherRules.status).toBe("loading");
  });
});

describe("teacherRulesDraftFrom", () => {
  test("abre as regras guardadas para corrigir", () => {
    expect(teacherRulesDraftFrom(strictRules)).toEqual(strictDraft);
  });
});

describe("validateTeacherRules", () => {
  test("transforma o que foi preenchido no que vai para o banco", () => {
    expect(validateTeacherRules(strictDraft)).toEqual({ ok: true, row: strictRules });
    expect(validateTeacherRules(defaultDraft)).toEqual({ ok: true, row: defaultTeacherRules });
  });

  test("ignora o prazo e o valor que ficaram escritos quando a opção foi desligada", () => {
    const result = validateTeacherRules({ noticeHours: " 12 ", makeupPolicy: "none", makeupDays: "abc", fiveWeekPolicy: "same_price", fiveWeekExtra: "abc" });
    expect(result).toEqual({ ok: true, row: { ...defaultTeacherRules, notice_hours: 12 } });
  });

  test.each([[""], ["0"], ["1,5"], ["abc"], [String(noticeHoursLimit + 1)]])("recusa antecedência de %s horas", (noticeHours) => {
    expect(validateTeacherRules({ ...defaultDraft, noticeHours })).toEqual({ ok: false, errors: { noticeHours: teacherRulesMessages.noticeInvalid } });
  });

  test("aceita os limites de antecedência e de prazo", () => {
    expect(validateTeacherRules({ ...strictDraft, noticeHours: "1", makeupDays: "1" }).ok).toBe(true);
    expect(validateTeacherRules({ ...strictDraft, noticeHours: String(noticeHoursLimit), makeupDays: String(makeupDaysLimit) }).ok).toBe(true);
  });

  test.each([[""], ["0"], [String(makeupDaysLimit + 1)]])("com prazo ligado, recusa %s dias", (makeupDays) => {
    expect(validateTeacherRules({ ...strictDraft, makeupDays })).toEqual({ ok: false, errors: { makeupDays: teacherRulesMessages.makeupDaysInvalid } });
  });

  test("somando a aula avulsa, pede um valor válido", () => {
    expect(validateTeacherRules({ ...strictDraft, fiveWeekExtra: "" })).toEqual({ ok: false, errors: { fiveWeekExtra: billingMessages.amountInvalid } });
    expect(validateTeacherRules({ ...strictDraft, fiveWeekExtra: "100.000,01" })).toEqual({ ok: false, errors: { fiveWeekExtra: billingMessages.amountTooHigh } });
  });

  test("aponta todos os problemas de uma vez", () => {
    expect(validateTeacherRules({ ...strictDraft, noticeHours: "", makeupDays: "", fiveWeekExtra: "" })).toEqual({
      ok: false,
      errors: { noticeHours: teacherRulesMessages.noticeInvalid, makeupDays: teacherRulesMessages.makeupDaysInvalid, fiveWeekExtra: billingMessages.amountInvalid },
    });
  });
});

describe("loadTeacherRules", () => {
  test("traz as regras guardadas do professor", async () => {
    const { client, from } = fakeClient({ load: async () => ({ data: strictRules, error: null }) });
    expect(await loadTeacherRules(client)).toEqual({ ok: true, rules: strictRules });
    expect(from).toHaveBeenCalledWith("teacher_rules");
  });

  test("quem nunca guardou recebe as regras de partida", async () => {
    expect(await loadTeacherRules(fakeClient().client)).toEqual({ ok: true, rules: defaultTeacherRules });
  });

  test("erro do banco ou queda da conexão vira falha, e não as regras de partida", async () => {
    expect(await loadTeacherRules(fakeClient({ load: async () => ({ data: null, error: { message: "negado" } }) }).client)).toEqual({ ok: false });
    expect(
      await loadTeacherRules(
        fakeClient({
          load: async () => {
            throw new Error("sem rede");
          },
        }).client,
      ),
    ).toEqual({ ok: false });
  });
});

describe("saveTeacherRules", () => {
  test("guarda uma linha só por professor, trocando a anterior", async () => {
    const { client, upsert } = fakeClient();
    expect(await saveTeacherRules(client, strictRules)).toBe(true);
    expect(upsert).toHaveBeenCalledWith(strictRules, { onConflict: "owner_id" });
  });

  test("erro do banco ou queda da conexão vira falha", async () => {
    expect(await saveTeacherRules(fakeClient({ upsert: async () => ({ error: { message: "negado" } }) }).client, strictRules)).toBe(false);
    expect(
      await saveTeacherRules(
        fakeClient({
          upsert: async () => {
            throw new Error("sem rede");
          },
        }).client,
        strictRules,
      ),
    ).toBe(false);
  });
});

describe("estado da tela", () => {
  test("mudar um campo atualiza o rascunho e tira o aviso de guardado", () => {
    const next = changeTeacherRule({ ...ready(), notice: teacherRulesMessages.saved }, "noticeHours", "6");
    expect(next.draft.noticeHours).toBe("6");
    expect(next.notice).toBeNull();
  });

  test("tentar de novo volta a carregar", () => {
    expect(startReloadingTeacherRules({ ...initialTeacherRules, status: "failed" }).status).toBe("loading");
  });

  test("resposta do banco preenche o formulário, e a falha mantém o rascunho", () => {
    expect(applyTeacherRulesLoad(initialTeacherRules, { ok: true, rules: strictRules })).toMatchObject({ status: "ready", draft: strictDraft });
    expect(applyTeacherRulesLoad(initialTeacherRules, { ok: false })).toMatchObject({ status: "failed", draft: defaultDraft });
  });
});

describe("submitTeacherRules", () => {
  test("com dado errado, mostra o erro sem falar com o banco", async () => {
    const { client, upsert } = fakeClient();
    const next = await submitTeacherRules(client, ready({ ...strictDraft, noticeHours: "" }));
    expect(upsert).not.toHaveBeenCalled();
    expect(next.errors.noticeHours).toBe(teacherRulesMessages.noticeInvalid);
  });

  test("guardou: limpa os erros, mostra o aviso e deixa o valor bem escrito", async () => {
    const { client, upsert } = fakeClient();
    const before = { ...ready({ ...strictDraft, noticeHours: " 48 ", fiveWeekExtra: "80" }), errors: { noticeHours: "antigo" }, message: "antiga" };
    const next = await submitTeacherRules(client, before);
    expect(upsert).toHaveBeenCalledWith(strictRules, { onConflict: "owner_id" });
    expect(next).toMatchObject({ draft: strictDraft, errors: {}, message: null, notice: teacherRulesMessages.saved });
  });

  test("não guardou: avisa e mantém o que foi escrito", async () => {
    const { client } = fakeClient({ upsert: async () => ({ error: { message: "negado" } }) });
    const next = await submitTeacherRules(client, ready());
    expect(next).toMatchObject({ draft: strictDraft, message: teacherRulesMessages.saveFailed, notice: null });
  });
});
