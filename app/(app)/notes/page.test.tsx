import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { noteLimit, noteTooLongMessage } from "@/lib/notes";

const order = vi.fn(async () => ({ data: [], error: null }));
const select = vi.fn(() => ({ order }));
const insert = vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
const from = vi.fn(() => ({ select, insert }));

const screenState = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void) => effect(),
  useCallback: <T,>(callback: T) => callback,
  useState: (initial: unknown) => {
    const slot = screenState.cursor++;
    if (!(slot in screenState.values)) screenState.values[slot] = initial;
    return [screenState.values[slot], (next: unknown) => (screenState.values[slot] = next)];
  },
}));
vi.mock("@/lib/supabase", () => ({ supabase: { from, auth: {} } }));

const { default: NotesPage } = await import("./page");

type AnyProps = Record<string, (arg: unknown) => unknown> & { children?: ReactNode };

function renderScreen() {
  screenState.cursor = 0;
  return NotesPage();
}

function findByTag(node: ReactNode, tag: string): ReactElement<AnyProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByTag(child, tag);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object" || !("props" in node)) return null;
  const element = node as ReactElement<AnyProps>;
  return element.type === tag ? element : findByTag(element.props.children, tag);
}

function type(text: string) {
  findByTag(renderScreen(), "input")!.props.onChange({ target: { value: text } });
}

async function save() {
  await findByTag(renderScreen(), "form")!.props.onSubmit({ preventDefault: () => {} });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function screenHtml() {
  return renderToStaticMarkup(renderScreen());
}

beforeEach(() => {
  screenState.values = [];
  insert.mockClear();
  insert.mockResolvedValue({ error: null });
});

describe("página de notas", () => {
  test("abre com as notas do professor e o caminho para a conta", () => {
    const html = screenHtml();
    expect(html).toContain("Minhas notas");
    expect(html).toContain('href="/account"');
    expect(from).toHaveBeenCalledWith("notes");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  test("nota acima do limite mostra o aviso, não grava e mantém o texto no campo", async () => {
    const tooLong = "a".repeat(noteLimit + 1);
    type(tooLong);
    await save();
    const html = screenHtml();
    expect(html).toContain(noteTooLongMessage);
    expect(html).toContain(`value="${tooLong}"`);
    expect(insert).not.toHaveBeenCalled();
  });

  test("nota no limite é gravada, sem aviso, e o campo fica vazio", async () => {
    const fits = "a".repeat(noteLimit);
    type(fits);
    await save();
    const html = screenHtml();
    expect(insert).toHaveBeenCalledWith({ body: fits });
    expect(html).not.toContain(noteTooLongMessage);
    expect(html).not.toContain(`value="${fits}"`);
  });

  test("depois de encurtar a nota, o aviso some ao guardar", async () => {
    type("a".repeat(noteLimit + 1));
    await save();
    type("nota curta");
    await save();
    expect(insert).toHaveBeenCalledWith({ body: "nota curta" });
    expect(screenHtml()).not.toContain(noteTooLongMessage);
  });

  test("nota só com espaços não grava nem avisa", async () => {
    type("   ");
    await save();
    expect(insert).not.toHaveBeenCalled();
    expect(screenHtml()).not.toContain(noteTooLongMessage);
  });

  test("erro ao gravar aparece e mantém o texto no campo", async () => {
    insert.mockResolvedValue({ error: { message: "Sem conexão" } });
    type("nota curta");
    await save();
    const html = screenHtml();
    expect(html).toContain("Sem conexão");
    expect(html).toContain('value="nota curta"');
  });
});
