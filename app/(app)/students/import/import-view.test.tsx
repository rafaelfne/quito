import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialStudentImport, studentImportMessages, type StudentImportState } from "@/lib/student-import";
import type { Student } from "@/lib/students";
import { StudentImportView } from "./import-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const pedro: Student = { id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null };
const ready: StudentImportState = { ...initialStudentImport, listStatus: "ready" };

function handlers() {
  return { onChange: vi.fn(), onSubmit: vi.fn(), onRetry: vi.fn() };
}

function render(state: StudentImportState, busy = false) {
  return renderToStaticMarkup(<StudentImportView state={state} busy={busy} {...handlers()} />);
}

function expand(node: ReactNode): ReactElement<AnyProps>[] {
  const found: ReactElement<AnyProps>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<AnyProps>(child)) return;
    if (typeof child.type === "function" && child.type.name !== "LinkComponent") {
      found.push(...expand((child.type as (props: AnyProps) => ReactNode)(child.props)));
      return;
    }
    found.push(child);
    found.push(...expand(child.props.children));
  });
  return found;
}

describe("tela de colar a lista de alunos", () => {
  test("explica o formato e volta para Alunos", () => {
    const html = render(ready);
    expect(html).toContain("Um aluno por linha");
    expect(html).toContain('href="/students"');
    expect(html).toContain("Guardar 0 alunos");
    expect(html).not.toContain("Como o Quitô separou");
  });

  test("mostra como cada linha foi separada e o que falta corrigir", () => {
    const html = render({ ...ready, text: "Pedro Lima, Ana Lima, 11987654321\nBia Reis, 98765-4321", students: [] });
    expect(html).toContain("Como o Quitô separou");
    expect(html).toContain("Linha 1");
    expect(html).toContain("(11) 98765-4321");
    expect(html).toContain("Pronto para guardar");
    expect(html).toContain("Linha 2");
    expect(html).toContain(studentImportMessages.guardianMissing);
    expect(html).toContain(studentImportMessages.phoneInvalid);
    expect(html).toContain("1 pronto para guardar, 1 precisa de correção.");
    expect(html).toContain("Guardar 1 aluno");
    expect(html).toContain("ficam na caixa depois de guardar");
  });

  test("conta no plural e marca quem já está cadastrado", () => {
    const html = render({ ...ready, students: [pedro], text: "Pedro Lima, Ana, 11987654321\nBia, Rosa, 2134567890\nCaio, Rosa, 2134567891\nX\nY" });
    expect(html).toContain("2 prontos para guardar, 3 precisam de correção.");
    expect(html).toContain(studentImportMessages.alreadySaved);
  });

  test("sem pendência, não fala em correção", () => {
    const html = render({ ...ready, text: "Pedro Lima, Ana Lima, 11987654321" });
    expect(html).toContain("1 pronto para guardar.");
    expect(html).not.toContain("ficam na caixa");
  });

  test("mostra a confirmação e o aviso de erro", () => {
    expect(render({ ...ready, notice: "2 alunos guardados." })).toContain("2 alunos guardados.");
    expect(render({ ...ready, message: studentImportMessages.saveFailed })).toContain(studentImportMessages.saveFailed);
  });

  test("enquanto guarda, trava a caixa e diz o que está fazendo", () => {
    const html = render({ ...ready, text: "Pedro Lima, Ana Lima, 11987654321" }, true);
    expect(html).toContain("Guardando...");
    expect(html).toMatch(/<textarea[^>]*disabled/);
  });

  test("só deixa guardar com a lista de alunos carregada", () => {
    const text = "Pedro Lima, Ana Lima, 11987654321";
    const button = (state: StudentImportState) => expand(StudentImportView({ state, busy: false, ...handlers() })).find((element) => element.type === "button" && element.props.type === "submit")!;
    expect(button({ ...ready, text }).props.disabled).toBe(false);
    expect(button({ ...initialStudentImport, text }).props.disabled).toBe(true);
  });

  test("quando não dá para conferir os alunos, avisa e oferece tentar de novo", () => {
    const props = handlers();
    const all = expand(StudentImportView({ state: { ...initialStudentImport, listStatus: "failed" }, busy: false, ...props }));
    expect(renderToStaticMarkup(<StudentImportView state={{ ...initialStudentImport, listStatus: "failed" }} busy={false} {...props} />)).toContain(studentImportMessages.loadFailed);
    (all.find((element) => element.type === "button" && element.props.type === "button")!.props.onClick as () => void)();
    expect(props.onRetry).toHaveBeenCalled();
  });

  test("digitar e guardar chamam a ação certa sem recarregar a página", () => {
    const props = handlers();
    const all = expand(StudentImportView({ state: ready, busy: false, ...props }));
    (all.find((element) => element.type === "textarea")!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "Pedro" } });
    expect(props.onChange).toHaveBeenCalledWith("Pedro");
    const preventDefault = vi.fn();
    (all.find((element) => element.type === "form")!.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(props.onSubmit).toHaveBeenCalled();
  });
});
