import { describe, expect, test } from "vitest";
import { cleanNote, noteLimit } from "./notes";

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
