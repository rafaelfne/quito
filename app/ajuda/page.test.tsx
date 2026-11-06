import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { helpQuestions } from "@/lib/help";
import HelpPage, { metadata } from "./page";

const html = renderToStaticMarkup(<HelpPage />);

describe("página de ajuda", () => {
  test("mostra o título e o caminho de volta para o app", () => {
    expect(html).toContain("<h1");
    expect(html).toContain("Ajuda");
    expect(html).toContain('href="/"');
    expect(metadata.title).toBe("Ajuda · quito");  });

  test("traz as três perguntas do professor, na ordem combinada", () => {
    const questions = ["Como cobro meus alunos?", "Como marco uma cobrança como paga?", "Como falo com o suporte?"];
    expect(helpQuestions.map((item) => item.question)).toEqual(questions);
    const positions = questions.map((question) => html.indexOf(question));
    positions.forEach((position) => expect(position).toBeGreaterThan(-1));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("cada pergunta abre e fecha com a sua resposta inteira", () => {
    expect(html.match(/<details/g)).toHaveLength(3);
    expect(html.match(/<summary/g)).toHaveLength(3);
    helpQuestions.flatMap((item) => item.answers).forEach((answer) => expect(html).toContain(answer));
  });

  test("as respostas falam do caminho que o professor segue no app", () => {
    expect(html).toContain("WhatsApp");
    expect(html).toContain("chave Pix");
    expect(html).toContain("Marcar como pago");
    expect(html).toContain("e-mail de suporte");
  });

  test("usa as cores e o arredondado do tema do app", () => {
    expect(html).toContain("bg-card");
    expect(html).toContain("text-card-foreground");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("border-border");
    expect(html).toContain("rounded-sm");
    expect(html).toContain("text-primary");
  });
});
