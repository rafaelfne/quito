import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { SignInFormProps } from "./sign-in-form";

const replace = vi.fn();
const auth = { signInWithOtp: vi.fn(), verifyOtp: vi.fn() };
const captured: { props?: SignInFormProps } = {};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

const flow = vi.hoisted(() => ({
  submitEmail: vi.fn(),
  submitCode: vi.fn(),
  resendCode: vi.fn(),
  normalizeEmail: vi.fn(),
}));

vi.mock("@/lib/sign-in", async (original) => ({ ...(await original<typeof import("@/lib/sign-in")>()), ...flow }));

const google = vi.hoisted(() => ({ startGoogleSignIn: vi.fn() }));

vi.mock("@/lib/google-sign-in", async (original) => ({ ...(await original<typeof import("@/lib/google-sign-in")>()), ...google }));

const inbox = vi.hoisted(() => ({ askTestMail: vi.fn(), waitForNewTestCode: vi.fn() }));

vi.mock("@/lib/test-inbox", async (original) => ({ ...(await original<typeof import("@/lib/test-inbox")>()), ...inbox }));

const location = { origin: "https://quito.app", search: "" };

vi.stubGlobal("window", { location });

const { SignInScreen } = await import("./sign-in-screen");
const { initialSignIn } = await import("@/lib/sign-in");

function renderCapturing() {
  renderToStaticMarkup(<SignInScreen />);
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
  replace.mockReset();
  location.search = "";
  flow.submitEmail.mockReset().mockResolvedValue(initialSignIn);
  flow.submitCode.mockReset().mockResolvedValue(initialSignIn);
  flow.resendCode.mockReset().mockResolvedValue(initialSignIn);
  flow.normalizeEmail.mockReset().mockReturnValue(null);
  google.startGoogleSignIn.mockReset().mockResolvedValue({ ok: true });
  inbox.askTestMail.mockReset().mockResolvedValue(null);
  inbox.waitForNewTestCode.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tela de entrada", () => {
  test("ligada ao banco de ensaio, passa o link da caixa de e-mails de teste", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54621");
    expect(renderCapturing().props!.testInboxUrl).toBe("http://127.0.0.1:54624");
  });

  test("ligada a outro Supabase, não passa link nenhum", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
    expect(renderCapturing().props!.testInboxUrl).toBeNull();
  });


  describe("procurar o código no ensaio", () => {
    const sent = { ...initialSignIn, step: "code" as const, email: "ana@exemplo.com" };

    function typedEmailScreen() {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54621");
      flow.normalizeEmail.mockReturnValue("ana@exemplo.com");
    }

    test("depois de pedir, espera um e-mail mais novo que o anterior", async () => {
      flow.submitEmail.mockResolvedValue(sent);
      inbox.askTestMail.mockResolvedValue({ id: "velho", code: "654321" });
      typedEmailScreen();
      const { props } = renderCapturing();
      props!.onSubmitEmail();
      await settle();
      await settle();
      expect(inbox.askTestMail).toHaveBeenCalledWith("ana@exemplo.com");
      expect(inbox.waitForNewTestCode).toHaveBeenCalledWith("ana@exemplo.com", "velho");
    });

    test("sem e-mail anterior, espera o primeiro", async () => {
      flow.resendCode.mockResolvedValue(sent);
      typedEmailScreen();
      const { props } = renderCapturing();
      props!.onResend();
      await settle();
      await settle();
      expect(inbox.waitForNewTestCode).toHaveBeenCalledWith("ana@exemplo.com", null);
    });

    test("se o pedido falhar, não procura código", async () => {
      flow.submitEmail.mockResolvedValue({ ...sent, message: "Espere um minutinho" });
      typedEmailScreen();
      const { props } = renderCapturing();
      props!.onSubmitEmail();
      await settle();
      await settle();
      expect(inbox.waitForNewTestCode).not.toHaveBeenCalled();
    });

    test("fora do ensaio, não pergunta nada à caixa de teste", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefgh.supabase.co");
      flow.submitEmail.mockResolvedValue(sent);
      flow.normalizeEmail.mockReturnValue("ana@exemplo.com");
      const { props } = renderCapturing();
      props!.onSubmitEmail();
      await settle();
      await settle();
      expect(flow.submitEmail).toHaveBeenCalled();
      expect(inbox.askTestMail).not.toHaveBeenCalled();
      expect(inbox.waitForNewTestCode).not.toHaveBeenCalled();
    });
  });

  test("abre no passo do e-mail, sem senha", () => {
    const html = renderToStaticMarkup(<SignInScreen />);
    expect(html).toContain("Entrar no Quitô");
    expect(html).toContain("Receber código");
    expect(html).not.toContain("Senha");
  });

  test("mostra a chamada do Quitô acima do formulário", () => {
    const html = renderToStaticMarkup(<SignInScreen />);
    const hero = html.indexOf("Cobre sem constrangimento");
    expect(hero).toBeGreaterThan(-1);
    expect(hero).toBeLessThan(html.indexOf("<form"));
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
    expect(replace).not.toHaveBeenCalled();
  });

  test("depois de entrar, abre o app", async () => {
    flow.submitCode.mockResolvedValue({ ...initialSignIn, signedIn: true });
    const { props } = renderCapturing();
    props!.onSubmitCode();
    await settle();
    expect(replace).toHaveBeenCalledWith("/charges");
  });

  test("depois de entrar, volta para onde o professor ia", async () => {
    location.search = "?next=%2Falunos%2F42";
    flow.submitCode.mockResolvedValue({ ...initialSignIn, signedIn: true });
    const { props } = renderCapturing();
    props!.onSubmitCode();
    await settle();
    expect(replace).toHaveBeenCalledWith("/alunos/42");
  });

  test("o Google também volta para onde o professor ia", async () => {
    location.search = "?next=%2Falunos%2F42";
    const { realBrowser } = await import("@/lib/google-sign-in");
    const { props } = renderCapturing();
    props!.onGoogle();
    await settle();
    expect(google.startGoogleSignIn).toHaveBeenCalledWith(auth, "https://quito.app/auth/callback?next=%2Falunos%2F42", realBrowser);
  });

  test("o botão do Google leva para o Google e volta para a tela de retorno", async () => {
    const { realBrowser } = await import("@/lib/google-sign-in");
    const { props } = renderCapturing();
    props!.onGoogle();
    await settle();
    expect(google.startGoogleSignIn).toHaveBeenCalledWith(auth, "https://quito.app/auth/callback", realBrowser);
  });

  test("quando o Google não dá certo, continua na tela de entrada", async () => {
    google.startGoogleSignIn.mockResolvedValue({ ok: false, message: "Entrar com Google ainda não está ligado." });
    const { props } = renderCapturing();
    props!.onGoogle();
    await settle();
    expect(google.startGoogleSignIn).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
