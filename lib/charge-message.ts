import { formatCurrency } from "@/lib/billing";
import { adjustmentLabelPrefix, describeMonthName, monthOfKey } from "@/lib/charge-adjustments";
import type { Charge, ChargeStudent } from "@/lib/charges";
import { describeSignedAmount, lineUnitSeparator, monthlyLineLabel, notChargedNote, siblingDiscountPrefix, type ClosingLine } from "@/lib/closing";
import { dueDayForGuardian, loadGuardianDueDays, overridesByPhone } from "@/lib/guardian-due-days";
import { shiftMonth, type LessonsClient } from "@/lib/lessons";
import { loadMessageSettings, messageAdjustmentsFrom, messageSettingsDraftFrom } from "@/lib/message-settings";
import { composeMessage, type MessageAdjustments, type MessageParts } from "@/lib/message-templates";
import { dueDateIn, loadPaymentSettings, type PaymentSettingsRow } from "@/lib/payment-settings";
import { loadStudents, type Student } from "@/lib/students";

export type ChargeMessageContext = {
  adjustments: MessageAdjustments;
  payment: PaymentSettingsRow | null;
  dueDayOverrides: Map<string, number>;
  students: Pick<Student, "id" | "gender" | "called_as">[];
};

type NamedStudent = { name: string; article: string; account: ChargeStudent };

const articles = { male: "do", female: "da", other: "de" };

const givenLessonSuffix = / dadas?$/;

function listed(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase("pt-BR") + text.slice(1);
}

function namedStudents(charge: Charge, students: ChargeMessageContext["students"]): NamedStudent[] {
  const registered = new Map(students.map((student) => [student.id, student]));
  return charge.account.map((account) => {
    const student = registered.get(account.studentId);
    return {
      name: student?.gender === "other" && student.called_as ? student.called_as : account.studentName,
      article: student?.gender ? articles[student.gender] : articles.other,
      account,
    };
  });
}

function isDiscount({ label }: ClosingLine): boolean {
  return label.startsWith(siblingDiscountPrefix);
}

function isAdjustment({ label }: ClosingLine): boolean {
  return label.startsWith(adjustmentLabelPrefix);
}

function isMultiplied({ label }: ClosingLine): boolean {
  return label.includes(lineUnitSeparator);
}

function multipliedLines(name: string, lines: ClosingLine[]): string[] {
  const units = new Map<string, { quantities: string[]; cents: number }>();
  for (const { label, cents } of lines) {
    const [quantity, unit] = label.split(lineUnitSeparator);
    const group = units.get(unit) ?? { quantities: [], cents: 0 };
    units.set(unit, { quantities: [...group.quantities, quantity.replace(givenLessonSuffix, "")], cents: group.cents + cents });
  }
  return [...units].map(([unit, { quantities, cents }]) => `${name}: ${listed(quantities)}${lineUnitSeparator}${unit} = ${formatCurrency(cents)}`);
}

function plainLine(name: string, { label, cents }: ClosingLine): string {
  if (label === monthlyLineLabel) return `${name}: ${lowerFirst(label)} ${formatCurrency(cents)}`;
  if (cents === 0) return `${name}: ${lowerFirst(label)}`;
  return `${name}: ${lowerFirst(label)}: ${describeSignedAmount(cents)}`;
}

function notChargedAbsences(name: string, { attendance, lines }: ChargeStudent): string[] {
  if (lines.some(({ label }) => label === monthlyLineLabel)) return [];
  return attendance
    .replace(/\.$/, "")
    .split("; ")
    .filter((part) => part.endsWith(notChargedNote))
    .map((part) => `${name}: ${part}`);
}

function studentLines({ name, account }: NamedStudent): string[] {
  const lines = account.lines.filter((line) => !isDiscount(line));
  const adjustments = lines.filter(isAdjustment);
  const regular = lines.filter((line) => !isAdjustment(line));
  return [
    ...multipliedLines(name, regular.filter(isMultiplied)),
    ...regular.filter((line) => !isMultiplied(line)).map((line) => plainLine(name, line)),
    ...notChargedAbsences(name, account),
    ...adjustments.map((line) => plainLine(name, line)),
  ];
}

function discountLines(students: NamedStudent[]): string[] {
  const totals = new Map<string, number>();
  for (const { label, cents } of students.flatMap(({ account }) => account.lines).filter(isDiscount)) totals.set(label, (totals.get(label) ?? 0) + cents);
  return [...totals].map(([label, cents]) => `${label}: ${describeSignedAmount(cents)}`);
}

export function accountLinesOf(charge: Charge, students: ChargeMessageContext["students"]): string[] {
  const named = namedStudents(charge, students);
  return [...named.flatMap(studentLines), ...discountLines(named)];
}

export function chargeDueDate(charge: Charge, defaultDueDay: number, overrides: Map<string, number>): string {
  const dueDay = dueDayForGuardian(defaultDueDay, overrides.get(charge.guardian_phone));
  return dueDateIn(shiftMonth(monthOfKey(charge.charge_month), 1), dueDay);
}

export function chargeMessageParts(charge: Charge, { payment, dueDayOverrides, students }: ChargeMessageContext, today: string): MessageParts | null {
  if (payment === null) return null;
  const named = namedStudents(charge, students);
  const due = chargeDueDate(charge, payment.due_day, dueDayOverrides);
  const dueMonth = monthOfKey(due);
  const dueDay = String(Number(due.slice(8)));
  return {
    guardianName: charge.guardian_name,
    studentNames: listed(named.map(({ name }) => name)),
    studentsWithArticles: listed(named.map(({ name, article }) => `${article} ${name}`)),
    month: describeMonthName(monthOfKey(charge.charge_month)),
    accountLines: accountLinesOf(charge, students),
    total: formatCurrency(charge.total_cents),
    dueDay,
    dueShort: `${dueDay}/${dueMonth.month}`,
    dueLong: `${dueDay} de ${describeMonthName(dueMonth)}`,
    duePassed: today > due,
    pixKey: payment.pix_key,
    receiverName: payment.display_name,
  };
}

export function chargeMessageOf(charge: Charge, context: ChargeMessageContext, today: string): string | null {
  const parts = chargeMessageParts(charge, context, today);
  return parts === null ? null : composeMessage(context.adjustments, parts);
}

export function composedMessagesFor(charges: Charge[], context: ChargeMessageContext, today: string): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const charge of charges) {
    const message = charge.total_cents > 0 ? chargeMessageOf(charge, context, today) : null;
    if (message !== null) messages[charge.id] = message;
  }
  return messages;
}

export function chargeDueDatesFor(charges: Charge[], { payment, dueDayOverrides }: ChargeMessageContext): Record<string, string> {
  if (payment === null) return {};
  return Object.fromEntries(charges.filter((charge) => charge.total_cents > 0).map((charge) => [charge.id, chargeDueDate(charge, payment.due_day, dueDayOverrides)]));
}

export async function loadChargeMessageContext(client: LessonsClient): Promise<ChargeMessageContext | null> {
  const [payment, message, dueDays, students] = await Promise.all([loadPaymentSettings(client), loadMessageSettings(client), loadGuardianDueDays(client), loadStudents(client)]);
  if (!payment.ok || !message.ok || !dueDays.ok || !students.ok) return null;
  return {
    adjustments: messageAdjustmentsFrom(messageSettingsDraftFrom(message.settings)),
    payment: payment.settings,
    dueDayOverrides: overridesByPhone(dueDays.rows),
    students: students.students,
  };
}
