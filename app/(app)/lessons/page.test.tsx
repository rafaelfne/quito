import { beforeEach, describe, expect, test, vi } from "vitest";
import type { LessonStatus, LessonsState, MonthLesson } from "@/lib/lessons";
import { lessonKey } from "@/lib/lessons";
import type { Student } from "@/lib/students";

type ViewProps = {
  state: LessonsState;
  today: string;
  onMark: (lesson: MonthLesson, status: LessonStatus) => void;
  onChangeMonth: (delta: number) => void;
  onRetry: () => void;
};

const pedro: Student = { id: "p", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const lesson: MonthLesson = { studentId: "p", studentName: "Pedro Lima", date: "2026-11-02", time: "15:00", status: null };

const selectStudents = vi.fn(async () => ({ data: [pedro] as Student[] | null, error: null as { message: string } | null }));
const lte = vi.fn(async () => ({ data: [], error: null }));
const upsert = vi.fn(async () => ({ error: null as { message: string } | null }));
const from = vi.fn((table: string) => {
  if (table === "students") return { select: selectStudents };
  if (table === "teacher_rules") return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
  return { select: () => ({ gte: () => ({ lte }) }), upsert };
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

const { default: LessonsPage } = await import("./page");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function view(): ViewProps {
  hooks.rewind();
  return LessonsPage().props as ViewProps;
}

async function open() {
  view();
  await settle();
  return view();
}

beforeEach(() => {
  hooks.reset();
  selectStudents.mockClear();
  lte.mockClear();
  upsert.mockClear();
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 15, 12) });
  return () => vi.useRealTimers();
});

describe("página de aulas", () => {
  test("abre no mês e no dia do aparelho e mostra os alunos", async () => {
    expect(view().state.status).toBe("loading");
    expect(view().state.month).toEqual({ year: 2026, month: 11 });
    expect(view().today).toBe("2026-11-15");
    await settle();
    expect(view().state).toMatchObject({ status: "ready", students: [pedro], noticeHours: 24 });
  });

  test("carrega uma vez só, mesmo quando a tela é desenhada de novo", async () => {
    await open();
    view();
    await settle();
    expect(selectStudents).toHaveBeenCalledTimes(1);
  });

  test("trocar de mês busca o novo mês", async () => {
    (await open()).onChangeMonth(1);
    expect(view().state).toMatchObject({ status: "loading", month: { year: 2026, month: 12 } });
    await settle();
    expect(selectStudents).toHaveBeenCalledTimes(2);
    expect(view().state.status).toBe("ready");
  });

  test("tentar de novo volta a carregar", async () => {
    selectStudents.mockResolvedValueOnce({ data: null, error: { message: "sem rede" } });
    const failed = await open();
    expect(failed.state.status).toBe("failed");
    failed.onRetry();
    expect(view().state.status).toBe("loading");
    await settle();
    expect(view().state.status).toBe("ready");
  });

  test("um toque marca na hora, trava enquanto grava e guarda", async () => {
    (await open()).onMark(lesson, "given");
    const marking = view().state;
    expect(marking.marks).toEqual([{ student_id: "p", lesson_date: "2026-11-02", status: "given" }]);
    expect(marking.pending).toEqual([lessonKey(lesson)]);
    await settle();
    expect(upsert).toHaveBeenCalledWith({ student_id: "p", lesson_date: "2026-11-02", status: "given" }, { onConflict: "student_id,lesson_date" });
    expect(view().state).toMatchObject({ pending: [], failedLesson: null });
  });

  test("se não gravar, a marcação volta e a aula avisa", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "sem rede" } });
    (await open()).onMark(lesson, "given");
    await settle();
    expect(view().state).toMatchObject({ marks: [], pending: [], failedLesson: lessonKey(lesson) });
  });
});
