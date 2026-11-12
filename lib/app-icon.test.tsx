import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppIcon, appIconImage, homeScreenIcons, isHomeScreenIconName } from "./app-icon";

describe("ícone do app", () => {
  test("mostra o Q branco com a perninha verde no fundo roxo do Quitô", () => {
    const html = renderToStaticMarkup(<AppIcon size={192} maskable={false} />);
    expect(html).toContain("background:#7033ff");
    expect(html).toContain("width:192px");
    expect(html).toContain("height:192px");
    expect(html).toMatch(/<circle[^>]*stroke="#ffffff"/);
    expect(html).toMatch(/<path[^>]*stroke="#4ac885"/);
  });

  test("o fundo é quadrado, porque o próprio celular arredonda os cantos", () => {
    const html = renderToStaticMarkup(<AppIcon size={512} maskable={false} />);
    expect(html).not.toContain("border-radius");
    expect(html).not.toContain("rx=");
  });

  test("no ícone de recorte redondo, o Q fica menor para não ser cortado", () => {
    expect(renderToStaticMarkup(<AppIcon size={512} maskable={false} />)).toContain('viewBox="0 0 512 512"');
    expect(renderToStaticMarkup(<AppIcon size={512} maskable />)).toContain('viewBox="-64 -64 640 640"');
  });

  test("reconhece só os ícones que a ficha do app lista", () => {
    expect(Object.keys(homeScreenIcons).every(isHomeScreenIconName)).toBe(true);
    expect(isHomeScreenIconName("icon-64.png")).toBe(false);
    expect(isHomeScreenIconName("toString")).toBe(false);
  });

  test("gera uma imagem PNG", async () => {
    const image = appIconImage({ size: 192, maskable: false });
    expect(image.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await image.arrayBuffer());
    expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  });
});
