import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SignInFooter } from "./sign-in-footer";

afterEach(() => {
  vi.useRealTimers();
});

describe("rodapé da tela de entrada", () => {
  test("diz que os dados dos alunos são só do professor", () => {
    const html = renderToStaticMarkup(<SignInFooter />);
    expect(html).toContain("Os dados dos seus alunos são só seus. Ninguém mais vê.");
  });

  test("tem um link de contato por e-mail para oi@quito.app", () => {
    const html = renderToStaticMarkup(<SignInFooter />);
    expect(html).toContain('href="mailto:oi@quito.app"');
    expect(html).toContain(">oi@quito.app</a>");
  });

  test("mostra o ano corrente, calculado na hora", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 5, 1));
    expect(renderToStaticMarkup(<SignInFooter />)).toContain("© 2031 Quitô");
    vi.setSystemTime(new Date(2032, 0, 1));
    expect(renderToStaticMarkup(<SignInFooter />)).toContain("© 2032 Quitô");
  });

  test("fica num rodapé da página", () => {
    expect(renderToStaticMarkup(<SignInFooter />)).toMatch(/^<footer/);
  });
});
