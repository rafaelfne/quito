import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  test("o padrão usa a cor principal do tema", () => {
    const html = renderToStaticMarkup(<Button type="submit">Guardar</Button>);
    expect(html).toMatch(/^<button/);
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-primary-foreground");
    expect(html).toContain('type="submit"');
  });

  test.each(["default", "sm", "icon"] as const)("o tamanho %s mantém a altura de toque do celular", (size) => {
    expect(buttonVariants({ size })).toContain("min-h-11");
  });

  test("com asChild, o link recebe a aparência do botão", () => {
    const html = renderToStaticMarkup(
      <Button asChild>
        <a href="/entrada">Voltar</a>
      </Button>,
    );
    expect(html).toMatch(/^<a /);
    expect(html).toContain("bg-primary");
    expect(html).toContain('href="/entrada"');
  });

  test("a classe de quem usa vence a do padrão", () => {
    const html = renderToStaticMarkup(<Button className="px-0">Trocar</Button>);
    expect(html).toContain("px-0");
    expect(html).not.toContain("px-4");
  });
});
