import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppFooter, appMotto, supportEmail } from "./app-footer";

function renderFooter() {
  return renderToStaticMarkup(<AppFooter />);
}

function visibleText(html: string) {
  return html.replace(/<[^>]+>/g, "");
}

function footerLines() {
  return [...renderFooter().matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((match) => ({
    tag: match[0],
    text: visibleText(match[1]),
  }));
}

describe("AppFooter", () => {
  test("o contato de suporte é suporte@quito.app", () => {
    expect(supportEmail).toBe("suporte@quito.app");
  });

  test("o lema do Quitô é Quitô · suas aulas em dia", () => {
    expect(appMotto).toBe("Quitô · suas aulas em dia");
  });

  test("mostra o convite para tirar dúvidas com o e-mail do suporte", () => {
    expect(footerLines()[0].text).toBe("Dúvidas? suporte@quito.app");
  });

  test("mostra o lema do Quitô", () => {
    expect(footerLines()[1].text).toBe("Quitô · suas aulas em dia");
  });

  test("mostra só o contato e o lema", () => {
    expect(footerLines()).toHaveLength(2);
  });

  test("é um rodapé da página", () => {
    expect(renderFooter()).toMatch(/^<footer[^>]*>[\s\S]*<\/footer>$/);
  });

  test("tocar no e-mail abre o aplicativo de e-mail já endereçado ao suporte", () => {
    expect(renderFooter()).toContain('<a href="mailto:suporte@quito.app"');
  });

  test("fica discreto, em letra pequena e cor apagada", () => {
    const [support, motto] = footerLines();
    expect(renderFooter()).toMatch(/<footer[^>]*class="[^"]*\btext-muted-foreground\b/);
    expect(support.tag).toMatch(/class="[^"]*\btext-sm\b/);
    expect(motto.tag).toMatch(/class="[^"]*\btext-xs\b/);
  });

  test("vai para o fim da tela mesmo quando a tela tem pouco conteúdo", () => {
    expect(renderFooter()).toMatch(/<footer[^>]*class="[^"]*\bmt-auto\b/);
  });
});
