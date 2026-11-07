import { describe, expect, test, vi } from "vitest";
import type { ChargeMessageContext } from "./charge-message";
import type { ClosingData } from "./closing";
import {
  describeFirstChargePreview,
  firstChargePreviewFrom,
  firstChargePreviewMessages,
  firstChargePreviewMissingPaths,
  forecastMarks,
  loadFirstChargePreview,
  type FirstChargePreview,
  type FirstChargePreviewFacts,
} from "./first-charge-preview";
import type { LessonsClient } from "./lessons";
import { defaultTeacherRules } from "./teacher-rules";
import type { Student } from "./students";

const pedro: Student = { id: "p", name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00" };
const caio: Student = { ...pedro, id: "c", name: "Caio Souza", guardian_name: "Rita Souza", guardian_phone: "11912345678", billing_kind: "per_class", billing_amount_cents: 5000 };

const closing: ClosingData = {
  students: [pedro, caio],
  enrollments: [
    { id: "p", created_at: "2026-11-07T15:00:00Z" },
    { id: "c", created_at: "2026-11-07T15:00:00Z" },
  ],
  marks: [{ student_id: "c", lesson_date: "2026-11-09", status: "given", makeup_date: null }],
  rules: defaultTeacherRules,
};

const context: ChargeMessageContext = {
  adjustments: { tone: "friendly", greeting: null, thanks: null, signature: null, footer: false },
  payment: { pix_key: "joao.violao@email.com", display_name: "João Silva", due_day: 5 },
  dueDayOverrides: new Map(),
  students: [pedro, caio],
  reminderDays: [],
};

const facts: FirstChargePreviewFacts = { startedAt: "2026-11-07T15:00:00Z", today: "2026-11-07", closing, context };

function preview(overrides: Partial<FirstChargePreviewFacts> = {}): FirstChargePreview {
  const result = firstChargePreviewFrom({ ...facts, ...overrides });
  if (result === null) throw new Error("sem prévia");
  return result;
}

function ready(overrides: Partial<FirstChargePreviewFacts> = {}): Extract<FirstChargePreview, { kind: "ready" }> {
  const result = preview(overrides);
  if (result.kind !== "ready") throw new Error("prévia incompleta");
  return result;
}

describe("aulas previstas do primeiro mês cobrado", () => {
  test("conta como dadas as aulas do horário que ainda não foram marcadas", () => {
    const marks = forecastMarks({ students: [caio], marks: [] }, { year: 2026, month: 12 });
    expect(marks.map((mark) => mark.lesson_date)).toEqual(["2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"]);
    expect(marks.every((mark) => mark.status === "given" && mark.student_id === "c")).toBe(true);
  });

  test("mantém o que o professor já marcou no lugar da previsão", () => {
    const absence = { student_id: "c", lesson_date: "2026-12-07", status: "notified_absence" as const, makeup_date: null };
    const marks = forecastMarks({ students: [caio], marks: [absence] }, { year: 2026, month: 12 });
    expect(marks.filter((mark) => mark.lesson_date === "2026-12-07")).toEqual([absence]);
    expect(marks).toHaveLength(4);
  });
});

describe("prévia da primeira cobrança", () => {
  test("monta a mensagem pronta de um responsável com o valor previsto do mês seguinte ao da entrada", () => {
    const result = ready();
    expect(result.firstMonth).toEqual({ year: 2026, month: 12 });
    expect(result.guardianName).toBe("Rita Souza");
    expect(result.dueDate).toBe("2027-01-05");
    expect(result.message).toContain("Oi, Rita Souza! Tudo bem?");
    expect(result.message).toContain("Segue a conta de dezembro do Caio Souza:");
    expect(result.message).toContain("Caio Souza: 4 aulas × R$ 50,00 = R$ 200,00");
    expect(result.message).toContain("*Total: R$ 200,00*");
    expect(result.message).toContain("Vence hoje, dia 5. A chave Pix é:");
    expect(result.message).toContain("joao.violao@email.com");
    expect(result.message).not.toContain("novembro");
  });

  test("usa o tom e o dia de vencimento próprio do responsável", () => {
    const result = ready({ context: { ...context, adjustments: { ...context.adjustments, tone: "formal" }, dueDayOverrides: new Map([["11912345678", 20]]) } });
    expect(result.dueDate).toBe("2027-01-20");
    expect(result.message).toContain("com vencimento em 20 de janeiro");
  });

  test("explica que o valor é previsto e de quem é a mensagem", () => {
    expect(describeFirstChargePreview(ready())).toBe("Esta é a mensagem que Rita Souza recebe em 5 de janeiro, com o valor previsto para dezembro se todas as aulas do horário forem dadas. O valor final sai das aulas que você marcar.");
  });

  test("sem data de entrada guardada, o primeiro mês é o seguinte a hoje", () => {
    expect(ready({ startedAt: null }).firstMonth).toEqual({ year: 2026, month: 12 });
  });

  test("some depois que acaba o primeiro mês cobrado", () => {
    expect(firstChargePreviewFrom({ ...facts, today: "2026-12-31" })).not.toBeNull();
    expect(firstChargePreviewFrom({ ...facts, today: "2027-01-01" })).toBeNull();
  });

  test("leva ao que falta quando ainda não dá para montar a mensagem", () => {
    expect(preview({ closing: { ...closing, students: [] } })).toEqual({ kind: "missing", firstMonth: { year: 2026, month: 12 }, missing: "students" });
    expect(preview({ context: { ...context, payment: null } })).toMatchObject({ kind: "missing", missing: "payment" });
    expect(preview({ closing: { ...closing, students: [pedro] } })).toMatchObject({ kind: "missing", missing: "billing" });
  });

  test("cada falta tem o seu texto e o seu caminho", () => {
    expect(firstChargePreviewMissingPaths).toEqual({ students: "/students", payment: "/payment", billing: "/students/setup" });
    expect(firstChargePreviewMessages.missing.payment).toContain("Recebimento");
  });
});

type Response = { data: unknown; error: { message: string } | null };

function clientWith(responses: Record<string, Response>, failing: string | null = null): LessonsClient {
  const from = vi.fn((table: string) => {
    const response = table === failing ? { data: null, error: { message: "sem rede" } } : (responses[table] ?? { data: null, error: null });
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Response) => unknown) => Promise.resolve(response).then(resolve),
      maybeSingle: () => Promise.resolve(response),
    };
    for (const method of ["select", "lte", "order", "range"]) builder[method] = () => builder;
    return builder;
  });
  return { from } as unknown as LessonsClient;
}

const responses: Record<string, Response> = {
  students: { data: [pedro, caio].map((student) => ({ ...student, created_at: "2026-11-07T15:00:00Z" })), error: null },
  lesson_marks: { data: [], error: null },
  payment_settings: { data: context.payment, error: null },
};

describe("carregar a prévia da primeira cobrança", () => {
  test("parte da entrada do professor e dos dados guardados", async () => {
    const result = await loadFirstChargePreview(clientWith(responses), "2026-11-07T15:00:00Z", new Date("2026-11-07T15:00:00Z"));
    expect(result).toMatchObject({ kind: "ready", guardianName: "Rita Souza", dueDate: "2027-01-05" });
  });

  test("sem entrada guardada, usa hoje", async () => {
    const result = await loadFirstChargePreview(clientWith(responses), null, new Date("2026-11-07T15:00:00Z"));
    expect(result?.firstMonth).toEqual({ year: 2026, month: 12 });
  });

  test("se o fechamento ou a mensagem não abrem, não mostra a prévia", async () => {
    expect(await loadFirstChargePreview(clientWith(responses, "lesson_marks"), null)).toBeNull();
    expect(await loadFirstChargePreview(clientWith(responses, "payment_settings"), null)).toBeNull();
  });
});
