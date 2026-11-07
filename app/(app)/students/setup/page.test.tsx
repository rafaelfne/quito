import { beforeEach, describe, expect, test, vi } from "vitest";
import type { BillingDraft } from "@/lib/billing";
import type { ScheduleDraft } from "@/lib/schedule";
import type { StudentSetupState } from "@/lib/student-setup";
import type { Student } from "@/lib/students";

type SelectResult = { data: Student[] | null; error: { message: string } | null };
type ViewProps = {
  state: StudentSetupState;
  busy: boolean;
  onToggle: (id: string) => void;
  onSelectWithoutBilling: () => void;
  onClearSelection: () => void;
  onChangeBilling: (field: keyof BillingDraft, value: string) => void;
  onApplyBilling: () => void;
  onChangeSchedule: (id: string, field: keyof ScheduleDraft, value: string) => void;
  onSaveSchedule: (id: string) => void;
  onRetry: () => void;
};

const blank = { billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null, gender: null, called_as: null };
const pedro: Student = { ...blank, id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" };
const bia: Student = { ...blank, id: "2", name: "Bia Reis", guardian_name: "Rosa Reis", guardian_phone: "2134567890" };

const select = vi.fn<() => Promise<SelectResult>>(async () => ({ data: [bia, pedro], error: null }));
const updates: { row: unknown; ids: string[] }[] = [];
const update = vi.fn((row: unknown) => ({
  in: (_column: string, ids: string[]) => {
    updates.push({ row, ids });
    return { select: async () => ({ data: ids.map((id) => ({ id })), error: null }) };
  },
}));
const from = vi.fn(() => ({ select, update }));

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

const { default: StudentSetupPage } = await import("./page");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return StudentSetupPage().props as ViewProps;
}

async function open() {
  view();
  await settle();
  return view();
}

beforeEach(() => {
  hooks.reset();
  select.mockClear();
  update.mockClear();
  updates.length = 0;
});

describe("página de cobrança e horário em grupo", () => {
  test("carrega os alunos do professor", async () => {
    expect(view().state.listStatus).toBe("loading");
    await settle();
    expect(view().state).toMatchObject({ listStatus: "ready", students: [bia, pedro] });
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

  test("marca vários alunos e aplica a mesma forma de cobrança de uma vez", async () => {
    const opened = await open();
    opened.onSelectWithoutBilling();
    view().onToggle("2");
    view().onToggle("2");
    view().onChangeBilling("billingKind", "per_class");
    view().onChangeBilling("billingAmount", "80");
    view().onApplyBilling();
    expect(view().busy).toBe(true);
    await settle();
    const done = view();
    expect(done.busy).toBe(false);
    expect(updates).toEqual([{ row: { billing_kind: "per_class", billing_amount_cents: 8000, package_lessons: null }, ids: ["1", "2"] }]);
    expect(done.state.notice).toBe("Forma de cobrança aplicada a 2 alunos. Agora acerte o horário de cada um.");
  });

  test("desmarcar todos solta a marcação", async () => {
    const opened = await open();
    opened.onSelectWithoutBilling();
    view().onClearSelection();
    expect(view().state.selected).toEqual([]);
  });

  test("acerta o horário de um aluno", async () => {
    const opened = await open();
    opened.onChangeSchedule("1", "lessonWeekday", "1");
    view().onChangeSchedule("1", "lessonTime", "15:00");
    view().onSaveSchedule("1");
    await settle();
    expect(updates).toEqual([{ row: { lesson_weekday: 1, lesson_time: "15:00" }, ids: ["1"] }]);
    expect(view().state.notice).toBe("Horário de Pedro Lima guardado.");
  });
});
