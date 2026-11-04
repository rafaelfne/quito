import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { closingMessages, initialClosing, type ClosingData, type ClosingState } from "@/lib/closing";
import type { LessonMark } from "@/lib/lessons";
import type { Student } from "@/lib/students";
import { ClosingView } from "./closing-view";

const november = { year: 2026, month: 11 };

const pedro: Student = { id: "p", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "per_class", billing_amount_cents: 8000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const bruno: Student = { ...pedro, id: "b", name: "Bruno Lima", billing_kind: "monthly", billing_amount_cents: 20000 };
const given: LessonMark = { student_id: "p", lesson_date: "2026-11-02", status: "given", makeup_date: null };
const credit: LessonMark = { student_id: "p", lesson_date: "2026-11-09", status: "notified_absence", makeup_date: null };
const rules: ClosingData["rules"] = { makeup_deadline_days: null, five_week_policy: "same_price", five_week_extra_cents: null, sibling_discount_percent: 10 };

function ready(overrides: Partial<ClosingData> = {}): ClosingState {
  return { month: november, status: "ready", data: { students: [pedro, bruno], enrollments: [], marks: [given, credit], rules, ...overrides } };
}

function render(state: ClosingState) {
  return renderToStaticMarkup(<ClosingView state={state} today="2026-11-30" onChangeMonth={vi.fn()} onRetry={vi.fn()} />);
}

describe("tela de fechamento", () => {
  test("mostra o mês, os links e carrega", () => {
    const html = render(initialClosing(november));
    expect(html).toContain("Fechamento");
    expect(html).toContain("Novembro de 2026");
    expect(html).toContain("Carregando");
    expect(html).toContain('href="/students"');
    expect(html).toContain('href="/lessons"');
    expect(html).toContain('href="/rules"');
    expect(html).toContain('href="/payment"');
    expect(html).toContain('href="/charges"');
    expect(html).toContain('href="/account"');
  });

  test("falha avisa e oferece tentar de novo", () => {
    const html = render({ month: november, status: "failed", data: null });
    expect(html).toContain(closingMessages.loadFailed);
    expect(html).toContain("Tentar de novo");
  });

  test("sem alunos, leva até a tela de Alunos", () => {
    expect(render(ready({ students: [] }))).toContain(closingMessages.noStudents);
  });

  test("mostra o responsável, a conta aberta de cada aluno e os totais", () => {
    const html = render(ready());
    expect(html).toContain("Ana Lima");
    expect(html).toContain("(11) 98765-4321");
    expect(html).toContain("1 aula dada × R$ 80,00");
    expect(html).toContain("Desconto de 10% para irmãos");
    expect(html).toContain("− R$ 8,00");
    expect(html).toContain("Mensalidade");
    expect(html).toContain("Falta avisada de 9 de novembro, sem prazo");
    expect(html).toContain("3 aulas ainda sem marcar.");
    expect(html).toContain(closingMessages.guardianTotal);
    expect(html).toContain("R$ 252,00");
    expect(html).toContain(closingMessages.monthTotal);
  });

  test("avisa quando há aula sem marcar que muda valor", () => {
    expect(render(ready())).toContain("podem mudar o valor");
    expect(render(ready({ students: [bruno], marks: [] }))).not.toContain("podem mudar o valor");
  });

  test("aluno sem cobrança pede para definir em Alunos", () => {
    const html = render(ready({ students: [{ ...pedro, billing_kind: null, billing_amount_cents: null }], marks: [] }));
    expect(html).toContain(closingMessages.missingBilling);
    expect(html).toContain("Definir em Alunos");
    expect(html).toContain("1 aluno está sem forma de cobrança");
  });

  test("pacote mostra o saldo de aulas", () => {
    const html = render(ready({ students: [{ ...pedro, billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4 }], marks: [given] }));
    expect(html).toContain("Passam para o mês seguinte: 3.");
  });

  test("as setas e o tentar de novo avisam a página", () => {
    const onChangeMonth = vi.fn();
    const onRetry = vi.fn();
    const tree = ClosingView({ state: { month: november, status: "failed", data: null }, today: "2026-11-30", onChangeMonth, onRetry });
    const [, monthRow, , failed] = tree.props.children;
    monthRow.props.children[0].props.onClick();
    monthRow.props.children[2].props.onClick();
    failed.props.children[1].props.onClick();
    expect(onChangeMonth.mock.calls).toEqual([[-1], [1]]);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
