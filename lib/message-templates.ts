export type MessageTone = "friendly" | "direct" | "formal";

export type MessageAdjustments = {
  tone: MessageTone;
  greeting: string | null;
  thanks: string | null;
  signature: string | null;
};

export type MessageParts = {
  guardianName: string;
  studentNames: string;
  studentsWithArticles: string;
  month: string;
  accountLines: string[];
  total: string;
  dueDay: string;
  dueShort: string;
  dueLong: string;
  duePassed: boolean;
  pixKey: string;
  receiverName: string;
};

type ToneWording = {
  greeting: string;
  thanks: string;
  signature: string;
};

type ToneText = {
  greeting: string;
  thanks: string;
  signaturePrefix: string;
  lines: (parts: MessageParts, wording: ToneWording) => string[];
};

export const defaultMessageTone: MessageTone = "friendly";

export const messageTones: { id: MessageTone; label: string; hint: string }[] = [
  { id: "friendly", label: "Próximo", hint: "Como você falaria com os pais." },
  { id: "direct", label: "Direto", hint: "Uma mensagem rápida, com o valor logo no começo." },
  { id: "formal", label: "Formal", hint: "Para quem trata os pais com mais distância." },
];

export const quitoFooter = "Conta feita pelo Quitô";

const toneTexts: Record<MessageTone, ToneText> = {
  friendly: {
    greeting: "Oi",
    thanks: "Obrigado",
    signaturePrefix: "Prof. ",
    lines: (parts, { greeting, thanks, signature }) => [
      `${greeting}, ${parts.guardianName}! Tudo bem?`,
      `Segue a conta de ${parts.month} ${parts.studentsWithArticles}:`,
      "",
      ...parts.accountLines,
      `*Total: ${parts.total}*`,
      "",
      `${parts.duePassed ? `Venceu em ${parts.dueShort}` : `Vence hoje, dia ${parts.dueDay}`}. A chave Pix é:`,
      parts.pixKey,
      `(${parts.receiverName})`,
      "",
      `Qualquer dúvida, é só me chamar. ${thanks}!`,
      signature,
    ],
  },
  direct: {
    greeting: "Olá",
    thanks: "Obrigado",
    signaturePrefix: "",
    lines: (parts, { greeting, thanks, signature }) => [
      `${greeting}, ${parts.guardianName}.`,
      `Cobrança de ${parts.month} (${parts.studentNames}): *${parts.total}*, ${parts.duePassed ? "venceu em" : "vence hoje,"} ${parts.dueShort}.`,
      "",
      ...parts.accountLines,
      "",
      "Pix:",
      parts.pixKey,
      `(${parts.receiverName})`,
      "",
      `${thanks},`,
      signature,
    ],
  },
  formal: {
    greeting: "Olá",
    thanks: "Atenciosamente",
    signaturePrefix: "Professor ",
    lines: (parts, { greeting, thanks, signature }) => [
      `${greeting}, ${parts.guardianName}.`,
      `Envio o resumo das aulas de ${parts.month} ${parts.studentsWithArticles}, com vencimento em ${parts.dueLong}.`,
      "",
      ...parts.accountLines,
      `*Valor total: ${parts.total}*`,
      "",
      "Chave Pix para pagamento:",
      parts.pixKey,
      `Titular: ${parts.receiverName}`,
      "",
      "Fico à disposição para qualquer esclarecimento.",
      `${thanks},`,
      signature,
    ],
  },
};

export function isMessageTone(value: string): value is MessageTone {
  return messageTones.some((tone) => tone.id === value);
}

export function defaultGreeting(tone: MessageTone): string {
  return toneTexts[tone].greeting;
}

export function defaultThanks(tone: MessageTone): string {
  return toneTexts[tone].thanks;
}

export function defaultSignature(tone: MessageTone, displayName: string): string {
  const firstName = displayName.trim().split(/\s+/)[0];
  return `${toneTexts[tone].signaturePrefix}${firstName}`;
}

export function composeMessage(adjustments: MessageAdjustments, parts: MessageParts): string {
  const { tone } = adjustments;
  const wording = {
    greeting: adjustments.greeting ?? defaultGreeting(tone),
    thanks: adjustments.thanks ?? defaultThanks(tone),
    signature: adjustments.signature ?? defaultSignature(tone, parts.receiverName),
  };
  return [...toneTexts[tone].lines(parts, wording), "", quitoFooter].join("\n");
}

export const exampleMessageParts: MessageParts = {
  guardianName: "Carla",
  studentNames: "Pedro e Ana",
  studentsWithArticles: "do Pedro e da Ana",
  month: "novembro",
  accountLines: ["Pedro: 4 aulas e 1 reposição × R$ 50,00 = R$ 250,00", "Ana: mensalidade R$ 200,00", "Desconto de 10% para irmãos: − R$ 45,00"],
  total: "R$ 405,00",
  dueDay: "5",
  dueShort: "5/12",
  dueLong: "5 de dezembro",
  duePassed: false,
  pixKey: "joao.violao@email.com",
  receiverName: "João Silva",
};

export function exampleMessage(adjustments: MessageAdjustments, teacher: { pixKey: string; displayName: string }): string {
  return composeMessage(adjustments, {
    ...exampleMessageParts,
    pixKey: teacher.pixKey.trim() || exampleMessageParts.pixKey,
    receiverName: teacher.displayName.trim() || exampleMessageParts.receiverName,
  });
}
