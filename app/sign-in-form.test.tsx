import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialSignIn, type SignInState } from "@/lib/sign-in";
import { SignInForm, type SignInFormProps } from "./sign-in-form";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

function props(state: SignInState, busy = false): SignInFormProps {
  return {
    state,
    busy,
    onEmailChange: vi.fn(),
    onCodeChange: vi.fn(),
    onSubmitEmail: vi.fn(),
    onSubmitCode: vi.fn(),
    onResend: vi.fn(),
    onEditEmail: vi.fn(),
  };
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

function tree(formProps: SignInFormProps) {
  return elements(SignInForm(formProps));
}

function byType(all: ReactElement<AnyProps>[], type: string) {
  return all.filter((element) => element.type === type);
}

function submit(all: ReactElement<AnyProps>[]) {
  const form = byType(all, "form")[0];
  const preventDefault = vi.fn();
  (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
  return preventDefault;
}

function change(input: ReactElement<AnyProps>, value: string) {
  (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}

const codeStep: SignInState = { ...initialSignIn, step: "code", email: "ana@exemplo.com", notice: "Enviamos um código" };

describe("SignInForm no passo do e-mail", () => {
  test("pede só o e-mail, sem senha nem criar conta", () => {
    const html = renderToStaticMarkup(<SignInForm {...props(initialSignIn)} />);
    expect(html).toContain("Entrar no Quitô");
    expect(html).toContain('type="email"');
    expect(html).toContain("Receber código");
    expect(html).not.toContain("password");
    expect(html).not.toContain("Criar conta");
  });

  test("enviar pede o código", () => {
    const formProps = props(initialSignIn);
    const preventDefault = submit(tree(formProps));
    expect(preventDefault).toHaveBeenCalled();
    expect(formProps.onSubmitEmail).toHaveBeenCalled();
    expect(formProps.onSubmitCode).not.toHaveBeenCalled();
  });

  test("digitar atualiza o e-mail", () => {
    const formProps = props(initialSignIn);
    change(byType(tree(formProps), "input")[0], "ana@exemplo.com");
    expect(formProps.onEmailChange).toHaveBeenCalledWith("ana@exemplo.com");
  });

  test("mostra que está enviando e trava o botão", () => {
    const html = renderToStaticMarkup(<SignInForm {...props(initialSignIn, true)} />);
    expect(html).toContain("Enviando...");
    expect(html).toContain("disabled");
  });

  test("mostra a mensagem de erro", () => {
    const html = renderToStaticMarkup(<SignInForm {...props({ ...initialSignIn, message: "Confira o e-mail" })} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Confira o e-mail");
  });
});

describe("SignInForm no passo do código", () => {
  test("mostra o aviso e o campo de código pronto para o preenchimento automático", () => {
    const html = renderToStaticMarkup(<SignInForm {...props(codeStep)} />);
    expect(html).toContain("Digite o código");
    expect(html).toContain("Enviamos um código");
    expect(html).toContain('autoComplete="one-time-code"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('maxLength="6"');
  });

  test("só libera Entrar com os 6 números", () => {
    const incomplete = byType(tree(props({ ...codeStep, code: "123" })), "button")[0];
    const complete = byType(tree(props({ ...codeStep, code: "123456" })), "button")[0];
    expect(incomplete.props.disabled).toBe(true);
    expect(complete.props.disabled).toBe(false);
  });

  test("mostra que está conferindo", () => {
    const html = renderToStaticMarkup(<SignInForm {...props({ ...codeStep, code: "123456" }, true)} />);
    expect(html).toContain("Conferindo...");
  });

  test("enviar confere o código", () => {
    const formProps = props({ ...codeStep, code: "123456" });
    submit(tree(formProps));
    expect(formProps.onSubmitCode).toHaveBeenCalled();
    expect(formProps.onSubmitEmail).not.toHaveBeenCalled();
  });

  test("digitar atualiza o código", () => {
    const formProps = props(codeStep);
    change(byType(tree(formProps), "input")[0], "12");
    expect(formProps.onCodeChange).toHaveBeenCalledWith("12");
  });

  test("tem botões para enviar outro código e trocar o e-mail", () => {
    const formProps = props(codeStep);
    const [, resend, edit] = byType(tree(formProps), "button");
    expect(resend.props.children).toBe("Enviar outro código");
    expect(edit.props.children).toBe("Trocar e-mail");
    (resend.props.onClick as () => void)();
    (edit.props.onClick as () => void)();
    expect(formProps.onResend).toHaveBeenCalled();
    expect(formProps.onEditEmail).toHaveBeenCalled();
  });

  test("sem aviso, não mostra parágrafo vazio", () => {
    const html = renderToStaticMarkup(<SignInForm {...props({ ...codeStep, notice: null })} />);
    expect(html).not.toContain("Enviamos um código");
  });
});
