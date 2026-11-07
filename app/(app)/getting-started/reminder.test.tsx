import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GettingStartedLoad, GettingStartedReminder as Reminder } from "@/lib/getting-started";

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
          slots[index] = value;
        },
      ];
    },
    useEffect(effect: () => (() => void) | void, deps: unknown[]) {
      const index = cursor++;
      const previous = slots[index] as { deps: unknown[]; cleanup?: () => void } | undefined;
      if (previous && deps.every((dep, position) => dep === previous.deps[position])) return;
      previous?.cleanup?.();
      slots[index] = { deps, cleanup: effect() ?? undefined };
    },
  };
});

const navigation = vi.hoisted(() => ({ pathname: "/charges", router: { replace: vi.fn() } }));
const database = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: hooks.useState,
  useEffect: hooks.useEffect,
}));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => navigation.router }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/getting-started", async (original) => ({ ...(await original<typeof import("@/lib/getting-started")>()), loadGettingStarted: database.load }));

const { GettingStartedReminder } = await import("./reminder");

const steps = [{ id: "a", title: "Passo", hint: "Dica", path: "/students", done: false }];
const pending: GettingStartedLoad = { ok: true, progress: { started: true, finished: false, baselineDelayDays: null, steps } };
const neverStarted: GettingStartedLoad = { ok: true, progress: { started: false, finished: false, baselineDelayDays: null, steps } };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function reminder(): Reminder {
  hooks.rewind();
  return GettingStartedReminder().props.reminder as Reminder;
}

beforeEach(() => {
  hooks.reset();
  navigation.pathname = "/charges";
  navigation.router.replace.mockReset();
  database.load.mockReset().mockResolvedValue(pending);
});

describe("GettingStartedReminder", () => {
  test("não mostra nada até saber o progresso e depois lembra o que falta", async () => {
    expect(reminder()).toEqual({ kind: "none" });
    await settle();
    expect(reminder()).toEqual({ kind: "progress", steps });
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });

  test("busca uma vez só, mesmo quando a tela é desenhada de novo", async () => {
    reminder();
    await settle();
    reminder();
    await settle();
    expect(database.load).toHaveBeenCalledTimes(1);
  });

  test("na primeira entrada, leva para a sequência", async () => {
    database.load.mockResolvedValue(neverStarted);
    reminder();
    await settle();
    expect(navigation.router.replace).toHaveBeenCalledWith("/getting-started");
    expect(reminder()).toEqual({ kind: "first-entry" });
  });

  test("telas fora da sequência não fazem busca nem mostram lembrete", async () => {
    navigation.pathname = "/lessons";
    expect(reminder()).toEqual({ kind: "none" });
    await settle();
    expect(database.load).not.toHaveBeenCalled();
  });

  test("ao trocar de tela, o lembrete anterior some e o novo é buscado", async () => {
    reminder();
    await settle();
    navigation.pathname = "/students";
    expect(reminder()).toEqual({ kind: "none" });
    await settle();
    expect(reminder()).toEqual({ kind: "back" });
    expect(database.load).toHaveBeenCalledTimes(2);
  });

  test("resposta que chega depois de sair da tela é ignorada", async () => {
    database.load.mockResolvedValueOnce(neverStarted);
    reminder();
    navigation.pathname = "/lessons";
    reminder();
    await settle();
    expect(navigation.router.replace).not.toHaveBeenCalled();
    expect(reminder()).toEqual({ kind: "none" });
  });
});
