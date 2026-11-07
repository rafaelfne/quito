import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  composeMessage,
  defaultGreeting,
  defaultMessageTone,
  defaultSignature,
  defaultThanks,
  exampleMessage,
  exampleMessageParts,
  isMessageTone,
  messageTones,
  quitoFooter,
  type MessageTone,
} from "./message-templates";

const finding = readFileSync(join(process.cwd(), "docs/product/findings/tom-da-mensagem.md"), "utf8");

function findingText(label: string): string {
  const heading = finding.split("\n").findIndex((line) => line.startsWith(`**${label}`));
  const lines = finding.split("\n").slice(heading + 2);
  const end = lines.findIndex((line) => !line.startsWith(">"));
  return lines
    .slice(0, end)
    .map((line) => line.replace(/^> ?/, ""))
    .join("\n");
}

const standard = (tone: MessageTone) => ({ tone, greeting: null, thanks: null, signature: null, footer: true });

describe("os três tons", () => {
  test("são Próximo, Direto e Formal, com o Próximo de partida", () => {
    expect(messageTones.map((tone) => tone.label)).toEqual(["Próximo", "Direto", "Formal"]);
    expect(defaultMessageTone).toBe("friendly");
  });

  test.each(messageTones)("o tom $label tem exatamente o texto da descoberta", ({ id, label }) => {
    expect(composeMessage(standard(id), exampleMessageParts)).toBe(findingText(label));
  });

  test("reconhece só os tons que existem", () => {
    expect(isMessageTone("direct")).toBe(true);
    expect(isMessageTone("duro")).toBe(false);
    expect(isMessageTone("constructor")).toBe(false);
  });
});

describe("saudação, agradecimento e assinatura", () => {
  test("cada tom tem a sua saudação e a sua assinatura de partida", () => {
    expect(defaultGreeting("friendly")).toBe("Oi");
    expect(defaultGreeting("formal")).toBe("Olá");
    expect(defaultThanks("friendly")).toBe("Obrigado");
    expect(defaultThanks("direct")).toBe("Obrigado");
    expect(defaultThanks("formal")).toBe("Atenciosamente");
    expect(defaultSignature("friendly", "João Silva")).toBe("Prof. João");
    expect(defaultSignature("direct", "João Silva")).toBe("João");
    expect(defaultSignature("formal", "  João Silva ")).toBe("Professor João");
  });

  test.each(messageTones)("no tom $label, a saudação e a assinatura do professor entram no lugar das de partida", ({ id }) => {
    const message = composeMessage({ tone: id, greeting: "Bom dia", thanks: "Obrigada", signature: "Tio João", footer: true }, exampleMessageParts);
    expect(message.split("\n")[0]).toMatch(/^Bom dia, Carla[!.]/);
    const lines = message.split("\n");
    expect(lines[lines.length - 3]).toBe("Tio João");
    expect(lines[lines.length - 4]).toMatch(/Obrigada[!,]$/);
    expect(message).not.toContain("Obrigado");
    expect(message).not.toContain("Atenciosamente");
    expect(lines[lines.length - 1]).toBe(quitoFooter);
  });
});

describe("linha do Quitô no fim", () => {
  test.each(messageTones)("no tom $label, desligada, a mensagem termina na assinatura", ({ id }) => {
    const message = composeMessage({ ...standard(id), footer: false }, exampleMessageParts);
    expect(message).not.toContain(quitoFooter);
    expect(message).toBe(findingText(messageTones.find((tone) => tone.id === id)?.label ?? "").replace(`\n\n${quitoFooter}`, ""));
  });
});

describe("exemplo na tela", () => {
  test("usa o nome e a chave do professor quando já escritos", () => {
    const message = exampleMessage(standard("friendly"), { pixKey: " maria@email.com ", displayName: " Maria Souza " });
    expect(message).toContain("\nmaria@email.com\n(Maria Souza)\n");
    expect(message).toContain("\nProf. Maria\n");
  });

  test("sem nome e chave, usa os do exemplo", () => {
    expect(exampleMessage(standard("friendly"), { pixKey: " ", displayName: "" })).toBe(composeMessage(standard("friendly"), exampleMessageParts));
  });
});
