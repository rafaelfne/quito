import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { DeleteAccountView, type DeleteStep } from "./delete-account-view";

function render(step: DeleteStep, message: string | null = null) {
  return renderToStaticMarkup(<DeleteAccountView email="ana@escola.com" step={step} message={message} onOpen={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} />);
}

describe("apagar conta na tela", () => {
  test("fechado, só oferece o botão e não apaga de um toque", () => {
    const html = render("closed");
    expect(html).toContain("Apagar conta");
    expect(html).not.toContain("Sim, apagar tudo");
  });

  test("antes de apagar, diz de quem é a conta, o que se perde e deixa desistir", () => {
    const html = render("confirming");
    expect(html).toContain("ana@escola.com");
    expect(html).toContain("alunos, aulas e cobranças");
    expect(html).toContain("Não dá para desfazer");
    expect(html).toContain("Sim, apagar tudo");
    expect(html).toContain("Cancelar");
    expect(html).not.toContain('disabled=""');
  });

  test("enquanto apaga, trava os dois botões", () => {
    const html = render("deleting");
    expect(html).toContain("Apagando...");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  test("mostra o aviso quando não deu certo", () => {
    expect(render("confirming", "Não apagou.")).toContain("Não apagou.");
    expect(render("confirming")).not.toContain('role="alert"');
  });
});
