import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, test } from "vitest";

const appDir = join(process.cwd(), "app");
const tailwindDir = join(process.cwd(), "node_modules", "tailwindcss");
const css = readFileSync(join(appDir, "globals.css"), "utf8");

const redSevenHundred = "oklch(50.5% 0.213 27.518)";

const screenFiles = readdirSync(appDir, { recursive: true, encoding: "utf8" }).filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));

function variablesOf(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

function blockAfter(marker: string): string {
  const start = css.indexOf(marker);
  expect(start, marker).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start + marker.length - 1);
  return css.slice(open, css.indexOf("}", open));
}

const light = variablesOf(blockAfter(":root {"));
const dark = variablesOf(blockAfter(".dark {"));
const systemDark = variablesOf(blockAfter("@media (prefers-color-scheme: dark) {\n  :root {"));

async function compiledRule(candidate: string): Promise<string> {
  const compiler = await compile(css, {
    loadStylesheet: async () => ({ path: "index.css", base: tailwindDir, content: readFileSync(join(tailwindDir, "index.css"), "utf8") }),
  });
  const output = compiler.build([candidate]);
  const selector = `.${candidate} {`;
  const start = output.indexOf(selector);
  expect(start, candidate).toBeGreaterThanOrEqual(0);
  return output.slice(start, output.indexOf("}", start));
}

describe("variáveis do tema", () => {
  test("o tema claro guarda as cores e os cantos de hoje", () => {
    expect(light).toEqual({
      "--background": "#ffffff",
      "--foreground": "#171717",
      "--destructive": redSevenHundred,
      "--destructive-foreground": "#ffffff",
      "--radius": "0.25rem",
    });
  });

  test("o tema escuro guarda as cores de hoje", () => {
    expect(dark).toEqual({
      "--background": "#0a0a0a",
      "--foreground": "#ededed",
      "--destructive": redSevenHundred,
      "--destructive-foreground": "#ffffff",
    });
  });

  test("quem usa o aparelho no modo escuro continua vendo o mesmo tema escuro", () => {
    expect(systemDark).toEqual(dark);
  });

  test.each([
    ["bg-background", "background-color: var(--background)"],
    ["text-foreground", "color: var(--foreground)"],
    ["bg-destructive", "background-color: var(--destructive)"],
    ["border-destructive", "border-color: var(--destructive)"],
    ["text-destructive", "color: var(--destructive)"],
    ["text-destructive-foreground", "color: var(--destructive-foreground)"],
    ["rounded-sm", "border-radius: var(--radius)"],
  ])("%s lê a variável", async (candidate, declaration) => {
    expect(await compiledRule(candidate)).toContain(declaration);
  });
});

describe("telas", () => {
  test("encontra as telas para conferir", () => {
    expect(screenFiles).toContain(join("(app)", "account", "delete-account-view.tsx"));
  });

  test.each(screenFiles)("%s não tem cor nem canto fora das variáveis", (path) => {
    const source = readFileSync(join(appDir, path), "utf8");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch)\(/);
    expect(source).not.toMatch(/\b(bg|text|border|ring|fill|stroke|outline|divide|placeholder|accent|caret|decoration|shadow|from|via|to)-(white|black)\b/);
    expect(source).not.toMatch(/\b(bg|text|border|ring|fill|stroke|outline|divide|placeholder|accent|caret|decoration|shadow|from|via|to)-[a-z]+-\d{2,3}\b/);
    expect(source).not.toMatch(/\brounded(?![\w-])/);
    expect(source).not.toMatch(/\brounded-(?!sm\b)/);
  });
});
