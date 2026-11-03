import { describe, expect, test, vi } from "vitest";
import { billingMessages } from "./billing";
import { scheduleMessages } from "./schedule";
import {
  applyLoad,
  cancelEditing,
  changeDraft,
  currentDraft,
  formatPhone,
  initialStudents,
  loadStudents,
  normalizePhone,
  saveStudent,
  sortStudents,
  startEditing,
  startReloading,
  studentMessages,
  studentNameLimit,
  submitStudent,
  validateStudent,
  type Student,
  type StudentsClient,
  type StudentsState,
} from "./students";

type Failure = { message: string } | null;
type SelectResult = { data: unknown[] | null; error: Failure };

const noBilling = { billing_kind: null, billing_amount_cents: null, package_lessons: null };
const emptyDraft = { name: "", guardianName: "", guardianPhone: "", billingKind: "", billingAmount: "", packageLessons: "", lessonWeekday: "", lessonTime: "" };
const pedro: Student = { id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4, lesson_weekday: 2, lesson_time: "15:00:00" };
const alvaro: Student = { id: "2", name: "Álvaro Reis", guardian_name: "Bia Reis", guardian_phone: "2134567890", ...noBilling, lesson_weekday: null, lesson_time: null };
const validDraft = { name: "  Pedro   Lima ", guardianName: " Ana  Lima", guardianPhone: "(11) 98765-4321", billingKind: "package", billingAmount: "300,00", packageLessons: "4", lessonWeekday: "2", lessonTime: "15:00" };
const validRow = { name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "package" as const, billing_amount_cents: 30000, package_lessons: 4, lesson_weekday: 2, lesson_time: "15:00" };

function fakeClient(overrides: { select?: () => Promise<SelectResult>; insert?: () => Promise<{ error: Failure }>; updated?: () => Promise<SelectResult> } = {}) {
  const select = vi.fn(overrides.select ?? (async () => ({ data: [] as unknown[], error: null as Failure })));
  const insert = vi.fn(overrides.insert ?? (async () => ({ error: null as Failure })));
  const updatedSelect = vi.fn(overrides.updated ?? (async () => ({ data: [{ id: "1" }] as unknown[], error: null as Failure })));
  const eq = vi.fn(() => ({ select: updatedSelect }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, insert, update }));
  return { client: { from } as unknown as StudentsClient, from, select, insert, update, eq, updatedSelect };
}

function withDraft(draft = validDraft): StudentsState {
  return { ...initialStudents, listStatus: "ready", newDraft: draft };
}

describe("normalizePhone", () => {
  test.each([
    ["11987654321", "11987654321"],
    ["(11) 98765-4321", "11987654321"],
    ["+55 11 98765-4321", "11987654321"],
    ["5511987654321", "11987654321"],
    ["011 98765 4321", "11987654321"],
    ["(21) 3456-7890", "2134567890"],
    ["552134567890", "2134567890"],
    ["01987654321", "1987654321"],
    ["55987654321", "55987654321"],
  ])("aceita %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  test.each([[""], ["não sei"], ["98765-4321"], ["10987654321"], ["11887654321"], ["1112345678"], ["119876543210"], ["1234"]])("recusa %s", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe("formatPhone", () => {
  test("mostra celular e fixo do jeito que se lê no Brasil", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("2134567890")).toBe("(21) 3456-7890");
  });
});

describe("validateStudent", () => {
  test("limpa os espaços e deixa só os números do telefone", () => {
    expect(validateStudent(validDraft)).toEqual({ ok: true, row: validRow });
  });

  test("com tudo vazio, aponta os três campos e pede o horário e a forma de cobrança", () => {
    expect(validateStudent({ ...emptyDraft, name: " " })).toEqual({
      ok: false,
      errors: { name: studentMessages.nameMissing, guardianName: studentMessages.guardianMissing, guardianPhone: studentMessages.phoneInvalid, billingKind: billingMessages.kindMissing, lessonWeekday: scheduleMessages.weekdayMissing, lessonTime: scheduleMessages.timeInvalid },
    });
  });

  test("com o cadastro certo e a cobrança errada, não aprova", () => {
    expect(validateStudent({ ...validDraft, billingAmount: "" })).toEqual({ ok: false, errors: { billingAmount: billingMessages.amountInvalid } });
  });

  test("com o cadastro certo e o horário errado, não aprova", () => {
    expect(validateStudent({ ...validDraft, lessonTime: "" })).toEqual({ ok: false, errors: { lessonTime: scheduleMessages.timeInvalid } });
  });

  test("aceita nome no limite e recusa o que passa dele", () => {
    const fits = "a".repeat(studentNameLimit);
    const tooLong = `${fits}a`;
    expect(validateStudent({ ...validDraft, name: fits, guardianName: fits }).ok).toBe(true);
    expect(validateStudent({ ...validDraft, name: tooLong, guardianName: tooLong })).toEqual({
      ok: false,
      errors: { name: studentMessages.nameTooLong, guardianName: studentMessages.guardianTooLong },
    });
  });

  test("com o telefone certo e o nome errado, não aprova", () => {
    expect(validateStudent({ ...validDraft, name: "" })).toEqual({ ok: false, errors: { name: studentMessages.nameMissing } });
  });
});

describe("sortStudents", () => {
  test("põe em ordem alfabética respeitando acento, sem mexer na lista original", () => {
    const original = [pedro, alvaro];
    expect(sortStudents(original)).toEqual([alvaro, pedro]);
    expect(original).toEqual([pedro, alvaro]);
  });
});

describe("loadStudents", () => {
  test("devolve os alunos em ordem alfabética", async () => {
    const { client, from, select } = fakeClient({ select: async () => ({ data: [pedro, alvaro], error: null }) });
    expect(await loadStudents(client)).toEqual({ ok: true, students: [alvaro, pedro] });
    expect(from).toHaveBeenCalledWith("students");
    expect(select).toHaveBeenCalledWith("id, name, guardian_name, guardian_phone, billing_kind, billing_amount_cents, package_lessons, lesson_weekday, lesson_time");
  });

  test("sem resposta, a lista vem vazia", async () => {
    const { client } = fakeClient({ select: async () => ({ data: null, error: null }) });
    expect(await loadStudents(client)).toEqual({ ok: true, students: [] });
  });

  test("quando o banco recusa ou a conexão cai, avisa que falhou", async () => {
    const refused = fakeClient({ select: async () => ({ data: null, error: { message: "negado" } }) });
    const dropped = fakeClient({ select: () => Promise.reject(new Error("sem rede")) });
    expect(await loadStudents(refused.client)).toEqual({ ok: false });
    expect(await loadStudents(dropped.client)).toEqual({ ok: false });
  });
});

describe("saveStudent", () => {
  test("sem id, cria um aluno novo", async () => {
    const { client, insert, update } = fakeClient();
    expect(await saveStudent(client, validRow, null)).toBe(true);
    expect(insert).toHaveBeenCalledWith(validRow);
    expect(update).not.toHaveBeenCalled();
  });

  test("com id, corrige só aquele aluno", async () => {
    const { client, insert, update, eq } = fakeClient();
    expect(await saveStudent(client, validRow, "1")).toBe(true);
    expect(update).toHaveBeenCalledWith(validRow);
    expect(eq).toHaveBeenCalledWith("id", "1");
    expect(insert).not.toHaveBeenCalled();
  });

  test("avisa quando a criação falha", async () => {
    const refused = fakeClient({ insert: async () => ({ error: { message: "negado" } }) });
    const dropped = fakeClient({ insert: () => Promise.reject(new Error("sem rede")) });
    expect(await saveStudent(refused.client, validRow, null)).toBe(false);
    expect(await saveStudent(dropped.client, validRow, null)).toBe(false);
  });

  test("avisa quando a correção falha ou não alcança nenhum aluno", async () => {
    const refused = fakeClient({ updated: async () => ({ data: null, error: { message: "negado" } }) });
    const nobody = fakeClient({ updated: async () => ({ data: [], error: null }) });
    const noAnswer = fakeClient({ updated: async () => ({ data: null, error: null }) });
    expect(await saveStudent(refused.client, validRow, "1")).toBe(false);
    expect(await saveStudent(nobody.client, validRow, "1")).toBe(false);
    expect(await saveStudent(noAnswer.client, validRow, "1")).toBe(false);
  });
});

describe("rascunho do formulário", () => {
  test("o que se digita vai para o aluno novo", () => {
    const state = changeDraft(initialStudents, "name", "Pedro");
    expect(state.newDraft.name).toBe("Pedro");
    expect(currentDraft(state).name).toBe("Pedro");
  });

  test("corrigir um aluno antigo abre a forma de cobrança em branco", () => {
    expect(currentDraft(startEditing(initialStudents, alvaro))).toMatchObject({ billingKind: "", billingAmount: "", packageLessons: "" });
  });

  test("corrigir um aluno antigo abre o horário em branco", () => {
    expect(currentDraft(startEditing(initialStudents, alvaro))).toMatchObject({ lessonWeekday: "", lessonTime: "" });
  });

  test("corrigir um aluno mostra os dados dele e guarda o que estava sendo digitado no novo", () => {
    const typing = changeDraft(initialStudents, "name", "Maria");
    const editing = startEditing({ ...typing, notice: "antes", message: "antes", errors: { name: "antes" } }, pedro);
    expect(currentDraft(editing)).toEqual({ name: "Pedro Lima", guardianName: "Ana Lima", guardianPhone: "(11) 98765-4321", billingKind: "package", billingAmount: "300,00", packageLessons: "4", lessonWeekday: "2", lessonTime: "15:00" });
    expect(editing).toMatchObject({ notice: null, message: null, errors: {} });

    const changed = changeDraft(editing, "name", "Pedro Souza");
    expect(currentDraft(changed).name).toBe("Pedro Souza");
    expect(changed.newDraft.name).toBe("Maria");

    const cancelled = cancelEditing({ ...changed, errors: { name: "erro" }, message: "erro" });
    expect(cancelled).toMatchObject({ editing: null, errors: {}, message: null });
    expect(currentDraft(cancelled).name).toBe("Maria");
  });
});

describe("lista na tela", () => {
  test("mostra o que chegou do banco", () => {
    expect(applyLoad(initialStudents, { ok: true, students: [pedro] })).toMatchObject({ students: [pedro], listStatus: "ready" });
  });

  test("quando falha, mantém os alunos que já estavam na tela", () => {
    const state = { ...initialStudents, students: [pedro] };
    expect(applyLoad(state, { ok: false })).toMatchObject({ students: [pedro], listStatus: "failed" });
  });

  test("ao tentar de novo, volta a carregar", () => {
    expect(startReloading({ ...initialStudents, listStatus: "failed" }).listStatus).toBe("loading");
  });
});

describe("submitStudent", () => {
  test("com dado errado, aponta o campo e não vai ao banco", async () => {
    const { client, from } = fakeClient();
    const state = await submitStudent(client, { ...withDraft({ ...validDraft, guardianPhone: "123" }), notice: "antes", message: "antes" });
    expect(from).not.toHaveBeenCalled();
    expect(state).toMatchObject({ errors: { guardianPhone: studentMessages.phoneInvalid }, message: null, notice: null });
    expect(state.newDraft.guardianPhone).toBe("123");
  });

  test("guarda o aluno novo, limpa o formulário e mostra a lista nova", async () => {
    const { client, insert } = fakeClient({ select: async () => ({ data: [pedro], error: null }) });
    const state = await submitStudent(client, withDraft());
    expect(insert).toHaveBeenCalledWith(validRow);
    expect(state.newDraft).toEqual(emptyDraft);
    expect(state).toMatchObject({ students: [pedro], listStatus: "ready", notice: "Cadastro de Pedro Lima guardado.", errors: {}, message: null });
  });

  test("corrige o aluno, fecha a edição e devolve o que estava sendo digitado no novo", async () => {
    const { client, update, eq, insert } = fakeClient({ select: async () => ({ data: [pedro], error: null }) });
    const typing = changeDraft(withDraft({ ...emptyDraft, name: "Maria" }), "guardianName", "Rosa");
    const state = await submitStudent(client, startEditing(typing, pedro));
    expect(update).toHaveBeenCalledWith(validRow);
    expect(eq).toHaveBeenCalledWith("id", "1");
    expect(insert).not.toHaveBeenCalled();
    expect(state.editing).toBeNull();
    expect(state.newDraft).toEqual({ ...emptyDraft, name: "Maria", guardianName: "Rosa" });
  });

  test("quando não consegue guardar, avisa e não perde o que foi digitado", async () => {
    const { client, select } = fakeClient({ insert: async () => ({ error: { message: "negado" } }) });
    const state = await submitStudent(client, { ...withDraft(), errors: { name: "antes" }, notice: "antes" });
    expect(select).not.toHaveBeenCalled();
    expect(state).toMatchObject({ message: studentMessages.saveFailed, errors: {}, notice: null });
    expect(state.newDraft).toEqual(validDraft);
  });

  test("quando guarda mas a lista não atualiza, confirma o cadastro e pede para tentar de novo", async () => {
    const { client } = fakeClient({ select: async () => ({ data: null, error: { message: "sem rede" } }) });
    const state = await submitStudent(client, { ...withDraft(), students: [alvaro] });
    expect(state).toMatchObject({ students: [alvaro], listStatus: "failed", notice: "Cadastro de Pedro Lima guardado." });
  });
});
