import type { SupabaseClient } from "@supabase/supabase-js";
import { amountError, formatAmount, parseAmount, parseWholeNumber } from "@/lib/billing";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type TeacherRulesClient = Pick<SupabaseClient, "from">;

export const makeupPolicies = ["none", "deadline"] as const;

export type MakeupPolicy = (typeof makeupPolicies)[number];

export const fiveWeekPolicies = ["same_price", "add_lesson"] as const;

export type FiveWeekPolicy = (typeof fiveWeekPolicies)[number];

export type TeacherRulesRow = {
  notice_hours: number;
  makeup_deadline_days: number | null;
  five_week_policy: FiveWeekPolicy;
  five_week_extra_cents: number | null;
  sibling_discount_percent: number;
};

export type TeacherRulesDraft = {
  noticeHours: string;
  makeupPolicy: string;
  makeupDays: string;
  fiveWeekPolicy: string;
  fiveWeekExtra: string;
  siblingDiscountPercent: string;
};

export type TeacherRulesField = keyof TeacherRulesDraft;

export type TeacherRulesErrors = Partial<Record<TeacherRulesField, string>>;

export type TeacherRulesValidation = { ok: true; row: TeacherRulesRow } | { ok: false; errors: TeacherRulesErrors };

export type TeacherRulesLoad = { ok: true; rules: TeacherRulesRow } | { ok: false };

export type TeacherRulesState = {
  status: "loading" | "ready" | "failed";
  draft: TeacherRulesDraft;
  errors: TeacherRulesErrors;
  message: string | null;
  notice: string | null;
};

export const teacherRulesPath = "/rules";

export const noticeHoursLimit = 168;

export const makeupDaysLimit = 365;

export const siblingDiscountLimit = 100;

export const defaultTeacherRules: TeacherRulesRow = {
  notice_hours: 24,
  makeup_deadline_days: null,
  five_week_policy: "same_price",
  five_week_extra_cents: null,
  sibling_discount_percent: 0,
};

export const makeupOptions: Record<MakeupPolicy, string> = {
  none: "Sem prazo",
  deadline: "Com prazo",
};

export const fiveWeekOptions: Record<FiveWeekPolicy, string> = {
  same_price: "Custa igual aos outros meses",
  add_lesson: "Soma o valor de uma aula avulsa",
};

export const teacherRulesMessages = {
  noticeInvalid: `Escreva quantas horas antes da aula, de 1 a ${noticeHoursLimit}.`,
  makeupDaysInvalid: `Escreva o prazo em dias, de 1 a ${makeupDaysLimit}.`,
  loadFailed: "Não deu para abrir as suas regras agora. Confira a internet e tente de novo.",
  saveFailed: "Não deu para guardar as regras agora. Confira a internet e toque em Guardar de novo.",
  saved: "Regras guardadas.",
  siblingDiscountInvalid: `Escreva um desconto de 0 a ${siblingDiscountLimit}%.`,
};

const table = "teacher_rules";

const columns = "notice_hours, makeup_deadline_days, five_week_policy, five_week_extra_cents, sibling_discount_percent";

export function teacherRulesDraftFrom(rules: TeacherRulesRow): TeacherRulesDraft {
  const { makeup_deadline_days: days, five_week_extra_cents: extra } = rules;
  return {
    noticeHours: String(rules.notice_hours),
    makeupPolicy: days === null ? "none" : "deadline",
    makeupDays: days === null ? "" : String(days),
    fiveWeekPolicy: rules.five_week_policy,
    fiveWeekExtra: extra === null ? "" : formatAmount(extra),
    siblingDiscountPercent: String(rules.sibling_discount_percent),
  };
}

export const initialTeacherRules: TeacherRulesState = {
  status: "loading",
  draft: teacherRulesDraftFrom(defaultTeacherRules),
  errors: {},
  message: null,
  notice: null,
};

export function validateTeacherRules(draft: TeacherRulesDraft): TeacherRulesValidation {
  const noticeHours = parseWholeNumber(draft.noticeHours, noticeHoursLimit);
  const makeupDays = draft.makeupPolicy === "deadline" ? parseWholeNumber(draft.makeupDays, makeupDaysLimit) : null;
  const addsLesson = draft.fiveWeekPolicy === "add_lesson";
  const extraCents = addsLesson ? parseAmount(draft.fiveWeekExtra) : null;
  const siblingDiscountPercent = draft.siblingDiscountPercent.trim() === "0" ? 0 : parseWholeNumber(draft.siblingDiscountPercent, siblingDiscountLimit);
  const errors: TeacherRulesErrors = {};
  const extraProblem = addsLesson ? amountError(extraCents) : undefined;
  if (noticeHours === null) errors.noticeHours = teacherRulesMessages.noticeInvalid;
  if (draft.makeupPolicy === "deadline" && makeupDays === null) errors.makeupDays = teacherRulesMessages.makeupDaysInvalid;
  if (extraProblem) errors.fiveWeekExtra = extraProblem;
  if (siblingDiscountPercent === null) errors.siblingDiscountPercent = teacherRulesMessages.siblingDiscountInvalid;
  if (noticeHours === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    row: {
      notice_hours: noticeHours,
      makeup_deadline_days: makeupDays,
      five_week_policy: addsLesson ? "add_lesson" : "same_price",
      five_week_extra_cents: extraCents,
      sibling_discount_percent: siblingDiscountPercent ?? 0,
    },
  };
}

export async function loadTeacherRules(client: TeacherRulesClient): Promise<TeacherRulesLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select(columns).maybeSingle()), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, rules: (data as TeacherRulesRow | null) ?? defaultTeacherRules };
  } catch {
    return { ok: false };
  }
}

export async function saveTeacherRules(client: TeacherRulesClient, row: TeacherRulesRow): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).upsert(row, { onConflict: "owner_id" })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export function changeTeacherRule(state: TeacherRulesState, field: TeacherRulesField, value: string): TeacherRulesState {
  return { ...state, draft: { ...state.draft, [field]: value }, notice: null };
}

export function startReloadingTeacherRules(state: TeacherRulesState): TeacherRulesState {
  return { ...state, status: "loading" };
}

export function applyTeacherRulesLoad(state: TeacherRulesState, result: TeacherRulesLoad): TeacherRulesState {
  return result.ok ? { ...state, status: "ready", draft: teacherRulesDraftFrom(result.rules) } : { ...state, status: "failed" };
}

export async function submitTeacherRules(client: TeacherRulesClient, state: TeacherRulesState): Promise<TeacherRulesState> {
  const validation = validateTeacherRules(state.draft);
  if (!validation.ok) return { ...state, errors: validation.errors, message: null, notice: null };
  const saved = await saveTeacherRules(client, validation.row);
  if (!saved) return { ...state, errors: {}, message: teacherRulesMessages.saveFailed, notice: null };
  return { ...state, draft: teacherRulesDraftFrom(validation.row), errors: {}, message: null, notice: teacherRulesMessages.saved };
}
