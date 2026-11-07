import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CalendarMonth } from "@/lib/schedule";
import { studentMessages, type Student, type StudentField, type StudentsState } from "@/lib/students";

type SelectResult = { data: Student[] | null; error: { message: string } | null };
type ViewProps = {
  state: StudentsState;
  month: CalendarMonth;
  busy: boolean;
  onChange: (field: StudentField, value: string) => void;
  onSubmit: () => void;
  onEdit: (student: Student) => void;
  onCancelEdit: () => void;
  onRetry: () => void;
};

const select = vi.fn<() => Promise<SelectResult>>(async () => ({ data: [], error: null }));
const insert = vi.fn(async (row: unknown) => ({ error: null, row }));
const from = vi.fn(() => ({ select, insert }));

const hooks = vi.hoisted(() => {
  let slots: unknown[] = [];
  let cursor = 0;
  return {
    reset() {
      slots = [];
      cursor = 0;
    },
    rewind() {
      cursor = 0;
    },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value: unknown) => {
          slots[index] = typeof value === "function" ? (value as (current: unknown) => unknown)(slots[index]) : value;
        },
      ];
    },
    useCallback(callback: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = callback;
      return slots[index];
    },
    useEffect(effect: () => void, deps: unknown[]) {
      const index = cursor++;
      const previous = slots[index] as unknown[] | undefined;
      slots[index] = deps;
      if (!previous || deps.some((dep, position) => dep !== previous[position])) effect();
    },
  };
});

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: hooks.useState,
  useCallback: hooks.useCallback,
  useEffect: hooks.useEffect,
}));
vi.mock("@/lib/supabase", () => ({ supabase: { from, auth: {} } }));

const { default: StudentsPage } = await import("./page");

const pedro: Student = { id: "1", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return StudentsPage().props as ViewProps;
}

async function open() {
  view();
  await settle();
  return view();
}

beforeEach(() => {
  hooks.reset();
  select.mockClear();
  insert.mockClear();
});

describe("página de alunos", () => {
  test("começa carregando e mostra os alunos quando o banco responde", async () => {
    select.mockResolvedValueOnce({ data: [pedro], error: null });
    expect(view().state.listStatus).toBe("loading");
    await settle();
    expect(view().state).toMatchObject({ listStatus: "ready", students: [pedro] });
    expect(from).toHaveBeenCalledWith("students");
  });

  test("mostra as aulas previstas do mês em que o aparelho está", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 15, 12) });
    try {
      expect(view().month).toEqual({ year: 2026, month: 11 });
    } finally {
      vi.useRealTimers();
    }
  });

  test("busca alunos e regras uma vez cada, mesmo quando a tela é desenhada de novo", async () => {
    await open();
    view();
    await settle();
    expect(select).toHaveBeenCalledTimes(2);
    expect(from).toHaveBeenNthCalledWith(1, "students");
    expect(from).toHaveBeenNthCalledWith(2, "teacher_rules");
  });

  test("tentar de novo volta a carregar e mostra a lista", async () => {
    select.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    expect(failed.state.listStatus).toBe("failed");
    select.mockResolvedValueOnce({ data: [pedro], error: null });
    failed.onRetry();
    expect(view().state.listStatus).toBe("loading");
    await settle();
    expect(view().state).toMatchObject({ listStatus: "ready", students: [pedro] });
  });

  test("guarda o que foi digitado, trava enquanto grava e destrava no fim", async () => {
    const opened = await open();
    opened.onChange("name", "Pedro Lima");
    view().onChange("gender", "male");
    view().onChange("guardianName", "Ana Lima");
    view().onChange("guardianPhone", "(11) 98765-4321");
    view().onChange("billingKind", "monthly");
    view().onChange("billingAmount", "300,00");
    view().onChange("lessonWeekday", "1");
    view().onChange("lessonTime", "15:00");
    select.mockResolvedValueOnce({ data: [pedro], error: null });
    view().onSubmit();
    expect(view().busy).toBe(true);
    await settle();
    const done = view();
    expect(insert).toHaveBeenCalledWith({ name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00", package_balance: 0, makeup_credits: 0 });
    expect(done.busy).toBe(false);
    expect(done.state.students).toEqual([pedro]);
    expect(done.state.notice).toContain("Pedro Lima");
  });

  test("dado errado aparece no campo e destrava o formulário", async () => {
    const opened = await open();
    opened.onSubmit();
    await settle();
    const done = view();
    expect(insert).not.toHaveBeenCalled();
    expect(done.busy).toBe(false);
    expect(done.state.errors.name).toBe(studentMessages.nameMissing);
  });

  test("editar abre o aluno escolhido e cancelar volta para o aluno novo", async () => {
    select.mockResolvedValueOnce({ data: [pedro], error: null });
    const opened = await open();
    opened.onEdit(pedro);
    expect(view().state.editing?.id).toBe("1");
    view().onCancelEdit();
    expect(view().state.editing).toBeNull();
  });
});
