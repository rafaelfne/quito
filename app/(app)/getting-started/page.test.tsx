import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GettingStartedState } from "@/lib/getting-started";

type ViewProps = { state: GettingStartedState; onRetry: () => void; baselineDelayDays: number | null; onSaveBaselineDelay: (days: number) => Promise<void> };

const maybeSingle = vi.fn(async () => ({ data: { finished_at: null, baseline_delay_days: null } as { finished_at: string | null; baseline_delay_days: number | null } | null, error: null as { message: string } | null }));
const upsert = vi.fn(async () => ({ error: null as { message: string } | null }));
const students = vi.fn(async () => ({ data: [], error: null }));
const from = vi.fn((table: string) => (table === "students" ? { select: students } : { select: () => ({ maybeSingle }), upsert }));

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

const { default: GettingStartedPage } = await import("./page");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return GettingStartedPage().props as ViewProps;
}

beforeEach(() => {
  hooks.reset();
  maybeSingle.mockClear();
  upsert.mockClear();
});

describe("página de primeiros passos", () => {
  test("começa carregando e mostra os passos quando o banco responde", async () => {
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state.status).toBe("ready");
    expect(view().state.steps.length).toBeGreaterThan(0);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  test("tentar de novo volta a carregar", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    view();
    await settle();
    const failed = view();
    expect(failed.state.status).toBe("failed");
    failed.onRetry();
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state.status).toBe("ready");
  });

  test("guarda a média de atraso e atualiza os passos", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { finished_at: null, baseline_delay_days: null }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { finished_at: null, baseline_delay_days: 12 }, error: null });
    view();
    await settle();
    await view().onSaveBaselineDelay(12);
    await settle();
    expect(upsert).toHaveBeenCalledWith({ baseline_delay_days: 12 }, { onConflict: "owner_id" });
    expect(view().baselineDelayDays).toBe(12);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  test("mantém o valor atual quando não consegue guardar a resposta", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "sem rede" } });
    view();
    await settle();
    await view().onSaveBaselineDelay(12);
    expect(view().baselineDelayDays).toBeNull();
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
