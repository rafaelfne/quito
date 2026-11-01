import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migrationsDir = join(process.cwd(), "supabase/migrations");

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n");

const tables = [...migrations.matchAll(/create table public\."?(\w+)"?/gi)].map((match) => match[1]);

describe("cada professor só vê os próprios dados", () => {
  test("as migrações criam tabelas", () => {
    expect(tables).toContain("notes");
  });

  test.each(tables)("a tabela %s nasce com a regra de acesso ligada e só para o dono", (table) => {
    expect(migrations).toMatch(new RegExp(`alter table public\\."?${table}"? enable row level security`, "i"));
    for (const action of ["select", "insert", "update", "delete"]) {
      const policy = new RegExp(`create policy "[^"]+" on public\\."?${table}"? for ${action} to authenticated [^;]*auth\\.uid\\(\\)\\) = "owner_id"`, "i");
      expect(migrations).toMatch(policy);
    }
  });

  test("nenhuma regra libera tudo", () => {
    expect(migrations).not.toMatch(/(using|with check)\s*\(\s*true\s*\)/i);
    expect(migrations).not.toMatch(/disable row level security/i);
  });
});
