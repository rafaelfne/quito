import { describe, expect, test, vi } from "vitest";
import { billingMessages, emptyBillingDraft } from "./billing";
import { scheduleMessages } from "./schedule";
import {
  applySetupLoad,
  changeGroupBilling,
  changeSchedule,
  clearSelection,
  describeApplied,
  describeApply,
  initialStudentSetup,
  saveGroupBilling,
  scheduleDraftOf,
  selectWithoutBilling,
  startReloadingSetup,
  studentSetupMessages,
  studentSetupPath,
  submitGroupBilling,
  submitStudentSchedule,
  toggleStudent,
  type StudentSetupState,
} from "./student-setup";
import type { Student, StudentsClient } from "./students";

type Failure = { message: string } | null;
type UpdateResult = { data: { id: string }[] | null; error: Failure };

const blank = { billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null, gender: null, called_as: null };
const pedro: Student = { ...blank, id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" };
const bia: Student = { ...blank, id: "2", name: "Bia Reis", guardian_name: "Rosa Reis", guardian_phone: "2134567890" };
const caio: Student = { ...blank, id: "3", name: "Caio Reis", guardian_name: "Rosa Reis", guardian_phone: "2134567890", billing_kind: "monthly", billing_amount_cents: 20000, lesson_weekday: 2, lesson_time: "09:30:00" };

function fakeClient(result: (ids: string[]) => Promise<UpdateResult> = async (ids) => ({ data: ids.map((id) => ({ id })), error: null })) {
  const calls: { row: unknown; column: string; ids: string[] }[] = [];
  const update = vi.fn((row: unknown) => ({
    in: (column: string, ids: string[]) => {
      calls.push({ row, column, ids });
      return { select: () => result(ids) };
    },
  }));
  const from = vi.fn(() => ({ update }));
  return { client: { from } as unknown as StudentsClient, from, update, calls };
}

function ready(students: Student[] = [bia, caio, pedro]): StudentSetupState {
  return applySetupLoad(initialStudentSetup, { ok: true, students });
}

describe("rótulos", () => {
  test("o botão diz quantos alunos recebem a forma de cobrança", () => {
    expect(studentSetupPath).toBe("/students/setup");
    expect(describeApply(0)).toBe("Marque os alunos");
    expect(describeApply(1)).toBe("Aplicar a 1 aluno");
    expect(describeApply(3)).toBe("Aplicar a 3 alunos");
    expect(describeApplied(2)).toBe("Forma de cobrança aplicada a 2 alunos. Agora acerte o horário de cada um.");
  });
});

describe("carregar e marcar", () => {
  test("cada aluno começa com o horário que já tem", () => {
    const state = ready();
    expect(state.listStatus).toBe("ready");
    expect(scheduleDraftOf(state, "3")).toEqual({ lessonWeekday: "2", lessonTime: "09:30" });
    expect(scheduleDraftOf(state, "1")).toEqual({ lessonWeekday: "", lessonTime: "" });
    expect(scheduleDraftOf(state, "nenhum")).toEqual({ lessonWeekday: "", lessonTime: "" });
  });

  test("recarregar mantém o que foi digitado e solta quem saiu da lista", () => {
    const typed = toggleStudent(changeSchedule(ready(), "1", "lessonTime", "15:00"), "2");
    const reloaded = applySetupLoad(startReloadingSetup(typed), { ok: true, students: [pedro] });
    expect(scheduleDraftOf(reloaded, "1").lessonTime).toBe("15:00");
    expect(reloaded.selected).toEqual([]);
  });

  test("falha ao carregar avisa sem perder o que já estava na tela", () => {
    const failed = applySetupLoad(startReloadingSetup(ready()), { ok: false });
    expect(failed.listStatus).toBe("failed");
    expect(failed.students).toHaveLength(3);
  });

  test("marca e desmarca alunos um por um", () => {
    const one = toggleStudent(ready(), "1");
    const two = toggleStudent(one, "2");
    expect(two.selected).toEqual(["1", "2"]);
    expect(toggleStudent(two, "1").selected).toEqual(["2"]);
  });

  test("marca de uma vez só os alunos sem forma de cobrança e desmarca todos", () => {
    const selected = selectWithoutBilling(ready());
    expect(selected.selected).toEqual(["2", "1"]);
    expect(clearSelection(selected).selected).toEqual([]);
  });

  test("muda o valor do grupo e o horário de um aluno sem mexer nos outros", () => {
    const state = changeSchedule(changeGroupBilling(ready(), "billingKind", "per_class"), "1", "lessonWeekday", "4");
    expect(state.billing).toEqual({ ...emptyBillingDraft, billingKind: "per_class" });
    expect(scheduleDraftOf(state, "1")).toEqual({ lessonWeekday: "4", lessonTime: "" });
    expect(scheduleDraftOf(state, "3")).toEqual({ lessonWeekday: "2", lessonTime: "09:30" });
  });
});

describe("aplicar a mesma forma de cobrança", () => {
  function chosen(): StudentSetupState {
    const state = toggleStudent(toggleStudent(ready(), "1"), "2");
    return changeGroupBilling(changeGroupBilling(state, "billingKind", "package"), "billingAmount", "300,00");
  }

  test("grava o mesmo valor e a mesma forma em todos os marcados de uma vez", async () => {
    const { client, from, update, calls } = fakeClient();
    const next = await submitGroupBilling(client, changeGroupBilling(chosen(), "packageLessons", "4"));
    expect(from).toHaveBeenCalledWith("students");
    expect(update).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([{ row: { billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4 }, column: "id", ids: ["1", "2"] }]);
    expect(next.notice).toBe(describeApplied(2));
    expect(next.selected).toEqual([]);
    expect(next.billing).toEqual(emptyBillingDraft);
    expect(next.students.find((student) => student.id === "1")).toMatchObject({ billing_kind: "package", billing_amount_cents: 30000, package_lessons: 4 });
    expect(next.students.find((student) => student.id === "3")).toMatchObject({ billing_kind: "monthly", billing_amount_cents: 20000 });
  });

  test("sem aluno marcado, pede para marcar e não grava nada", async () => {
    const { client, update } = fakeClient();
    const next = await submitGroupBilling(client, changeGroupBilling(ready(), "billingKind", "monthly"));
    expect(next.message).toBe(studentSetupMessages.noneSelected);
    expect(update).not.toHaveBeenCalled();
  });

  test("valor ou pacote incompleto mostra o erro de cada campo e não grava", async () => {
    const { client, update } = fakeClient();
    const next = await submitGroupBilling(client, chosen());
    expect(next.billingErrors).toEqual({ packageLessons: billingMessages.lessonsInvalid });
    const noKind = await submitGroupBilling(client, toggleStudent(ready(), "1"));
    expect(noKind.billingErrors).toEqual({ billingKind: billingMessages.kindMissing });
    expect(update).not.toHaveBeenCalled();
  });

  test("erro do banco, aluno que não voltou ou queda da conexão avisam e mantêm a marcação", async () => {
    const failures: ((ids: string[]) => Promise<UpdateResult>)[] = [
      async () => ({ data: null, error: { message: "negado" } }),
      async () => ({ data: [{ id: "1" }], error: null }),
      async () => ({ data: null, error: null }),
      async () => {
        throw new Error("sem rede");
      },
    ];
    for (const failure of failures) {
      const { client } = fakeClient(failure);
      const next = await submitGroupBilling(client, changeGroupBilling(chosen(), "packageLessons", "4"));
      expect(next.message).toBe(studentSetupMessages.billingFailed);
      expect(next.selected).toEqual(["1", "2"]);
      expect(next.students.find((student) => student.id === "1")?.billing_kind).toBeNull();
    }
  });

  test("lista vazia não vai para o banco", async () => {
    const { client, update } = fakeClient();
    expect(await saveGroupBilling(client, { billing_kind: "monthly", billing_amount_cents: 100, package_lessons: null }, [])).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("acertar o horário de cada um", () => {
  test("guarda só o horário do aluno escolhido", async () => {
    const { client, calls } = fakeClient();
    const typed = changeSchedule(changeSchedule(ready(), "1", "lessonWeekday", "1"), "1", "lessonTime", "15:00");
    const next = await submitStudentSchedule(client, typed, "1");
    expect(calls).toEqual([{ row: { lesson_weekday: 1, lesson_time: "15:00" }, column: "id", ids: ["1"] }]);
    expect(next.notice).toBe("Horário de Pedro Lima guardado.");
    expect(next.students.find((student) => student.id === "1")).toMatchObject({ lesson_weekday: 1, lesson_time: "15:00" });
    expect(next.students.find((student) => student.id === "2")?.lesson_weekday).toBeNull();
  });

  test("horário incompleto marca o erro só daquele aluno e some depois de corrigir", async () => {
    const { client, update } = fakeClient();
    const withOther: StudentSetupState = { ...ready(), scheduleErrors: { "2": { lessonTime: scheduleMessages.timeInvalid } } };
    const failed = await submitStudentSchedule(client, withOther, "1");
    expect(failed.scheduleErrors).toEqual({ "1": { lessonWeekday: scheduleMessages.weekdayMissing, lessonTime: scheduleMessages.timeInvalid }, "2": { lessonTime: scheduleMessages.timeInvalid } });
    expect(update).not.toHaveBeenCalled();
    const fixed = changeSchedule(changeSchedule(failed, "1", "lessonWeekday", "3"), "1", "lessonTime", "08:00");
    const saved = await submitStudentSchedule(client, fixed, "1");
    expect(saved.scheduleErrors).toEqual({ "2": { lessonTime: scheduleMessages.timeInvalid } });
  });

  test("falha ao gravar avisa e mantém o que foi digitado", async () => {
    const { client } = fakeClient(async () => ({ data: null, error: { message: "negado" } }));
    const typed = changeSchedule(changeSchedule(ready(), "1", "lessonWeekday", "1"), "1", "lessonTime", "15:00");
    const next = await submitStudentSchedule(client, typed, "1");
    expect(next.message).toBe(studentSetupMessages.scheduleFailed);
    expect(scheduleDraftOf(next, "1")).toEqual({ lessonWeekday: "1", lessonTime: "15:00" });
  });

  test("aluno que não está na lista não muda nada", async () => {
    const { client, update } = fakeClient();
    const state = ready();
    expect(await submitStudentSchedule(client, state, "nenhum")).toBe(state);
    expect(update).not.toHaveBeenCalled();
  });
});
