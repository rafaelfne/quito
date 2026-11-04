import type { SupabaseClient } from "@supabase/supabase-js";
import { afterSignInPath } from "@/lib/session";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import { loadStudents, studentsPath, type Student } from "@/lib/students";

export type GettingStartedClient = Pick<SupabaseClient, "from">;

type StepFacts = { students: Student[] };

type StepDefinition = {
  id: string;
  title: string;
  hint: string;
  path: string;
  isDone: (facts: StepFacts) => boolean;
};

export type GettingStartedStep = Omit<StepDefinition, "isDone"> & { done: boolean };

export type GettingStartedProgress = { started: boolean; finished: boolean; steps: GettingStartedStep[] };

export type GettingStartedLoad = { ok: true; progress: GettingStartedProgress } | { ok: false };

export type GettingStartedState = { status: "loading" | "ready" | "failed"; steps: GettingStartedStep[] };

export type GettingStartedReminder = { kind: "none" } | { kind: "first-entry" } | { kind: "back" } | { kind: "progress"; steps: GettingStartedStep[] };

export const gettingStartedPath = "/getting-started";

export const gettingStartedMessages = {
  intro: "Siga estes passos para deixar o Quitô pronto para cobrar.",
  leaveHint: "Você pode sair e continuar depois. O Quitô guarda onde você parou.",
  finished: "Tudo pronto. Você terminou os primeiros passos.",
  loadFailed: "Não deu para abrir os primeiros passos agora. Confira a internet e tente de novo.",
  allDoneReminder: "Seus primeiros passos estão prontos.",
};

export const noReminder: GettingStartedReminder = { kind: "none" };

export const initialGettingStarted: GettingStartedState = { status: "loading", steps: [] };

const table = "getting_started";

function hasBillingAndSchedule(student: Student): boolean {
  return student.billing_kind !== null && student.billing_amount_cents !== null && student.lesson_weekday !== null && student.lesson_time !== null;
}

const stepDefinitions: StepDefinition[] = [
  {
    id: "students",
    title: "Cadastre seus alunos",
    hint: "Nome do aluno, nome do responsável e WhatsApp.",
    path: studentsPath,
    isDone: ({ students }) => students.length > 0,
  },
  {
    id: "billing-and-schedule",
    title: "Defina a forma de cobrança e o horário de cada aluno",
    hint: "Cada aluno precisa do valor, do jeito de pagar, do dia e da hora da aula.",
    path: studentsPath,
    isDone: ({ students }) => students.length > 0 && students.every(hasBillingAndSchedule),
  },
];

function stepsFrom(isDone: (definition: StepDefinition) => boolean): GettingStartedStep[] {
  return stepDefinitions.map((definition) => ({ id: definition.id, title: definition.title, hint: definition.hint, path: definition.path, done: isDone(definition) }));
}

export function remainingSteps(steps: GettingStartedStep[]): number {
  return steps.filter((step) => !step.done).length;
}

export function currentStep(steps: GettingStartedStep[]): GettingStartedStep | undefined {
  return steps.find((step) => !step.done);
}

export function describeRemaining(steps: GettingStartedStep[]): string {
  const remaining = remainingSteps(steps);
  return `${remaining === 1 ? "Falta" : "Faltam"} ${remaining} de ${steps.length} ${steps.length === 1 ? "passo" : "passos"}.`;
}

export async function loadGettingStarted(client: GettingStartedClient): Promise<GettingStartedLoad> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select("finished_at").maybeSingle()), requestTimeoutMs);
    if (error) return { ok: false };
    const record = data as { finished_at: string | null } | null;
    const started = record !== null;
    if (record?.finished_at) return { ok: true, progress: { started, finished: true, steps: stepsFrom(() => true) } };
    const students = await loadStudents(client);
    if (!students.ok) return { ok: false };
    return { ok: true, progress: { started, finished: false, steps: stepsFrom(({ isDone }) => isDone({ students: students.students })) } };
  } catch {
    return { ok: false };
  }
}

async function saved(request: PromiseLike<{ error: unknown }>): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(request), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export function startGettingStarted(client: GettingStartedClient): Promise<boolean> {
  return saved(client.from(table).upsert({ started_at: new Date().toISOString() }, { onConflict: "owner_id", ignoreDuplicates: true }));
}

export function finishGettingStarted(client: GettingStartedClient): Promise<boolean> {
  return saved(client.from(table).upsert({ finished_at: new Date().toISOString() }, { onConflict: "owner_id" }));
}

export async function openGettingStarted(client: GettingStartedClient): Promise<GettingStartedLoad> {
  const load = await loadGettingStarted(client);
  if (!load.ok) return load;
  const { progress } = load;
  if (!progress.started && !(await startGettingStarted(client))) return { ok: false };
  const finished = progress.finished || (remainingSteps(progress.steps) === 0 && (await finishGettingStarted(client)));
  return { ok: true, progress: { ...progress, started: true, finished } };
}

export function startReloadingGettingStarted(state: GettingStartedState): GettingStartedState {
  return { ...state, status: "loading" };
}

export function applyGettingStartedLoad(state: GettingStartedState, load: GettingStartedLoad): GettingStartedState {
  return load.ok ? { status: "ready", steps: load.progress.steps } : { ...state, status: "failed" };
}

function isStepPath(pathname: string): boolean {
  return stepDefinitions.some((definition) => definition.path === pathname);
}

export function tracksReminder(pathname: string): boolean {
  return pathname === afterSignInPath || isStepPath(pathname);
}

export function reminderFor(pathname: string, load: GettingStartedLoad): GettingStartedReminder {
  if (!load.ok || load.progress.finished) return noReminder;
  const { started, steps } = load.progress;
  if (pathname === afterSignInPath) return started ? { kind: "progress", steps } : { kind: "first-entry" };
  return started && isStepPath(pathname) ? { kind: "back" } : noReminder;
}
