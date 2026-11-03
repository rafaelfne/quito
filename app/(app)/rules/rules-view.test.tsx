import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { billingMessages } from "@/lib/billing";
import { initialTeacherRules, teacherRulesMessages, type TeacherRulesDraft, type TeacherRulesState } from "@/lib/teacher-rules";
import { TeacherRulesView } from "./rules-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const ready: TeacherRulesState = { ...initialTeacherRules, status: "ready" };

function withDraft(changes: Partial<TeacherRulesDraft>): TeacherRulesState {
  return { ...ready, draft: { ...ready.draft, ...changes } };
}

function handlers() {
  return { onChange: vi.fn(), onSubmit: vi.fn(), onRetry: vi.fn() };
}

function render(state: TeacherRulesState, busy = false) {
  return renderToStaticMarkup(<TeacherRulesView state={state} busy={busy} {...handlers()} />);
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

function controls(state: TeacherRulesState) {
  const props = handlers();
  const all = expand(TeacherRulesView({ state, busy: false, ...props }));
  return {
    props,
    all,
    inputs: all.filter((element) => element.type === "input"),
    form: all.find((element) => element.type === "form"),
    button: all.find((element) => element.type === "button"),
  };
}

describe("tela de regras", () => {
  test("enquanto carrega, avisa e não deixa guardar ainda", () => {
    const html = render(initialTeacherRules);
    expect(html).toContain("Carregando");
    expect(html).toContain('<fieldset class="flex flex-col gap-4" disabled');
  });

  test("mostra as três regras, com 24 horas de partida, e diz que valem para todos os alunos", () => {
    const html = render(ready);
    expect(html).not.toContain("Carregando");
    expect(html).not.toContain('<fieldset class="flex flex-col gap-4" disabled');
    expect(html).toContain("todos os seus alunos");
    expect(html).toContain("horas de antecedência");
    expect(html).toContain("Desconto para alunos com o mesmo responsável");
    expect(html).toContain('value="24"');
    expect(html).toContain("A reposição tem prazo?");
    expect(html).toContain("o mês com 5 semanas");
    expect(html).toContain("Custa igual aos outros meses");
    expect(html).toContain("Soma o valor de uma aula avulsa");
  });

  test("tem os caminhos para os alunos e a conta", () => {
    const html = render(ready);
    expect(html).toContain('href="/students"');
    expect(html).toContain('href="/lessons"');
    expect(html).toContain('href="/account"');
  });

  test("o prazo só é pedido quando a reposição tem prazo", () => {
    expect(render(ready)).not.toContain("Prazo para repor");
    expect(render(withDraft({ makeupPolicy: "deadline" }))).toContain("Prazo para repor");
  });

  test("o valor da aula avulsa só é pedido quando o mês com 5 semanas soma", () => {
    expect(render(ready)).not.toContain("Valor da aula avulsa");
    expect(render(withDraft({ fiveWeekPolicy: "add_lesson" }))).toContain("Valor da aula avulsa");
  });

  test("aponta erro no desconto percentual", () => {
    const html = render({ ...ready, errors: { siblingDiscountPercent: "Confira o desconto" } });
    expect(html).toContain('id="rules-sibling-discount-percent-error"');
    expect(html).toContain("Confira o desconto");
  });

  test("aponta o erro no campo certo", () => {
    const html = render({ ...withDraft({ makeupPolicy: "deadline" }), errors: { makeupDays: teacherRulesMessages.makeupDaysInvalid } });
    expect(html).toContain('id="rules-makeup-days-error"');
    expect(html).toContain('aria-describedby="rules-makeup-days-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(teacherRulesMessages.makeupDaysInvalid);
  });

  test("mostra o erro de valor no campo da aula avulsa", () => {
    const html = render({ ...withDraft({ fiveWeekPolicy: "add_lesson" }), errors: { fiveWeekExtra: billingMessages.amountInvalid } });
    expect(html).toContain('id="rules-five-week-extra-error"');
  });

  test("mostra o aviso de guardado e a falha ao guardar", () => {
    expect(render({ ...ready, notice: teacherRulesMessages.saved })).toContain(teacherRulesMessages.saved);
    expect(render({ ...ready, message: teacherRulesMessages.saveFailed })).toContain(teacherRulesMessages.saveFailed);
  });

  test("enquanto guarda, trava o formulário e avisa no botão", () => {
    const html = render(ready, true);
    expect(html).toContain("Guardando...");
    expect(html).toContain('<fieldset class="flex flex-col gap-4" disabled');
  });

  test("se não abriu as regras, não mostra o formulário e deixa tentar de novo", () => {
    const { form, button, props } = controls({ ...initialTeacherRules, status: "failed" });
    expect(render({ ...initialTeacherRules, status: "failed" })).toContain(teacherRulesMessages.loadFailed);
    expect(form).toBeUndefined();
    (button!.props.onClick as () => void)();
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  test("digitar e escolher avisam o campo certo", () => {
    const { inputs, props } = controls(ready);
    const notice = inputs.find((input) => input.props.type === "text")!;
    (notice.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "12" } });
    expect(props.onChange).toHaveBeenCalledWith("noticeHours", "12");
    const deadline = inputs.find((input) => input.props.value === "deadline")!;
    (deadline.props.onChange as () => void)();
    expect(props.onChange).toHaveBeenCalledWith("makeupPolicy", "deadline");
    const addLesson = inputs.find((input) => input.props.value === "add_lesson")!;
    (addLesson.props.onChange as () => void)();
    expect(props.onChange).toHaveBeenCalledWith("fiveWeekPolicy", "add_lesson");
  });

  test("marca as opções guardadas", () => {
    const { inputs } = controls(withDraft({ makeupPolicy: "deadline", fiveWeekPolicy: "add_lesson" }));
    const checked = inputs.filter((input) => input.props.checked).map((input) => input.props.value);
    expect(checked).toEqual(["deadline", "add_lesson"]);
  });

  test("guardar não recarrega a página e envia o formulário", () => {
    const { form, props } = controls(ready);
    const preventDefault = vi.fn();
    (form!.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });
});
