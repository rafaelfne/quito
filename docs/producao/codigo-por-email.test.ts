import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { codeLength, signInMessages } from "@/lib/sign-in";

const root = process.cwd();
const guide = readFileSync(join(root, "docs/producao/codigo-por-email.md"), "utf8");
const config = readFileSync(join(root, "supabase/config.toml"), "utf8");
const templatePath = "supabase/templates/codigo-de-entrada.html";
const template = readFileSync(join(root, templatePath), "utf8");

function configValue(section: string, key: string): string {
  const pattern = new RegExp(`\\[${section.replaceAll(".", "\\.")}\\][^[]*?\\n${key} = "?([^"\\n]+)"?`);
  const value = config.match(pattern)?.[1];
  if (!value) throw new Error(`${section}.${key} não está em supabase/config.toml`);
  return value;
}

describe("passo a passo do código por e-mail em produção", () => {
  test("usa o mesmo assunto dos dois modelos do ensaio", () => {
    const magicLink = configValue("auth.email.template.magic_link", "subject");
    const confirmation = configValue("auth.email.template.confirmation", "subject");
    expect(confirmation).toBe(magicLink);
    expect(guide).toContain(`\`${magicLink}\``);
  });

  test("aponta para o modelo de e-mail que o ensaio usa", () => {
    expect(configValue("auth.email.template.magic_link", "content_path")).toBe(`./${templatePath}`);
    expect(guide).toContain(`\`${templatePath}\``);
    expect(template).toContain("{{ .Token }}");
    expect(guide).toContain("{{ .Token }}");
  });

  test("promete o mesmo tamanho de código que o app e o ensaio", () => {
    expect(Number(configValue("auth.email", "otp_length"))).toBe(codeLength);
    expect(guide).toContain(`**Email OTP Length**: \`${codeLength}\``);
    expect(template).toContain(`${codeLength} números`);
  });

  test("promete a mesma validade que o ensaio e o e-mail", () => {
    const seconds = Number(configValue("auth.email", "otp_expiry"));
    const minutes = seconds / 60;
    expect(guide).toContain(`**Email OTP Expiration**: \`${seconds}\``);
    expect(guide).toContain(`${minutes} minutos`);
    expect(template).toContain(`vale por ${minutes} minutos`);
  });

  test("repete o limite de envios por hora do ensaio", () => {
    const perHour = configValue("auth.rate_limit", "email_sent");
    expect(guide).toContain(`**Rate limit for sending emails**: \`${perHour}\` por hora`);
  });

  test("repete o caminho de envio do ensaio", () => {
    expect(guide).toContain(`\`${configValue("auth.email.smtp", "host")}\``);
    expect(guide).toContain(`\`${configValue("auth.email.smtp", "port")}\``);
    expect(guide).toContain(`\`${configValue("auth.email.smtp", "user")}\``);
    expect(guide).toContain(`\`${configValue("auth.email.smtp", "sender_name")}\``);
  });

  test("cita as frases que o e-mail e o app mostram", () => {
    for (const phrase of ["O código vale por 10 minutos", "Você dá a aula. O Quitô cuida da cobrança."]) {
      expect(template).toContain(phrase);
      expect(guide).toContain(phrase);
    }
    expect(guide).toContain(signInMessages.tooManyEmails);
    expect(guide).toContain(signInMessages.wrongCode.split(".")[0]);
  });

  test("não traz chave, senha nem token", () => {
    expect(guide).not.toMatch(/re_[A-Za-z0-9_-]{10,}/);
    expect(guide).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(guide).not.toMatch(/sb_(secret|publishable)_/);
  });
});
