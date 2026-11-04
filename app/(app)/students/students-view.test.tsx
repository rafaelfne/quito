import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { billingMessages, packageRolloverHint } from "@/lib/billing";
import { scheduleMessages } from "@/lib/schedule";
import { changeDraft, initialStudents, startEditing, studentMessages, type Student, type StudentsState } from "@/lib/students";
import { StudentsView } from "./students-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const pedro: Student = { id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4, lesson_weekday: 1, lesson_time: "15:00:00" };
const bia: Student = { id: "2", name: "Bia Reis", guardian_name: "Rosa Reis", guardian_phone: "2134567890", billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null };
const november2026 = { year: 2026, month: 11 };
const ready: StudentsState = { ...initialStudents, listStatus: "ready", students: [bia, pedro] };

function handlers() {
  return { onChange: vi.fn(), onSubmit: vi.fn(), onEdit: vi.fn(), onCancelEdit: vi.fn(), onRetry: vi.fn() };
}

function render(state: StudentsState, busy = false, discountPercent = 0) {
  return renderToStaticMarkup(<StudentsView state={state} month={november2026} busy={busy} discountPercent={discountPercent} {...handlers()} />);
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
  const all = expand(StudentsView({ state, month: november2026, busy: false, ...props }));
  const buttonNamed = (label: string) => all.find((element) => element.type === "button" && Children.toArray(element.props.children).join("") === label)!;
  return {
    props,
    buttonNamed,
    inputs: all.filter((element) => element.type === "input"),
    select: all.find((element) => element.type === "select")!,
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

  test("agrupa alunos do mesmo responsável e mostra a cobrança com o desconto configurado", () => {
    const sibling = { ...bia, guardian_name: pedro.guardian_name, guardian_phone: pedro.guardian_phone, billing_kind: "monthly" as const, billing_amount_cents: 30000 };
    const html = render({ ...ready, students: [pedro, sibling] }, false, 10);
    expect(html).toContain("Alunos de Ana Lima");
    expect(html).toContain("Pacote de 4 aulas por R$ 270,00 com 10% de desconto");
    expect(html).toContain("Mensalidade de R$ 270,00 com 10% de desconto");
  });

  test("tem os caminhos para as notas, as regras e a conta", () => {
    const html = render(ready);
    expect(html).toContain('href="/notes"');
    expect(html).toContain('href="/lessons"');
    expect(html).toContain('href="/rules"');
    expect(html).toContain('href="/payment"');
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

describe("forma de cobrança na tela de alunos", () => {
  function choosing(kind: string) {
    return changeDraft(ready, "billingKind", kind);
  }

  test("oferece as três formas, sem nenhuma escolhida e sem pedir valor antes da escolha", () => {
    const html = render(ready);
    expect(html).toContain("Como este aluno paga");
    expect(html).toContain("Mensalidade fixa");
    expect(html).toContain("Valor por aula");
    expect(html).toContain("Pacote de aulas");
    expect(html).not.toContain("checked");
    expect(html).not.toContain("em reais");
  });

  test.each([
    ["monthly", "Valor da mensalidade, em reais"],
    ["per_class", "Valor de cada aula, em reais"],
  ])("com %s, pede só o valor", (kind, label) => {
    const html = render(choosing(kind));
    expect(html).toContain(label);
    expect(html).toContain('inputMode="decimal"');
    expect(html).not.toContain("Quantas aulas tem o pacote");
    expect(html).toContain("checked");
  });

  test("no pacote, pede as aulas e o valor e avisa que as aulas não vencem", () => {
    const html = render(choosing("package"));
    expect(html).toContain("Quantas aulas tem o pacote");
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain("Valor do pacote inteiro, em reais");
    expect(html).toContain(packageRolloverHint);
  });

  test("mostra na lista como cada aluno paga, e quem ainda não tem forma definida", () => {
    const html = render(ready);
    expect(html).toContain("Pacote de 4 aulas por R$ 300,00");
    expect(html).toContain("Forma de cobrança ainda não definida");
  });

  test("ao corrigir, abre com a forma e os valores guardados", () => {
    const html = render(startEditing(ready, pedro));
    expect(html).toContain('value="300,00"');
    expect(html).toContain('value="4"');
    expect(html).toContain("checked");
  });

  test("aponta o erro de cada parte da cobrança", () => {
    const missing = render({ ...ready, errors: { billingKind: billingMessages.kindMissing } });
    expect(missing).toContain(billingMessages.kindMissing);
    expect(missing).toContain('aria-describedby="student-billing-kind-error"');

    const invalid = render({ ...choosing("package"), errors: { billingAmount: billingMessages.amountInvalid, packageLessons: billingMessages.lessonsInvalid } });
    expect(invalid).toContain('id="student-billing-amount-error"');
    expect(invalid).toContain('id="student-package-lessons-error"');
  });

  test("escolher a forma avisa qual foi escolhida", () => {
    const { inputs, props } = controls(ready);
    const radio = inputs.find((input) => input.props.value === "per_class")!;
    (radio.props.onChange as () => void)();
    expect(props.onChange).toHaveBeenCalledWith("billingKind", "per_class");
  });
});

describe("horário fixo na tela de alunos", () => {
  test("pede o dia e o horário, sem nenhum dia escolhido de partida", () => {
    const html = render(ready);
    expect(html).toContain("Dia da aula, toda semana");
    expect(html).toContain("Horário da aula");
    expect(html).toContain('type="time"');
    expect(html).toContain("Segunda-feira");
    expect(html).toContain("Domingo");
    expect(html).toContain('<option value="" selected="">Escolha o dia</option>');
  });

  test("mostra o horário e as aulas previstas do mês, com as 5 aulas quando é o caso", () => {
    const html = render(ready);
    expect(html).toContain("Toda segunda, 15:00");
    expect(html).toContain("Em novembro: 5 aulas previstas, nos dias 2, 9, 16, 23 e 30");
  });

  test("aluno sem horário tem aviso e nenhuma aula prevista", () => {
    const html = render({ ...ready, students: [bia] });
    expect(html).toContain("Horário ainda não definido");
    expect(html).not.toContain("aulas previstas");
  });

  test("ao corrigir, abre com o dia e o horário guardados", () => {
    const html = render(startEditing(ready, pedro));
    expect(html).toContain('<option value="1" selected="">Segunda-feira</option>');
    expect(html).toContain('value="15:00"');
  });

  test("aponta o erro no dia e no horário", () => {
    const html = render({ ...ready, errors: { lessonWeekday: scheduleMessages.weekdayMissing, lessonTime: scheduleMessages.timeInvalid } });
    expect(html).toContain(scheduleMessages.weekdayMissing);
    expect(html).toContain('aria-describedby="student-lesson-weekday-error"');
    expect(html).toContain('id="student-lesson-weekday-error"');
    expect(html).toContain(scheduleMessages.timeInvalid);
    expect(html).toContain('id="student-lesson-time-error"');
  });

  test("escolher o dia avisa qual foi escolhido", () => {
    const { select, props } = controls(ready);
    (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "3" } });
    expect(props.onChange).toHaveBeenCalledWith("lessonWeekday", "3");
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
