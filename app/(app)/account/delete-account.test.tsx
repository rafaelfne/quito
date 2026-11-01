import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const client = vi.hoisted(() => ({ rpc: vi.fn() }));
const deleteAccount = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ setters: [] as ReturnType<typeof vi.fn>[] }));
const captured: { email?: string; onOpen?: () => void; onCancel?: () => void; onConfirm?: () => void } = {};

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) => {
      const setter = vi.fn();
      state.setters.push(setter);
      return [initial, setter];
    },
  };
});
vi.mock("@/lib/supabase", () => ({ supabase: client }));
vi.mock("@/lib/account", () => ({ deleteAccount }));
vi.mock("./delete-account-view", () => ({
  DeleteAccountView: (props: typeof captured) => {
    Object.assign(captured, props);
    return <p>apagar</p>;
  },
}));

const { DeleteAccount } = await import("./delete-account");

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setup() {
  renderToStaticMarkup(<DeleteAccount email="ana@escola.com" />);
  const [setStep, setMessage] = state.setters;
  return { setStep, setMessage };
}

beforeEach(() => {
  state.setters.length = 0;
  deleteAccount.mockReset();
});

describe("DeleteAccount", () => {
  test("mostra a conta de quem está aqui", () => {
    setup();
    expect(captured.email).toBe("ana@escola.com");
  });

  test("abrir só pede a confirmação, sem apagar nada", () => {
    const { setStep } = setup();
    captured.onOpen!();
    expect(setStep).toHaveBeenCalledWith("confirming");
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  test("cancelar fecha e limpa o aviso, sem apagar nada", () => {
    const { setStep, setMessage } = setup();
    captured.onCancel!();
    expect(setStep).toHaveBeenCalledWith("closed");
    expect(setMessage).toHaveBeenCalledWith(null);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  test("confirmar apaga e continua travado até voltar para a entrada", async () => {
    deleteAccount.mockResolvedValue({ ok: true });
    const { setStep } = setup();
    captured.onConfirm!();
    await settle();
    expect(deleteAccount).toHaveBeenCalledWith(client);
    expect(setStep.mock.calls).toEqual([["deleting"]]);
  });

  test("quando falha, volta para a confirmação com o aviso", async () => {
    deleteAccount.mockResolvedValue({ ok: false, message: "Não apagou." });
    const { setStep, setMessage } = setup();
    captured.onConfirm!();
    await settle();
    expect(setMessage).toHaveBeenLastCalledWith("Não apagou.");
    expect(setStep).toHaveBeenLastCalledWith("confirming");
  });
});
