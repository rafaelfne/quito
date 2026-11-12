import { describe, expect, test } from "vitest";
import AppleIcon, { contentType, size } from "./apple-icon";

describe("ícone do iPhone", () => {
  test("tem o tamanho que o iPhone usa na tela de início", () => {
    expect(size).toEqual({ width: 180, height: 180 });
    expect(contentType).toBe("image/png");
  });

  test("gera a imagem do ícone", () => {
    expect(AppleIcon().headers.get("content-type")).toBe("image/png");
  });
});
