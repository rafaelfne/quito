import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { aboutSentences } from "./about-sentences";
import AboutPage, { metadata } from "./page";

describe("página Sobre o Quitô", () => {
  test("explica em duas frases o que o Quitô faz para o professor", () => {
    const html = renderToStaticMarkup(<AboutPage />);
    expect(aboutSentences).toHaveLength(2);
    expect(html).toContain("Sobre o Quitô");
    for (const sentence of aboutSentences) expect(html).toContain(`<p>${sentence}</p>`);
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  test("leva quem quer usar para a entrada do app", () => {
    const html = renderToStaticMarkup(<AboutPage />);
    expect(html).toContain('href="/"');
    expect(html).toContain("Entrar no Quitô");
  });

  test("o título da aba e a descrição falam do Quitô", () => {
    expect(metadata.title).toBe("Sobre o Quitô");
    expect(metadata.description).toBe("Você dá a aula. O Quitô cuida da cobrança.");
  });
});
