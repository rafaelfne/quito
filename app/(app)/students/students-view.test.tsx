import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialStudents, startEditing, studentMessages, type Student, type StudentsState } from "@/lib/students";
import { StudentsView } from "./students-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const pedro: Student = { id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" };
const bia: Student = { id: "2", name: "Bia Reis", guardian_name: "Rosa Reis", guardian_phone: "2134567890" };
const ready: StudentsState = { ...initialStudents, listStatus: "ready", students: [bia, pedro] };

function handlers() {
  return { onChange: vi.fn(), onSubmit: vi.fn(), onEdit: vi.fn(), onCancelEdit: vi.fn(), onRetry: vi.fn() };
}

function render(state: StudentsState, busy = false) {
  return renderToStaticMarkup(<StudentsView state={state} busy={busy} {...handlers()} />);
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

function controls(state: StudentsState) {
  const props = handlers();
  const all = expand(StudentsView({ state, busy: false, ...props }));
  const buttonNamed = (label: string) => all.find((element) => element.type === "button" && Children.toArray(element.props.children).join("") === label)!;
  return {
    props,
    buttonNamed,
    inputs: all.filter((element) => element.type === "input"),
    form: all.find((element) => element.type === "form")!,
  };
}

describe("tela de alunos", () => {
  test("enquanto carrega, avisa e não deixa guardar ainda", () => {
    const html = render(initialStudents);
    expect(html).toContain("Carregando");
    expect(html).toContain("<fieldset class=\"flex flex-col gap-4\" disabled");
  });

  test("sem alunos, convida a cadastrar o primeiro", () => {
    const html = render({ ...initialStudents, listStatus: "ready" });
    expect(html).toContain("Nenhum aluno por aqui ainda");
    expect(html).not.toContain("Carregando");
    expect(html).not.toContain("<fieldset class=\"flex flex-col gap-4\" disabled");
  });

  test("mostra aluno, responsável e telefone legível, com botão de editar", () => {
    const html = render(ready);
    expect(html).toContain("Pedro Lima");
    expect(html).toContain("Ana Lima");
    expect(html).toContain("(11) 98765-4321");
    expect(html).toContain("(21) 3456-7890");
    expect(html).toContain('aria-label="Editar Pedro Lima"');
    expect(html.indexOf("Bia Reis")).toBeLessThan(html.indexOf("Pedro Lima"));
  });

  test("tem os caminhos para as notas e a conta", () => {
    const html = render(ready);
    expect(html).toContain('href="/notes"');
    expect(html).toContain('href="/account"');
  });

  test("o campo de telefone abre o teclado de telefone e explica para que serve", () => {
    const html = render(ready);
    expect(html).toContain('type="tel"');
    expect(html).toContain('inputMode="tel"');
    expect(html).toContain("WhatsApp do responsável");
    expect(html).toContain("Com DDD");
  });

  test("aponta o erro no campo certo", () => {
    const html = render({ ...ready, errors: { guardianPhone: studentMessages.phoneInvalid } });
    expect(html).toContain(studentMessages.phoneInvalid);
    expect(html).toContain('aria-describedby="student-guardian-phone-error"');
    expect(html).toContain('id="student-guardian-phone-error"');
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);
  });

  test("mostra a confirmação e o aviso de falha ao guardar", () => {
    expect(render({ ...ready, notice: "Cadastro de Pedro guardado." })).toContain('role="status"');
    expect(render(ready)).not.toContain('role="status"');
    expect(render({ ...ready, message: studentMessages.saveFailed })).toContain(studentMessages.saveFailed);
  });

  test("enquanto guarda, trava o formulário e diz o que está fazendo", () => {
    const html = render(ready, true);
    expect(html).toContain("Guardando...");
    expect(html).toContain("<fieldset class=\"flex flex-col gap-4\" disabled");
  });

  test("quando a lista falha, mantém os alunos e oferece tentar de novo", () => {
    const html = render({ ...ready, listStatus: "failed" });
    expect(html).toContain(studentMessages.loadFailed);
    expect(html).toContain("Tentar de novo");
    expect(html).toContain("Pedro Lima");
  });

  test("quando a lista falha sem nenhum aluno na tela, não diz que a lista está vazia", () => {
    const html = render({ ...initialStudents, listStatus: "failed" });
    expect(html).toContain(studentMessages.loadFailed);
    expect(html).not.toContain("Nenhum aluno por aqui");
  });

  test("ao recarregar com alunos na tela, mostra a lista sem deixar editar", () => {
    const html = render({ ...ready, listStatus: "loading" });
    expect(html).toContain("Pedro Lima");
    expect(html).not.toContain("Editar");
    expect(html).not.toContain("Carregando");
  });

  test("ao corrigir um aluno, o formulário abre no lugar dele e os outros não podem ser editados", () => {
    const html = render(startEditing(ready, pedro));
    expect(html).not.toContain("Novo aluno");
    expect(html).toContain('value="Pedro Lima"');
    expect(html).toContain('value="(11) 98765-4321"');
    expect(html).toContain("Cancelar");
    expect(html).toContain("Bia Reis");
    expect(html).not.toContain("Editar");
  });
});

describe("toques na tela de alunos", () => {
  test("digitar avisa qual campo mudou", () => {
    const { inputs, props } = controls(ready);
    (inputs[0].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "Maria" } });
    (inputs[2].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "11" } });
    expect(props.onChange).toHaveBeenCalledWith("name", "Maria");
    expect(props.onChange).toHaveBeenCalledWith("guardianPhone", "11");
  });

  test("guardar não recarrega a página", () => {
    const { form, props } = controls(ready);
    const preventDefault = vi.fn();
    (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(props.onSubmit).toHaveBeenCalled();
  });

  test("editar avisa qual aluno foi escolhido", () => {
    const { buttonNamed, props } = controls(ready);
    (buttonNamed("Editar").props.onClick as () => void)();
    expect(props.onEdit).toHaveBeenCalledWith(bia);
  });

  test("cancelar e tentar de novo chamam a ação certa", () => {
    const editing = controls(startEditing(ready, pedro));
    (editing.buttonNamed("Cancelar").props.onClick as () => void)();
    expect(editing.props.onCancelEdit).toHaveBeenCalled();

    const failed = controls({ ...ready, listStatus: "failed" });
    (failed.buttonNamed("Tentar de novo").props.onClick as () => void)();
    expect(failed.props.onRetry).toHaveBeenCalled();
  });
});
