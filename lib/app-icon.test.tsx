import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppIcon, appIconImage, homeScreenIcons, isHomeScreenIconName } from "./app-icon";

describe("ícone do app", () => {
  test("mostra a letra Q na cor do Quitô", () => {
    const html = renderToStaticMarkup(<AppIcon size={192} maskable={false} />);
    expect(html).toContain(">Q</div>");
    expect(html).toContain("background:#7033ff");
    expect(html).toContain("width:192px");
    expect(html).toContain("height:192px");
  });

  test("no ícone de recorte redondo, a letra fica menor para não ser cortada", () => {
    expect(renderToStaticMarkup(<AppIcon size={512} maskable={false} />)).toContain("font-size:317px");
    expect(renderToStaticMarkup(<AppIcon size={512} maskable />)).toContain("font-size:256px");
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
