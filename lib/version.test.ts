import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { appVersion, versionLabel } from "./version";

const declaredVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

describe("versão do app", () => {
  test("é a mesma declarada no package.json", () => {
    expect(appVersion).toBe(declaredVersion);
  });

  test("o texto do rodapé traz o nome do app e a versão atual", () => {
    expect(versionLabel()).toBe(`Quitô versão ${declaredVersion}`);
  });

  test("o texto acompanha a versão recebida", () => {
    expect(versionLabel("2.3.4")).toBe("Quitô versão 2.3.4");
  });
});
