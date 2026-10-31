import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SignInFormProps } from "./sign-in-form";

const push = vi.fn();
const auth = { signInWithOtp: vi.fn(), verifyOtp: vi.fn() };
const captured: { props?: SignInFormProps } = {};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

const flow = vi.hoisted(() => ({
  submitEmail: vi.fn(),
  submitCode: vi.fn(),
  resendCode: vi.fn(),
}));

vi.mock("@/lib/sign-in", async (original) => ({ ...(await original<typeof import("@/lib/sign-in")>()), ...flow }));

const { default: Home } = await import("./page");
const { initialSignIn } = await import("@/lib/sign-in");

function renderCapturing() {
  renderToStaticMarkup(<Home />);
  return captured;
}

vi.mock("./sign-in-form", async (original) => {
  const real = await original<typeof import("./sign-in-form")>();
  return {
    SignInForm: (props: SignInFormProps) => {
      captured.props = props;
      return real.SignInForm(props);
    },
  };
});

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  push.mockReset();
  flow.submitEmail.mockReset().mockResolvedValue(initialSignIn);
  flow.submitCode.mockReset().mockResolvedValue(initialSignIn);
  flow.resendCode.mockReset().mockResolvedValue(initialSignIn);
});

describe("tela de entrada", () => {
  test("abre no passo do e-mail, sem senha", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Entrar no Quitô");
    expect(html).toContain("Receber código");
    expect(html).not.toContain("Senha");
  });

  test("liga cada botão ao passo certo, usando o login do Supabase", async () => {
    const { props } = renderCapturing();
    props!.onSubmitEmail();
    props!.onResend();
    props!.onSubmitCode();
    props!.onEmailChange("ana@exemplo.com");
    props!.onCodeChange("12a3");
    props!.onEditEmail();
    await settle();
    expect(flow.submitEmail).toHaveBeenCalledWith(auth, initialSignIn);
    expect(flow.resendCode).toHaveBeenCalledWith(auth, initialSignIn);
    expect(flow.submitCode).toHaveBeenCalledWith(auth, initialSignIn);
    expect(push).not.toHaveBeenCalled();
  });

  test("depois de entrar, abre o app", async () => {
    flow.submitCode.mockResolvedValue({ ...initialSignIn, signedIn: true });
    const { props } = renderCapturing();
    props!.onSubmitCode();
    await settle();
    expect(push).toHaveBeenCalledWith("/notes");
  });
});
