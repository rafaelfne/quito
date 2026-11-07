import { pendingAdjustments, settleAdjustments, type PendingAdjustment, type SettledAdjustment } from "@/lib/charge-adjustments";
import { chargeDueDatesFor, composedMessagesFor, loadChargeMessageContext, reminderMessagesFor } from "@/lib/charge-message";
import { buildMonthClosing, describeUnmarked, loadClosingMonth, type GuardianClosing, type MonthClosing, type StudentClosing } from "@/lib/closing";
import { describeMonth, monthRange, shiftMonth, type LessonsClient } from "@/lib/lessons";
import { loadMessagePreview } from "@/lib/message-preview";
import { reminderProgress, type ReminderProgress } from "@/lib/reminders";
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

export type Charge = NewCharge & { id: string; sent_at?: string | null; paid_at?: string | null; reminders_sent_at?: string[] | null };

export type WaitingStudent = { studentId: string; studentName: string; unmarked: number; missingBilling: boolean };

export type WaitingGuardian = { phone: string; guardianName: string; students: WaitingStudent[] };

export type ChargesPlan = { newCharges: NewCharge[]; waiting: WaitingGuardian[]; nothingToCharge: string[] };

export type ChargesLoad = { ok: true; month: CalendarMonth; charges: Charge[]; waiting: WaitingGuardian[]; nothingToCharge: string[]; messages?: Record<string, string>; dueDates?: Record<string, string>; today?: string; previewConfirmed?: boolean; reminderDays?: number[]; reminderMessages?: Record<string, string[]> } | { ok: false; month: CalendarMonth };

export type ChargesState = { month: CalendarMonth; status: "loading" | "ready" | "failed"; charges: Charge[]; waiting: WaitingGuardian[]; nothingToCharge: string[]; messages: Record<string, string>; dueDates: Record<string, string>; today: string; previewConfirmed: boolean; confirmingPreview: boolean; previewMessage: string | null; savingSends: string[]; sendMessage: string | null; savingPayments: string[]; paymentMessage: string | null; reminderDays: number[]; reminderMessages: Record<string, string[]>; savingReminders: string[]; reminderNotice: string | null };

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
  previewFirst: "Antes do primeiro envio, leia a mensagem como o responsável vai receber. Se estiver certa, toque em \"A mensagem está certa\". Depois disso, você pode enviar as cobranças.",
  confirmPreview: "A mensagem está certa",
  confirmingPreview: "Guardando...",
  confirmPreviewFailed: "Não deu para guardar agora. Confira a internet e toque de novo.",
  sendOnDueDay: "O botão de enviar aparece no dia do vencimento.",
  sendOnWhatsApp: "Enviar pelo WhatsApp",
  savingSend: "Guardando...",
  sent: "Enviada pelo WhatsApp.",
  undoHint: "Se você desistiu e a mensagem não saiu, desfaça para a cobrança voltar a esperar o envio.",
  undoSend: "Desfazer o envio",
  sendFailed: "O Quitô não conseguiu guardar que a cobrança foi enviada. Confira a internet e toque de novo.",
  undoFailed: "Não deu para desfazer o envio agora. Confira a internet e toque de novo.",
  markPaid: "Marcar como pago",
  savingPayment: "Guardando...",
  paid: "Paga.",
  paidHint: "Os lembretes deste responsável param neste mês. Se marcou por engano, desfaça.",
  undoPaid: "Desfazer o pagamento",
  paymentFailed: "O Quitô não conseguiu guardar que a cobrança foi paga. Confira a internet e toque de novo.",
  undoPaymentFailed: "Não deu para desfazer o pagamento agora. Confira a internet e toque de novo.",
  reminderToday: "para hoje",
  sendReminder: "Enviar lembrete pelo WhatsApp",
  savingReminder: "Guardando...",
  undoReminder: "Desfazer o último lembrete",
  allRemindersSent: "Todos os lembretes deste mês foram enviados.",
  reminderFailed: "O Quitô não conseguiu guardar que o lembrete foi enviado. Confira a internet e toque de novo.",
  undoReminderFailed: "Não deu para desfazer o lembrete agora. Confira a internet e toque de novo.",
  todayTitle: "Para enviar hoje",
  nothingToday: "Nada para enviar hoje.",
  openTitle: "Em aberto",
  paidTitle: "Pagas",
  coveredTitle: "Cobertas pelo acerto",
  dueToday: "Vence hoje",
};

export type ChargeGroups = { today: Charge[]; open: Charge[]; paid: Charge[]; covered: Charge[] };

const table = "charges";

const columns = "id, charge_month, guardian_phone, guardian_name, total_cents, account, sent_at, paid_at, reminders_sent_at";

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
  const [result, context, preview] = await Promise.all([syncMonthCharges(client, month, today), loadChargeMessageContext(client), loadMessagePreview(client)]);
  if (!result.ok || context === null || !preview.ok) return { ok: false, month };
  return {
    ...result,
    messages: composedMessagesFor(result.charges, context, today),
    dueDates: chargeDueDatesFor(result.charges, context),
    today,
    previewConfirmed: preview.confirmed,
    reminderDays: context.reminderDays,
    reminderMessages: reminderMessagesFor(result.charges, context, today),
  };
}

export function initialCharges(month: CalendarMonth): ChargesState {
  return { month, status: "loading", charges: [], waiting: [], nothingToCharge: [], messages: {}, dueDates: {}, today: "", previewConfirmed: false, confirmingPreview: false, previewMessage: null, savingSends: [], sendMessage: null, savingPayments: [], paymentMessage: null, reminderDays: [], reminderMessages: {}, savingReminders: [], reminderNotice: null };
}

export function startReloadingCharges(state: ChargesState): ChargesState {
  return { ...state, status: "loading" };
}

export function applyChargesLoad(state: ChargesState, result: ChargesLoad): ChargesState {
  if (!result.ok) return { ...state, status: "failed" };
  const { charges, waiting, nothingToCharge, messages = {}, dueDates = {}, today = "", previewConfirmed = false, reminderDays = [], reminderMessages = {} } = result;
  return { ...state, status: "ready", charges, waiting, nothingToCharge, messages, dueDates, today, previewConfirmed, reminderDays, reminderMessages };
}

export function needsFirstPreview(state: ChargesState): boolean {
  return !state.previewConfirmed && Object.keys(state.messages).length > 0;
}

export function canSendCharges(state: ChargesState): boolean {
  return state.previewConfirmed;
}

export function isDueToSend(state: ChargesState, chargeId: string): boolean {
  const due = state.dueDates[chargeId];
  return due !== undefined && state.today !== "" && state.today >= due;
}

export function canSendCharge(state: ChargesState, chargeId: string): boolean {
  return canSendCharges(state) && isDueToSend(state, chargeId) && state.messages[chargeId] !== undefined;
}

export function describeReadyFor(due: string): string {
  return `Pronta para o dia ${Number(due.slice(8))}`;
}

export function startConfirmingPreview(state: ChargesState): ChargesState {
  return { ...state, confirmingPreview: true, previewMessage: null };
}

export function applyPreviewConfirmation(state: ChargesState, saved: boolean): ChargesState {
  if (!saved) return { ...state, confirmingPreview: false, previewMessage: chargeMessages.confirmPreviewFailed };
  return { ...state, confirmingPreview: false, previewConfirmed: true, previewMessage: null };
}

export function isChargeSent(charge: Charge): boolean {
  return Boolean(charge.sent_at);
}

export function startSavingSend(state: ChargesState, chargeId: string): ChargesState {
  return { ...state, savingSends: [...state.savingSends.filter((id) => id !== chargeId), chargeId], sendMessage: null };
}

export function applySendSaved(state: ChargesState, chargeId: string, sentAt: string | null, saved: boolean): ChargesState {
  const savingSends = state.savingSends.filter((id) => id !== chargeId);
  if (!saved) return { ...state, savingSends, sendMessage: sentAt ? chargeMessages.sendFailed : chargeMessages.undoFailed };
  return { ...state, savingSends, charges: state.charges.map((charge) => (charge.id === chargeId ? { ...charge, sent_at: sentAt } : charge)) };
}

export function isChargePaid(charge: Charge): boolean {
  return Boolean(charge.paid_at);
}

export function awaitsReminders(charge: Charge): boolean {
  return isChargeSent(charge) && !isChargePaid(charge);
}

export function startSavingPayment(state: ChargesState, chargeId: string): ChargesState {
  return { ...state, savingPayments: [...state.savingPayments.filter((id) => id !== chargeId), chargeId], paymentMessage: null };
}

export function applyPaidSaved(state: ChargesState, chargeId: string, paidAt: string | null, saved: boolean): ChargesState {
  const savingPayments = state.savingPayments.filter((id) => id !== chargeId);
  if (!saved) return { ...state, savingPayments, paymentMessage: paidAt ? chargeMessages.paymentFailed : chargeMessages.undoPaymentFailed };
  return { ...state, savingPayments, charges: state.charges.map((charge) => (charge.id === chargeId ? { ...charge, paid_at: paidAt } : charge)) };
}

export function remindersSentOf(charge: Charge): string[] {
  return charge.reminders_sent_at ?? [];
}

export function reminderProgressOf(state: ChargesState, charge: Charge): ReminderProgress | null {
  if (!awaitsReminders(charge) || !charge.sent_at) return null;
  return reminderProgress(charge.sent_at, remindersSentOf(charge), state.reminderDays);
}

export function isReminderDue(state: ChargesState, progress: ReminderProgress): boolean {
  return progress.next !== null && state.today !== "" && state.today >= progress.next.due;
}

export function reminderMessageOf(state: ChargesState, chargeId: string, index: number): string | undefined {
  return state.reminderMessages[chargeId]?.[index];
}

export function withReminderSent(charge: Charge, sentAt: string): string[] {
  return [...remindersSentOf(charge), sentAt];
}

export function withoutLastReminder(charge: Charge): string[] {
  return remindersSentOf(charge).slice(0, -1);
}

export function startSavingReminder(state: ChargesState, chargeId: string): ChargesState {
  return { ...state, savingReminders: [...state.savingReminders.filter((id) => id !== chargeId), chargeId], reminderNotice: null };
}

export function applyRemindersSaved(state: ChargesState, chargeId: string, remindersSentAt: string[], saved: boolean, undoing: boolean): ChargesState {
  const savingReminders = state.savingReminders.filter((id) => id !== chargeId);
  if (!saved) return { ...state, savingReminders, reminderNotice: undoing ? chargeMessages.undoReminderFailed : chargeMessages.reminderFailed };
  return { ...state, savingReminders, charges: state.charges.map((charge) => (charge.id === chargeId ? { ...charge, reminders_sent_at: remindersSentAt } : charge)) };
}

export function hasReminderToday(state: ChargesState, charge: Charge): boolean {
  const progress = reminderProgressOf(state, charge);
  return progress !== null && isReminderDue(state, progress);
}

function groupOf(state: ChargesState, charge: Charge): keyof ChargeGroups {
  if (charge.total_cents === 0) return "covered";
  if (isChargePaid(charge)) return "paid";
  if (!isChargeSent(charge) && isDueToSend(state, charge.id)) return "today";
  if (hasReminderToday(state, charge)) return "today";
  return "open";
}

export function groupCharges(state: ChargesState): ChargeGroups {
  const groups: ChargeGroups = { today: [], open: [], paid: [], covered: [] };
  for (const charge of state.charges) groups[groupOf(state, charge)].push(charge);
  return groups;
}

const dayMs = 24 * 60 * 60 * 1000;

function dayNumberOf(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / dayMs;
}

export function daysBetween(from: string, to: string): number {
  return dayNumberOf(to) - dayNumberOf(from);
}

export function describeOpenDays(days: number): string {
  if (days === 0) return chargeMessages.dueToday;
  return `Em aberto há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function describeOpenFor(state: ChargesState, charge: Charge): string | null {
  const due = state.dueDates[charge.id];
  if (isChargePaid(charge) || due === undefined || !isDueToSend(state, charge.id)) return null;
  return describeOpenDays(daysBetween(due, state.today));
}
