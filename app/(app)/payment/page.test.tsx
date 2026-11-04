import { beforeEach, describe, expect, test, vi } from "vitest";
import { paymentSettingsMessages, type PaymentSettingsField, type PaymentSettingsRow, type PaymentSettingsState } from "@/lib/payment-settings";

type LoadResult = { data: PaymentSettingsRow | null; error: { message: string } | null };
type ViewProps = {
  state: PaymentSettingsState;
  busy: boolean;
  today: string;
  onChange: (field: PaymentSettingsField, value: string) => void;
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

const { default: PaymentSettingsPage } = await import("./page");

const saved: PaymentSettingsRow = { pix_key: "joao@email.com", display_name: "João Silva", due_day: 10 };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return PaymentSettingsPage().props as ViewProps;
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

describe("página de recebimento", () => {
  test("começa carregando e mostra os dados guardados quando o banco responde", async () => {
    maybeSingle.mockResolvedValueOnce({ data: saved, error: null });
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state).toMatchObject({ status: "ready", draft: { pixKey: "joao@email.com", displayName: "João Silva", dueDay: "10" } });
    expect(from).toHaveBeenCalledWith("payment_settings");
  });

  test("passa o dia de hoje para a tela", async () => {
    expect((await open()).today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("busca os dados uma vez só, mesmo quando a tela é desenhada de novo", async () => {
    await open();
    view();
    await settle();
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  test("tentar de novo volta a carregar e mostra os dados", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    expect(failed.state.status).toBe("failed");
    maybeSingle.mockResolvedValueOnce({ data: saved, error: null });
    failed.onRetry();
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state.status).toBe("ready");
    expect(view().state.draft.dueDay).toBe("10");
  });

  test("guarda o que foi escrito, trava enquanto grava e destrava no fim", async () => {
    const opened = await open();
    opened.onChange("pixKey", "joao@email.com");
    view().onChange("displayName", "João Silva");
    view().onChange("dueDay", "31");
    view().onSubmit();
    expect(view().busy).toBe(true);
    await settle();
    const done = view();
    expect(upsert).toHaveBeenCalledWith({ pix_key: "joao@email.com", display_name: "João Silva", due_day: 31 }, { onConflict: "owner_id" });
    expect(done.busy).toBe(false);
    expect(done.state.notice).toBe(paymentSettingsMessages.saved);
  });

  test("dado errado aparece no campo e destrava o formulário", async () => {
    const opened = await open();
    opened.onChange("pixKey", "abc");
    view().onSubmit();
    await settle();
    const done = view();
    expect(upsert).not.toHaveBeenCalled();
    expect(done.busy).toBe(false);
    expect(done.state.errors.pixKey).toBe(paymentSettingsMessages.pixKeyInvalid);
  });
});
