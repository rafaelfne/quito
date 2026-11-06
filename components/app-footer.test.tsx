import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppFooter, supportEmail } from "./app-footer";

function renderFooter() {
  return renderToStaticMarkup(<AppFooter />);
}

function visibleText(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

describe("AppFooter", () => {
  test("o contato de suporte é suporte@quito.app", () => {
    expect(supportEmail).toBe("suporte@quito.app");
  });

  test("mostra o convite para tirar dúvidas com o e-mail do suporte", () => {
    expect(visibleText(renderFooter())).toBe("Dúvidas? suporte@quito.app");
  });

  test("é um rodapé da página", () => {
    expect(renderFooter()).toMatch(/^<footer[^>]*>[\s\S]*<\/footer>$/);
  });

  test("tocar no e-mail abre o aplicativo de e-mail já endereçado ao suporte", () => {
    expect(renderFooter()).toContain('<a href="mailto:suporte@quito.app"');
  });

  test("fica discreto, em letra pequena e cor apagada", () => {
    const html = renderFooter();
    expect(html).toMatch(/<footer[^>]*class="[^"]*\btext-sm\b/);
    expect(html).toMatch(/<footer[^>]*class="[^"]*\btext-muted-foreground\b/);
  });

  test("vai para o fim da tela mesmo quando a tela tem pouco conteúdo", () => {
    expect(renderFooter()).toMatch(/<footer[^>]*class="[^"]*\bmt-auto\b/);
  });
});
