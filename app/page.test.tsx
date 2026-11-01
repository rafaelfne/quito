import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const replace = vi.fn();
const auth = { getSession: vi.fn() };
const session = vi.hoisted(() => ({ enterIfSignedIn: vi.fn() }));
const state = vi.hoisted(() => ({ checking: true, setChecking: vi.fn() }));

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void) => effect(),
  useState: () => [state.checking, state.setChecking],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("@/lib/session", async (original) => ({ ...(await original<typeof import("@/lib/session")>()), ...session }));
vi.mock("@/app/sign-in-screen", () => ({ SignInScreen: () => <p>tela de entrada</p> }));

vi.stubGlobal("window", { location: { search: "?next=%2Falunos" } });

const { default: Home } = await import("./page");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  state.checking = true;
  state.setChecking.mockReset();
  session.enterIfSignedIn.mockReset().mockResolvedValue(false);
});

describe("abertura do app", () => {
  test("não mostra a entrada enquanto confere se o professor já entrou", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Abrindo o Quitô...");
    expect(html).not.toContain("tela de entrada");
    expect(session.enterIfSignedIn).toHaveBeenCalledWith(auth, "?next=%2Falunos", replace);
  });

  test("quem não entrou passa a ver a entrada", async () => {
    renderToStaticMarkup(<Home />);
    await settle();
    expect(state.setChecking).toHaveBeenCalledWith(false);
    state.checking = false;
    expect(renderToStaticMarkup(<Home />)).toContain("tela de entrada");
  });

  test("quem já entrou segue sem ver a entrada", async () => {
    session.enterIfSignedIn.mockResolvedValue(true);
    renderToStaticMarkup(<Home />);
    await settle();
    expect(state.setChecking).not.toHaveBeenCalled();
  });
});
