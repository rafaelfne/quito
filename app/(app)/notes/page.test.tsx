import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

type NoteRow = { id: string; body: string; created_at: string };
type DatabaseError = { message: string };
type NotesResult = { data: NoteRow[] | null; error: DatabaseError | null };
type AnyProps = Record<string, unknown> & { children?: ReactNode };

const order = vi.fn<() => Promise<NotesResult>>(async () => ({ data: [], error: null }));
const select = vi.fn(() => ({ order }));
const insert = vi.fn<(row: { body: string }) => Promise<{ error: DatabaseError | null }>>(async () => ({ error: null }));
const from = vi.fn(() => ({ select, insert }));

const hooks = vi.hoisted(() => {
  let slots: unknown[] = [];
  let cursor = 0;
  return {
    reset() {
      slots = [];
      cursor = 0;
    },
    rewind() {
      cursor = 0;
    },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (value: unknown) => {
          slots[index] = value;
        },
      ];
    },
    useCallback(callback: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = callback;
      return slots[index];
    },
    useEffect(effect: () => void, deps: unknown[]) {
      const index = cursor++;
      const previous = slots[index] as unknown[] | undefined;
      slots[index] = deps;
      if (!previous || deps.some((dep, position) => dep !== previous[position])) effect();
    },
  };
});

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: hooks.useState,
  useCallback: hooks.useCallback,
  useEffect: hooks.useEffect,
}));
vi.mock("@/lib/supabase", () => ({ supabase: { from, auth: {} } }));

const { default: NotesPage } = await import("./page");

const older: NoteRow = { id: "1", body: "Nota antiga", created_at: "2026-01-01T10:00:00Z" };
const newer: NoteRow = { id: "2", body: "Nota nova", created_at: "2026-01-02T10:00:00Z" };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function elements(node: ReactNode): ReactElement<AnyProps>[] {
  const found: ReactElement<AnyProps>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<AnyProps>(child)) return;
    found.push(child);
    found.push(...elements(child.props.children));
  });
  return found;
}

function render() {
  hooks.rewind();
  const page = NotesPage();
  const all = elements(page);
  return {
    html: renderToStaticMarkup(page),
    input: all.find((element) => element.type === "input")!,
    form: all.find((element) => element.type === "form")!,
  };
}

async function open() {
  render();
  await settle();
  return render();
}

function type(value: string) {
  const { input } = render();
  (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}

async function submit() {
  const { form } = render();
  const preventDefault = vi.fn();
  (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
  await settle();
  return { preventDefault, ...render() };
}

beforeEach(() => {
  hooks.reset();
  order.mockReset();
  insert.mockReset();
});

describe("página de notas", () => {
  test("abre com as notas do professor e o caminho para a conta", () => {
    const html = renderToStaticMarkup(<NotesPage />);
    expect(html).toContain("Minhas notas");
    expect(html).toContain('href="/account"');
    expect(from).toHaveBeenCalledWith("notes");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("ao abrir as notas", () => {
  test("mostra as notas na ordem em que o banco devolve, a mais recente primeiro", async () => {
    order.mockResolvedValueOnce({ data: [newer, older], error: null });
    const { html } = await open();
    expect(html).toContain("Nota nova");
    expect(html).toContain("Nota antiga");
    expect(html.indexOf("Nota nova")).toBeLessThan(html.indexOf("Nota antiga"));
    expect(html).not.toContain('role="status"');
  });

  test("busca as notas uma vez só, mesmo quando a tela é desenhada de novo", async () => {
    await open();
    render();
    await settle();
    expect(order).toHaveBeenCalledTimes(1);
  });

  test("sem resposta do banco, mostra a lista vazia", async () => {
    order.mockResolvedValueOnce({ data: null, error: null });
    const { html } = await open();
    expect(html).toContain("<ul");
    expect(html).not.toContain("<li");
  });

  test("quando a busca falha, mostra o aviso", async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: "Sem conexão" } });
    const { html } = await open();
    expect(html).toContain('role="status"');
    expect(html).toContain("Sem conexão");
    expect(html).not.toContain("<li");
  });
});

describe("ao guardar uma nota", () => {
  test("o campo é obrigatório e mostra o que foi digitado", async () => {
    await open();
    type("Comprar giz");
    const { input } = render();
    expect(input.props.required).toBe(true);
    expect(input.props.value).toBe("Comprar giz");
  });

  test("grava o texto sem os espaços das pontas, limpa o campo e mostra a lista nova", async () => {
    order.mockResolvedValueOnce({ data: [older], error: null });
    await open();
    order.mockResolvedValueOnce({ data: [newer, older], error: null });
    type("  Nota nova  ");
    const { preventDefault, html, input } = await submit();
    expect(preventDefault).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("notes");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ body: "Nota nova" });
    expect(input.props.value).toBe("");
    expect(html.indexOf("Nota nova")).toBeLessThan(html.indexOf("Nota antiga"));
  });

  test("nota só com espaços não vai para o banco", async () => {
    await open();
    type("   ");
    const { preventDefault } = await submit();
    expect(preventDefault).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(order).toHaveBeenCalledTimes(1);
  });

  test("nota acima do limite não vai para o banco e o texto continua no campo", async () => {
    const tooLong = "a".repeat(2001);
    await open();
    type(tooLong);
    const { input } = await submit();
    expect(insert).not.toHaveBeenCalled();
    expect(input.props.value).toBe(tooLong);
  });

  test("quando a gravação falha, mostra o aviso e não perde o texto digitado", async () => {
    order.mockResolvedValueOnce({ data: [older], error: null });
    await open();
    insert.mockResolvedValueOnce({ error: { message: "Não foi possível guardar" } });
    type("Nota nova");
    const { html, input } = await submit();
    expect(html).toContain('role="status"');
    expect(html).toContain("Não foi possível guardar");
    expect(input.props.value).toBe("Nota nova");
    expect(html).toContain("Nota antiga");
    expect(order).toHaveBeenCalledTimes(1);
  });

  test("quando grava mas a lista não atualiza, avisa e mantém as notas que já estavam na tela", async () => {
    order.mockResolvedValueOnce({ data: [older], error: null });
    await open();
    order.mockResolvedValueOnce({ data: null, error: { message: "Sem conexão" } });
    type("Nota nova");
    const { html, input } = await submit();
    expect(insert).toHaveBeenCalledWith({ body: "Nota nova" });
    expect(input.props.value).toBe("");
    expect(html).toContain("Sem conexão");
    expect(html).toContain("Nota antiga");
  });
});
