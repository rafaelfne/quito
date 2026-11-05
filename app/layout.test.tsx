import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const stylesheet = vi.hoisted(() => ({ loaded: false }));

vi.mock("./globals.css", () => {
  stylesheet.loaded = true;
  return {};
});

vi.mock("next/font/google", () => {
  const font = ({ variable }: { variable: string }) => ({ variable });
  return { Poppins: font, Domine: font, IBM_Plex_Mono: font };
});

const { default: RootLayout, metadata } = await import("./layout");

function renderLayout() {
  return renderToStaticMarkup(
    <RootLayout>
      <p>conteúdo da tela</p>
    </RootLayout>,
  );
}

function systemThemeHarness(systemIsDark: boolean) {
  const script = renderLayout().match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeDefined();
  const classes = new Set(["h-full", "antialiased"]);
  const listeners: Array<() => void> = [];
  const systemDark = {
    matches: systemIsDark,
    addEventListener: (_type: "change", listener: () => void) => listeners.push(listener),
  };
  const matchMedia = vi.fn(() => systemDark);
  const document = {
    documentElement: {
      classList: {
        toggle: (name: string, force: boolean) => (force ? classes.add(name) : classes.delete(name)),
      },
    },
  };
  new Function("document", "matchMedia", script as string)(document, matchMedia);
  return {
    classes,
    matchMedia,
    systemChangesTo(isDark: boolean) {
      systemDark.matches = isDark;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("tema do aparelho", () => {
  test("pergunta ao aparelho se ele está no modo escuro", () => {
    expect(systemThemeHarness(false).matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  test("aparelho no modo escuro abre o app no tema escuro", () => {
    expect(systemThemeHarness(true).classes.has("dark")).toBe(true);
  });

  test("aparelho no modo claro abre o app no tema claro", () => {
    expect(systemThemeHarness(false).classes.has("dark")).toBe(false);
  });

  test("o app acompanha quando o aparelho muda de modo com a tela aberta", () => {
    const harness = systemThemeHarness(false);
    harness.systemChangesTo(true);
    expect(harness.classes.has("dark")).toBe(true);
    harness.systemChangesTo(false);
    expect(harness.classes.has("dark")).toBe(false);
  });

  test("mantém as outras classes da página", () => {
    const { classes } = systemThemeHarness(true);
    expect(classes.has("h-full")).toBe(true);
    expect(classes.has("antialiased")).toBe(true);
  });

  test("o tema é escolhido antes de a tela aparecer", () => {
    expect(renderLayout()).toMatch(/<head><script>[\s\S]*<\/script><\/head><body/);
  });
});

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

  test.each(["--font-app-sans", "--font-app-serif", "--font-app-mono"])("entrega a fonte %s à página", (variable) => {
    expect(renderLayout()).toMatch(new RegExp(`<html[^>]*class="[^"]*${variable}\\b`));
  });

  test("carrega o visual comum a todas as telas", () => {
    expect(stylesheet.loaded).toBe(true);
  });

  test("dá ao app o nome e a descrição que aparecem na aba do navegador", () => {
    expect(metadata).toEqual({ title: "quito", description: "Criado com o Virgílio" });
  });
});
