import { describe, expect, test } from "vitest";
import { guideLinkFrom, qrCodeOf, qrQuietZone } from "@/lib/guide-qr";

function darkCells(path: string): Set<string> {
  return new Set([...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(([, x, y]) => `${x},${y}`));
}

function finderAt(cells: Set<string>, left: number, top: number): boolean {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = x === 0 || y === 0 || x === 6 || y === 6;
      const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      if (cells.has(`${left + x},${top + y}`) !== (ring || center)) return false;
    }
  }
  return true;
}

describe("código QR do guia no computador", () => {
  test("o link leva ao guia de ativação no mesmo endereço do Quitô", () => {
    expect(guideLinkFrom("https://quito.exemplo")).toBe("https://quito.exemplo/notifications/guide");
  });

  test("desenha os três quadrados de canto que a câmera do celular procura", () => {
    const { size, path } = qrCodeOf(guideLinkFrom("https://quito.exemplo"));
    const cells = darkCells(path);
    const far = size - qrQuietZone - 7;
    expect(finderAt(cells, qrQuietZone, qrQuietZone)).toBe(true);
    expect(finderAt(cells, far, qrQuietZone)).toBe(true);
    expect(finderAt(cells, qrQuietZone, far)).toBe(true);
    expect(finderAt(cells, far, far)).toBe(false);
  });

  test("deixa uma margem em branco em volta, para a câmera ler", () => {
    const { size, path } = qrCodeOf(guideLinkFrom("https://quito.exemplo"));
    const coordinates = [...darkCells(path)].flatMap((cell) => cell.split(",").map(Number));
    expect(Math.min(...coordinates)).toBe(qrQuietZone);
    expect(Math.max(...coordinates)).toBe(size - qrQuietZone - 1);
    expect((size - qrQuietZone * 2 - 17) % 4).toBe(0);
  });

  test("um endereço mais longo gera um código maior", () => {
    const short = qrCodeOf("https://q.co/notifications/guide");
    const long = qrCodeOf(`https://${"quito".repeat(20)}.exemplo/notifications/guide`);
    expect(long.size).toBeGreaterThan(short.size);
  });
});
