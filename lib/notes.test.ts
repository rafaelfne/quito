import { describe, expect, test } from "vitest";
import { cleanNote, noteLimit, noteTooLongMessage, noteWarning } from "./notes";

describe("noteWarning", () => {
  test("avisa quando a nota passa do limite", () => {
    expect(noteWarning("a".repeat(noteLimit + 1))).toBe(noteTooLongMessage);
    expect(noteTooLongMessage).toContain("2.000 caracteres");
    expect(noteTooLongMessage).toContain("toque em Guardar");
  });

  test("não avisa com a nota exatamente no limite", () => {
    expect(noteWarning("a".repeat(noteLimit))).toBeNull();
  });

  test("não conta os espaços das pontas", () => {
    expect(noteWarning(`  ${"a".repeat(noteLimit)}  `)).toBeNull();
  });

  test("não avisa em nota vazia", () => {
    expect(noteWarning("   ")).toBeNull();
  });
});

describe("cleanNote", () => {
  test("tira os espaços das pontas", () => {
    expect(cleanNote("  comprar pão  ")).toBe("comprar pão");
  });

  test("recusa nota vazia", () => {
    expect(cleanNote("   ")).toBeNull();
  });

  test("recusa nota maior que o limite", () => {
    expect(cleanNote("a".repeat(noteLimit + 1))).toBeNull();
  });
});
