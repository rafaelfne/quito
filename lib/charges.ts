import { pendingAdjustments, settleAdjustments, type PendingAdjustment, type SettledAdjustment } from "@/lib/charge-adjustments";
import { composedMessagesFor, loadChargeMessageContext } from "@/lib/charge-message";
import { buildMonthClosing, describeUnmarked, loadClosingMonth, type GuardianClosing, type MonthClosing, type StudentClosing } from "@/lib/closing";
import { describeMonth, monthRange, shiftMonth, type LessonsClient } from "@/lib/lessons";
import { calendarMonthOf, type CalendarMonth } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type ChargeStudent = Pick<StudentClosing, "studentId" | "studentName" | "lines" | "attendance" | "packageBalance" | "credits" | "totalCents"> & { basis?: StudentClosing["basis"]; settled?: SettledAdjustment[] };

export type NewCharge = {
  charge_month: string;
  guardian_phone: string;
  guardian_name: string;
  total_cents: number;
  account: ChargeStudent[];
};

export type Charge = NewCharge & { id: string };

export type WaitingStudent = { studentId: string; studentName: string; unmarked: number; missingBilling: boolean };

export type WaitingGuardian = { phone: string; guardianName: string; students: WaitingStudent[] };

export type ChargesPlan = { newCharges: NewCharge[]; waiting: WaitingGuardian[]; nothingToCharge: string[] };

export type ChargesLoad = { ok: true; month: CalendarMonth; charges: Charge[]; waiting: WaitingGuardian[]; nothingToCharge: string[]; messages?: Record<string, string> } | { ok: false; month: CalendarMonth };

export type ChargesState = { month: CalendarMonth; status: "loading" | "ready" | "failed"; charges: Charge[]; waiting: WaitingGuardian[]; nothingToCharge: string[]; messages: Record<string, string> };

export const chargesPath = "/charges";

export const chargeMessages = {
  loadFailed: "Não deu para abrir as cobranças agora. Confira a internet e tente de novo.",
  empty: "Nenhuma cobrança deste mês. As cobranças aparecem aqui depois que o mês acaba, para os alunos que já estavam cadastrados nele.",
  frozen: "O valor fica guardado como estava quando a cobrança ficou pronta. Corrigir uma aula depois não muda este valor: a diferença entra na próxima cobrança do responsável.",
  coveredByAdjustment: "O acerto cobriu o valor deste mês. Este responsável não tem nada a pagar agora.",
  guardianTotal: "Total a cobrar",
  monthTotal: "Total do mês",
  waitingTitle: "Ainda não ficaram prontas",
  missingBilling: "Forma de cobrança ainda não definida.",
  defineBilling: "Definir a forma de cobrança em Alunos",
  nothingToChargeTitle: "Nada a cobrar neste mês",
  messageTitle: "Mensagem para o responsável",
  messageNeedsPayment: "Para montar a mensagem, falta guardar a sua chave Pix e o seu nome.",
  fillPayment: "Preencher em Recebimento",
};

const table = "charges";

const columns = "id, charge_month, guardian_phone, guardian_name, total_cents, account";

const chargesPageSize = 1000;

export function endedMonthOf(date: Date): CalendarMonth {
  return shiftMonth(calendarMonthOf(date), -1);
}

export function describeMarkLessons(month: CalendarMonth): string {
  return `Marcar as aulas de ${describeMonth(month).toLocaleLowerCase("pt-BR")}`;
}

export function describeWaitingStudent({ unmarked, missingBilling }: WaitingStudent): string {
  return missingBilling ? chargeMessages.missingBilling : describeUnmarked(unmarked);
}

export function waitsForMarks(waiting: WaitingGuardian[]): boolean {
  return waiting.some((guardian) => guardian.students.some((student) => student.unmarked > 0));
}

export function waitsForBilling(waiting: WaitingGuardian[]): boolean {
  return waiting.some((guardian) => guardian.students.some((student) => student.missingBilling));
}

function holdsCharge(student: StudentClosing): boolean {
  return student.missingBilling || (student.dependsOnMarks && student.unmarked > 0);
}

export function isGuardianReady(guardian: GuardianClosing): boolean {
  return !guardian.students.some(holdsCharge);
}

function waitingGuardianFrom({ phone, guardianName, students }: GuardianClosing): WaitingGuardian {
  return {
    phone,
    guardianName,
    students: students.filter(holdsCharge).map(({ studentId, studentName, unmarked, missingBilling }) => ({ studentId, studentName, unmarked: missingBilling ? 0 : unmarked, missingBilling })),
  };
}

function chargeStudentFrom({ studentId, studentName, lines, attendance, packageBalance, credits, totalCents, basis }: StudentClosing, applied: PendingAdjustment[]): ChargeStudent {
  const own = applied.filter((adjustment) => adjustment.studentId === studentId);
  return {
    studentId,
    studentName,
    lines: [...lines, ...own.map(({ label, cents }) => ({ label, cents }))],
    attendance,
    packageBalance,
    credits,
    totalCents: own.reduce((total, { cents }) => total + cents, totalCents),
    basis,
    settled: own.map(({ month, cents }) => ({ month, cents })),
  };
}

function newChargeFrom(guardian: GuardianClosing, month: CalendarMonth, applied: PendingAdjustment[]): NewCharge {
  return {
    charge_month: monthRange(month).first,
    guardian_phone: guardian.phone,
    guardian_name: guardian.guardianName,
    total_cents: applied.reduce((total, { cents }) => total + cents, guardian.totalCents),
    account: guardian.students.map((student) => chargeStudentFrom(student, applied)),
  };
}

export function planMonthCharges(closing: MonthClosing, month: CalendarMonth, existing: Charge[], adjustments: Map<string, PendingAdjustment[]> = new Map()): ChargesPlan {
  const chargedPhones = new Set(existing.map((charge) => charge.guardian_phone));
  const chargedStudents = new Set(existing.flatMap((charge) => charge.account.map((student) => student.studentId)));
  const plan: ChargesPlan = { newCharges: [], waiting: [], nothingToCharge: [] };
  for (const guardian of closing.guardians) {
    if (chargedPhones.has(guardian.phone) || guardian.students.some((student) => chargedStudents.has(student.studentId))) continue;
    const applied = settleAdjustments(guardian.totalCents, guardian.students.flatMap((student) => adjustments.get(student.studentId) ?? []));
    if (!isGuardianReady(guardian)) plan.waiting.push(waitingGuardianFrom(guardian));
    else if (guardian.totalCents === 0 && applied.length === 0) plan.nothingToCharge.push(guardian.guardianName);
    else plan.newCharges.push(newChargeFrom(guardian, month, applied));
  }
  return plan;
}

export function monthChargesTotal(charges: Charge[]): number {
  return charges.reduce((total, charge) => total + charge.total_cents, 0);
}

export async function loadMonthCharges(client: LessonsClient, month: CalendarMonth): Promise<Charge[] | null> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from(table).select(columns).eq("charge_month", monthRange(month).first)), requestTimeoutMs);
    return error ? null : ((data ?? []) as Charge[]);
  } catch {
    return null;
  }
}

export async function loadEarlierCharges(client: LessonsClient, month: CalendarMonth): Promise<Charge[] | null> {
  const charges: Charge[] = [];
  try {
    for (;;) {
      const request = client.from(table).select(columns).lt("charge_month", monthRange(month).first).order("charge_month").order("id").range(charges.length, charges.length + chargesPageSize - 1);
      const { data, error } = await withTimeout(Promise.resolve(request), requestTimeoutMs);
      if (error) return null;
      const page = (data ?? []) as Charge[];
      charges.push(...page);
      if (page.length < chargesPageSize) return charges;
    }
  } catch {
    return null;
  }
}

export async function insertNewCharges(client: LessonsClient, charges: NewCharge[]): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from(table).upsert(charges, { onConflict: "owner_id,charge_month,guardian_phone", ignoreDuplicates: true })), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

function byGuardianName(charges: Charge[]): Charge[] {
  return [...charges].sort((a, b) => a.guardian_name.localeCompare(b.guardian_name, "pt-BR", { sensitivity: "base" }));
}

export async function syncMonthCharges(client: LessonsClient, month: CalendarMonth, today: string): Promise<ChargesLoad> {
  const [closing, existing, earlier] = await Promise.all([loadClosingMonth(client, month), loadMonthCharges(client, month), loadEarlierCharges(client, month)]);
  if (!closing.ok || existing === null || earlier === null) return { ok: false, month };
  const { newCharges, waiting, nothingToCharge } = planMonthCharges(buildMonthClosing(closing, month, today), month, existing, pendingAdjustments(earlier, closing.marks));
  if (newCharges.length === 0) return { ok: true, month, charges: byGuardianName(existing), waiting, nothingToCharge };
  if (!(await insertNewCharges(client, newCharges))) return { ok: false, month };
  const charges = await loadMonthCharges(client, month);
  if (charges === null) return { ok: false, month };
  return { ok: true, month, charges: byGuardianName(charges), waiting, nothingToCharge };
}

export async function syncChargesWithMessages(client: LessonsClient, month: CalendarMonth, today: string): Promise<ChargesLoad> {
  const [result, context] = await Promise.all([syncMonthCharges(client, month, today), loadChargeMessageContext(client)]);
  if (!result.ok || context === null) return { ok: false, month };
  return { ...result, messages: composedMessagesFor(result.charges, context, today) };
}

export function initialCharges(month: CalendarMonth): ChargesState {
  return { month, status: "loading", charges: [], waiting: [], nothingToCharge: [], messages: {} };
}

export function startReloadingCharges(state: ChargesState): ChargesState {
  return { ...state, status: "loading" };
}

export function applyChargesLoad(state: ChargesState, result: ChargesLoad): ChargesState {
  if (!result.ok) return { ...state, status: "failed" };
  const { charges, waiting, nothingToCharge, messages = {} } = result;
  return { ...state, status: "ready", charges, waiting, nothingToCharge, messages };
}
