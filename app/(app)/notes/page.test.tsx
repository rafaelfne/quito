import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const order = vi.fn(async () => ({ data: [], error: null }));
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));

vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), useEffect: (effect: () => void) => effect() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from, auth: {} } }));

const { default: NotesPage } = await import("./page");

describe("página de notas", () => {
  test("abre com as notas do professor e o botão de sair", () => {
    const html = renderToStaticMarkup(<NotesPage />);
    expect(html).toContain("Minhas notas");
    expect(html).toContain("Sair");
    expect(from).toHaveBeenCalledWith("notes");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});
