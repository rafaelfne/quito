import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SignInSteps } from "./sign-in-steps";

describe("passos da tela de entrada", () => {
  const html = renderToStaticMarkup(<SignInSteps />);

  test("mostra as três orientações na ordem definida", () => {
    const firstStep = html.indexOf("Marque as aulas de cada aluno.");
    const secondStep = html.indexOf("O Quitô calcula o valor do mês.");
    const thirdStep = html.indexOf("Mande a cobrança com a chave Pix no dia do vencimento.");

    expect(firstStep).toBeGreaterThan(-1);
    expect(secondStep).toBeGreaterThan(firstStep);
    expect(thirdStep).toBeGreaterThan(secondStep);
  });

  test("numera cada orientação e permite empilhar ou alinhar os passos", () => {
    expect(html.match(/rounded-sm border bg-card/g)).toHaveLength(3);
    expect(html).toContain('class="grid grid-cols-1 gap-3 md:grid-cols-3"');
    expect(html).toContain(">1</span>");
    expect(html).toContain(">2</span>");
    expect(html).toContain(">3</span>");
  });

  test("identifica a seção pelo título", () => {
    expect(html).toContain('aria-labelledby="how-it-works-title"');
    expect(html).toContain('id="how-it-works-title"');
  });
});
