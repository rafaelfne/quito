import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SignInHero } from "./sign-in-hero";

describe("SignInHero", () => {
  const html = renderToStaticMarkup(<SignInHero />);

  test("mostra o título da chamada", () => {
    expect(html).toContain(">Cobre sem constrangimento</h2>");
  });

  test("diz em uma frase o que o Quitô resolve", () => {
    expect(html).toContain("O Quitô calcula quanto cada responsável deve no mês e deixa a cobrança pronta no dia certo.");
  });

  test("a seção é nomeada pelo próprio título", () => {
    expect(html).toContain('aria-labelledby="sign-in-hero-title"');
    expect(html).toContain('id="sign-in-hero-title"');
  });
});
