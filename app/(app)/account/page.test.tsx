import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AccountResult } from "@/lib/account";

const auth = { signOut: vi.fn() };
const loadAccount = vi.hoisted(() => vi.fn());
const captured: { account?: AccountResult | null; onRetry?: () => void; onSignOutError?: (message: string) => void } = {};
const state = vi.hoisted(() => ({ setters: [] as ReturnType<typeof vi.fn>[] }));

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useEffect: (effect: () => void) => effect(),
    useState: (initial: unknown) => {
      const setter = vi.fn();
      state.setters.push(setter);
      return [initial, setter];
    },
  };
});
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("@/lib/account", async (original) => ({ ...(await original<typeof import("@/lib/account")>()), loadAccount }));
vi.mock("./account-view", () => ({
  AccountView: (props: { account: AccountResult | null; onRetry: () => void; onSignOutError: (message: string) => void }) => {
    captured.account = props.account;
    captured.onRetry = props.onRetry;
    captured.onSignOutError = props.onSignOutError;
    return <p>conta</p>;
  },
}));

const { default: AccountPage } = await import("./page");

const loaded: AccountResult = { ok: true, email: "ana@escola.com", method: "google" };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  state.setters.length = 0;
  loadAccount.mockReset().mockResolvedValue(loaded);
});

describe("página de conta", () => {
  test("abre carregando e busca os dados da conta", async () => {
    renderToStaticMarkup(<AccountPage />);
    expect(captured.account).toBeNull();
    expect(loadAccount).toHaveBeenCalledWith(auth);
    await settle();
    expect(state.setters[0]).toHaveBeenCalledWith(loaded);
  });

  test("tentar de novo volta a carregar e busca outra vez", async () => {
    renderToStaticMarkup(<AccountPage />);
    captured.onRetry!();
    expect(state.setters[0]).toHaveBeenCalledWith(null);
    expect(loadAccount).toHaveBeenCalledTimes(2);
    await settle();
  });

  test("guarda o aviso de quando não deu para sair", () => {
    renderToStaticMarkup(<AccountPage />);
    captured.onSignOutError!("Não saiu.");
    expect(state.setters[1]).toHaveBeenCalledWith("Não saiu.");
  });
});
