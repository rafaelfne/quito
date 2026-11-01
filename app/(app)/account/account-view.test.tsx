import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AccountResult } from "@/lib/account";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: {} } }));

const { AccountView } = await import("./account-view");

function render(account: AccountResult | null, signOutMessage: string | null = null) {
  return renderToStaticMarkup(<AccountView account={account} signOutMessage={signOutMessage} onRetry={vi.fn()} onSignOutError={vi.fn()} />);
}

describe("tela de conta", () => {
  test("mostra o e-mail e quem entrou com código", () => {
    const html = render({ ok: true, email: "ana@escola.com", method: "email-code" });
    expect(html).toContain("ana@escola.com");
    expect(html).toContain("Como você entrou neste aparelho");
    expect(html).toContain("Código por e-mail");
  });

  test("mostra quem entrou com Google", () => {
    expect(render({ ok: true, email: "ana@escola.com", method: "google" })).toContain("Google");
  });

  test("sem saber como entrou, mostra só o e-mail", () => {
    const html = render({ ok: true, email: "ana@escola.com", method: null });
    expect(html).toContain("ana@escola.com");
    expect(html).not.toContain("Como você entrou");
  });

  test("enquanto carrega, avisa e já deixa sair", () => {
    const html = render(null);
    expect(html).toContain("Carregando");
    expect(html).toContain("Sair deste aparelho");
  });

  test("quando não carrega, oferece tentar de novo e ainda deixa sair", () => {
    const html = render({ ok: false, message: "Falhou aqui." });
    expect(html).toContain("Falhou aqui.");
    expect(html).toContain("Tentar de novo");
    expect(html).toContain("Sair deste aparelho");
  });

  test("avisa quando não deu para sair", () => {
    expect(render(null, "Não saiu.")).toContain("Não saiu.");
    expect(render(null)).not.toContain('role="alert"');
  });

  test("só oferece apagar quando sabe de quem é a conta", () => {
    expect(render({ ok: true, email: "ana@escola.com", method: "google" })).toContain("Apagar conta");
    expect(render(null)).not.toContain("Apagar conta");
    expect(render({ ok: false, message: "Falhou aqui." })).not.toContain("Apagar conta");
  });

  test("tem caminho de volta para as notas", () => {
    expect(render(null)).toContain('href="/notes"');
  });
});
