import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppFooter } from "./app-footer";
import { versionLabel } from "@/lib/version";

describe("rodapé do app", () => {
  test("mostra o nome do app e a versão", () => {
    expect(renderToStaticMarkup(<AppFooter />)).toContain(versionLabel());
  });

  test("é um rodapé da página", () => {
    expect(renderToStaticMarkup(<AppFooter />)).toMatch(/^<footer/);
  });

  test("usa texto pequeno e a cor discreta do tema", () => {
    const html = renderToStaticMarkup(<AppFooter />);
    expect(html).toContain("text-xs");
    expect(html).toContain("text-muted-foreground");
  });
});
