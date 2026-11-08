import { dateKeyOf } from "@/lib/lessons";
import { defaultGreeting, defaultSignature, defaultThanks, exampleMessageParts, quitoFooter, type MessageAdjustments, type MessageParts, type MessageTone } from "@/lib/message-templates";

export type ReminderDraftValidation = { ok: true; days: number[] } | { ok: false; error: string };

export type ReminderProgress = {
  sent: number;
  total: number;
  next: { index: number; due: string } | null;
  lastSentIndex: number | null;
};

export const reminderCountLimit = 3;

export const reminderDayLimit = 60;

export const defaultReminderDays = [3, 7];

const suggestedReminderDays = [3, 7, 14];

export const reminderMessages = {
  invalidDays: `Use de 1 a ${reminderDayLimit} dias, e cada lembrete depois do anterior.`,
};

type ReminderWording = { greeting: string; thanks: string; signature: string };

type ReminderText = (parts: MessageParts, wording: ReminderWording, index: number) => string[];

function friendlySentence(parts: MessageParts, index: number): string {
  const charge = `conta de ${parts.month} ${parts.studentsWithArticles}, de *${parts.total}*, que venceu em ${parts.dueShort}`;
  if (index === 0) return `Passando para lembrar da ${charge}.`;
  if (index === 1) return `Ainda não encontrei o pagamento da ${charge}. Na correria, acontece!`;
  return `Mais um lembrete da ${charge}. Se precisar de alguma coisa, é só me chamar.`;
}

function directSentence(parts: MessageParts, index: number): string {
  const ordinal = ["Lembrete", "Segundo lembrete", "Terceiro lembrete"][index] ?? "Lembrete";
  return `${ordinal}: cobrança de ${parts.month} (${parts.studentNames}), *${parts.total}*, venceu em ${parts.dueShort}.`;
}

function formalSentence(parts: MessageParts, index: number): string {
  const charge = `*${parts.total}*, referente às aulas de ${parts.month} ${parts.studentsWithArticles}, com vencimento em ${parts.dueLong}`;
  if (index === 0) return `Lembro que o pagamento de ${charge}, ainda está em aberto.`;
  if (index === 1) return `Ainda não identifiquei o pagamento de ${charge}.`;
  return `Retomo o lembrete do pagamento de ${charge}. Fico à disposição caso precise conversar.`;
}

const reminderTexts: Record<MessageTone, ReminderText> = {
  friendly: (parts, { greeting, thanks, signature }, index) => [
    `${greeting}, ${parts.guardianName}! Tudo bem?`,
    friendlySentence(parts, index),
    "",
    "A chave Pix é:",
    parts.pixKey,
    `(${parts.receiverName})`,
    "",
    `Se já pagou, pode desconsiderar. ${thanks}!`,
    signature,
  ],
  direct: (parts, { greeting, thanks, signature }, index) => [
    `${greeting}, ${parts.guardianName}.`,
    directSentence(parts, index),
    "",
    "Pix:",
    parts.pixKey,
    `(${parts.receiverName})`,
    "",
    "Se já pagou, desconsidere.",
    `${thanks},`,
    signature,
  ],
  formal: (parts, { greeting, thanks, signature }, index) => [
    `${greeting}, ${parts.guardianName}.`,
    formalSentence(parts, index),
    "",
    "Chave Pix para pagamento:",
    parts.pixKey,
    `Titular: ${parts.receiverName}`,
    "",
    "Caso o pagamento já tenha sido feito, por favor desconsidere esta mensagem.",
    `${thanks},`,
    signature,
  ],
};

export function composeReminder(adjustments: MessageAdjustments, parts: MessageParts, index: number): string {
  const { tone } = adjustments;
  const wording = {
    greeting: adjustments.greeting ?? defaultGreeting(tone),
    thanks: adjustments.thanks ?? defaultThanks(tone),
    signature: adjustments.signature ?? defaultSignature(tone, parts.receiverName),
  };
  const footer = adjustments.footer ? ["", quitoFooter] : [];
  return [...reminderTexts[tone](parts, wording, index), ...footer].join("\n");
}

export function exampleReminder(adjustments: MessageAdjustments, teacher: { pixKey: string; displayName: string }, index: number): string {
  return composeReminder(
    adjustments,
    {
      ...exampleMessageParts,
      duePassed: true,
      pixKey: teacher.pixKey.trim() || exampleMessageParts.pixKey,
      receiverName: teacher.displayName.trim() || exampleMessageParts.receiverName,
    },
    index,
  );
}

export function sanitizedReminderDays(days: number[] | null | undefined): number[] {
  if (!Array.isArray(days)) return [...defaultReminderDays];
  const valid: number[] = [];
  for (const day of days) {
    if (valid.length === reminderCountLimit) break;
    if (Number.isInteger(day) && day >= 1 && day <= reminderDayLimit && day > (valid[valid.length - 1] ?? 0)) valid.push(day);
  }
  return valid;
}

export function reminderDraftFrom(days: number[]): string[] {
  return days.map(String);
}

export function resizeReminderDrafts(drafts: string[], count: number): string[] {
  const size = Math.max(0, Math.min(reminderCountLimit, count));
  const resized = drafts.slice(0, size);
  while (resized.length < size) {
    const previous = Number(resized[resized.length - 1]) || 0;
    const suggested = suggestedReminderDays[resized.length] ?? previous + 1;
    resized.push(String(Math.min(reminderDayLimit, Math.max(suggested, previous + 1))));
  }
  return resized;
}

export function validateReminderDrafts(drafts: string[]): ReminderDraftValidation {
  const days: number[] = [];
  for (const draft of drafts.slice(0, reminderCountLimit)) {
    const text = draft.trim();
    const day = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(day) || day < 1 || day > reminderDayLimit || day <= (days[days.length - 1] ?? 0)) return { ok: false, error: reminderMessages.invalidDays };
    days.push(day);
  }
  return { ok: true, days };
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localDateOf(timestamp: string): string {
  return dateKeyOf(new Date(timestamp));
}

export function reminderProgress(sentAt: string, remindersSentAt: string[], days: number[], dateOf: (timestamp: string) => string = localDateOf): ReminderProgress {
  const sent = remindersSentAt.length;
  const lastSentIndex = sent > 0 ? sent - 1 : null;
  if (sent >= days.length) return { sent, total: days.length, next: null, lastSentIndex };
  const fromCharge = addDays(dateOf(sentAt), days[sent]);
  const due = sent === 0 ? fromCharge : [fromCharge, addDays(dateOf(remindersSentAt[sent - 1]), days[sent] - days[sent - 1])].sort()[1];
  return { sent, total: days.length, next: { index: sent, due }, lastSentIndex };
}

export function describeReminderDay(due: string): string {
  return `${Number(due.slice(8))}/${Number(due.slice(5, 7))}`;
}

export function describeReminderName(index: number, total: number): string {
  return `Lembrete ${index + 1} de ${total}`;
}
