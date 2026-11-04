import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ClosingState } from "@/lib/closing";
import type { Student } from "@/lib/students";

type ViewProps = { state: ClosingState; today: string; onChangeMonth: (delta: number) => void; onRetry: () => void };

const pedro: Student = { id: "p", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };

const selectStudents = vi.fn(async (columns: string) => (columns === "id, created_at" ? { data: [], error: null as { message: string } | null } : { data: [pedro] as Student[] | null, error: null as { message: string } | null }));
const marksChain = { order: () => marksChain, range: async () => ({ data: [], error: null }) };
const from = vi.fn((table: string) => {
  if (table === "students") return { select: selectStudents };
  if (table === "teacher_rules") return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
  return { select: () => ({ lte: () => marksChain }) };
});

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

const { default: ClosingPage } = await import("./page");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return ClosingPage().props as ViewProps;
}

beforeEach(() => {
  hooks.reset();
  selectStudents.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 15, 12) });
  return () => vi.useRealTimers();
});

describe("página de fechamento", () => {
  test("abre no mês e no dia do aparelho e mostra os alunos", async () => {
    expect(view().state).toMatchObject({ status: "loading", month: november() });
    expect(view().today).toBe("2026-11-15");
    await settle();
    expect(view().state.status).toBe("ready");
    expect(view().state.data?.students).toEqual([pedro]);
  });

  test("trocar de mês busca o novo mês", async () => {
    view();
    await settle();
    view().onChangeMonth(1);
    expect(view().state).toMatchObject({ status: "loading", month: { year: 2026, month: 12 } });
    await settle();
    expect(view().state.status).toBe("ready");
  });

  test("tentar de novo volta a carregar", async () => {
    selectStudents.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    view();
    await settle();
    const failed = view();
    expect(failed.state.status).toBe("failed");
    failed.onRetry();
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state.status).toBe("ready");
  });
});

function november() {
  return { year: 2026, month: 11 };
}
