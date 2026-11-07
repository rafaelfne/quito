import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWholeNumber } from "@/lib/billing";
import { describeNextDue, dueDayLimit } from "@/lib/payment-settings";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import { formatPhone, groupStudentsByGuardian, type Student } from "@/lib/students";

export type GuardianDueDaysClient = Pick<SupabaseClient, "from">;

export type GuardianDueDayRow = {
  guardian_phone: string;
  due_day: number;
};

export type GuardianDueGroup = {
  phone: string;
  guardianName: string;
  studentNames: string[];
  dueDay: string;
};

export type GuardianDueDaysState = {
  status: "loading" | "ready" | "failed";
  groups: GuardianDueGroup[];
  defaultDueDay: number;
  errors: Record<string, string>;
  notices: Record<string, string>;
  messages: Record<string, string>;
};

export type GuardianDueDaysLoad = {
  ok: true;
  groups: GuardianDueGroup[];
} | { ok: false };

export const guardianDueDaysMessages = {
  dueDayInvalid: `Escreva um dia de 1 a ${dueDayLimit}, ou deixe em branco para usar o dia padrão.`,
  loadFailed: "Não deu para abrir o vencimento por responsável agora. Confira a internet e tente de novo.",
  saveFailed: "Não deu para guardar o vencimento agora. Confira a internet e toque em Guardar de novo.",
  saved: "Vencimento deste responsável guardado.",
  cleared: "Este responsável voltou a usar o dia padrão.",
  empty: "Cadastre alunos para escolher um dia diferente por responsável.",
};

const table = "guardian_due_days";

const columns = "guardian_phone, due_day";

export const initialGuardianDueDays: GuardianDueDaysState = {
  status: "loading",
  groups: [],
  defaultDueDay: 5,
  errors: {},
  notices: {},
  messages: {},
};

export function dueDayForGuardian(defaultDueDay: number, override: number | null | undefined): number {
  return override ?? defaultDueDay;
}

export function overridesByPhone(rows: GuardianDueDayRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.guardian_phone, row.due_day]));
}

export function guardianDueGroupsFrom(students: Student[], overrides: Map<string, number>): GuardianDueGroup[] {
  return groupStudentsByGuardian(students).map((group) => {
    const phone = group[0].guardian_phone;
    const override = overrides.get(phone);
    return {
      phone,
      guardianName: group[0].guardian_name,
      studentNames: group.map((student) => student.name),
      dueDay: override === undefined ? "" : String(override),
    };
  });
}

export function describeGuardianStudents(names: string[]): string {
  if (names.length === 1) return `Aluno: ${names[0]}.`;
  if (names.length === 2) return `Alunos: ${names[0]} e ${names[1]}.`;
  return `Alunos: ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}.`;
}

export function describeGuardianDue(today: string, dueDayDraft: string, defaultDueDay: number): string | null {
  const dueDay = dueDayDraft.trim() === "" ? defaultDueDay : parseWholeNumber(dueDayDraft, dueDayLimit);
  return dueDay === null ? null : describeNextDue(today, String(dueDay));
}

export function validateGuardianDueDay(dueDayDraft: string): { ok: true; dueDay: number | null } | { ok: false; error: string } {
  if (dueDayDraft.trim() === "") return { ok: true, dueDay: null };
  const dueDay = parseWholeNumber(dueDayDraft, dueDayLimit);
  if (dueDay === null) return { ok: false, error: guardianDueDaysMessages.dueDayInvalid };
  return { ok: true, dueDay };
}

export async function loadGuardianDueDays(client: GuardianDueDaysClient): Promise<{ ok: true; rows: GuardianDueDayRow[] } | { ok: false }> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select(columns)), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, rows: (data ?? []) as GuardianDueDayRow[] };
  } catch {
    return { ok: false };
  }
}

export async function saveGuardianDueDay(client: GuardianDueDaysClient, phone: string, dueDay: number): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(client.from(table).upsert({ guardian_phone: phone, due_day: dueDay }, { onConflict: "owner_id,guardian_phone" })),
      requestTimeoutMs,
    );
    return !error;
  } catch {
    return false;
  }
}

export async function clearGuardianDueDay(client: GuardianDueDaysClient, phone: string): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).delete().eq("guardian_phone", phone)), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

function withoutPhone(record: Record<string, string>, phone: string): Record<string, string> {
  const next = { ...record };
  delete next[phone];
  return next;
}

export function changeGuardianDueDay(state: GuardianDueDaysState, phone: string, dueDay: string): GuardianDueDaysState {
  return {
    ...state,
    groups: state.groups.map((group) => (group.phone === phone ? { ...group, dueDay } : group)),
    errors: withoutPhone(state.errors, phone),
    notices: withoutPhone(state.notices, phone),
    messages: withoutPhone(state.messages, phone),
  };
}

export function startReloadingGuardianDueDays(state: GuardianDueDaysState, defaultDueDay: number): GuardianDueDaysState {
  return { ...state, status: "loading", defaultDueDay, errors: {}, notices: {}, messages: {} };
}

export function applyGuardianDueDaysLoad(
  state: GuardianDueDaysState,
  result: GuardianDueDaysLoad,
  defaultDueDay: number,
): GuardianDueDaysState {
  if (!result.ok) return { ...state, status: "failed", defaultDueDay };
  return { ...state, status: "ready", groups: result.groups, defaultDueDay, errors: {}, notices: {}, messages: {} };
}

export async function submitGuardianDueDay(
  client: GuardianDueDaysClient,
  state: GuardianDueDaysState,
  phone: string,
): Promise<GuardianDueDaysState> {
  const group = state.groups.find((entry) => entry.phone === phone);
  if (!group) return state;
  const validation = validateGuardianDueDay(group.dueDay);
  if (!validation.ok) {
    return {
      ...state,
      errors: { ...withoutPhone(state.errors, phone), [phone]: validation.error },
      notices: withoutPhone(state.notices, phone),
      messages: withoutPhone(state.messages, phone),
    };
  }
  const saved = validation.dueDay === null ? await clearGuardianDueDay(client, phone) : await saveGuardianDueDay(client, phone, validation.dueDay);
  if (!saved) {
    return {
      ...state,
      errors: withoutPhone(state.errors, phone),
      notices: withoutPhone(state.notices, phone),
      messages: { ...withoutPhone(state.messages, phone), [phone]: guardianDueDaysMessages.saveFailed },
    };
  }
  const notice = validation.dueDay === null ? guardianDueDaysMessages.cleared : guardianDueDaysMessages.saved;
  return {
    ...state,
    groups: state.groups.map((entry) =>
      entry.phone === phone ? { ...entry, dueDay: validation.dueDay === null ? "" : String(validation.dueDay) } : entry,
    ),
    errors: withoutPhone(state.errors, phone),
    notices: { ...withoutPhone(state.notices, phone), [phone]: notice },
    messages: withoutPhone(state.messages, phone),
  };
}

export function formatGuardianPhone(phone: string): string {
  return formatPhone(phone);
}
