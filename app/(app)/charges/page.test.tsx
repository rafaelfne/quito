import { beforeEach, describe, expect, test, vi } from "vitest";
import { chargeMessages, type ChargesState } from "@/lib/charges";
import type { Student } from "@/lib/students";

type ViewProps = { state: ChargesState; onRetry: () => void; onConfirmPreview: () => void; onSend: (chargeId: string) => void; onUndoSend: (chargeId: string) => void };

const pedro: Student = { id: "p", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };

const stored: unknown[] = [];
const selectStudents = vi.fn(async (columns: string) => (columns === "id, created_at" ? { data: [], error: null as { message: string } | null } : { data: [pedro] as Student[] | null, error: null as { message: string } | null }));
const upsert = vi.fn(async (rows: Record<string, unknown>[]) => {
  stored.push(...rows.map((row) => ({ ...row, id: "c1" })));
  return { error: null };
});
const previewUpsert = vi.fn(async () => ({ error: null as { message: string } | null }));
const sentEq = vi.fn(async () => ({ error: null as { message: string } | null }));
const update = vi.fn(() => ({ eq: sentEq }));
const marksChain = { order: () => marksChain, range: async () => ({ data: [], error: null }) };
const from = vi.fn((table: string) => {
  if (table === "students") return { select: selectStudents };
  if (table === "teacher_rules" || table === "message_settings") return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
  if (table === "payment_settings") return { select: () => ({ maybeSingle: async () => ({ data: { pix_key: "joao@email.com", display_name: "João Silva", due_day: 5 }, error: null }) }) };
  if (table === "message_previews") return { upsert: previewUpsert, select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
  if (table === "guardian_due_days") return { select: async () => ({ data: [], error: null }) };
  if (table === "charges") return { upsert, update, select: () => ({ lt: () => marksChain, eq: async () => ({ data: [...stored], error: null }) }) };
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

const { default: ChargesPage } = await import("./page");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return ChargesPage().props as ViewProps;
}

beforeEach(() => {
  hooks.reset();
  stored.length = 0;
  upsert.mockClear();
  selectStudents.mockClear();
  previewUpsert.mockClear();
  update.mockClear();
  sentEq.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 11, 1, 12) });
  return () => vi.useRealTimers();
});

describe("página de cobranças", () => {
  test("abre no mês que terminou e cria a cobrança", async () => {
    expect(view().state).toMatchObject({ status: "loading", month: { year: 2026, month: 11 } });
    await settle();
    const { state } = view();
    expect(state.status).toBe("ready");
    expect(state.charges).toHaveLength(1);
    expect(state.charges[0]).toMatchObject({ charge_month: "2026-11-01", guardian_name: "Ana Lima", total_cents: 30000 });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(state.messages.c1).toContain("Segue a conta de novembro do Pedro Lima:");
    expect(state.messages.c1.split("\n")).toContain("joao@email.com");
    expect(state.previewConfirmed).toBe(false);
    expect(state.dueDates).toEqual({ c1: "2026-12-05" });
    expect(state.today).toBe("2026-12-01");
  });

  test("confirmar a prévia guarda e libera o envio", async () => {
    view();
    await settle();
    view().onConfirmPreview();
    expect(view().state.confirmingPreview).toBe(true);
    await settle();
    expect(previewUpsert).toHaveBeenCalledTimes(1);
    expect(view().state).toMatchObject({ confirmingPreview: false, previewConfirmed: true });
  });

  test("se não deu para guardar a prévia, avisa", async () => {
    previewUpsert.mockResolvedValueOnce({ error: { message: "fora do ar" } });
    view();
    await settle();
    view().onConfirmPreview();
    await settle();
    expect(view().state).toMatchObject({ previewConfirmed: false, previewMessage: chargeMessages.confirmPreviewFailed });
  });

  test("o toque no WhatsApp guarda a cobrança como enviada e desfazer volta atrás", async () => {
    view();
    await settle();
    view().onSend("c1");
    expect(view().state.savingSends).toEqual(["c1"]);
    await settle();
    expect(update).toHaveBeenLastCalledWith({ sent_at: new Date(2026, 11, 1, 12).toISOString() });
    expect(sentEq).toHaveBeenLastCalledWith("id", "c1");
    expect(view().state.charges[0].sent_at).toBe(new Date(2026, 11, 1, 12).toISOString());
    expect(view().state.savingSends).toEqual([]);
    view().onUndoSend("c1");
    await settle();
    expect(update).toHaveBeenLastCalledWith({ sent_at: null });
    expect(view().state.charges[0].sent_at).toBeNull();
  });

  test("se não deu para guardar o envio, avisa", async () => {
    sentEq.mockResolvedValueOnce({ error: { message: "fora do ar" } });
    view();
    await settle();
    view().onSend("c1");
    await settle();
    expect(view().state.sendMessage).toBe(chargeMessages.sendFailed);
    expect(view().state.charges[0].sent_at).toBeUndefined();
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
