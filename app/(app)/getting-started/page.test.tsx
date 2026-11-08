import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FirstChargePreview } from "@/lib/first-charge-preview";
import type { FirstChargeNotice } from "@/lib/first-charge";
import type { GettingStartedState } from "@/lib/getting-started";

type ViewProps = { state: GettingStartedState; onRetry: () => void; baselineDelayDays: number | null; onSaveBaselineDelay: (days: number) => Promise<void>; firstCharge: FirstChargeNotice | null; firstChargePreview: FirstChargePreview | null; notificationsInvite: boolean };

const maybeSingle = vi.fn(async () => ({ data: { finished_at: null, baseline_delay_days: null } as { finished_at: string | null; baseline_delay_days: number | null } | null, error: null as { message: string } | null }));
const upsert = vi.fn(async () => ({ error: null as { message: string } | null }));
const students = vi.fn(async () => ({ data: [], error: null }));
const payment = vi.fn(async () => ({ data: null, error: null }));
const from = vi.fn((table: string) => {
  if (table === "students") return { select: students };
  if (table === "payment_settings") return { select: () => ({ maybeSingle: payment }) };
  return { select: () => ({ maybeSingle }), upsert };
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
const loadFirstChargePreview = vi.fn(async (): Promise<FirstChargePreview | null> => ({ kind: "missing", firstMonth: { year: 2026, month: 12 }, missing: "students" }));
vi.mock("@/lib/first-charge-preview", () => ({ loadFirstChargePreview }));
vi.mock("@/lib/supabase", () => ({ supabase: { from, auth: {} } }));
const guideOffer = vi.hoisted(() => ({ offered: false }));
vi.mock("@/app/(app)/notifications/guide-offer", () => ({ useNotificationsGuideOffer: () => guideOffer.offered }));

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
  guideOffer.offered = false;
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

  test("depois de abrir, mostra quando começa a cobrança", async () => {
    view();
    await settle();
    await settle();
    expect(view().firstCharge?.missing).toBe("students");
  });

  test("depois de abrir, mostra a prévia da primeira cobrança", async () => {
    view();
    await settle();
    await settle();
    expect(view().firstChargePreview).toMatchObject({ kind: "missing", missing: "students" });
    expect(loadFirstChargePreview).toHaveBeenCalledWith(expect.anything(), null);
  });

  test("se os passos não abrem, não procura o aviso da cobrança", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    view();
    await settle();
    await settle();
    expect(view().firstCharge).toBeNull();
    expect(view().firstChargePreview).toBeNull();
  });

  test("com os passos feitos, convida para o guia quando ele é oferecido neste aparelho", async () => {
    guideOffer.offered = true;
    maybeSingle.mockResolvedValueOnce({ data: { finished_at: "2026-11-07T10:00:00Z", baseline_delay_days: 5 }, error: null });
    expect(view().notificationsInvite).toBe(false);
    await settle();
    expect(view().notificationsInvite).toBe(true);
  });

  test("o convite para as notificações fica desligado quando o guia não é oferecido neste aparelho, mesmo com os passos feitos", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { finished_at: "2026-11-07T10:00:00Z", baseline_delay_days: 5 }, error: null });
    expect(view().notificationsInvite).toBe(false);
    await settle();
    const ready = view();
    expect(ready.state.status).toBe("ready");
    expect(ready.notificationsInvite).toBe(false);
  });
});
