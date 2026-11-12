import { describe, expect, test } from "vitest";
import { GET, dynamicParams, generateStaticParams } from "./route";

function request(name: string) {
  return GET(new Request(`http://localhost/icons/${name}`), { params: Promise.resolve({ name }) });
}

describe("endereço dos ícones da tela inicial", () => {
  test("prepara um endereço para cada ícone da ficha do app", () => {
    expect(generateStaticParams()).toEqual([{ name: "icon-192.png" }, { name: "icon-512.png" }, { name: "maskable-512.png" }]);
    expect(dynamicParams).toBe(false);
  });

  test.each(["icon-192.png", "icon-512.png", "maskable-512.png"])("entrega o ícone %s como imagem", async (name) => {
    const response = await request(name);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  test("responde que não existe para um ícone fora da ficha", async () => {
    expect((await request("icon-64.png")).status).toBe(404);
  });
});
