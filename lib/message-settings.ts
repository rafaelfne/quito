import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultMessageTone, isMessageTone, type MessageAdjustments, type MessageTone } from "@/lib/message-templates";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type MessageSettingsClient = Pick<SupabaseClient, "from">;

export type MessageSettingsRow = MessageAdjustments;

export type MessageSettingsDraft = {
  tone: MessageTone;
  greeting: string;
  thanks: string;
  signature: string;
};

export type MessageSettingsField = keyof MessageSettingsDraft;

export type MessageSettingsErrors = Partial<Record<"greeting" | "thanks" | "signature", string>>;

export type MessageSettingsValidation = { ok: true; row: MessageSettingsRow } | { ok: false; errors: MessageSettingsErrors };

export type MessageSettingsLoad = { ok: true; settings: MessageSettingsRow | null } | { ok: false };

export type MessageSettingsState = {
  status: "loading" | "ready" | "failed";
  draft: MessageSettingsDraft;
  errors: MessageSettingsErrors;
  message: string | null;
  notice: string | null;
};

export const greetingLengthLimit = 40;

export const thanksLengthLimit = 40;

export const signatureLengthLimit = 80;

export const messageSettingsMessages = {
  greetingTooLong: `Use uma saudação de até ${greetingLengthLimit} letras.`,
  thanksTooLong: `Use um agradecimento de até ${thanksLengthLimit} letras.`,
  signatureTooLong: `Use uma assinatura de até ${signatureLengthLimit} letras.`,
  loadFailed: "Não deu para abrir o modelo da mensagem agora. Confira a internet e tente de novo.",
  saveFailed: "Não deu para guardar a mensagem agora. Confira a internet e toque em Guardar de novo.",
  saved: "Mensagem guardada. Vale para todos os responsáveis.",
};

const table = "message_settings";

const columns = "tone, greeting, thanks, signature";

function withoutEndingPunctuation(raw: string): string {
  return raw.trim().replace(/[\s,;:.!]+$/, "");
}

export function messageAdjustmentsFrom(draft: MessageSettingsDraft): MessageAdjustments {
  return { tone: draft.tone, greeting: withoutEndingPunctuation(draft.greeting) || null, thanks: withoutEndingPunctuation(draft.thanks) || null, signature: draft.signature.trim() || null };
}

export function messageSettingsDraftFrom(settings: MessageSettingsRow | null): MessageSettingsDraft {
  if (settings === null) return { tone: defaultMessageTone, greeting: "", thanks: "", signature: "" };
  return {
    tone: isMessageTone(settings.tone) ? settings.tone : defaultMessageTone,
    greeting: settings.greeting ?? "",
    thanks: settings.thanks ?? "",
    signature: settings.signature ?? "",
  };
}

export const initialMessageSettings: MessageSettingsState = {
  status: "loading",
  draft: messageSettingsDraftFrom(null),
  errors: {},
  message: null,
  notice: null,
};

export function validateMessageSettings(draft: MessageSettingsDraft): MessageSettingsValidation {
  const row = messageAdjustmentsFrom(draft);
  const errors: MessageSettingsErrors = {};
  if ((row.greeting?.length ?? 0) > greetingLengthLimit) errors.greeting = messageSettingsMessages.greetingTooLong;
  if ((row.thanks?.length ?? 0) > thanksLengthLimit) errors.thanks = messageSettingsMessages.thanksTooLong;
  if ((row.signature?.length ?? 0) > signatureLengthLimit) errors.signature = messageSettingsMessages.signatureTooLong;
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, row };
}

export async function loadMessageSettings(client: MessageSettingsClient): Promise<MessageSettingsLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select(columns).maybeSingle()), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, settings: data as MessageSettingsRow | null };
  } catch {
    return { ok: false };
  }
}

export async function saveMessageSettings(client: MessageSettingsClient, row: MessageSettingsRow): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).upsert(row, { onConflict: "owner_id" })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export function changeMessageSetting(state: MessageSettingsState, changes: Partial<MessageSettingsDraft>): MessageSettingsState {
  return { ...state, draft: { ...state.draft, ...changes }, notice: null };
}

export function startReloadingMessageSettings(state: MessageSettingsState): MessageSettingsState {
  return { ...state, status: "loading" };
}

export function applyMessageSettingsLoad(state: MessageSettingsState, result: MessageSettingsLoad): MessageSettingsState {
  return result.ok ? { ...state, status: "ready", draft: messageSettingsDraftFrom(result.settings) } : { ...state, status: "failed" };
}

export async function submitMessageSettings(client: MessageSettingsClient, state: MessageSettingsState): Promise<MessageSettingsState> {
  const validation = validateMessageSettings(state.draft);
  if (!validation.ok) return { ...state, errors: validation.errors, message: null, notice: null };
  const saved = await saveMessageSettings(client, validation.row);
  if (!saved) return { ...state, errors: {}, message: messageSettingsMessages.saveFailed, notice: null };
  return { ...state, draft: messageSettingsDraftFrom(validation.row), errors: {}, message: null, notice: messageSettingsMessages.saved };
}
