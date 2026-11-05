import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  applyMessageSettingsLoad,
  changeMessageSetting,
  greetingLengthLimit,
  initialMessageSettings,
  loadMessageSettings,
  messageAdjustmentsFrom,
  messageSettingsDraftFrom,
  messageSettingsMessages,
  saveMessageSettings,
  signatureLengthLimit,
  thanksLengthLimit,
  startReloadingMessageSettings,
  submitMessageSettings,
  validateMessageSettings,
  type MessageSettingsClient,
  type MessageSettingsRow,
  type MessageSettingsState,
} from "./message-settings";
import { messageTones, type MessageTone } from "./message-templates";

type Failure = { message: string } | null;
type LoadResult = { data: MessageSettingsRow | null; error: Failure };

const savedRow: MessageSettingsRow = { tone: "direct", greeting: "Bom dia", thanks: "Obrigada", signature: "Tio João" };
const savedDraft = { tone: "direct" as MessageTone, greeting: "Bom dia", thanks: "Obrigada", signature: "Tio João" };

function fakeClient(overrides: { load?: () => Promise<LoadResult>; upsert?: () => Promise<{ error: Failure }> } = {}) {
  const maybeSingle = vi.fn(overrides.load ?? (async () => ({ data: null, error: null } as LoadResult)));
  const select = vi.fn(() => ({ maybeSingle }));
  const upsert = vi.fn(overrides.upsert ?? (async () => ({ error: null as Failure })));
  const from = vi.fn(() => ({ select, upsert }));
  return { client: { from } as unknown as MessageSettingsClient, from, upsert };
}

function ready(draft = savedDraft): MessageSettingsState {
  return { ...initialMessageSettings, status: "ready", draft };
}

function failing() {
  return async () => {
    throw new Error("sem rede");
  };
}

describe("modelo da mensagem no banco", () => {
  const migration = ["20261105000000_message_settings.sql", "20261105010000_message_settings_thanks.sql"]
    .map((file) => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8"))
    .join("\n");

  test("guarda os mesmos limites e os mesmos tons que a tela", () => {
    expect(migration).toContain(`char_length("greeting") between 1 and ${greetingLengthLimit}`);
    expect(migration).toContain(`char_length("thanks") between 1 and ${thanksLengthLimit}`);
    expect(migration).toContain(`char_length("signature") between 1 and ${signatureLengthLimit}`);
    expect(migration).toContain(`"tone" text not null default 'friendly'`);
    expect(migration).toContain(`"tone" in (${messageTones.map((tone) => `'${tone.id}'`).join(", ")})`);
  });
});

describe("messageSettingsDraftFrom", () => {
  test("quem nunca guardou começa no Próximo, com saudação e assinatura de partida", () => {
    expect(messageSettingsDraftFrom(null)).toEqual({ tone: "friendly", greeting: "", thanks: "", signature: "" });
    expect(initialMessageSettings.status).toBe("loading");
  });

  test("abre o que foi guardado, e o que está vazio continua em branco", () => {
    expect(messageSettingsDraftFrom(savedRow)).toEqual(savedDraft);
    expect(messageSettingsDraftFrom({ tone: "formal", greeting: null, thanks: null, signature: null })).toEqual({ tone: "formal", greeting: "", thanks: "", signature: "" });
  });

  test("um tom que o app não conhece volta ao Próximo", () => {
    expect(messageSettingsDraftFrom({ tone: "duro" as MessageTone, greeting: null, thanks: null, signature: null }).tone).toBe("friendly");
  });
});

describe("messageAdjustmentsFrom", () => {
  test("em branco vira a saudação e a assinatura de partida", () => {
    expect(messageAdjustmentsFrom({ tone: "friendly", greeting: "  ", thanks: " ", signature: " " })).toEqual({ tone: "friendly", greeting: null, thanks: null, signature: null });
  });

  test("tira os espaços e a pontuação do fim da saudação, porque o nome vem logo depois", () => {
    expect(messageAdjustmentsFrom({ tone: "friendly", greeting: " Bom dia, ", thanks: " Obrigada! ", signature: " Tio João. " })).toEqual({ tone: "friendly", greeting: "Bom dia", thanks: "Obrigada", signature: "Tio João." });
    expect(messageAdjustmentsFrom({ tone: "friendly", greeting: "!!", thanks: "", signature: "" }).greeting).toBeNull();
  });
});

describe("validateMessageSettings", () => {
  test("aceita até o limite e recusa acima dele", () => {
    expect(validateMessageSettings({ ...savedDraft, greeting: "a".repeat(greetingLengthLimit), thanks: "c".repeat(thanksLengthLimit), signature: "b".repeat(signatureLengthLimit) }).ok).toBe(true);
    expect(validateMessageSettings({ ...savedDraft, greeting: "a".repeat(greetingLengthLimit + 1), thanks: "c".repeat(thanksLengthLimit + 1), signature: "b".repeat(signatureLengthLimit + 1) })).toEqual({
      ok: false,
      errors: { greeting: messageSettingsMessages.greetingTooLong, thanks: messageSettingsMessages.thanksTooLong, signature: messageSettingsMessages.signatureTooLong },
    });
  });

  test("em branco é válido", () => {
    expect(validateMessageSettings({ tone: "formal", greeting: "", thanks: "", signature: "" })).toEqual({ ok: true, row: { tone: "formal", greeting: null, thanks: null, signature: null } });
  });
});

describe("loadMessageSettings", () => {
  test("traz o modelo guardado do professor", async () => {
    const { client, from } = fakeClient({ load: async () => ({ data: savedRow, error: null }) });
    expect(await loadMessageSettings(client)).toEqual({ ok: true, settings: savedRow });
    expect(from).toHaveBeenCalledWith("message_settings");
  });

  test("erro do banco ou queda da conexão vira falha", async () => {
    expect(await loadMessageSettings(fakeClient({ load: async () => ({ data: null, error: { message: "negado" } }) }).client)).toEqual({ ok: false });
    expect(await loadMessageSettings(fakeClient({ load: failing() }).client)).toEqual({ ok: false });
  });
});

describe("saveMessageSettings", () => {
  test("guarda uma linha só por professor, que vale para todos os responsáveis", async () => {
    const { client, upsert } = fakeClient();
    expect(await saveMessageSettings(client, savedRow)).toBe(true);
    expect(upsert).toHaveBeenCalledWith(savedRow, { onConflict: "owner_id" });
  });

  test("erro do banco ou queda da conexão vira falha", async () => {
    expect(await saveMessageSettings(fakeClient({ upsert: async () => ({ error: { message: "negado" } }) }).client, savedRow)).toBe(false);
    expect(await saveMessageSettings(fakeClient({ upsert: failing() }).client, savedRow)).toBe(false);
  });
});

describe("estado da tela", () => {
  test("trocar o tom muda o rascunho, mantém os ajustes e tira o aviso de guardado", () => {
    const next = changeMessageSetting({ ...ready(), notice: messageSettingsMessages.saved }, { tone: "formal" });
    expect(next.draft).toEqual({ ...savedDraft, tone: "formal" });
    expect(next.notice).toBeNull();
  });

  test("tentar de novo volta a carregar", () => {
    expect(startReloadingMessageSettings({ ...initialMessageSettings, status: "failed" }).status).toBe("loading");
  });

  test("resposta do banco preenche o formulário, e a falha mantém o rascunho", () => {
    expect(applyMessageSettingsLoad(initialMessageSettings, { ok: true, settings: savedRow })).toMatchObject({ status: "ready", draft: savedDraft });
    expect(applyMessageSettingsLoad(initialMessageSettings, { ok: false })).toMatchObject({ status: "failed", draft: initialMessageSettings.draft });
  });
});

describe("submitMessageSettings", () => {
  test("com texto grande demais, mostra o erro sem falar com o banco", async () => {
    const { client, upsert } = fakeClient();
    const next = await submitMessageSettings(client, ready({ ...savedDraft, greeting: "a".repeat(greetingLengthLimit + 1) }));
    expect(upsert).not.toHaveBeenCalled();
    expect(next.errors.greeting).toBe(messageSettingsMessages.greetingTooLong);
  });

  test("guardou: limpa os erros, mostra o aviso e deixa o texto limpo", async () => {
    const { client, upsert } = fakeClient();
    const next = await submitMessageSettings(client, { ...ready({ ...savedDraft, greeting: " Bom dia, " }), errors: { greeting: "antigo" }, message: "antiga" });
    expect(upsert).toHaveBeenCalledWith(savedRow, { onConflict: "owner_id" });
    expect(next).toMatchObject({ draft: savedDraft, errors: {}, message: null, notice: messageSettingsMessages.saved });
  });

  test("não guardou: avisa e mantém o que foi escrito", async () => {
    const { client } = fakeClient({ upsert: async () => ({ error: { message: "negado" } }) });
    expect(await submitMessageSettings(client, ready())).toMatchObject({ draft: savedDraft, message: messageSettingsMessages.saveFailed, notice: null });
  });
});
