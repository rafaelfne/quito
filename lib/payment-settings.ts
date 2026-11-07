import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWholeNumber } from "@/lib/billing";
import { describeShortDay, monthRange, shiftMonth } from "@/lib/lessons";
import type { CalendarMonth } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type PaymentSettingsClient = Pick<SupabaseClient, "from">;

export type PaymentSettingsRow = {
  pix_key: string;
  display_name: string;
  due_day: number;
};

export type PaymentSettingsDraft = {
  pixKey: string;
  displayName: string;
  dueDay: string;
};

export type PaymentSettingsField = keyof PaymentSettingsDraft;

export type PaymentSettingsErrors = Partial<Record<PaymentSettingsField, string>>;

export type PaymentSettingsValidation = { ok: true; row: PaymentSettingsRow } | { ok: false; errors: PaymentSettingsErrors };

export type PaymentSettingsLoad = { ok: true; settings: PaymentSettingsRow | null } | { ok: false };

export type PaymentSettingsState = {
  status: "loading" | "ready" | "failed";
  draft: PaymentSettingsDraft;
  errors: PaymentSettingsErrors;
  message: string | null;
  notice: string | null;
};

export const paymentSettingsPath = "/payment";

export const pixKeyLengthLimit = 77;

export const displayNameLengthLimit = 80;

export const dueDayLimit = 31;

export const defaultDueDay = 5;

export const paymentSettingsMessages = {
  pixKeyInvalid: "Confira a chave Pix: ela precisa ser um CPF, CNPJ, celular, e-mail ou chave aleatória.",
  displayNameMissing: "Escreva o nome que o responsável vai ver.",
  displayNameTooLong: `Use um nome de até ${displayNameLengthLimit} letras.`,
  dueDayInvalid: `Escreva um dia de 1 a ${dueDayLimit}.`,
  loadFailed: "Não deu para abrir os seus dados de recebimento agora. Confira a internet e tente de novo.",
  saveFailed: "Não deu para guardar os dados agora. Confira a internet e toque em Guardar de novo.",
  saved: "Dados de recebimento guardados.",
};

const table = "payment_settings";

const columns = "pix_key, display_name, due_day";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const randomKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cpfOrPhonePattern = /^(\+?55)?\d{10,11}$/;

const cnpjPattern = /^[0-9A-Z]{12}\d{2}$/;

const cnpjFirstDigitWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const cnpjSecondDigitWeights = [6, ...cnpjFirstDigitWeights];

function cnpjCheckDigit(base: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + (base.charCodeAt(index) - 48) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isCnpj(text: string): boolean {
  if (!cnpjPattern.test(text)) return false;
  const first = cnpjCheckDigit(text, cnpjFirstDigitWeights);
  const second = cnpjCheckDigit(text.slice(0, 12) + first, cnpjSecondDigitWeights);
  return text.endsWith(`${first}${second}`);
}

export function isPixKey(raw: string): boolean {
  const key = raw.trim();
  if (key.length === 0 || key.length > pixKeyLengthLimit) return false;
  if (emailPattern.test(key) || randomKeyPattern.test(key)) return true;
  const bare = key.replace(/[\s().\-/]/g, "");
  return cpfOrPhonePattern.test(bare) || isCnpj(bare.toUpperCase());
}

export function dueDateIn(month: CalendarMonth, dueDay: number): string {
  const { last } = monthRange(month);
  const day = Math.min(dueDay, Number(last.slice(8)));
  return `${last.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

export function nextDueDate(today: string, dueDay: number): string {
  const month = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const due = dueDateIn(month, dueDay);
  return due >= today ? due : dueDateIn(shiftMonth(month, 1), dueDay);
}

export function describeNextDue(today: string, dueDayDraft: string): string | null {
  const dueDay = parseWholeNumber(dueDayDraft, dueDayLimit);
  return dueDay === null ? null : `Próximo vencimento: ${describeShortDay(nextDueDate(today, dueDay))}.`;
}

export function paymentSettingsDraftFrom(settings: PaymentSettingsRow | null): PaymentSettingsDraft {
  if (settings === null) return { pixKey: "", displayName: "", dueDay: String(defaultDueDay) };
  return { pixKey: settings.pix_key, displayName: settings.display_name, dueDay: String(settings.due_day) };
}

export const initialPaymentSettings: PaymentSettingsState = {
  status: "loading",
  draft: paymentSettingsDraftFrom(null),
  errors: {},
  message: null,
  notice: null,
};

function displayNameError(name: string): string | undefined {
  if (name.length === 0) return paymentSettingsMessages.displayNameMissing;
  return name.length > displayNameLengthLimit ? paymentSettingsMessages.displayNameTooLong : undefined;
}

export function validatePaymentSettings(draft: PaymentSettingsDraft): PaymentSettingsValidation {
  const pixKey = draft.pixKey.trim();
  const displayName = draft.displayName.trim();
  const dueDay = parseWholeNumber(draft.dueDay, dueDayLimit);
  const nameProblem = displayNameError(displayName);
  const errors: PaymentSettingsErrors = {};
  if (!isPixKey(pixKey)) errors.pixKey = paymentSettingsMessages.pixKeyInvalid;
  if (nameProblem) errors.displayName = nameProblem;
  if (dueDay === null) errors.dueDay = paymentSettingsMessages.dueDayInvalid;
  if (dueDay === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, row: { pix_key: pixKey, display_name: displayName, due_day: dueDay } };
}

export async function loadPaymentSettings(client: PaymentSettingsClient): Promise<PaymentSettingsLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select(columns).maybeSingle()), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, settings: data as PaymentSettingsRow | null };
  } catch {
    return { ok: false };
  }
}

export async function savePaymentSettings(client: PaymentSettingsClient, row: PaymentSettingsRow): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).upsert(row, { onConflict: "owner_id" })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export function changePaymentSetting(state: PaymentSettingsState, field: PaymentSettingsField, value: string): PaymentSettingsState {
  return { ...state, draft: { ...state.draft, [field]: value }, notice: null };
}

export function startReloadingPaymentSettings(state: PaymentSettingsState): PaymentSettingsState {
  return { ...state, status: "loading" };
}

export function applyPaymentSettingsLoad(state: PaymentSettingsState, result: PaymentSettingsLoad): PaymentSettingsState {
  return result.ok ? { ...state, status: "ready", draft: paymentSettingsDraftFrom(result.settings) } : { ...state, status: "failed" };
}

export async function submitPaymentSettings(client: PaymentSettingsClient, state: PaymentSettingsState): Promise<PaymentSettingsState> {
  const validation = validatePaymentSettings(state.draft);
  if (!validation.ok) return { ...state, errors: validation.errors, message: null, notice: null };
  const saved = await savePaymentSettings(client, validation.row);
  if (!saved) return { ...state, errors: {}, message: paymentSettingsMessages.saveFailed, notice: null };
  return { ...state, draft: paymentSettingsDraftFrom(validation.row), errors: {}, message: null, notice: paymentSettingsMessages.saved };
}
