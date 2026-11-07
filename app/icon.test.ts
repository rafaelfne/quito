import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { appIdentity } from "@/lib/app-identity";

const appDir = join(process.cwd(), "app");
const icon = readFileSync(join(appDir, "icon.svg"), "utf8");
const css = readFileSync(join(appDir, "globals.css"), "utf8");
const lightTheme = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));

function themeColor(variable: string): string {
  const match = lightTheme.match(new RegExp(`${variable}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\);`));
  expect(match, variable).not.toBeNull();
  const [lightness, chroma, hue] = (match as RegExpMatchArray).slice(1).map(Number);
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const toHex = (channel: number) => {
    const clamped = Math.min(1, Math.max(0, channel));
    const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255).toString(16).padStart(2, "0");
  };
  return `#${linear.map(toHex).join("")}`;
}

describe("ícone do Quitô", () => {
  test("o fundo é o roxo dos botões do app", () => {
    expect(icon).toMatch(new RegExp(`<rect[^>]*fill="${themeColor("--primary")}"`));
  });

  test("o fundo tem cantos arredondados, como os ícones do celular", () => {
    expect(icon).toMatch(/<rect[^>]*rx="\d+"/);
  });

  test("o Q é branco", () => {
    expect(icon).toMatch(/<circle[^>]*stroke="#ffffff"/);
  });

  test("a perninha do Q é o verde do tema do app", () => {
    expect(icon).toMatch(new RegExp(`<path[^>]*stroke="${themeColor("--chart-1")}"`));
  });

  test("é quadrado, para servir de ícone em qualquer tamanho", () => {
    expect(icon).toContain('viewBox="0 0 512 512"');
  });

  test("usa as mesmas cores do ícone da tela inicial do celular", () => {
    expect(icon).toContain(`fill="${appIdentity.brandColor}"`);
    expect(icon).toContain(`stroke="${appIdentity.letterColor}"`);
    expect(icon).toContain(`stroke="${appIdentity.accentColor}"`);
  });
});
