import { beforeEach, describe, expect, test, vi } from "vitest";
import { teacherRulesMessages, type TeacherRulesField, type TeacherRulesRow, type TeacherRulesState } from "@/lib/teacher-rules";

type LoadResult = { data: TeacherRulesRow | null; error: { message: string } | null };
type ViewProps = {
  state: TeacherRulesState;
  busy: boolean;
  onChange: (field: TeacherRulesField, value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
};

const maybeSingle = vi.fn<() => Promise<LoadResult>>(async () => ({ data: null, error: null }));
const select = vi.fn(() => ({ maybeSingle }));
const upsert = vi.fn(async (row: unknown) => ({ error: null, row }));
const from = vi.fn(() => ({ select, upsert }));

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

const { default: TeacherRulesPage } = await import("./page");

const saved: TeacherRulesRow = { notice_hours: 48, makeup_deadline_days: 30, five_week_policy: "add_lesson", five_week_extra_cents: 8000, sibling_discount_percent: 12 };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return TeacherRulesPage().props as ViewProps;
}

async function open() {
  view();
  await settle();
  return view();
}

beforeEach(() => {
  hooks.reset();
  maybeSingle.mockClear();
  upsert.mockClear();
});

describe("página de regras", () => {
  test("começa carregando e mostra as regras guardadas quando o banco responde", async () => {
    maybeSingle.mockResolvedValueOnce({ data: saved, error: null });
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state).toMatchObject({ status: "ready", draft: { noticeHours: "48", makeupDays: "30", fiveWeekExtra: "80,00", siblingDiscountPercent: "12" } });
    expect(from).toHaveBeenCalledWith("teacher_rules");
  });

  test("busca as regras uma vez só, mesmo quando a tela é desenhada de novo", async () => {
    await open();
    view();
    await settle();
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  test("tentar de novo volta a carregar e mostra as regras", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    expect(failed.state.status).toBe("failed");
    maybeSingle.mockResolvedValueOnce({ data: saved, error: null });
    failed.onRetry();
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state.status).toBe("ready");
    expect(view().state.draft.noticeHours).toBe("48");
  });

  test("guarda o que foi escrito, trava enquanto grava e destrava no fim", async () => {
    const opened = await open();
    opened.onChange("noticeHours", "12");
    view().onChange("makeupPolicy", "deadline");
    view().onChange("makeupDays", "60");
    view().onSubmit();
    expect(view().busy).toBe(true);
    await settle();
    const done = view();
    expect(upsert).toHaveBeenCalledWith({ notice_hours: 12, makeup_deadline_days: 60, five_week_policy: "same_price", five_week_extra_cents: null, sibling_discount_percent: 0 }, { onConflict: "owner_id" });
    expect(done.busy).toBe(false);
    expect(done.state.notice).toBe(teacherRulesMessages.saved);
  });

  test("dado errado aparece no campo e destrava o formulário", async () => {
    const opened = await open();
    opened.onChange("noticeHours", "");
    view().onSubmit();
    await settle();
    const done = view();
    expect(upsert).not.toHaveBeenCalled();
    expect(done.busy).toBe(false);
    expect(done.state.errors.noticeHours).toBe(teacherRulesMessages.noticeInvalid);
  });
});
