import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { applyOpeningLoad, initialOpeningBalance, openingBalanceMessages, type OpeningBalanceState } from "@/lib/opening-balance";
import type { Student } from "@/lib/students";
import { OpeningBalanceView } from "./opening-balance-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const november = { year: 2026, month: 11 };
const pedro: Student = { id: "m", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00", created_at: "2026-11-05T12:00:00Z", makeup_credits: 1 };
const rui: Student = { ...pedro, id: "p", name: "Rui Dias", billing_kind: "package", package_lessons: 4, package_balance: 3, makeup_credits: 0 };
const ready = applyOpeningLoad(initialOpeningBalance, { ok: true, trainingMonth: november, students: [pedro, rui], marks: [], makeupDeadlineDays: null });

function handlers() {
  return { onChange: vi.fn(), onConfirm: vi.fn(), onRetry: vi.fn() };
}

function render(state: OpeningBalanceState, today = "2026-12-01", busy = false) {
  return renderToStaticMarkup(<OpeningBalanceView state={state} today={today} busy={busy} {...handlers()} />);
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

function controls(state: OpeningBalanceState, today = "2026-12-01") {
  const props = handlers();
  const all = expand(OpeningBalanceView({ state, today, busy: false, ...props }));
  return {
    props,
    inputs: all.filter((element) => element.type === "input"),
    form: all.find((element) => element.type === "form"),
    button: (label: string) => all.find((element) => element.type === "button" && Children.toArray(element.props.children).join("") === label),
  };
}

describe("tela do acerto do saldo", () => {
  test("enquanto carrega, avisa", () => {
    expect(render(initialOpeningBalance)).toContain("Carregando...");
  });

  test("falha ao carregar oferece tentar de novo", () => {
    const { button, props } = controls({ ...initialOpeningBalance, status: "failed" });
    expect(render({ ...initialOpeningBalance, status: "failed" })).toContain(openingBalanceMessages.loadFailed);
    (button("Tentar de novo")!.props.onClick as () => void)();
    expect(props.onRetry).toHaveBeenCalled();
  });

  test("sem entrada nos primeiros passos, leva para lá", () => {
    const html = render({ ...initialOpeningBalance, status: "ready" });
    expect(html).toContain(openingBalanceMessages.noTraining);
    expect(html).toContain('href="/getting-started"');
  });

  test("antes do primeiro mês cobrado, diz quando o acerto abre", () => {
    const html = render(ready, "2026-11-30");
    expect(html).toContain("O acerto do saldo abre em 1 de dezembro");
    expect(html).not.toContain("<form");
  });

  test("sem alunos do treino, explica", () => {
    expect(render({ ...ready, students: [] })).toContain(openingBalanceMessages.noStudents);
  });

  test("mostra o previsto de cada aluno, o pacote só para quem paga por pacote, e quem falta confirmar", () => {
    const html = render(ready);
    expect(html).toContain("O treino de novembro acabou.");
    expect(html).toContain("Os créditos não têm prazo.");
    expect(html).toContain("Pedro Lima");
    expect(html).toContain("Mensalidade de R$ 300,00");
    expect(html.match(/Aulas que sobram no pacote/g)).toHaveLength(1);
    expect(html).toContain("Previsto pelo Quitô: 3 aulas.");
    expect(html).toContain("Previsto pelo Quitô: 1 crédito.");
    expect(html.match(new RegExp(openingBalanceMessages.pending, "g"))).toHaveLength(2);
    expect(html).toContain('href="/lessons"');
    const { inputs } = controls(ready);
    expect(inputs.map((input) => input.props.value)).toEqual(["1", "3", "0"]);
  });

  test("aluno confirmado aparece como confirmado", () => {
    const confirmed = { ...ready, students: [{ ...pedro, opening_balance_on: "2026-12-01", opening_package_balance: null, opening_makeup_credits: 1 }] };
    expect(render(confirmed)).toContain(openingBalanceMessages.confirmed);
  });

  test("um aluno sem previsão carregada mostra só os créditos", () => {
    const html = render({ ...ready, predictions: {} });
    expect(html).not.toContain("Aulas que sobram no pacote");
    expect(html).toContain("Previsto pelo Quitô: 0 créditos.");
  });

  test("corrigir um valor e confirmar chamam a página", () => {
    const { inputs, form, props } = controls(ready);
    (inputs[1].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "2" } });
    expect(props.onChange).toHaveBeenCalledWith("p", "packageBalance", "2");
    const preventDefault = vi.fn();
    (form!.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(props.onConfirm).toHaveBeenCalled();
  });

  test("mostra erros, aviso e confirmação, e trava enquanto guarda", () => {
    const withErrors = { ...ready, errors: { p: { packageBalance: "Escreva quantas aulas sobram no pacote, de 0 a 4." } }, message: openingBalanceMessages.invalid, notice: "Saldo de 1 aluno confirmado." };
    const html = render(withErrors, "2026-12-01", true);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="opening-p-packageBalance-error"');
    expect(html).toContain(openingBalanceMessages.invalid);
    expect(html).toContain("Saldo de 1 aluno confirmado.");
    expect(html).toContain("Guardando...");
    expect(html).toContain("disabled");
  });

  test("ao carregar de novo, continua mostrando os alunos", () => {
    const html = render({ ...ready, status: "loading" });
    expect(html).not.toContain("Carregando...");
    expect(html).toContain(openingBalanceMessages.confirm);
  });
});
