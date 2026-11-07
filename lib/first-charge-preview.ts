import { describeMonthName } from "@/lib/charge-adjustments";
import { chargeDueDate, chargeMessageOf, loadChargeMessageContext, type ChargeMessageContext } from "@/lib/charge-message";
import { planMonthCharges } from "@/lib/charges";
import { buildMonthClosing, loadClosingMonth, type ClosingData } from "@/lib/closing";
import { firstChargedMonth } from "@/lib/first-charge";
import { dateKeyOf, describeShortDay, lessonKey, monthRange, shiftMonth, type LessonMark, type LessonsClient } from "@/lib/lessons";
import { paymentSettingsPath } from "@/lib/payment-settings";
import { calendarMonthOf, plannedLessons, type CalendarMonth } from "@/lib/schedule";
import { studentSetupPath } from "@/lib/student-setup";
import { studentsPath } from "@/lib/students";

export type FirstChargePreviewMissing = "students" | "payment" | "billing";

export type FirstChargePreview =
  | { kind: "ready"; firstMonth: CalendarMonth; guardianName: string; dueDate: string; message: string }
  | { kind: "missing"; firstMonth: CalendarMonth; missing: FirstChargePreviewMissing };

export type FirstChargePreviewFacts = {
  startedAt: string | null;
  today: string;
  closing: ClosingData;
  context: ChargeMessageContext;
};

export const firstChargePreviewId = "first-charge-preview";

export const firstChargePreviewMessages = {
  title: "Prévia da primeira cobrança",
  notSent: "Esta mensagem não é enviada agora. Ela mostra como o Quitô vai montar a cobrança, com um dos seus alunos.",
  missing: {
    students: "Cadastre seus alunos para ver a mensagem da primeira cobrança.",
    payment: "Guarde a chave Pix e o dia de vencimento em Recebimento para ver a mensagem da primeira cobrança.",
    billing: "Defina a forma de cobrança e o horário dos alunos para ver a mensagem da primeira cobrança.",
  } satisfies Record<FirstChargePreviewMissing, string>,
};

export const firstChargePreviewMissingPaths: Record<FirstChargePreviewMissing, string> = {
  students: studentsPath,
  payment: paymentSettingsPath,
  billing: studentSetupPath,
};

export function forecastMarks({ students, marks }: Pick<ClosingData, "students" | "marks">, month: CalendarMonth): LessonMark[] {
  const marked = new Set(marks.map((mark) => lessonKey({ studentId: mark.student_id, date: mark.lesson_date })));
  const forecast = students.flatMap((student) =>
    plannedLessons(student, month)
      .filter(({ date }) => !marked.has(lessonKey({ studentId: student.id, date })))
      .map(({ date }): LessonMark => ({ student_id: student.id, lesson_date: date, status: "given", makeup_date: null })),
  );
  return [...marks, ...forecast];
}

export function firstChargePreviewFrom({ startedAt, today, closing, context }: FirstChargePreviewFacts): FirstChargePreview | null {
  const entryMonth = calendarMonthOf(startedAt === null ? new Date(`${today}T12:00:00`) : new Date(startedAt));
  const firstMonth = firstChargedMonth(entryMonth);
  if (today > monthRange(firstMonth).last) return null;
  if (closing.students.length === 0) return { kind: "missing", firstMonth, missing: "students" };
  if (context.payment === null) return { kind: "missing", firstMonth, missing: "payment" };
  const forecast = buildMonthClosing({ ...closing, marks: forecastMarks(closing, firstMonth) }, firstMonth, monthRange(firstMonth).first);
  const [charge] = planMonthCharges(forecast, firstMonth, []).newCharges;
  if (charge === undefined) return { kind: "missing", firstMonth, missing: "billing" };
  const previewCharge = { ...charge, id: firstChargePreviewId };
  const dueDate = chargeDueDate(previewCharge, context.payment.due_day, context.dueDayOverrides);
  const message = chargeMessageOf(previewCharge, context, dueDate) ?? "";
  return { kind: "ready", firstMonth, guardianName: charge.guardian_name, dueDate, message };
}

export function describeFirstChargePreview(preview: Extract<FirstChargePreview, { kind: "ready" }>): string {
  return `Esta é a mensagem que ${preview.guardianName} recebe em ${describeShortDay(preview.dueDate)}, com o valor previsto para ${describeMonthName(preview.firstMonth)} se todas as aulas do horário forem dadas. O valor final sai das aulas que você marcar.`;
}

export async function loadFirstChargePreview(client: LessonsClient, startedAt: string | null, now: Date = new Date()): Promise<FirstChargePreview | null> {
  const today = dateKeyOf(now);
  const entryMonth = calendarMonthOf(startedAt === null ? now : new Date(startedAt));
  const [closing, context] = await Promise.all([loadClosingMonth(client, shiftMonth(entryMonth, 1)), loadChargeMessageContext(client)]);
  if (!closing.ok || context === null) return null;
  const { students, enrollments, marks, rules } = closing;
  return firstChargePreviewFrom({ startedAt, today, closing: { students, enrollments, marks, rules }, context });
}
