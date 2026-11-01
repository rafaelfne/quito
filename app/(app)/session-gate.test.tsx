import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GateStatus } from "./session-gate-view";

const replace = vi.fn();
const auth = { getSession: vi.fn(), onAuthStateChange: vi.fn() };
const session = vi.hoisted(() => ({ guardPage: vi.fn(), watchSignOut: vi.fn() }));
const captured: { onRetry?: () => void; status?: GateStatus } = {};
const cleanups: unknown[] = [];

vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => unknown) => cleanups.push(effect()),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("@/lib/session", async (original) => ({ ...(await original<typeof import("@/lib/session")>()), ...session }));
vi.mock("./session-gate-view", () => ({
  SessionGateView: (props: { status: GateStatus; onRetry: () => void }) => {
    captured.onRetry = props.onRetry;
    captured.status = props.status;
    return <p>porta</p>;
  },
}));

vi.stubGlobal("window", { location: { pathname: "/alunos/42", search: "?mes=3", hash: "#aula" } });

const { SessionGate } = await import("./session-gate");
const { default: SignedInLayout } = await import("./layout");

function render() {
  return renderToStaticMarkup(<SessionGate>dados</SessionGate>);
}

beforeEach(() => {
  replace.mockReset();
  cleanups.length = 0;
  session.guardPage.mockReset().mockResolvedValue("signed-in");
  session.watchSignOut.mockReset().mockReturnValue("parar");
});

describe("SessionGate", () => {
  test("começa conferindo o caminho completo da página aberta", () => {
    render();
    expect(captured.status).toBe("checking");
    expect(session.guardPage).toHaveBeenCalledWith(auth, "/alunos/42?mes=3#aula", replace);
  });

  test("quando a sessão termina, volta para a entrada sem guardar a página", () => {
    render();
    const [watchedAuth, onSignedOut] = session.watchSignOut.mock.calls[0];
    expect(watchedAuth).toBe(auth);
    onSignedOut();
    expect(replace).toHaveBeenCalledWith("/");
    expect(cleanups).toContain("parar");
  });

  test("tentar de novo confere a sessão outra vez", () => {
    render();
    captured.onRetry!();
    expect(session.guardPage).toHaveBeenCalledTimes(2);
  });
});

describe("área de quem entrou", () => {
  test("toda página dela passa pela porta", () => {
    expect(renderToStaticMarkup(<SignedInLayout>dados</SignedInLayout>)).toBe("<p>porta</p>");
  });
});
