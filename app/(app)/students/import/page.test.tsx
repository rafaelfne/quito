import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { StudentImportState } from "@/lib/student-import";
import type { Student } from "@/lib/students";

type SelectResult = { data: Student[] | null; error: { message: string } | null };
type ViewProps = { state: StudentImportState; busy: boolean; onChange: (text: string) => void; onEditLine: (line: number, field: "name" | "guardianName" | "phone", value: string) => void; onSubmit: () => void; onRetry: () => void; onPickContacts?: () => void };

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
  useSyncExternalStore: (subscribe: () => () => void, getSnapshot: () => unknown, getServerSnapshot: () => unknown) => {
    subscribe()();
    return getServerSnapshot() ?? getSnapshot();
  },
}));
vi.mock("@/lib/supabase", () => ({ supabase: { from, auth: {} } }));

const { default: StudentImportPage } = await import("./page");

const pedro: Student = { id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null, gender: null, called_as: null };

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

afterEach(() => {
  vi.unstubAllGlobals();
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

  test("corrige uma linha pela tela de conferência", async () => {
    const opened = await open();
    opened.onChange("Mãe do Pedro, Ana Lima, 11987654321");
    view().onEditLine(1, "name", "Pedro Lima");
    expect(view().state.text).toBe("Pedro Lima\tAna Lima\t11987654321");
  });

  test("sem a escolha de contatos no celular, não oferece o botão", async () => {
    vi.stubGlobal("navigator", {});
    expect((await open()).onPickContacts).toBeUndefined();
  });

  test("os contatos escolhidos entram na caixa", async () => {
    const pick = vi.fn(async () => [{ name: ["Mãe do Pedro"], tel: ["11987654321"] }]);
    vi.stubGlobal("navigator", { contacts: { select: pick } });
    const opened = await open();
    opened.onPickContacts!();
    await settle();
    expect(pick).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
    expect(view().state).toMatchObject({ text: ", Mãe do Pedro, 11987654321", notice: "1 contato entrou na caixa. Escreva o nome do aluno no começo de cada linha, antes da vírgula." });
  });

  test("avisa quando o celular não abre os contatos", async () => {
    vi.stubGlobal("navigator", { contacts: { select: async () => Promise.reject(new Error("negado")) } });
    const opened = await open();
    opened.onPickContacts!();
    await settle();
    expect(view().state.message).toBe("Não deu para abrir os contatos do celular. Tente de novo ou cole a lista.");
  });
});
