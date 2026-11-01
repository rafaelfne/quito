import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { GoogleReturnView } from "./google-return-view";

describe("GoogleReturnView", () => {
  test("mostra que está entrando enquanto confere", () => {
    const html = renderToStaticMarkup(<GoogleReturnView message={null} retryHref="/" />);
    expect(html).toContain("Entrando com o Google...");
    expect(html).not.toContain("Voltar para a entrada");
  });

  test("mostra o erro e o caminho de volta para a entrada", () => {
    const html = renderToStaticMarkup(<GoogleReturnView message="Não deu para entrar com o Google." retryHref="/?next=%2Falunos" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Não deu para entrar com o Google.");
    expect(html).toContain('href="/?next=%2Falunos"');
    expect(html).toContain("Voltar para a entrada");
  });
});
