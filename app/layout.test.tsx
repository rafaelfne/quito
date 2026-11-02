import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const stylesheet = vi.hoisted(() => ({ loaded: false }));

vi.mock("./globals.css", () => {
  stylesheet.loaded = true;
  return {};
});

const { default: RootLayout, metadata } = await import("./layout");

function renderLayout() {
  return renderToStaticMarkup(
    <RootLayout>
      <p>conteúdo da tela</p>
    </RootLayout>,
  );
}

describe("moldura de todas as telas", () => {
  test("avisa ao navegador que o app está em português do Brasil", () => {
    expect(renderLayout()).toContain('<html lang="pt-BR"');
  });

  test("mostra o conteúdo de cada tela dentro da página", () => {
    expect(renderLayout()).toMatch(/<body[^>]*><p>conteúdo da tela<\/p><\/body>/);
  });

  test("faz a tela ocupar toda a altura do aparelho", () => {
    const html = renderLayout();
    expect(html).toMatch(/<html[^>]*class="[^"]*\bh-full\b/);
    expect(html).toMatch(/<body[^>]*class="[^"]*\bmin-h-full\b/);
  });

  test("carrega o visual comum a todas as telas", () => {
    expect(stylesheet.loaded).toBe(true);
  });

  test("dá ao app o nome e a descrição que aparecem na aba do navegador", () => {
    expect(metadata).toEqual({ title: "quito", description: "Criado com o Virgílio" });
  });
});
