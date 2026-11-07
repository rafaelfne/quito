import { describe, expect, test, vi } from "vitest";
import {
  applyImportLoad,
  changeImportText,
  describeReady,
  describeSaved,
  importableStudents,
  initialStudentImport,
  isReady,
  parseStudentLine,
  parseStudentList,
  saveImportedStudents,
  startReloadingImport,
  studentImportMessages,
  submitImport,
  type StudentImportState,
} from "./student-import";
import { studentNameLimit, type Student, type StudentsClient } from "./students";

type Failure = { message: string } | null;
type SelectResult = { data: unknown[] | null; error: Failure };

const pedro: Student = { id: "1", name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: null, billing_amount_cents: null, package_lessons: null, lesson_weekday: null, lesson_time: null };

function fakeClient(overrides: { select?: () => Promise<SelectResult>; insert?: () => Promise<{ error: Failure }> } = {}) {
  const select = vi.fn(overrides.select ?? (async () => ({ data: [] as unknown[], error: null as Failure })));
  const insert = vi.fn(overrides.insert ?? (async () => ({ error: null as Failure })));
  const from = vi.fn(() => ({ select, insert }));
  return { client: { from } as unknown as StudentsClient, from, select, insert };
}

function ready(text: string, students: Student[] = []): StudentImportState {
  return { ...initialStudentImport, text, students, listStatus: "ready" };
}

describe("parseStudentLine", () => {
  test.each([
    ["Pedro Lima, Ana Lima, (11) 98765-4321"],
    ["Pedro Lima\tAna Lima\t11987654321"],
    ["Pedro Lima; Ana Lima; +55 11 98765-4321"],
    ["Pedro Lima - Ana Lima - 11 98765 4321"],
    ["Pedro Lima / Ana Lima / 11 98765-4321"],
    ["Pedro Lima | Ana Lima | 11.98765.4321"],
    ["1. Pedro Lima, Ana Lima, 11987654321"],
    ["- Pedro Lima, Ana Lima, 11987654321"],
    ['"Pedro Lima","Ana Lima","11987654321"'],
    ["  Pedro   Lima ,  Ana  Lima , 11987654321  "],
    ["Pedro Lima, Ana Lima 11987654321"],
  ])("separa nome, responsável e telefone de %s", (text) => {
    expect(parseStudentLine(text, 3)).toEqual({ line: 3, text, name: "Pedro Lima", guardianName: "Ana Lima", phone: "11987654321", problems: [] });
  });

  test("aceita telefone fixo", () => {
    expect(parseStudentLine("Bia Reis, Rosa Reis, (21) 3456-7890", 1).phone).toBe("2134567890");
  });

  test("aponta o que falta em cada linha", () => {
    expect(parseStudentLine("Pedro Lima, 11987654321", 1).problems).toEqual([studentImportMessages.guardianMissing]);
    expect(parseStudentLine("Pedro Lima, Ana Lima", 1).problems).toEqual([studentImportMessages.phoneMissing]);
    expect(parseStudentLine("11987654321", 1).problems).toEqual([studentImportMessages.nameMissing]);
  });

  test("telefone sem DDD fica marcado para conferir", () => {
    const line = parseStudentLine("Pedro Lima, Ana Lima, 98765-4321", 1);
    expect(line.phone).toBeNull();
    expect(line.problems).toEqual([studentImportMessages.phoneInvalid]);
    expect(isReady(line)).toBe(false);
  });

  test("nome comprido demais fica marcado", () => {
    const long = "A".repeat(studentNameLimit + 1);
    expect(parseStudentLine(`${long}, Ana Lima, 11987654321`, 1).problems).toEqual([studentImportMessages.nameTooLong]);
  });
});

describe("parseStudentList", () => {
  test("ignora linhas vazias e guarda o número de cada linha", () => {
    const lines = parseStudentList("Pedro Lima, Ana Lima, 11987654321\r\n\n  \nBia Reis, Rosa Reis, 2134567890");
    expect(lines.map((line) => [line.line, line.name])).toEqual([
      [1, "Pedro Lima"],
      [4, "Bia Reis"],
    ]);
  });

  test("pula o cabeçalho copiado da planilha", () => {
    const lines = parseStudentList("Nome\tResponsável\tWhatsApp\nPedro Lima\tAna Lima\t11987654321");
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Pedro Lima");
  });

  test("não confunde um aluno com cabeçalho", () => {
    expect(parseStudentList("Nome Sobrenome, Ana Lima, 11987654321")).toHaveLength(1);
    expect(parseStudentList("Nome, Ana")).toHaveLength(1);
  });

  test("marca aluno repetido na lista e aluno já cadastrado", () => {
    const lines = parseStudentList("pedro lima, Ana, 11987654321\nBia Reis, Rosa, 2134567890\nBia Reis, Rosa, (21) 3456-7890", [pedro]);
    expect(lines.map((line) => line.problems)).toEqual([[studentImportMessages.alreadySaved], [], [studentImportMessages.repeatedInList]]);
  });

  test("irmãos com o mesmo responsável entram os dois", () => {
    const lines = parseStudentList("Pedro Lima, Ana Lima, 11987654321\nJoão Lima, Ana Lima, 11987654321");
    expect(importableStudents(lines)).toEqual([
      { name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" },
      { name: "João Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" },
    ]);
  });

  test("lista vazia não tem linhas", () => {
    expect(parseStudentList("")).toEqual([]);
  });
});

describe("textos", () => {
  test("botão e aviso concordam com a quantidade", () => {
    expect(describeReady(0)).toBe("Guardar 0 alunos");
    expect(describeReady(1)).toBe("Guardar 1 aluno");
    expect(describeReady(3)).toBe("Guardar 3 alunos");
    expect(describeSaved(1)).toBe("1 aluno guardado.");
    expect(describeSaved(2)).toBe("2 alunos guardados.");
  });
});

describe("saveImportedStudents", () => {
  const rows = [{ name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" }];

  test("grava todos de uma vez", async () => {
    const { client, from, insert } = fakeClient();
    expect(await saveImportedStudents(client, rows)).toBe(true);
    expect(from).toHaveBeenCalledWith("students");
    expect(insert).toHaveBeenCalledWith(rows);
  });

  test("avisa quando o banco recusa ou a rede falha", async () => {
    expect(await saveImportedStudents(fakeClient({ insert: async () => ({ error: { message: "x" } }) }).client, rows)).toBe(false);
    expect(await saveImportedStudents(fakeClient({ insert: async () => Promise.reject(new Error("rede")) }).client, rows)).toBe(false);
  });
});

describe("estado da importação", () => {
  test("mudar o texto apaga mensagens antigas", () => {
    const state = { ...ready("a"), message: "erro", notice: "ok" };
    expect(changeImportText(state, "b")).toEqual({ ...state, text: "b", message: null, notice: null });
  });

  test("carregar de novo volta a esperar", () => {
    expect(startReloadingImport({ ...initialStudentImport, listStatus: "failed" }).listStatus).toBe("loading");
  });

  test("aplica a lista de alunos ou marca a falha", () => {
    expect(applyImportLoad(initialStudentImport, { ok: true, students: [pedro] })).toMatchObject({ listStatus: "ready", students: [pedro] });
    expect(applyImportLoad(initialStudentImport, { ok: false }).listStatus).toBe("failed");
  });
});

describe("submitImport", () => {
  test("guarda as linhas prontas e deixa na caixa só as que precisam de correção", async () => {
    const { client, insert } = fakeClient({ select: async () => ({ data: [pedro], error: null }) });
    const next = await submitImport(client, ready("Pedro Lima, Ana Lima, 11987654321\nBia Reis, 98765-4321"));
    expect(insert).toHaveBeenCalledWith([{ name: "Pedro Lima", guardian_name: "Ana Lima", guardian_phone: "11987654321" }]);
    expect(next).toMatchObject({ text: "Bia Reis, 98765-4321", notice: "1 aluno guardado.", message: null, students: [pedro], listStatus: "ready" });
  });

  test("sem linha pronta, não grava e explica", async () => {
    const { client, insert } = fakeClient();
    const next = await submitImport(client, ready("Pedro Lima"));
    expect(insert).not.toHaveBeenCalled();
    expect(next).toMatchObject({ text: "Pedro Lima", message: studentImportMessages.nothingReady, notice: null });
  });

  test("se a gravação falha, mantém o texto para tentar de novo", async () => {
    const { client } = fakeClient({ insert: async () => ({ error: { message: "x" } }) });
    const state = ready("Pedro Lima, Ana Lima, 11987654321");
    expect(await submitImport(client, state)).toEqual({ ...state, message: studentImportMessages.saveFailed, notice: null });
  });
});
