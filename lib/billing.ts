export const billingKinds = ["monthly", "per_class", "package"] as const;

export type BillingKind = (typeof billingKinds)[number];

export type BillingRow = {
  billing_kind: BillingKind;
  billing_amount_cents: number;
  package_lessons: number | null;
};

export type SavedBilling = {
  billing_kind: BillingKind | null;
  billing_amount_cents: number | null;
  package_lessons: number | null;
};

export type BillingDraft = { billingKind: string; billingAmount: string; packageLessons: string };

export type BillingErrors = Partial<Record<keyof BillingDraft, string>>;

export type BillingValidation = { ok: true; row: BillingRow } | { ok: false; errors: BillingErrors };

export const billingAmountLimitCents = 10_000_000;

export const packageLessonsLimit = 100;

export const billingOptions: Record<BillingKind, { label: string; amountLabel: string }> = {
  monthly: { label: "Mensalidade fixa", amountLabel: "Valor da mensalidade, em reais" },
  per_class: { label: "Valor por aula", amountLabel: "Valor de cada aula, em reais" },
  package: { label: "Pacote de aulas", amountLabel: "Valor do pacote inteiro, em reais" },
};

export const emptyBillingDraft: BillingDraft = { billingKind: "", billingAmount: "", packageLessons: "" };

const amountFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const amountPattern = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;

export function formatAmount(cents: number): string {
  return amountFormat.format(cents / 100);
}

export function formatCurrency(cents: number): string {
  return `R$ ${formatAmount(cents)}`;
}

export const billingMessages = {
  kindMissing: "Escolha como este aluno paga.",
  amountInvalid: "Confira o valor: ele precisa ser maior que zero, como 150,00.",
  amountTooHigh: `O valor passou do limite de ${formatCurrency(billingAmountLimitCents)}. Confira e toque em Guardar de novo.`,
  lessonsInvalid: `Escreva quantas aulas tem o pacote, de 1 a ${packageLessonsLimit}.`,
};

export const packageRolloverHint = "As aulas que sobram passam para o mês seguinte. O pacote não tem validade.";

export function isBillingKind(value: string): value is BillingKind {
  return (billingKinds as readonly string[]).includes(value);
}

export function parseAmount(raw: string): number | null {
  const match = raw.replace(/r\$/i, "").trim().match(amountPattern);
  if (!match) return null;
  const whole = Number(match[1].replaceAll(".", ""));
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}

function parseLessons(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const lessons = Number(text);
  return lessons >= 1 && lessons <= packageLessonsLimit ? lessons : null;
}

function amountError(cents: number | null): string | undefined {
  if (!cents) return billingMessages.amountInvalid;
  return cents > billingAmountLimitCents ? billingMessages.amountTooHigh : undefined;
}

export function validateBilling(draft: BillingDraft): BillingValidation {
  const kind = draft.billingKind;
  if (!isBillingKind(kind)) return { ok: false, errors: { billingKind: billingMessages.kindMissing } };
  const cents = parseAmount(draft.billingAmount);
  const lessons = kind === "package" ? parseLessons(draft.packageLessons) : null;
  const errors: BillingErrors = {};
  const amountProblem = amountError(cents);
  if (amountProblem) errors.billingAmount = amountProblem;
  if (kind === "package" && lessons === null) errors.packageLessons = billingMessages.lessonsInvalid;
  if (cents === null || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, row: { billing_kind: kind, billing_amount_cents: cents, package_lessons: lessons } };
}

export function billingDraftFrom(billing: SavedBilling): BillingDraft {
  return {
    billingKind: billing.billing_kind ?? "",
    billingAmount: billing.billing_amount_cents === null ? "" : formatAmount(billing.billing_amount_cents),
    packageLessons: billing.package_lessons === null ? "" : String(billing.package_lessons),
  };
}

export function describeBilling(billing: SavedBilling): string {
  const { billing_kind: kind, billing_amount_cents: cents, package_lessons: lessons } = billing;
  if (kind === null || cents === null) return "Forma de cobrança ainda não definida";
  if (kind === "monthly") return `Mensalidade de ${formatCurrency(cents)}`;
  if (kind === "per_class") return `${formatCurrency(cents)} por aula`;
  return `Pacote de ${lessons} ${lessons === 1 ? "aula" : "aulas"} por ${formatCurrency(cents)}`;
}
