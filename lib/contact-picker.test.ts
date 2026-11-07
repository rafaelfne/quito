import { describe, expect, test, vi } from "vitest";
import { appendContactLines, contactLine, contactsPickerOf, pickContacts, type ContactsPicker } from "./contact-picker";
import { parseStudentLine, studentImportMessages } from "./student-import";

describe("contactsPickerOf", () => {
  test("só oferece os contatos quando o celular deixa escolher", () => {
    const select = vi.fn();
    expect(contactsPickerOf({ contacts: { select } })).toEqual({ select });
    expect(contactsPickerOf({ contacts: {} })).toBeNull();
    expect(contactsPickerOf({})).toBeNull();
    expect(contactsPickerOf(undefined)).toBeNull();
  });
});

describe("pickContacts", () => {
  test("pede só nome e telefone dos contatos escolhidos, vários de uma vez", async () => {
    const select = vi.fn(async () => [{ name: ["Mãe do Pedro"], tel: ["11987654321"] }]);
    expect(await pickContacts({ select })).toEqual({ ok: true, contacts: [{ name: ["Mãe do Pedro"], tel: ["11987654321"] }] });
    expect(select).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
  });

  test("fechar sem escolher não traz ninguém", async () => {
    expect(await pickContacts({ select: async () => [] })).toEqual({ ok: true, contacts: [] });
    expect(await pickContacts({ select: async () => null } as unknown as ContactsPicker)).toEqual({ ok: true, contacts: [] });
  });

  test("avisa quando o celular recusa abrir os contatos", async () => {
    expect(await pickContacts({ select: async () => Promise.reject(new Error("negado")) })).toEqual({ ok: false });
  });
});

describe("contactLine", () => {
  test("vira uma linha com o aluno em branco, o responsável e o telefone", () => {
    const line = contactLine({ name: ["Mãe do Pedro"], tel: ["+55 11 98765-4321", "1134567890"] });
    expect(line).toBe(", Mãe do Pedro, +55 11 98765-4321");
    expect(parseStudentLine(line, 1)).toMatchObject({ name: "", guardianName: "Mãe do Pedro", phone: "11987654321", problems: [studentImportMessages.nameMissing] });
  });

  test("com o nome do aluno escrito no começo, a linha fica pronta", () => {
    expect(parseStudentLine(`Pedro Lima${contactLine({ name: ["Mãe do Pedro"], tel: ["11987654321"] })}`, 1)).toMatchObject({ name: "Pedro Lima", guardianName: "Mãe do Pedro", phone: "11987654321", problems: [] });
  });

  test("tira do nome os sinais que separam as colunas", () => {
    expect(contactLine({ name: ["", "Silva, Ana; | Mãe"], tel: [" ", "11987654321"] })).toBe(", Silva Ana Mãe, 11987654321");
  });

  test("contato sem telefone fica marcado", () => {
    const line = contactLine({ name: ["Ana"] });
    expect(line).toBe(", Ana");
    expect(parseStudentLine(line, 1).problems).toEqual([studentImportMessages.nameMissing, studentImportMessages.phoneMissing]);
    expect(contactLine({})).toBe(", ");
  });
});

describe("appendContactLines", () => {
  test("junta os contatos depois do que já está na caixa", () => {
    const contacts = [{ name: ["Ana"], tel: ["11987654321"] }, { name: ["Rosa"], tel: ["2134567890"] }];
    expect(appendContactLines("Bia, Rosa, 2134567891\n\n", contacts)).toBe("Bia, Rosa, 2134567891\n, Ana, 11987654321\n, Rosa, 2134567890");
    expect(appendContactLines("", contacts)).toBe(", Ana, 11987654321\n, Rosa, 2134567890");
    expect(appendContactLines("Bia", [])).toBe("Bia");
  });
});
