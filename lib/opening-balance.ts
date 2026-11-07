import { describeMonthName } from "@/lib/charge-adjustments";
import { chargedLessonsBefore, counted, loadMarksThrough } from "@/lib/closing";
import { dateKeyOf, describeShortDay, monthRange, type LessonMark, type LessonsClient } from "@/lib/lessons";
import { creditExpiresOn, openCredits } from "@/lib/makeups";
import type { CalendarMonth } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import { loadStudents, sortStudents, type Student, type StudentOpeningBalance } from "@/lib/students";
import { loadTeacherRules } from "@/lib/teacher-rules";
import { firstChargedMonth, loadTrainingMonth } from "@/lib/training";

export type OpeningPrediction = { packageBalance: number | null; makeupCredits: number };

export type OpeningDraft = { packageBalance: string; makeupCredits: string };

export type OpeningErrors = Partial<Record<keyof OpeningDraft, string>>;

export type OpeningRow = StudentOpeningBalance & { opening_balance_on: string; opening_makeup_credits: number };

export type OpeningValidation = { ok: true; row: OpeningRow } | { ok: false; errors: OpeningErrors };

export type OpeningBalanceLoad = { ok: true; trainingMonth: CalendarMonth | null; students: Student[]; marks: LessonMark[]; makeupDeadlineDays: number | null } | { ok: false };

export type OpeningBalanceState = {
  status: "loading" | "ready" | "failed";
  trainingMonth: CalendarMonth | null;
  makeupDeadlineDays: number | null;
  students: Student[];
  predictions: Record<string, OpeningPrediction>;
  drafts: Record<string, OpeningDraft>;
  errors: Record<string, OpeningErrors>;
  message: string | null;
  notice: string | null;
};

export const openingBalancePath = "/students/opening-balance";

export const openingBalanceLimit = 100;

export const openingBalanceMessages = {
  title: "Acerto do saldo",
  noTraining: "O acerto do saldo aparece depois que você abre os primeiros passos.",
  noStudents: "Nenhum aluno passou pelo treino. Quem foi cadastrado depois já começa do saldo do cadastro.",
  loadFailed: "Não deu para abrir o acerto do saldo agora. Confira a internet e tente de novo.",
  invalid: "Confira os valores marcados e toque em Confirmar o saldo de novo.",
  creditsInvalid: `Escreva quantos créditos de reposição o aluno tem, de 0 a ${openingBalanceLimit}.`,
  confirmed: "Confirmado. A contagem real parte deste saldo.",
  pending: "Ainda não confirmado.",
  confirm: "Confirmar o saldo",
  lessonsNotice: "Começou o primeiro mês cobrado. Confira quantas aulas sobram no pacote e quantos créditos de reposição cada aluno tem depois do treino.",
  lessonsLink: "Acertar o saldo",
};

export const initialOpeningBalance: OpeningBalanceState = {
  status: "loading",
  trainingMonth: null,
  makeupDeadlineDays: null,
  students: [],
  predictions: {},
  drafts: {},
  errors: {},
  message: null,
  notice: null,
};

const emptyDraft: OpeningDraft = { packageBalance: "", makeupCredits: "0" };

export function openingDayOf(trainingMonth: CalendarMonth): string {
  return monthRange(firstChargedMonth(trainingMonth)).first;
}

export function isOpeningConfirmed(student: Student): boolean {
  return (student.opening_balance_on ?? null) !== null;
}

function enteredBefore(student: Student, openingDay: string): boolean {
  return student.created_at === undefined || dateKeyOf(new Date(student.created_at)) < openingDay;
}

export function trainedStudents(students: Student[], openingDay: string): Student[] {
  return sortStudents(students.filter((student) => enteredBefore(student, openingDay)));
}

export function needsOpeningBalance(students: Student[], trainingMonth: CalendarMonth | null, today: string): boolean {
  if (trainingMonth === null) return false;
  const openingDay = openingDayOf(trainingMonth);
  return today >= openingDay && trainedStudents(students, openingDay).some((student) => !isOpeningConfirmed(student));
}

function packageLessonsOf(student: Student): number | null {
  return student.billing_kind === "package" ? student.package_lessons : null;
}

function predictPackage(student: Student, marks: LessonMark[], openingDay: string): number | null {
  const lessons = packageLessonsOf(student);
  if (lessons === null || lessons <= 0) return null;
  const balance = student.package_balance ?? 0;
  const used = chargedLessonsBefore(marks, student.id, openingDay);
  const bought = Math.ceil(Math.max(0, used - balance) / lessons);
  return Math.min(openingBalanceLimit, balance + bought * lessons - used);
}

function startingCreditsLeft(student: Student, deadlineDays: number | null, openingDay: string): number {
  const count = student.makeup_credits ?? 0;
  if (count === 0 || student.created_at === undefined) return 0;
  const expiresOn = creditExpiresOn(dateKeyOf(new Date(student.created_at)), deadlineDays);
  return expiresOn === null || expiresOn >= openingDay ? count : 0;
}

export function predictOpening(student: Student, marks: LessonMark[], deadlineDays: number | null, openingDay: string): OpeningPrediction {
  const trainingMarks = marks.filter((mark) => mark.student_id === student.id && mark.lesson_date < openingDay);
  const open = openCredits([{ ...student, opening_balance_on: null }], trainingMarks, deadlineDays, openingDay).length;
  return {
    packageBalance: predictPackage(student, marks, openingDay),
    makeupCredits: Math.min(openingBalanceLimit, open + startingCreditsLeft(student, deadlineDays, openingDay)),
  };
}

function draftFrom(student: Student, prediction: OpeningPrediction): OpeningDraft {
  const confirmed = isOpeningConfirmed(student);
  const packageBalance = (confirmed ? (student.opening_package_balance ?? null) : null) ?? prediction.packageBalance;
  const makeupCredits = confirmed ? (student.opening_makeup_credits ?? 0) : prediction.makeupCredits;
  return { packageBalance: packageBalance === null ? "" : String(packageBalance), makeupCredits: String(makeupCredits) };
}

export function openingDraftOf(state: OpeningBalanceState, id: string): OpeningDraft {
  return state.drafts[id] ?? emptyDraft;
}

export function applyOpeningLoad(state: OpeningBalanceState, load: OpeningBalanceLoad): OpeningBalanceState {
  if (!load.ok) return { ...state, status: "failed" };
  const { trainingMonth, makeupDeadlineDays } = load;
  if (trainingMonth === null) return { ...state, status: "ready", trainingMonth, makeupDeadlineDays, students: [], predictions: {}, drafts: {} };
  const openingDay = openingDayOf(trainingMonth);
  const students = trainedStudents(load.students, openingDay);
  const predictions = Object.fromEntries(students.map((student) => [student.id, predictOpening(student, load.marks, makeupDeadlineDays, openingDay)]));
  const drafts = Object.fromEntries(students.map((student) => [student.id, state.drafts[student.id] ?? draftFrom(student, predictions[student.id])]));
  return { ...state, status: "ready", trainingMonth, makeupDeadlineDays, students, predictions, drafts };
}

export function startReloadingOpening(state: OpeningBalanceState): OpeningBalanceState {
  return { ...state, status: "loading" };
}

export function changeOpeningDraft(state: OpeningBalanceState, id: string, field: keyof OpeningDraft, value: string): OpeningBalanceState {
  return { ...state, drafts: { ...state.drafts, [id]: { ...openingDraftOf(state, id), [field]: value } }, message: null, notice: null };
}

function parseCount(raw: string, limit: number): number | null {
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number <= limit ? number : null;
}

export function packageBalanceInvalid(limit: number): string {
  return `Escreva quantas aulas sobram no pacote, de 0 a ${limit}.`;
}

export function validateOpening(student: Student, draft: OpeningDraft, openingDay: string): OpeningValidation {
  const errors: OpeningErrors = {};
  const lessons = packageLessonsOf(student);
  const packageLimit = lessons === null ? null : Math.min(openingBalanceLimit, lessons);
  const packageBalance = packageLimit === null ? null : parseCount(draft.packageBalance, packageLimit);
  const makeupCredits = parseCount(draft.makeupCredits, openingBalanceLimit);
  if (packageLimit !== null && packageBalance === null) errors.packageBalance = packageBalanceInvalid(packageLimit);
  if (makeupCredits === null) errors.makeupCredits = openingBalanceMessages.creditsInvalid;
  if (makeupCredits === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, row: { opening_balance_on: openingDay, opening_package_balance: packageBalance, opening_makeup_credits: makeupCredits } };
}

export async function saveOpeningBalance(client: LessonsClient, id: string, row: OpeningRow): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from("students").update(row).eq("id", id).select("id")), requestTimeoutMs);
    return !error && (data ?? []).length > 0;
  } catch {
    return false;
  }
}


export function describeOpeningIntro(trainingMonth: CalendarMonth): string {
  return `O treino de ${describeMonthName(trainingMonth)} acabou. A contagem real de ${describeMonthName(firstChargedMonth(trainingMonth))} começa do saldo abaixo. O Quitô calculou cada valor com as aulas marcadas no treino: confirme ou corrija o que estiver diferente.`;
}

export function describeOpeningNotYet(trainingMonth: CalendarMonth): string {
  return `O acerto do saldo abre em ${describeShortDay(openingDayOf(trainingMonth))}, quando começa o primeiro mês cobrado. Até lá, marque as aulas do treino normalmente.`;
}

export function describeCreditsDeadline(trainingMonth: CalendarMonth, deadlineDays: number | null): string {
  const expiresOn = creditExpiresOn(openingDayOf(trainingMonth), deadlineDays);
  return expiresOn === null ? "Os créditos não têm prazo." : `Os créditos confirmados valem até ${describeShortDay(expiresOn)}, pelo prazo de reposição contado do início do mês.`;
}

export function describePredictedPackage(count: number): string {
  return `Previsto pelo Quitô: ${counted(count, "aula", "aulas")}.`;
}

export function describePredictedCredits(count: number): string {
  return `Previsto pelo Quitô: ${counted(count, "crédito", "créditos")}.`;
}

function describeConfirmedCount(count: number, trainingMonth: CalendarMonth): string {
  return `Saldo de ${counted(count, "aluno confirmado", "alunos confirmados")}. A contagem de ${describeMonthName(firstChargedMonth(trainingMonth))} parte destes valores.`;
}

function describeSaveFailed(names: string[]): string {
  return `Não deu para guardar o saldo de ${names.join(", ")}. Confira a internet e toque em Confirmar o saldo de novo.`;
}

export async function submitOpeningBalance(client: LessonsClient, state: OpeningBalanceState): Promise<OpeningBalanceState> {
  if (state.trainingMonth === null || state.students.length === 0) return state;
  const openingDay = openingDayOf(state.trainingMonth);
  const validations = state.students.map((student) => ({ student, validation: validateOpening(student, openingDraftOf(state, student.id), openingDay) }));
  const errors = Object.fromEntries(validations.flatMap(({ student, validation }) => (validation.ok ? [] : [[student.id, validation.errors]])));
  const rows = validations.flatMap(({ student, validation }) => (validation.ok ? [{ student, row: validation.row }] : []));
  if (rows.length < validations.length) return { ...state, errors, message: openingBalanceMessages.invalid, notice: null };
  const results = await Promise.all(rows.map(async ({ student, row }) => ({ student, row, saved: await saveOpeningBalance(client, student.id, row) })));
  const savedRows = new Map(results.filter(({ saved }) => saved).map(({ student, row }) => [student.id, row]));
  const students = state.students.map((student) => ({ ...student, ...savedRows.get(student.id) }));
  const failed = results.filter(({ saved }) => !saved).map(({ student }) => student.name);
  const notice = savedRows.size > 0 ? describeConfirmedCount(savedRows.size, state.trainingMonth) : null;
  return { ...state, students, errors: {}, message: failed.length > 0 ? describeSaveFailed(failed) : null, notice };
}

export async function loadOpeningBalance(client: LessonsClient): Promise<OpeningBalanceLoad> {
  const [training, students, rules] = await Promise.all([loadTrainingMonth(client), loadStudents(client), loadTeacherRules(client)]);
  if (!training.ok || !students.ok || !rules.ok) return { ok: false };
  const { trainingMonth } = training;
  const makeupDeadlineDays = rules.rules.makeup_deadline_days;
  if (trainingMonth === null) return { ok: true, trainingMonth, students: students.students, marks: [], makeupDeadlineDays };
  const marks = await loadMarksThrough(client, monthRange(trainingMonth).last);
  if (marks === null) return { ok: false };
  return { ok: true, trainingMonth, students: students.students, marks, makeupDeadlineDays };
}
