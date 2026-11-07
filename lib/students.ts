import type { SupabaseClient } from "@supabase/supabase-js";
import { billingDraftFrom, emptyBillingDraft, validateBilling, type BillingDraft, type BillingRow, type SavedBilling } from "@/lib/billing";
import { emptyScheduleDraft, scheduleDraftFrom, validateSchedule, type SavedSchedule, type ScheduleDraft, type ScheduleRow } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type StudentsClient = Pick<SupabaseClient, "from">;

export type StudentGender = "male" | "female" | "other";

type StudentContact = { name: string; guardian_name: string; guardian_phone: string };

export type StudentRow = StudentContact & BillingRow & ScheduleRow & { gender: StudentGender; called_as: string | null };

export type Student = StudentContact & SavedBilling & SavedSchedule & { id: string; gender: StudentGender | null; called_as: string | null };

export type StudentDraft = BillingDraft & ScheduleDraft & { name: string; gender: string; calledAs: string; guardianName: string; guardianPhone: string };

export type StudentField = keyof StudentDraft;

export type StudentErrors = Partial<Record<StudentField, string>>;

export type StudentValidation = { ok: true; row: StudentRow } | { ok: false; errors: StudentErrors };

export type StudentsLoad = { ok: true; students: Student[] } | { ok: false };

export type StudentsListStatus = "loading" | "ready" | "failed";

export type StudentsState = {
  students: Student[];
  listStatus: StudentsListStatus;
  newDraft: StudentDraft;
  editing: { id: string; draft: StudentDraft } | null;
  errors: StudentErrors;
  message: string | null;
  notice: string | null;
};

export const studentsPath = "/students";

export const studentNameLimit = 120;

export const studentGenderOptions: { value: StudentGender; label: string }[] = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "other", label: "Outro" },
];

export const studentMessages = {
  nameMissing: "Escreva o nome do aluno.",
  genderMissing: "Escolha o gênero do aluno.",
  calledAsMissing: "Escreva como o aluno quer ser chamado.",
  calledAsTooLong: `O jeito de chamar o aluno passou do limite de ${studentNameLimit} caracteres. Encurte o texto e toque em Guardar de novo.`,
  nameTooLong: `O nome do aluno passou do limite de ${studentNameLimit} caracteres. Encurte o texto e toque em Guardar de novo.`,
  guardianMissing: "Escreva o nome do responsável.",
  guardianTooLong: `O nome do responsável passou do limite de ${studentNameLimit} caracteres. Encurte o texto e toque em Guardar de novo.`,
  phoneInvalid: "Confira o telefone: ele precisa ter o DDD e o número, como (11) 98765-4321.",
  loadFailed: "Não deu para atualizar a lista de alunos agora. Confira a internet e tente de novo.",
  saveFailed: "Não deu para guardar o cadastro agora. Confira a internet e toque em Guardar de novo.",
};

const table = "students";

const columns = "id, name, gender, called_as, guardian_name, guardian_phone, billing_kind, billing_amount_cents, package_lessons, lesson_weekday, lesson_time";

const nationalPhonePattern = /^[1-9]{2}(9\d{8}|[2-9]\d{7})$/;

const countryCodePattern = /^55\d{10,11}$/;

const emptyDraft: StudentDraft = { name: "", gender: "", calledAs: "", guardianName: "", guardianPhone: "", ...emptyBillingDraft, ...emptyScheduleDraft };

export const initialStudents: StudentsState = {
  students: [],
  listStatus: "loading",
  newDraft: emptyDraft,
  editing: null,
  errors: {},
  message: null,
  notice: null,
};

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  const national = countryCodePattern.test(digits) ? digits.slice(2) : digits;
  return nationalPhonePattern.test(national) ? national : null;
}

export function formatPhone(phone: string): string {
  return phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
}

function isStudentGender(value: string): value is StudentGender {
  return studentGenderOptions.some((option) => option.value === value);
}

function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function nameError(name: string, missing: string, tooLong: string): string | undefined {
  if (!name) return missing;
  return name.length > studentNameLimit ? tooLong : undefined;
}

export function validateStudent(draft: StudentDraft): StudentValidation {
  const name = cleanName(draft.name);
  const calledAs = draft.gender === "other" ? cleanName(draft.calledAs) : null;
  const guardianName = cleanName(draft.guardianName);
  const phone = normalizePhone(draft.guardianPhone);
  const billing = validateBilling(draft);
  const schedule = validateSchedule(draft);
  const errors: StudentErrors = { ...(billing.ok ? {} : billing.errors), ...(schedule.ok ? {} : schedule.errors) };
  const nameProblem = nameError(name, studentMessages.nameMissing, studentMessages.nameTooLong);
  const guardianProblem = nameError(guardianName, studentMessages.guardianMissing, studentMessages.guardianTooLong);
  if (nameProblem) errors.name = nameProblem;
  if (!isStudentGender(draft.gender)) errors.gender = studentMessages.genderMissing;
  const calledAsProblem = calledAs === null ? undefined : nameError(calledAs, studentMessages.calledAsMissing, studentMessages.calledAsTooLong);
  if (calledAsProblem) errors.calledAs = calledAsProblem;
  if (guardianProblem) errors.guardianName = guardianProblem;
  if (!phone) errors.guardianPhone = studentMessages.phoneInvalid;
  if (!phone || !billing.ok || !schedule.ok || !isStudentGender(draft.gender) || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, row: { name, gender: draft.gender, called_as: calledAs, guardian_name: guardianName, guardian_phone: phone, ...billing.row, ...schedule.row } };
}

export function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export function groupStudentsByGuardian(students: Student[]): Student[][] {
  const groups = new Map<string, Student[]>();
  for (const student of sortStudents(students)) {
    const group = groups.get(student.guardian_phone) ?? [];
    group.push(student);
    groups.set(student.guardian_phone, group);
  }
  return [...groups.values()];
}

export async function loadStudents(client: StudentsClient): Promise<StudentsLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select(columns)), requestTimeoutMs);
    if (error) return { ok: false };
    return { ok: true, students: sortStudents((data ?? []) as Student[]) };
  } catch {
    return { ok: false };
  }
}

export async function saveStudent(client: StudentsClient, row: StudentRow, id: string | null): Promise<boolean> {
  try {
    if (id === null) {
      const { error } = await withTimeout(Promise.resolve(client.from(table).insert(row)), requestTimeoutMs);
      return !error;
    }
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).update(row).eq("id", id).select("id")), requestTimeoutMs);
    return !error && (data ?? []).length > 0;
  } catch {
    return false;
  }
}

export function currentDraft(state: StudentsState): StudentDraft {
  return state.editing?.draft ?? state.newDraft;
}

export function changeDraft(state: StudentsState, field: StudentField, value: string): StudentsState {
  const draft = { ...currentDraft(state), [field]: value };
  return state.editing ? { ...state, editing: { ...state.editing, draft } } : { ...state, newDraft: draft };
}

export function startEditing(state: StudentsState, student: Student): StudentsState {
  const draft = { name: student.name, gender: student.gender ?? "", calledAs: student.called_as ?? "", guardianName: student.guardian_name, guardianPhone: formatPhone(student.guardian_phone), ...billingDraftFrom(student), ...scheduleDraftFrom(student) };
  return { ...state, editing: { id: student.id, draft }, errors: {}, message: null, notice: null };
}

export function cancelEditing(state: StudentsState): StudentsState {
  return { ...state, editing: null, errors: {}, message: null, notice: null };
}

export function startReloading(state: StudentsState): StudentsState {
  return { ...state, listStatus: "loading" };
}

export function applyLoad(state: StudentsState, result: StudentsLoad): StudentsState {
  return result.ok ? { ...state, students: result.students, listStatus: "ready" } : { ...state, listStatus: "failed" };
}

export async function submitStudent(client: StudentsClient, state: StudentsState): Promise<StudentsState> {
  const validation = validateStudent(currentDraft(state));
  if (!validation.ok) return { ...state, errors: validation.errors, message: null, notice: null };
  const saved = await saveStudent(client, validation.row, state.editing?.id ?? null);
  if (!saved) return { ...state, errors: {}, message: studentMessages.saveFailed, notice: null };
  const next: StudentsState = {
    ...state,
    newDraft: state.editing ? state.newDraft : emptyDraft,
    editing: null,
    errors: {},
    message: null,
    notice: `Cadastro de ${validation.row.name} guardado.`,
  };
  return applyLoad(next, await loadStudents(client));
}
