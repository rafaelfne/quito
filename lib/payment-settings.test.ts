import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  applyPaymentSettingsLoad,
  changePaymentSetting,
  defaultDueDay,
  describeNextDue,
  dueDateIn,
  dueDayLimit,
  displayNameLengthLimit,
  initialPaymentSettings,
  isPixKey,
  loadPaymentSettings,
  nextDueDate,
  paymentSettingsDraftFrom,
  paymentSettingsMessages,
  pixKeyLengthLimit,
  savePaymentSettings,
  startReloadingPaymentSettings,
  submitPaymentSettings,
  validatePaymentSettings,
  type PaymentSettingsClient,
  type PaymentSettingsRow,
  type PaymentSettingsState,
} from "./payment-settings";

type Failure = { message: string } | null;
type LoadResult = { data: PaymentSettingsRow | null; error: Failure };

const savedRow: PaymentSettingsRow = { pix_key: "joao.violao@email.com", display_name: "João Silva", due_day: 10 };
const savedDraft = { pixKey: "joao.violao@email.com", displayName: "João Silva", dueDay: "10" };

function fakeClient(overrides: { load?: () => Promise<LoadResult>; upsert?: () => Promise<{ error: Failure }> } = {}) {
  const maybeSingle = vi.fn(overrides.load ?? (async () => ({ data: null, error: null } as LoadResult)));
  const select = vi.fn(() => ({ maybeSingle }));
  const upsert = vi.fn(overrides.upsert ?? (async () => ({ error: null as Failure })));
  const from = vi.fn(() => ({ select, upsert }));
  return { client: { from } as unknown as PaymentSettingsClient, from, select, maybeSingle, upsert };
}

function ready(draft = savedDraft): PaymentSettingsState {
  return { ...initialPaymentSettings, status: "ready", draft };
}

function failing() {
  return async () => {
    throw new Error("sem rede");
  };
}

describe("dados de recebimento no banco", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261104000000_payment_settings.sql"), "utf8");

  test("guarda os mesmos limites que a tela confere", () => {
    expect(migration).toContain(`char_length("pix_key") between 1 and ${pixKeyLengthLimit}`);
    expect(migration).toContain(`char_length("display_name") between 1 and ${displayNameLengthLimit}`);
    expect(migration).toContain(`"due_day" between 1 and ${dueDayLimit}`);
    expect(migration).toContain(`"due_day" integer not null default ${defaultDueDay}`);
  });
});

describe("dueDateIn", () => {
  test("usa o dia escolhido quando o mês tem esse dia", () => {
    expect(dueDateIn({ year: 2026, month: 12 }, 5)).toBe("2026-12-05");
    expect(dueDateIn({ year: 2026, month: 12 }, 31)).toBe("2026-12-31");
  });

  test.each([
    [{ year: 2026, month: 11 }, 31, "2026-11-30"],
    [{ year: 2027, month: 2 }, 30, "2027-02-28"],
    [{ year: 2027, month: 2 }, 29, "2027-02-28"],
    [{ year: 2028, month: 2 }, 31, "2028-02-29"],
    [{ year: 2028, month: 2 }, 29, "2028-02-29"],
  ])("em mês mais curto, cai no último dia: %o dia %i", (month, day, expected) => {
    expect(dueDateIn(month, day)).toBe(expected);
  });
});

describe("nextDueDate", () => {
  test("hoje ou mais tarde neste mês, vence neste mês", () => {
    expect(nextDueDate("2026-11-04", 5)).toBe("2026-11-05");
    expect(nextDueDate("2026-11-05", 5)).toBe("2026-11-05");
  });

  test("já passou neste mês, vence no mês seguinte, inclusive na virada do ano", () => {
    expect(nextDueDate("2026-11-06", 5)).toBe("2026-12-05");
    expect(nextDueDate("2026-12-20", 5)).toBe("2027-01-05");
  });

  test("no último dia de um mês curto, o dia 31 vence hoje", () => {
    expect(nextDueDate("2027-02-28", 31)).toBe("2027-02-28");
    expect(nextDueDate("2027-01-31", 30)).toBe("2027-02-28");
  });
});

describe("describeNextDue", () => {
  test("diz a data por extenso para um dia válido", () => {
    expect(describeNextDue("2026-11-04", "31")).toBe("Próximo vencimento: 30 de novembro.");
  });

  test.each([[""], ["0"], ["32"], ["abc"]])("não diz nada para o dia %s", (day) => {
    expect(describeNextDue("2026-11-04", day)).toBeNull();
  });
});

describe("isPixKey", () => {
  test.each([
    ["e-mail", "joao.violao@email.com"],
    ["CPF com pontos", "123.456.789-09"],
    ["CPF só com números", "12345678909"],
    ["celular com DDD", "(11) 91234-5678"],
    ["celular com país", "+55 11 91234-5678"],
    ["celular com país sem o mais", "5511912345678"],
    ["CNPJ com pontos", "11.222.333/0001-81"],
    ["CNPJ só com números", "11222333000181"],
    ["CNPJ com letras", "12.ABC.345/01DE-35"],
    ["CNPJ com letras minúsculas", "12abc34501de35"],
    ["chave aleatória", "123e4567-e89b-12d3-a456-426614174000"],
    ["com espaço nas pontas", "  joao@email.com "],
  ])("aceita %s", (_kind, key) => {
    expect(isPixKey(key)).toBe(true);
  });

  test.each([
    ["vazio", ""],
    ["só espaço", "   "],
    ["texto solto", "joaoviolao"],
    ["e-mail sem domínio", "joao@email"],
    ["poucos números", "123456"],
    ["CNPJ com dígito errado", "11.222.333/0001-82"],
    ["texto de 14 letras e números", "joaoviolao1234"],
    ["longo demais", `${"a".repeat(pixKeyLengthLimit)}@email.com`],
  ])("recusa %s", (_kind, key) => {
    expect(isPixKey(key)).toBe(false);
  });
});

describe("paymentSettingsDraftFrom", () => {
  test("abre os dados guardados para corrigir", () => {
    expect(paymentSettingsDraftFrom(savedRow)).toEqual(savedDraft);
  });

  test("quem nunca guardou começa sem chave e sem nome, com o dia 5", () => {
    expect(paymentSettingsDraftFrom(null)).toEqual({ pixKey: "", displayName: "", dueDay: "5" });
    expect(initialPaymentSettings.status).toBe("loading");
  });
});

describe("validatePaymentSettings", () => {
  test("transforma o que foi preenchido no que vai para o banco, sem os espaços das pontas", () => {
    expect(validatePaymentSettings({ pixKey: " joao.violao@email.com ", displayName: "  João Silva ", dueDay: " 10 " })).toEqual({ ok: true, row: savedRow });
  });

  test("aceita os limites do dia", () => {
    expect(validatePaymentSettings({ ...savedDraft, dueDay: "1" }).ok).toBe(true);
    expect(validatePaymentSettings({ ...savedDraft, dueDay: "31" }).ok).toBe(true);
  });

  test.each([[""], ["0"], ["32"], ["1,5"], ["abc"]])("recusa o dia %s", (dueDay) => {
    expect(validatePaymentSettings({ ...savedDraft, dueDay })).toEqual({ ok: false, errors: { dueDay: paymentSettingsMessages.dueDayInvalid } });
  });

  test("pede o nome e recusa nome grande demais", () => {
    expect(validatePaymentSettings({ ...savedDraft, displayName: "   " })).toEqual({ ok: false, errors: { displayName: paymentSettingsMessages.displayNameMissing } });
    expect(validatePaymentSettings({ ...savedDraft, displayName: "a".repeat(displayNameLengthLimit) }).ok).toBe(true);
    expect(validatePaymentSettings({ ...savedDraft, displayName: "a".repeat(displayNameLengthLimit + 1) })).toEqual({ ok: false, errors: { displayName: paymentSettingsMessages.displayNameTooLong } });
  });

  test("aponta todos os problemas de uma vez", () => {
    expect(validatePaymentSettings({ pixKey: "", displayName: "", dueDay: "" })).toEqual({
      ok: false,
      errors: { pixKey: paymentSettingsMessages.pixKeyInvalid, displayName: paymentSettingsMessages.displayNameMissing, dueDay: paymentSettingsMessages.dueDayInvalid },
    });
  });
});

describe("loadPaymentSettings", () => {
  test("traz os dados guardados do professor", async () => {
    const { client, from } = fakeClient({ load: async () => ({ data: savedRow, error: null }) });
    expect(await loadPaymentSettings(client)).toEqual({ ok: true, settings: savedRow });
    expect(from).toHaveBeenCalledWith("payment_settings");
  });

  test("quem nunca guardou fica sem dados, para a cobrança saber que falta preencher", async () => {
    expect(await loadPaymentSettings(fakeClient().client)).toEqual({ ok: true, settings: null });
  });

  test("erro do banco ou queda da conexão vira falha", async () => {
    expect(await loadPaymentSettings(fakeClient({ load: async () => ({ data: null, error: { message: "negado" } }) }).client)).toEqual({ ok: false });
    expect(await loadPaymentSettings(fakeClient({ load: failing() }).client)).toEqual({ ok: false });
  });
});

describe("savePaymentSettings", () => {
  test("guarda uma linha só por professor, trocando a anterior", async () => {
    const { client, upsert } = fakeClient();
    expect(await savePaymentSettings(client, savedRow)).toBe(true);
    expect(upsert).toHaveBeenCalledWith(savedRow, { onConflict: "owner_id" });
  });

  test("erro do banco ou queda da conexão vira falha", async () => {
    expect(await savePaymentSettings(fakeClient({ upsert: async () => ({ error: { message: "negado" } }) }).client, savedRow)).toBe(false);
    expect(await savePaymentSettings(fakeClient({ upsert: failing() }).client, savedRow)).toBe(false);
  });
});

describe("estado da tela", () => {
  test("mudar um campo atualiza o rascunho e tira o aviso de guardado", () => {
    const next = changePaymentSetting({ ...ready(), notice: paymentSettingsMessages.saved }, "dueDay", "20");
    expect(next.draft.dueDay).toBe("20");
    expect(next.notice).toBeNull();
  });

  test("tentar de novo volta a carregar", () => {
    expect(startReloadingPaymentSettings({ ...initialPaymentSettings, status: "failed" }).status).toBe("loading");
  });

  test("resposta do banco preenche o formulário, e a falha mantém o rascunho", () => {
    expect(applyPaymentSettingsLoad(initialPaymentSettings, { ok: true, settings: savedRow })).toMatchObject({ status: "ready", draft: savedDraft });
    expect(applyPaymentSettingsLoad(initialPaymentSettings, { ok: false })).toMatchObject({ status: "failed", draft: initialPaymentSettings.draft });
  });
});

describe("submitPaymentSettings", () => {
  test("com dado errado, mostra o erro sem falar com o banco", async () => {
    const { client, upsert } = fakeClient();
    const next = await submitPaymentSettings(client, ready({ ...savedDraft, pixKey: "abc" }));
    expect(upsert).not.toHaveBeenCalled();
    expect(next.errors.pixKey).toBe(paymentSettingsMessages.pixKeyInvalid);
  });

  test("guardou: limpa os erros, mostra o aviso e deixa os dados sem espaços", async () => {
    const { client, upsert } = fakeClient();
    const before = { ...ready({ ...savedDraft, displayName: " João Silva " }), errors: { pixKey: "antigo" }, message: "antiga" };
    const next = await submitPaymentSettings(client, before);
    expect(upsert).toHaveBeenCalledWith(savedRow, { onConflict: "owner_id" });
    expect(next).toMatchObject({ draft: savedDraft, errors: {}, message: null, notice: paymentSettingsMessages.saved });
  });

  test("não guardou: avisa e mantém o que foi escrito", async () => {
    const { client } = fakeClient({ upsert: async () => ({ error: { message: "negado" } }) });
    const next = await submitPaymentSettings(client, ready());
    expect(next).toMatchObject({ draft: savedDraft, message: paymentSettingsMessages.saveFailed, notice: null });
  });
});
