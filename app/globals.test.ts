import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compile } from "tailwindcss";
import { describe, expect, test } from "vitest";

const appDir = join(process.cwd(), "app");
const tailwindDir = join(process.cwd(), "node_modules", "tailwindcss");
const css = readFileSync(join(appDir, "globals.css"), "utf8");

const themeVariables = [
  "--background",
  "--foreground",
  "--destructive",
  "--destructive-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--ring",
];

const hasDarkBlock = css.includes(".dark {");

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

async function compiledCss(candidate: string): Promise<string> {
  const compiler = await compile(css, {
    loadStylesheet: async () => ({ path: "index.css", base: tailwindDir, content: readFileSync(join(tailwindDir, "index.css"), "utf8") }),
  });
  return compiler.build([candidate]);
}

async function compiledRule(candidate: string): Promise<string> {
  const output = await compiledCss(candidate);
  const selector = `.${candidate} {`;
  const start = output.indexOf(selector);
  expect(start, candidate).toBeGreaterThanOrEqual(0);
  return output.slice(start, output.indexOf("}", start));
}

describe("variáveis do tema", () => {
  test.each([...themeVariables, "--radius"])("o tema claro define %s", (variable) => {
    expect(light[variable]).toBeTruthy();
  });

  test.skipIf(!hasDarkBlock).each(themeVariables)("o tema escuro define %s", (variable) => {
    expect(variablesOf(blockAfter(".dark {"))[variable]).toBeTruthy();
  });

  test("o tema não depende da preferência do aparelho direto no estilo", () => {
    expect(css).not.toContain("prefers-color-scheme");
  });

  test.skipIf(!hasDarkBlock)("o tema escuro tem uma forma só, o bloco .dark", async () => {
    const output = await compiledCss("dark:bg-background");
    expect(output).toContain(":where(.dark, .dark *)");
    expect(output).not.toContain("prefers-color-scheme");
  });

  test.each([
    ["bg-background", "background-color: var(--background)"],
    ["text-foreground", "color: var(--foreground)"],
    ["bg-destructive", "background-color: var(--destructive)"],
    ["border-destructive", "border-color: var(--destructive)"],
    ["text-destructive", "color: var(--destructive)"],
    ["text-destructive-foreground", "color: var(--destructive-foreground)"],
    ["bg-primary", "background-color: var(--primary)"],
    ["text-primary-foreground", "color: var(--primary-foreground)"],
    ["bg-accent", "background-color: var(--accent)"],
    ["border-border", "border-color: var(--border)"],
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
