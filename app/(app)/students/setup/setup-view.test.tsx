import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { billingMessages, packageRolloverHint } from "@/lib/billing";
import { scheduleMessages } from "@/lib/schedule";
import { applySetupLoad, changeGroupBilling, initialStudentSetup, studentSetupMessages, toggleStudent, type StudentSetupState } from "@/lib/student-setup";
import type { Student } from "@/lib/students";
import { StudentSetupView } from "./setup-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const blank = { billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null, gender: null, called_as: null };
const pedro: Student = { ...blank, id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" };
const caio: Student = { ...blank, id: "3", name: "Caio Reis", guardian_name: "Rosa Reis", guardian_phone: "2134567890", billing_kind: "monthly", billing_amount_cents: 20000, lesson_weekday: 2, lesson_time: "09:30:00" };
const ready = applySetupLoad(initialStudentSetup, { ok: true, students: [caio, pedro] });

function handlers() {
  return {
    onToggle: vi.fn(),
    onSelectWithoutBilling: vi.fn(),
    onClearSelection: vi.fn(),
    onChangeBilling: vi.fn(),
    onApplyBilling: vi.fn(),
    onChangeSchedule: vi.fn(),
    onSaveSchedule: vi.fn(),
    onRetry: vi.fn(),
  };
}

function render(state: StudentSetupState, busy = false) {
  return renderToStaticMarkup(<StudentSetupView state={state} busy={busy} {...handlers()} />);
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

function textOf(element: ReactElement<AnyProps>): string {
  return Children.toArray(element.props.children).join("");
}

function controls(state: StudentSetupState) {
  const props = handlers();
  const all = expand(StudentSetupView({ state, busy: false, ...props }));
  return {
    props,
    all,
    buttonNamed: (label: string) => all.find((element) => element.type === "button" && textOf(element) === label)!,
    forms: all.filter((element) => element.type === "form"),
    checkboxes: all.filter((element) => element.type === "input" && element.props.type === "checkbox"),
    radios: all.filter((element) => element.type === "input" && element.props.type === "radio"),
    selects: all.filter((element) => element.type === "select"),
    times: all.filter((element) => element.type === "input" && element.props.type === "time"),
  };
}

function submit(form: ReactElement<AnyProps>) {
  const preventDefault = vi.fn();
  (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
  return preventDefault;
}

describe("tela de cobrança e horário em grupo", () => {
  test("enquanto carrega, avisa", () => {
    expect(render(initialStudentSetup)).toContain("Carregando...");
  });

  test("ao carregar de novo, continua mostrando os alunos que já estavam na tela", () => {
    const html = render({ ...ready, listStatus: "loading" });
    expect(html).not.toContain("Carregando...");
    expect(html).toContain("Pedro Lima");
  });

  test("sem alunos, manda cadastrar ou colar a lista primeiro", () => {
    expect(render({ ...initialStudentSetup, listStatus: "ready" })).toContain("Cadastre ou cole a lista de alunos primeiro.");
  });

  test("quando não abre a lista, avisa e oferece tentar de novo", () => {
    const failed = { ...initialStudentSetup, listStatus: "failed" as const };
    expect(render(failed)).toContain(studentSetupMessages.loadFailed);
    const { buttonNamed, props } = controls(failed);
    (buttonNamed("Tentar de novo").props.onClick as () => void)();
    expect(props.onRetry).toHaveBeenCalled();
  });

  test("mostra cada aluno com a forma de cobrança e o horário de agora", () => {
    const html = render(ready);
    expect(html).toContain("Cobrança e horário em grupo");
    expect(html).toContain("Mensalidade de R$ 200,00");
    expect(html).toContain("Forma de cobrança ainda não definida");
    expect(html).toContain("Toda terça, 09:30");
    expect(html).toContain("Horário ainda não definido");
    expect(html).toContain("Marcar os 1 sem forma de cobrança");
    expect(html).toContain("Marque os alunos");
  });

  test("marcar um aluno e aplicar chamam a ação certa sem recarregar a página", () => {
    const { checkboxes, forms, props } = controls(ready);
    (checkboxes[1].props.onChange as () => void)();
    expect(props.onToggle).toHaveBeenCalledWith("1");
    expect(submit(forms[0])).toHaveBeenCalled();
    expect(props.onApplyBilling).toHaveBeenCalled();
  });

  test("o botão de aplicar só funciona com aluno marcado e diz quantos", () => {
    expect(controls(ready).all.find((element) => element.type === "button" && element.props.type === "submit")!.props.disabled).toBe(true);
    const marked = toggleStudent(ready, "1");
    const apply = controls(marked).all.find((element) => element.type === "button" && element.props.type === "submit")!;
    expect(apply.props.disabled).toBe(false);
    expect(textOf(apply)).toBe("Aplicar a 1 aluno");
  });

  test("marcar os sem cobrança e desmarcar todos chamam as ações", () => {
    const { buttonNamed, props } = controls(toggleStudent(ready, "1"));
    (buttonNamed("Marcar os 1 sem forma de cobrança").props.onClick as () => void)();
    (buttonNamed("Desmarcar todos").props.onClick as () => void)();
    expect(props.onSelectWithoutBilling).toHaveBeenCalled();
    expect(props.onClearSelection).toHaveBeenCalled();
  });

  test("sem aluno sem cobrança, não oferece marcar os que faltam", () => {
    const allSet = applySetupLoad(initialStudentSetup, { ok: true, students: [caio] });
    expect(render(allSet)).not.toContain("sem forma de cobrança");
  });

  test("escolher pacote pede quantas aulas e o valor do pacote", () => {
    const { radios, props } = controls(ready);
    (radios[2].props.onChange as () => void)();
    expect(props.onChangeBilling).toHaveBeenCalledWith("billingKind", "package");
    const packageState = changeGroupBilling(ready, "billingKind", "package");
    const html = render(packageState);
    expect(html).toContain("Quantas aulas tem o pacote");
    expect(html).toContain(packageRolloverHint);
    expect(html).toContain("Valor do pacote inteiro, em reais");
    const inputs = controls(packageState).all.filter((element) => element.type === "input" && element.props.inputMode);
    (inputs[0].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "4" } });
    (inputs[1].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "300" } });
  });

  test("digitar o valor do grupo chama a ação com o campo", () => {
    const state = changeGroupBilling(ready, "billingKind", "monthly");
    const { all, props } = controls(state);
    const amount = all.find((element) => element.type === "input" && element.props.inputMode === "decimal")!;
    (amount.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "150" } });
    expect(props.onChangeBilling).toHaveBeenCalledWith("billingAmount", "150");
    expect(render(state)).not.toContain("Quantas aulas tem o pacote");
  });

  test("mostra os erros da forma de cobrança ao lado de cada campo", () => {
    const html = render({ ...changeGroupBilling(ready, "billingKind", "package"), billingErrors: { billingAmount: billingMessages.amountInvalid, packageLessons: billingMessages.lessonsInvalid } });
    expect(html).toContain(billingMessages.amountInvalid);
    expect(html).toContain(billingMessages.lessonsInvalid);
    expect(render({ ...ready, billingErrors: { billingKind: billingMessages.kindMissing } })).toContain(billingMessages.kindMissing);
  });

  test("cada aluno tem o próprio dia e horário, com o botão de guardar só dele", () => {
    const { selects, times, forms, props } = controls(ready);
    expect(selects[0].props.value).toBe("2");
    expect(times[0].props.value).toBe("09:30");
    (selects[1].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "4" } });
    (times[1].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "15:00" } });
    expect(props.onChangeSchedule).toHaveBeenCalledWith("1", "lessonWeekday", "4");
    expect(props.onChangeSchedule).toHaveBeenCalledWith("1", "lessonTime", "15:00");
    expect(submit(forms[2])).toHaveBeenCalled();
    expect(props.onSaveSchedule).toHaveBeenCalledWith("1");
    expect(render(ready)).toContain('aria-label="Guardar horário de Pedro Lima"');
  });

  test("mostra o erro do horário só no aluno que tem o problema", () => {
    const html = render({ ...ready, scheduleErrors: { "1": { lessonWeekday: scheduleMessages.weekdayMissing, lessonTime: scheduleMessages.timeInvalid } } });
    expect(html).toContain('id="schedule-1-weekday-error"');
    expect(html).toContain('id="schedule-1-time-error"');
    expect(html).not.toContain("schedule-3-weekday-error");
  });

  test("mostra a confirmação e o aviso de erro", () => {
    expect(render({ ...ready, notice: "Horário de Pedro Lima guardado." })).toContain("Horário de Pedro Lima guardado.");
    expect(render({ ...ready, message: studentSetupMessages.noneSelected })).toContain(studentSetupMessages.noneSelected);
  });

  test("enquanto guarda, trava os campos e diz o que está fazendo", () => {
    const html = render(toggleStudent(ready, "1"), true);
    expect(html).toContain("Guardando...");
    expect(html).toMatch(/<fieldset[^>]*disabled/);
  });
});
