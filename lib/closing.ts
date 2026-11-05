import { discountAmount, formatCurrency, type BillingKind } from "@/lib/billing";
import { dateKeyOf, isCharged, lessonMarksTable, monthLessons, monthRange, shiftMonth, type LessonMark, type LessonStatus, type LessonsClient, type MonthLesson } from "@/lib/lessons";
import { describeCredit, monthMakeups, openCredits } from "@/lib/makeups";
import { plannedLessons, type CalendarMonth } from "@/lib/schedule";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import { groupStudentsByGuardian, loadStudents, type Student } from "@/lib/students";
import { loadTeacherRules, type TeacherRulesRow } from "@/lib/teacher-rules";

export type ClosingRules = Pick<TeacherRulesRow, "makeup_deadline_days" | "five_week_policy" | "five_week_extra_cents" | "sibling_discount_percent">;

export type StudentEnrollment = { id: string; created_at: string };

export type ClosingData = { students: Student[]; enrollments: StudentEnrollment[]; marks: LessonMark[]; rules: ClosingRules };

export type ClosingLine = { label: string; cents: number };

export type FrozenMark = Pick<LessonMark, "lesson_date" | "status" | "makeup_date">;

export type ChargeBasis = {
  billingKind: BillingKind;
  amountCents: number;
  packageLessons: number | null;
  discountPercent: number;
  monthCents: number;
  marks: FrozenMark[];
};

export type StudentClosing = {
  basis: ChargeBasis | null;
  studentId: string;
  studentName: string;
  lines: ClosingLine[];
  attendance: string;
  packageBalance: string | null;
  credits: string[];
  unmarked: number;
  missingBilling: boolean;
  dependsOnMarks: boolean;
  totalCents: number;
};

export type GuardianClosing = { phone: string; guardianName: string; students: StudentClosing[]; totalCents: number };

export type MonthClosing = { guardians: GuardianClosing[]; totalCents: number; unmarkedAffectingValue: number; missingBilling: number };

export type ClosingLoad = ({ ok: true; month: CalendarMonth } & ClosingData) | { ok: false; month: CalendarMonth };

export type ClosingState = { month: CalendarMonth; status: "loading" | "ready" | "failed"; data: ClosingData | null };

type AttendanceCounts = Record<LessonStatus, number> & { makeups: number; unmarked: number };

export const closingPath = "/closing";

export const closingMessages = {
  loadFailed: "Não deu para abrir o fechamento agora. Confira a internet e tente de novo.",
  noStudents: "Nenhum aluno neste mês. Cadastre os alunos na tela de Alunos.",
  missingBilling: "Forma de cobrança ainda não definida. Este aluno ainda não entra no total.",
  monthTotal: "Total do mês",
  guardianTotal: "Total a cobrar",
  creditsTitle: "Créditos de reposição em aberto",
};

const marksPageSize = 1000;

const marksColumns = "student_id, lesson_date, status, makeup_date";

export function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function attendanceCounts(lessons: MonthLesson[], makeups: number): AttendanceCounts {
  const counts: AttendanceCounts = { given: 0, notified_absence: 0, unnotified_absence: 0, teacher_absence: 0, makeups, unmarked: 0 };
  for (const { status } of lessons) {
    if (status === null) counts.unmarked += 1;
    else counts[status] += 1;
  }
  return counts;
}

export function describeAttendance(counts: AttendanceCounts): string {
  const parts = [
    counts.given > 0 ? counted(counts.given, "aula dada", "aulas dadas") : "",
    counts.unnotified_absence > 0 ? `${counted(counts.unnotified_absence, "falta sem aviso", "faltas sem aviso")}, cobrada${counts.unnotified_absence === 1 ? "" : "s"}` : "",
    counts.makeups > 0 ? counted(counts.makeups, "reposição", "reposições") : "",
    counts.notified_absence > 0 ? `${counted(counts.notified_absence, "falta avisada", "faltas avisadas")}, sem cobrança` : "",
    counts.teacher_absence > 0 ? `${counted(counts.teacher_absence, "falta do professor", "faltas do professor")}, sem cobrança` : "",
  ].filter(Boolean);
  return parts.length === 0 ? "Nenhuma aula marcada neste mês." : `${parts.join("; ")}.`;
}

export function describeUnmarked(count: number): string {
  return `${counted(count, "aula ainda sem marcar", "aulas ainda sem marcar")}.`;
}

export function describeSignedAmount(cents: number): string {
  return cents < 0 ? `− ${formatCurrency(-cents)}` : formatCurrency(cents);
}

export function describeValueWarning(count: number): string {
  return `${counted(count, "aula ainda sem marcar pode mudar", "aulas ainda sem marcar podem mudar")} o valor de quem paga por aula ou por pacote.`;
}

export function describeMissingBillingWarning(count: number): string {
  return count === 1 ? "1 aluno está sem forma de cobrança e não entra no total." : `${count} alunos estão sem forma de cobrança e não entram no total.`;
}

export function chargedLessonsBefore(marks: LessonMark[], studentId: string, limit: string): number {
  return marks.reduce((total, mark) => {
    if (mark.student_id !== studentId) return total;
    const lesson = isCharged(mark.status) && mark.lesson_date < limit ? 1 : 0;
    const makeup = mark.makeup_date !== null && mark.makeup_date < limit ? 1 : 0;
    return total + lesson + makeup;
  }, 0);
}

export function packageUsage(marks: LessonMark[], studentId: string, packageLessons: number, month: CalendarMonth) {
  const usedBefore = chargedLessonsBefore(marks, studentId, monthRange(month).first);
  const usedThrough = chargedLessonsBefore(marks, studentId, monthRange(shiftMonth(month, 1)).first);
  const packagesBefore = Math.ceil(usedBefore / packageLessons);
  const packagesThrough = Math.ceil(usedThrough / packageLessons);
  return {
    bought: packagesThrough - packagesBefore,
    carriedIn: packagesBefore * packageLessons - usedBefore,
    used: usedThrough - usedBefore,
    carriedOut: packagesThrough * packageLessons - usedThrough,
  };
}

function perClassLines(cents: number, counts: AttendanceCounts): ClosingLine[] {
  const unit = formatCurrency(cents);
  const lines = [
    { count: counts.given, label: counted(counts.given, "aula dada", "aulas dadas") },
    { count: counts.unnotified_absence, label: counted(counts.unnotified_absence, "falta sem aviso", "faltas sem aviso") },
    { count: counts.makeups, label: counted(counts.makeups, "reposição", "reposições") },
  ]
    .filter(({ count }) => count > 0)
    .map(({ count, label }) => ({ label: `${label} × ${unit}`, cents: count * cents }));
  return lines.length > 0 ? lines : [{ label: "Nenhuma aula cobrada neste mês", cents: 0 }];
}

function monthlyLines(student: Student, cents: number, month: CalendarMonth, rules: ClosingRules): ClosingLine[] {
  const lines = [{ label: "Mensalidade", cents }];
  const hasFiveWeeks = plannedLessons(student, month).length >= 5;
  if (hasFiveWeeks && rules.five_week_policy === "add_lesson" && rules.five_week_extra_cents !== null) lines.push({ label: "Mês com 5 semanas: uma aula avulsa a mais", cents: rules.five_week_extra_cents });
  return lines;
}

function packageLines(cents: number, packageLessons: number, bought: number): ClosingLine[] {
  if (bought === 0) return [{ label: "Nenhum pacote novo neste mês", cents: 0 }];
  return [{ label: `${counted(bought, "pacote", "pacotes")} de ${counted(packageLessons, "aula", "aulas")} × ${formatCurrency(cents)}`, cents: bought * cents }];
}

function describePackageBalance(usage: ReturnType<typeof packageUsage>): string {
  return `Saldo do mês anterior: ${counted(usage.carriedIn, "aula", "aulas")}. Usadas neste mês: ${usage.used}. Passam para o mês seguinte: ${usage.carriedOut}.`;
}

function chargeOf(student: Student, counts: AttendanceCounts, data: ClosingData, month: CalendarMonth): { lines: ClosingLine[]; packageBalance: string | null; billingKind: BillingKind; amountCents: number; packageLessons: number | null } | null {
  const { billing_kind: billingKind, billing_amount_cents: amountCents, package_lessons: packageLessons } = student;
  if (billingKind === null || amountCents === null) return null;
  const terms = { billingKind, amountCents, packageLessons };
  if (billingKind === "monthly") return { ...terms, lines: monthlyLines(student, amountCents, month, data.rules), packageBalance: null };
  if (billingKind === "per_class") return { ...terms, lines: perClassLines(amountCents, counts), packageBalance: null };
  if (packageLessons === null) return null;
  const usage = packageUsage(data.marks, student.id, packageLessons, month);
  return { ...terms, lines: packageLines(amountCents, packageLessons, usage.bought), packageBalance: describePackageBalance(usage) };
}

function frozenMarksOf(studentId: string, marks: LessonMark[], month: CalendarMonth): FrozenMark[] {
  const { first, last } = monthRange(month);
  const inMonth = (date: string | null) => date !== null && date >= first && date <= last;
  return marks.filter((mark) => mark.student_id === studentId && (inMonth(mark.lesson_date) || inMonth(mark.makeup_date))).map(({ lesson_date, status, makeup_date }) => ({ lesson_date, status, makeup_date }));
}

function closeStudent(student: Student, hasSiblings: boolean, credits: string[], data: ClosingData, month: CalendarMonth): StudentClosing {
  const lessons = monthLessons([student], data.marks, month);
  const counts = attendanceCounts(lessons, monthMakeups([student], data.marks, month).length);
  const charge = chargeOf(student, counts, data, month);
  const base = { studentId: student.id, studentName: student.name, attendance: describeAttendance(counts), credits, unmarked: counts.unmarked };
  if (charge === null) return { ...base, basis: null, lines: [], packageBalance: null, missingBilling: true, dependsOnMarks: false, totalCents: 0 };
  const grossCents = charge.lines.reduce((total, line) => total + line.cents, 0);
  const percent = hasSiblings ? data.rules.sibling_discount_percent : 0;
  const totalCents = discountAmount(grossCents, percent);
  const discountCents = grossCents - totalCents;
  const lines = discountCents > 0 ? [...charge.lines, { label: `Desconto de ${percent}% para irmãos`, cents: -discountCents }] : charge.lines;
  const basis = { billingKind: charge.billingKind, amountCents: charge.amountCents, packageLessons: charge.packageLessons, discountPercent: percent, monthCents: totalCents, marks: frozenMarksOf(student.id, data.marks, month) };
  return { ...base, basis, lines, packageBalance: charge.packageBalance, missingBilling: false, dependsOnMarks: student.billing_kind !== "monthly", totalCents };
}

function studentsOfMonth({ students, enrollments, marks }: ClosingData, month: CalendarMonth): Student[] {
  const { first, last } = monthRange(month);
  const enrolledOn = new Map(enrollments.map(({ id, created_at: createdAt }) => [id, dateKeyOf(new Date(createdAt))]));
  const hasMonthActivity = (student: Student) => marks.some((mark) => mark.student_id === student.id && ((mark.lesson_date >= first && mark.lesson_date <= last) || (mark.makeup_date !== null && mark.makeup_date >= first && mark.makeup_date <= last)));
  return students.filter((student) => (enrolledOn.get(student.id) ?? first) <= last || hasMonthActivity(student));
}

function creditsByStudent(students: Student[], { marks, rules }: ClosingData, month: CalendarMonth, today: string): Map<string, string[]> {
  const { first, last } = monthRange(month);
  const asOf = today >= first && today <= last ? today : last;
  const marksAtMonthEnd = marks.filter((mark) => mark.lesson_date <= last).map((mark) => (mark.makeup_date !== null && mark.makeup_date > last ? { ...mark, makeup_date: null } : mark));
  const credits = new Map<string, string[]>();
  for (const credit of openCredits(students, marksAtMonthEnd, rules.makeup_deadline_days, asOf)) credits.set(credit.studentId, [...(credits.get(credit.studentId) ?? []), describeCredit(credit)]);
  return credits;
}

export function buildMonthClosing(data: ClosingData, month: CalendarMonth, today: string): MonthClosing {
  const students = studentsOfMonth(data, month);
  const credits = creditsByStudent(students, data, month, today);
  const guardians = groupStudentsByGuardian(students)
    .map((group) => {
      const closed = group.map((student) => closeStudent(student, group.length > 1, credits.get(student.id) ?? [], data, month));
      return { phone: group[0].guardian_phone, guardianName: group[0].guardian_name, students: closed, totalCents: closed.reduce((total, student) => total + student.totalCents, 0) };
    })
    .sort((a, b) => a.guardianName.localeCompare(b.guardianName, "pt-BR", { sensitivity: "base" }));
  const closed = guardians.flatMap((guardian) => guardian.students);
  return {
    guardians,
    totalCents: guardians.reduce((total, guardian) => total + guardian.totalCents, 0),
    unmarkedAffectingValue: closed.reduce((total, student) => total + (student.dependsOnMarks ? student.unmarked : 0), 0),
    missingBilling: closed.filter((student) => student.missingBilling).length,
  };
}

export async function loadMarksThrough(client: LessonsClient, last: string): Promise<LessonMark[] | null> {
  const marks: LessonMark[] = [];
  try {
    for (;;) {
      const request = client.from(lessonMarksTable).select(marksColumns).lte("lesson_date", last).order("lesson_date").order("student_id").range(marks.length, marks.length + marksPageSize - 1);
      const { data, error } = await withTimeout(Promise.resolve(request), requestTimeoutMs);
      if (error) return null;
      const page = (data ?? []) as LessonMark[];
      marks.push(...page);
      if (page.length < marksPageSize) return marks;
    }
  } catch {
    return null;
  }
}

export async function loadEnrollments(client: LessonsClient): Promise<StudentEnrollment[] | null> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from("students").select("id, created_at")), requestTimeoutMs);
    return error ? null : ((data ?? []) as StudentEnrollment[]);
  } catch {
    return null;
  }
}

export async function loadClosingMonth(client: LessonsClient, month: CalendarMonth): Promise<ClosingLoad> {
  const [students, enrollments, marks, rules] = await Promise.all([loadStudents(client), loadEnrollments(client), loadMarksThrough(client, monthRange(month).last), loadTeacherRules(client)]);
  if (!students.ok || enrollments === null || marks === null || !rules.ok) return { ok: false, month };
  return { ok: true, month, students: students.students, enrollments, marks, rules: rules.rules };
}

export function initialClosing(month: CalendarMonth): ClosingState {
  return { month, status: "loading", data: null };
}

export function startClosingMonth(state: ClosingState, delta: number): ClosingState {
  return initialClosing(shiftMonth(state.month, delta));
}

export function startReloadingClosing(state: ClosingState): ClosingState {
  return { ...state, status: "loading" };
}

export function applyClosingLoad(state: ClosingState, result: ClosingLoad): ClosingState {
  if (result.month.year !== state.month.year || result.month.month !== state.month.month) return state;
  if (!result.ok) return { ...state, status: "failed" };
  const { students, enrollments, marks, rules } = result;
  return { ...state, status: "ready", data: { students, enrollments, marks, rules } };
}
