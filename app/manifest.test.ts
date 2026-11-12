import { describe, expect, test } from "vitest";
import manifest from "./manifest";

describe("ficha do app para a tela inicial", () => {
  const app = manifest();

  test("instala com o nome Quitô", () => {
    expect(app.name).toBe("Quitô");
    expect(app.short_name).toBe("Quitô");
  });

  test("abre em tela cheia, sem a barra de endereço do navegador", () => {
    expect(app.display).toBe("standalone");
  });

  test("abre pela tela de entrada e mantém todas as telas dentro do app", () => {
    expect(app.start_url).toBe("/");
    expect(app.scope).toBe("/");
    expect(app.id).toBe("/");
  });

  test("usa as cores do Quitô na abertura e na barra do celular", () => {
    expect(app.background_color).toBe("#fdfdfd");
    expect(app.theme_color).toBe("#fdfdfd");
  });

  test("está em português do Brasil e explica o que o app faz", () => {
    expect(app.lang).toBe("pt-BR");
    expect(app.description).toBe("Você dá a aula. O Quitô cuida da cobrança.");
  });

  test("traz os ícones que o Android pede para instalar, inclusive o de recorte redondo", () => {
    expect(app.icons).toEqual([
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});
