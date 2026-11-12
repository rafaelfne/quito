import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(__dirname, "..");

const serverOnly = ["web-push", "@/lib/dispatch-schedule", "@/lib/push-test"];

const valueImport = /^import\s+(?!type\s)[^;]*?from\s+"([^"]+)"/gm;

function fileOf(specifier: string, from: string): string | null {
  const base = specifier.startsWith("@/") ? join(root, specifier.slice(2)) : specifier.startsWith(".") ? resolve(from, "..", specifier) : null;
  if (base === null) return null;
  return [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find(existsSync) ?? null;
}

function reachableImports(entry: string): Set<string> {
  const seen = new Set<string>();
  const specifiers = new Set<string>();
  const pending = [join(root, entry)];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(valueImport)) {
      specifiers.add(specifier);
      const next = fileOf(specifier, file);
      if (next !== null) pending.push(next);
    }
  }
  return specifiers;
}

const clientPages = ["app/(app)/notifications/guide/page.tsx", "app/(app)/charges/page.tsx", "app/(app)/getting-started/page.tsx"];

describe("telas que rodam no celular", () => {
  test.each(clientPages)("%s não carrega o envio de notificações do servidor", (page) => {
    const imports = reachableImports(page);
    expect(imports.size).toBeGreaterThan(0);
    expect(serverOnly.filter((specifier) => imports.has(specifier))).toEqual([]);
  });

  test("o envio do servidor continua alcançável pela rota da notificação de teste", () => {
    const imports = reachableImports("app/api/push-test/route.ts");
    expect(imports).toContain("@/lib/push-test");
    expect(imports).toContain("web-push");
  });
});
