import { beforeEach, describe, expect, test, vi } from "vitest";
import type { OpeningBalanceViewProps } from "@/app/(app)/students/opening-balance/opening-balance-view";
import type { Student } from "@/lib/students";

type Failure = { message: string } | null;

const pedro: Student = { id: "m", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4, package_balance: 2, makeup_credits: 0, lesson_weekday: 1, lesson_time: "15:00:00", created_at: "2026-11-05T12:00:00Z" };

const studentsSelect = vi.fn<() => Promise<{ data: Student[] | null; error: Failure }>>(async () => ({ data: [pedro], error: null }));
const updates: { row: unknown; id: string }[] = [];
const update = vi.fn((row: unknown) => ({
  eq: (_column: string, id: string) => {
    updates.push({ row, id });
    return { select: async () => ({ data: [{ id }], error: null }) };
  },
}));
const marksChain = { order: () => marksChain, range: async () => ({ data: [{ student_id: "m", lesson_date: "2026-11-02", status: "given", makeup_date: null }], error: null }) };
const tables: Record<string, unknown> = {
  getting_started: { select: () => ({ maybeSingle: async () => ({ data: { started_at: "2026-11-05T12:00:00Z" }, error: null }) }) },
  students: { select: studentsSelect, update },
  teacher_rules: { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) },
  lesson_marks: { select: () => ({ lte: () => marksChain }) },
};
const from = vi.fn((table: string) => tables[table]);

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

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useState: hooks.useState, useCallback: hooks.useCallback, useEffect: hooks.useEffect }));
vi.mock("@/lib/supabase", () => ({ supabase: { from, auth: {} } }));

const { default: OpeningBalancePage } = await import("./page");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): OpeningBalanceViewProps {
  hooks.rewind();
  return OpeningBalancePage().props as OpeningBalanceViewProps;
}

async function open() {
  view();
  await settle();
  return view();
}

beforeEach(() => {
  hooks.reset();
  studentsSelect.mockClear();
  updates.length = 0;
});

describe("página do acerto do saldo", () => {
  test("carrega o previsto de cada aluno do treino", async () => {
    expect(view().state.status).toBe("loading");
    await settle();
    const ready = view();
    expect(ready.state.status).toBe("ready");
    expect(ready.state.predictions.m).toEqual({ packageBalance: 1, makeupCredits: 0 });
    expect(ready.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("tentar de novo volta a carregar", async () => {
    studentsSelect.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    expect(failed.state.status).toBe("failed");
    failed.onRetry();
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state.status).toBe("ready");
  });

  test("corrige o saldo e confirma", async () => {
    const opened = await open();
    opened.onChange("m", "packageBalance", "3");
    view().onConfirm();
    expect(view().busy).toBe(true);
    await settle();
    const done = view();
    expect(done.busy).toBe(false);
    expect(updates).toEqual([{ row: { opening_balance_on: "2026-12-01", opening_package_balance: 3, opening_makeup_credits: 0 }, id: "m" }]);
    expect(done.state.notice).toBe("Saldo de 1 aluno confirmado. A contagem de dezembro parte destes valores.");
  });
});
