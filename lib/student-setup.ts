import { emptyBillingDraft, validateBilling, type BillingDraft, type BillingErrors, type BillingRow } from "@/lib/billing";
import { scheduleDraftFrom, validateSchedule, type ScheduleDraft, type ScheduleErrors, type ScheduleRow } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import { sortStudents, type Student, type StudentsClient, type StudentsLoad } from "@/lib/students";

export type StudentSetupState = {
  students: Student[];
  listStatus: "loading" | "ready" | "failed";
  selected: string[];
  billing: BillingDraft;
  billingErrors: BillingErrors;
  schedules: Record<string, ScheduleDraft>;
  scheduleErrors: Record<string, ScheduleErrors>;
  message: string | null;
  notice: string | null;
};

export const studentSetupPath = "/students/setup";

export const studentSetupMessages = {
  noneSelected: "Marque pelo menos um aluno para aplicar a forma de cobrança.",
  loadFailed: "Não deu para abrir a lista de alunos agora. Confira a internet e tente de novo.",
  billingFailed: "Não deu para aplicar a forma de cobrança agora. Confira a internet e toque em Aplicar de novo.",
  scheduleFailed: "Não deu para guardar o horário agora. Confira a internet e toque em Guardar de novo.",
};

export const initialStudentSetup: StudentSetupState = {
  students: [],
  listStatus: "loading",
  selected: [],
  billing: emptyBillingDraft,
  billingErrors: {},
  schedules: {},
  scheduleErrors: {},
  message: null,
  notice: null,
};

function studentCount(count: number): string {
  return `${count} ${count === 1 ? "aluno" : "alunos"}`;
}

export function describeApply(count: number): string {
  return count === 0 ? "Marque os alunos" : `Aplicar a ${studentCount(count)}`;
}

export function describeApplied(count: number): string {
  return `Forma de cobrança aplicada a ${studentCount(count)}. Agora acerte o horário de cada um.`;
}

export function hasBilling(student: Student): boolean {
  return student.billing_kind !== null && student.billing_amount_cents !== null;
}

export function scheduleDraftOf(state: StudentSetupState, id: string): ScheduleDraft {
  return state.schedules[id] ?? { lessonWeekday: "", lessonTime: "" };
}

export function applySetupLoad(state: StudentSetupState, result: StudentsLoad): StudentSetupState {
  if (!result.ok) return { ...state, listStatus: "failed" };
  const schedules = Object.fromEntries(result.students.map((student) => [student.id, state.schedules[student.id] ?? scheduleDraftFrom(student)]));
  const ids = new Set(result.students.map((student) => student.id));
  return { ...state, students: result.students, listStatus: "ready", schedules, selected: state.selected.filter((id) => ids.has(id)) };
}

export function startReloadingSetup(state: StudentSetupState): StudentSetupState {
  return { ...state, listStatus: "loading" };
}

export function toggleStudent(state: StudentSetupState, id: string): StudentSetupState {
  const selected = state.selected.includes(id) ? state.selected.filter((current) => current !== id) : [...state.selected, id];
  return { ...state, selected, message: null, notice: null };
}

export function selectWithoutBilling(state: StudentSetupState): StudentSetupState {
  return { ...state, selected: state.students.filter((student) => !hasBilling(student)).map((student) => student.id), message: null, notice: null };
}

export function clearSelection(state: StudentSetupState): StudentSetupState {
  return { ...state, selected: [], message: null, notice: null };
}

export function changeGroupBilling(state: StudentSetupState, field: keyof BillingDraft, value: string): StudentSetupState {
  return { ...state, billing: { ...state.billing, [field]: value } };
}

export function changeSchedule(state: StudentSetupState, id: string, field: keyof ScheduleDraft, value: string): StudentSetupState {
  return { ...state, schedules: { ...state.schedules, [id]: { ...scheduleDraftOf(state, id), [field]: value } } };
}

async function updateStudents(client: StudentsClient, row: BillingRow | ScheduleRow, ids: string[]): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from("students").update(row).in("id", ids).select("id")), requestTimeoutMs);
    return !error && (data ?? []).length === ids.length;
  } catch {
    return false;
  }
}

export function saveGroupBilling(client: StudentsClient, row: BillingRow, ids: string[]): Promise<boolean> {
  return ids.length === 0 ? Promise.resolve(false) : updateStudents(client, row, ids);
}

export function saveStudentSchedule(client: StudentsClient, row: ScheduleRow, id: string): Promise<boolean> {
  return updateStudents(client, row, [id]);
}

function mergeStudents(students: Student[], ids: string[], row: BillingRow | ScheduleRow): Student[] {
  return sortStudents(students.map((student) => (ids.includes(student.id) ? { ...student, ...row } : student)));
}

export async function submitGroupBilling(client: StudentsClient, state: StudentSetupState): Promise<StudentSetupState> {
  if (state.selected.length === 0) return { ...state, billingErrors: {}, message: studentSetupMessages.noneSelected, notice: null };
  const validation = validateBilling(state.billing);
  if (!validation.ok) return { ...state, billingErrors: validation.errors, message: null, notice: null };
  if (!(await saveGroupBilling(client, validation.row, state.selected))) return { ...state, billingErrors: {}, message: studentSetupMessages.billingFailed, notice: null };
  return {
    ...state,
    students: mergeStudents(state.students, state.selected, validation.row),
    selected: [],
    billing: emptyBillingDraft,
    billingErrors: {},
    message: null,
    notice: describeApplied(state.selected.length),
  };
}

export async function submitStudentSchedule(client: StudentsClient, state: StudentSetupState, id: string): Promise<StudentSetupState> {
  const student = state.students.find((current) => current.id === id);
  if (!student) return state;
  const validation = validateSchedule(scheduleDraftOf(state, id));
  const otherErrors = Object.fromEntries(Object.entries(state.scheduleErrors).filter(([key]) => key !== id));
  if (!validation.ok) return { ...state, scheduleErrors: { ...otherErrors, [id]: validation.errors }, message: null, notice: null };
  if (!(await saveStudentSchedule(client, validation.row, id))) return { ...state, scheduleErrors: otherErrors, message: studentSetupMessages.scheduleFailed, notice: null };
  return { ...state, students: mergeStudents(state.students, [id], validation.row), scheduleErrors: otherErrors, message: null, notice: `Horário de ${student.name} guardado.` };
}
