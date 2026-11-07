import { beforeEach, describe, expect, test, vi } from "vitest";
import type { StudentImportState } from "@/lib/student-import";
import type { Student } from "@/lib/students";

type SelectResult = { data: Student[] | null; error: { message: string } | null };
type ViewProps = { state: StudentImportState; busy: boolean; onChange: (text: string) => void; onSubmit: () => void; onRetry: () => void };

const select = vi.fn<() => Promise<SelectResult>>(async () => ({ data: [], error: null }));
const insert = vi.fn(async (rows: unknown) => ({ error: null, rows }));
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

const { default: StudentImportPage } = await import("./page");

const pedro: Student = { id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return StudentImportPage().props as ViewProps;
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

describe("página de colar a lista de alunos", () => {
  test("carrega os alunos que já existem para marcar repetidos", async () => {
    select.mockResolvedValueOnce({ data: [pedro], error: null });
    expect(view().state.listStatus).toBe("loading");
    await settle();
    expect(view().state).toMatchObject({ listStatus: "ready", students: [pedro] });
    expect(from).toHaveBeenCalledWith("students");
  });

  test("tentar de novo volta a carregar", async () => {
    select.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    expect(failed.state.listStatus).toBe("failed");
    failed.onRetry();
    expect(view().state.listStatus).toBe("loading");
    await settle();
    expect(view().state.listStatus).toBe("ready");
  });

  test("guarda a lista colada, trava enquanto grava e destrava no fim", async () => {
    const opened = await open();
    opened.onChange("Pedro Lima, Ana Lima, (11) 98765-4321");
    select.mockResolvedValueOnce({ data: [pedro], error: null });
    view().onSubmit();
    expect(view().busy).toBe(true);
    await settle();
    const done = view();
    expect(insert).toHaveBeenCalledWith([{ name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" }]);
    expect(done.busy).toBe(false);
    expect(done.state).toMatchObject({ text: "", notice: "1 aluno guardado.", students: [pedro] });
  });
});
