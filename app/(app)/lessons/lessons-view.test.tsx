import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialLessons, lessonKey, lessonsMessages, type LessonMark, type LessonsState, type MonthLesson } from "@/lib/lessons";
import { makeupMessages } from "@/lib/makeups";
import type { Student } from "@/lib/students";
import { LessonsView } from "./lessons-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const november2026 = { year: 2026, month: 11 };
const pedro: Student = { id: "p", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const lia: Student = { ...pedro, id: "l", name: "Lia Melo", lesson_weekday: null, lesson_time: null };
const firstLesson: MonthLesson = { studentId: "p", studentName: "Pedro Lima", date: "2026-11-02", time: "15:00", status: null, makeupDate: null };
const unnotified: LessonMark = { student_id: "p", lesson_date: "2026-11-02", status: "unnotified_absence", makeup_date: null };
const notified: LessonMark = { student_id: "p", lesson_date: "2026-11-02", status: "notified_absence", makeup_date: null };
const ready: LessonsState = { ...initialLessons(november2026), status: "ready", students: [pedro], noticeHours: 24 };

function handlers() {
  return { onMark: vi.fn(), onChangeMonth: vi.fn(), onRetry: vi.fn(), onChangeMakeupDate: vi.fn(), onMakeUp: vi.fn(), onUndoMakeup: vi.fn() };
}

function render(state: LessonsState, today = "2026-11-03") {
  return renderToStaticMarkup(<LessonsView state={state} today={today} {...handlers()} />);
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

function buttons(state: LessonsState) {
  const props = handlers();
  const all = expand(LessonsView({ state, today: "2026-11-03", ...props }));
  const named = (label: string) => all.filter((element) => element.type === "button" && (Children.toArray(element.props.children).join("") === label || element.props["aria-label"] === label));
  return { props, named, all };
}

describe("tela de aulas", () => {
  test("mostra o mês, os links e carrega", () => {
    const html = render(initialLessons(november2026));
    expect(html).toContain("Novembro de 2026");
    expect(html).toContain("Carregando");
    expect(html).toContain('href="/students"');
    expect(html).toContain('href="/rules"');
    expect(html).toContain('href="/payment"');
    expect(html).toContain('href="/account"');
  });

  test("cada aula prevista traz as quatro opções, nenhuma escolhida", () => {
    const html = render(ready);
    expect(html).toContain("Segunda-feira, 2 de novembro");
    expect(html).toContain("Pedro Lima");
    expect(html).toContain("15:00");
    for (const label of ["Dada", "Falta avisada", "Falta sem aviso", "Falta do professor"]) expect(html).toContain(`>${label}</button>`);
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain("Ainda sem marcar");
  });

  test("explica a regra de cobrança com a antecedência do professor", () => {
    const html = render({ ...ready, noticeHours: 48 });
    expect(html).toContain(lessonsMessages.chargeRule);
    expect(html).toContain("48 horas");
    expect(html).toContain("na mesma para desfazer");
  });

  test("falta sem aviso aparece escolhida e cobrada", () => {
    const html = render({ ...ready, marks: [unnotified] });
    expect(html).toContain('aria-pressed="true">Falta sem aviso');
    expect(html).toContain("Cobrada");
    expect(html).toContain("1 aula cobrada, 0 sem cobrança e 4 para marcar.");
  });

  test("falta avisada aparece escolhida e sem cobrança", () => {
    const html = render({ ...ready, marks: [notified] });
    expect(html).toContain('aria-pressed="true">Falta avisada');
    expect(html).toContain("0 aulas cobradas, 1 sem cobrança e 4 para marcar.");
  });

  test("tocar numa opção manda a aula e a opção", () => {
    const { props, named } = buttons(ready);
    (named("Falta sem aviso")[0].props.onClick as () => void)();
    expect(props.onMark).toHaveBeenCalledWith(firstLesson, "unnotified_absence");
  });

  test("os botões de mês andam para os lados", () => {
    const { props, named } = buttons(ready);
    (named("Mês anterior")[0].props.onClick as () => void)();
    (named("Mês seguinte")[0].props.onClick as () => void)();
    expect(props.onChangeMonth.mock.calls).toEqual([[-1], [1]]);
  });

  test("enquanto grava, só a aula tocada fica travada", () => {
    const { named } = buttons({ ...ready, pending: [lessonKey(firstLesson)] });
    const dada = named("Dada");
    expect(dada[0].props.disabled).toBe(true);
    expect(dada[1].props.disabled).toBe(false);
  });

  test("marcação que não gravou avisa naquela aula", () => {
    expect(render({ ...ready, failedLesson: lessonKey(firstLesson) })).toContain(lessonsMessages.markFailed);
    expect(render(ready)).not.toContain(lessonsMessages.markFailed);
  });

  test("leva até a próxima aula e marca o dia de hoje", () => {
    const html = render(ready, "2026-11-09");
    expect(html).toContain('href="#hoje"');
    expect(html).toContain('id="hoje"');
    expect(html).toContain("Segunda-feira, 9 de novembro (hoje)");
  });

  test("em outro mês, não oferece ir para hoje", () => {
    expect(render(ready, "2026-12-01")).not.toContain('href="#hoje"');
  });

  test("sem aulas, explica o que fazer", () => {
    expect(render({ ...ready, students: [] })).toContain(lessonsMessages.noLessons);
  });

  test("avisa de aluno sem horário fixo e leva até Alunos", () => {
    const html = render({ ...ready, students: [pedro, lia] });
    expect(html).toContain("1 aluno está sem horário fixo");
    expect(html).toContain("Definir em Alunos");
  });

  test("sem crédito, não mostra a parte de reposição", () => {
    expect(render({ ...ready, marks: [unnotified] })).not.toContain(makeupMessages.title);
  });

  test("a falta avisada vira crédito, com o dia sugerido e o limite do prazo", () => {
    const html = render({ ...ready, marks: [notified], makeupDeadlineDays: 30 });
    expect(html).toContain(makeupMessages.title);
    expect(html).toContain("Falta avisada de 2 de novembro, vale até 2 de dezembro");
    expect(html).toContain('min="2026-11-02"');
    expect(html).toContain('max="2026-12-02"');
    expect(html).toContain('value="2026-11-03"');
    expect(html).toContain("Virou crédito de reposição, vale até 2 de dezembro.");
  });

  test("crédito vencido some da lista e a falta conta que venceu", () => {
    const html = render({ ...ready, marks: [notified], makeupDeadlineDays: 1 }, "2026-11-04");
    expect(html).not.toContain(makeupMessages.title);
    expect(html).toContain("O crédito de reposição venceu em 3 de novembro.");
  });

  test("tocar em marcar reposição manda o crédito e trocar o dia guarda o dia", () => {
    const { props, named, all } = buttons({ ...ready, marks: [notified] });
    (named("Marcar reposição")[0].props.onClick as () => void)();
    expect(props.onMakeUp).toHaveBeenCalledWith(expect.objectContaining({ studentId: "p", absenceDate: "2026-11-02" }));
    const input = all.find((element) => element.type === "input");
    (input?.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "2026-11-10" } });
    expect(props.onChangeMakeupDate).toHaveBeenCalledWith(expect.objectContaining({ absenceDate: "2026-11-02" }), "2026-11-10");
  });

  test("enquanto grava, o crédito fica travado", () => {
    const { named } = buttons({ ...ready, marks: [notified], pending: [lessonKey(firstLesson)] });
    expect(named("Marcar reposição")[0].props.disabled).toBe(true);
  });

  test("problema na reposição aparece no crédito", () => {
    expect(render({ ...ready, marks: [notified], makeupErrors: { [lessonKey(firstLesson)]: makeupMessages.saveFailed } })).toContain(makeupMessages.saveFailed);
  });

  test("a reposição aparece no dia dela, cobrada, e pode ser desfeita", () => {
    const madeUp = { ...notified, makeup_date: "2026-11-05" };
    const html = render({ ...ready, marks: [madeUp] });
    expect(html).not.toContain(makeupMessages.title);
    expect(html).toContain("Quinta-feira, 5 de novembro");
    expect(html).toContain("Reposição da falta de 2 de novembro. Cobrada.");
    expect(html).toContain("1 aula cobrada, 1 sem cobrança e 4 para marcar.");
    const { props, named } = buttons({ ...ready, marks: [madeUp] });
    (named("Desfazer reposição")[0].props.onClick as () => void)();
    expect(props.onUndoMakeup).toHaveBeenCalledWith({ studentId: "p", studentName: "Pedro Lima", date: "2026-11-05", absenceDate: "2026-11-02" });
  });

  test("falta já reposta fica travada e diz como trocar", () => {
    const madeUp = { ...notified, makeup_date: "2026-11-05" };
    expect(render({ ...ready, marks: [madeUp] })).toContain("Reposta em 5 de novembro.");
    expect(buttons({ ...ready, marks: [madeUp] }).named("Dada")[0].props.disabled).toBe(true);
  });

  test("reposição num mês sem aula prevista não mostra o aviso de mês vazio", () => {
    const madeUp = { ...notified, makeup_date: "2026-11-05" };
    expect(render({ ...ready, students: [{ ...pedro, lesson_weekday: null, lesson_time: null }], marks: [madeUp] })).not.toContain(lessonsMessages.noLessons);
  });

  test("falha ao carregar oferece tentar de novo", () => {
    const failed = { ...ready, status: "failed" as const };
    expect(render(failed)).toContain(lessonsMessages.loadFailed);
    const { props, named } = buttons(failed);
    (named("Tentar de novo")[0].props.onClick as () => void)();
    expect(props.onRetry).toHaveBeenCalled();
  });
});
