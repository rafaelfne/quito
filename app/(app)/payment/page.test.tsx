import { beforeEach, describe, expect, test, vi } from "vitest";
import { guardianDueDaysMessages, type GuardianDueDaysState, type GuardianDueDayRow } from "@/lib/guardian-due-days";
import { defaultDueDay, paymentSettingsMessages, type PaymentSettingsField, type PaymentSettingsRow, type PaymentSettingsState } from "@/lib/payment-settings";
import type { Student } from "@/lib/students";

type ViewProps = {
  state: PaymentSettingsState;
  guardianDueDays: GuardianDueDaysState;
  busy: boolean;
  busyPhone: string | null;
  today: string;
  onChange: (field: PaymentSettingsField, value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onGuardianDueChange: (phone: string, dueDay: string) => void;
  onGuardianDueSubmit: (phone: string) => void;
  onGuardianDueRetry: () => void;
};

const pedro: Student = {
  id: "1",
  name: "Pedro Lima",
  guardian_name: "Ana Lima",
  guardian_phone: "11987654321",
  billing_kind: "monthly",
  billing_amount_cents: 30000,
  package_lessons: null,
  lesson_weekday: 1,
  lesson_time: "15:00:00",
};

const saved: PaymentSettingsRow = { pix_key: "joao@email.com", display_name: "João Silva", due_day: 10 };
const override: GuardianDueDayRow = { guardian_phone: "11987654321", due_day: 15 };

const maybeSingle = vi.fn(async () => ({ data: null as PaymentSettingsRow | null, error: null as { message: string } | null }));
const paymentSelect = vi.fn(() => ({ maybeSingle }));
const upsertPayment = vi.fn(async (row: unknown) => ({ error: null, row }));

const studentsSelect = vi.fn(async () => ({ data: [pedro] as Student[] | null, error: null as { message: string } | null }));
const dueDaysSelect = vi.fn(async () => ({ data: [override] as GuardianDueDayRow[] | null, error: null as { message: string } | null }));
const upsertDueDay = vi.fn(async (row: unknown) => ({ error: null, row }));
const eqDelete = vi.fn(async () => ({ error: null }));
const deleteDueDay = vi.fn(() => ({ eq: eqDelete }));

const from = vi.fn((table: string) => {
  if (table === "payment_settings") return { select: paymentSelect, upsert: upsertPayment };
  if (table === "students") return { select: studentsSelect };
  if (table === "guardian_due_days") return { select: dueDaysSelect, upsert: upsertDueDay, delete: deleteDueDay };
  throw new Error(`tabela inesperada: ${table}`);
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

const { default: PaymentSettingsPage } = await import("./page");

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
  await settle();
  return view();
}

beforeEach(() => {
  hooks.reset();
  maybeSingle.mockClear();
  maybeSingle.mockResolvedValue({ data: null, error: null });
  upsertPayment.mockClear();
  studentsSelect.mockClear();
  studentsSelect.mockResolvedValue({ data: [pedro], error: null });
  dueDaysSelect.mockClear();
  dueDaysSelect.mockResolvedValue({ data: [override], error: null });
  upsertDueDay.mockClear();
  eqDelete.mockClear();
  from.mockClear();
});

describe("página de recebimento", () => {
  test("começa carregando e mostra os dados guardados quando o banco responde", async () => {
    maybeSingle.mockResolvedValueOnce({ data: saved, error: null });
    expect(view().state.status).toBe("loading");
    await settle();
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
    await settle();
    const done = view();
    expect(upsertPayment).toHaveBeenCalledWith({ pix_key: "joao@email.com", display_name: "João Silva", due_day: 31 }, { onConflict: "owner_id" });
    expect(done.busy).toBe(false);
    expect(done.state.notice).toBe(paymentSettingsMessages.saved);
  });

  test("dado errado aparece no campo e destrava o formulário", async () => {
    const opened = await open();
    opened.onChange("pixKey", "abc");
    view().onSubmit();
    await settle();
    const done = view();
    expect(upsertPayment).not.toHaveBeenCalled();
    expect(done.busy).toBe(false);
    expect(done.state.errors.pixKey).toBe(paymentSettingsMessages.pixKeyInvalid);
  });

  test("carrega o vencimento por responsável com os alunos e a troca guardada", async () => {
    const opened = await open();
    expect(from).toHaveBeenCalledWith("students");
    expect(from).toHaveBeenCalledWith("guardian_due_days");
    expect(opened.guardianDueDays).toMatchObject({
      status: "ready",
      defaultDueDay: 5,
      groups: [{ phone: "11987654321", guardianName: "Ana Lima", studentNames: ["Pedro Lima"], dueDay: "15" }],
    });
  });

  test("guarda o vencimento de um responsável", async () => {
    const opened = await open();
    opened.onGuardianDueChange("11987654321", "20");
    view().onGuardianDueSubmit("11987654321");
    expect(view().busyPhone).toBe("11987654321");
    await settle();
    const done = view();
    expect(upsertDueDay).toHaveBeenCalledWith({ guardian_phone: "11987654321", due_day: 20 }, { onConflict: "owner_id,guardian_phone" });
    expect(done.busyPhone).toBeNull();
    expect(done.guardianDueDays.notices["11987654321"]).toBe(guardianDueDaysMessages.saved);
  });

  test("campo em branco apaga a troca e volta ao padrão", async () => {
    const opened = await open();
    opened.onGuardianDueChange("11987654321", "");
    view().onGuardianDueSubmit("11987654321");
    await settle();
    expect(eqDelete).toHaveBeenCalledWith("guardian_phone", "11987654321");
    expect(view().guardianDueDays.notices["11987654321"]).toBe(guardianDueDaysMessages.cleared);
  });

  test("a lista de responsáveis falha quando os alunos não abrem", async () => {
    studentsSelect.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const opened = await open();
    expect(opened.guardianDueDays.status).toBe("failed");
    expect(opened.state.status).toBe("ready");
  });

  test("a lista de responsáveis falha quando as trocas não abrem", async () => {
    dueDaysSelect.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    expect((await open()).guardianDueDays.status).toBe("failed");
  });

  test("tentar de novo a lista usa o dia padrão escrito no formulário", async () => {
    maybeSingle.mockResolvedValueOnce({ data: saved, error: null });
    studentsSelect.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    expect(failed.guardianDueDays).toMatchObject({ status: "failed", defaultDueDay: 10 });
    failed.onChange("dueDay", "20");
    view().onGuardianDueRetry();
    expect(view().guardianDueDays).toMatchObject({ status: "loading", defaultDueDay: 20 });
    await settle();
    expect(view().guardianDueDays).toMatchObject({ status: "ready", defaultDueDay: 20, groups: [{ phone: "11987654321" }] });
  });

  test("tentar de novo a lista com o dia padrão em branco usa o dia de partida", async () => {
    maybeSingle.mockResolvedValueOnce({ data: saved, error: null });
    dueDaysSelect.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    failed.onChange("dueDay", "");
    view().onGuardianDueRetry();
    await settle();
    expect(view().guardianDueDays).toMatchObject({ status: "ready", defaultDueDay: defaultDueDay });
  });
});
