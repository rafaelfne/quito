import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialPaymentSettings, paymentSettingsMessages, type PaymentSettingsDraft, type PaymentSettingsState } from "@/lib/payment-settings";
import { PaymentSettingsView } from "./payment-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const today = "2026-11-04";
const ready: PaymentSettingsState = { ...initialPaymentSettings, status: "ready" };
const lockedForm = '<fieldset class="flex flex-col gap-4" disabled';

function withDraft(changes: Partial<PaymentSettingsDraft>): PaymentSettingsState {
  return { ...ready, draft: { ...ready.draft, ...changes } };
}

function handlers() {
  return { onChange: vi.fn(), onSubmit: vi.fn(), onRetry: vi.fn() };
}

function render(state: PaymentSettingsState, busy = false) {
  return renderToStaticMarkup(<PaymentSettingsView state={state} busy={busy} today={today} {...handlers()} />);
}

function expand(node: ReactNode): ReactElement<AnyProps>[] {
  const found: ReactElement<AnyProps>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<AnyProps>(child)) return;
    if (typeof child.type === "function" && child.type.name !== "LinkComponent") {
      found.push(...expand((child.type as (props: AnyProps) => ReactNode)(child.props)));
      return;
    }
    found.push(child);
    found.push(...expand(child.props.children));
  });
  return found;
}

function controls(state: PaymentSettingsState) {
  const props = handlers();
  const all = expand(PaymentSettingsView({ state, busy: false, today, ...props }));
  return {
    props,
    inputs: all.filter((element) => element.type === "input"),
    form: all.find((element) => element.type === "form"),
    button: all.find((element) => element.type === "button"),
  };
}

describe("tela de recebimento", () => {
  test("enquanto carrega, avisa e não deixa guardar ainda", () => {
    const html = render(initialPaymentSettings);
    expect(html).toContain("Carregando");
    expect(html).toContain(lockedForm);
  });

  test("pede a chave Pix, o nome e o dia, com o dia 5 de partida", () => {
    const html = render(ready);
    expect(html).not.toContain("Carregando");
    expect(html).not.toContain(lockedForm);
    expect(html).toContain("Sua chave Pix");
    expect(html).toContain("Nome que aparece para o responsável");
    expect(html).toContain("Dia de vencimento");
    expect(html).toContain('value="5"');
  });

  test("explica o que acontece em mês mais curto e mostra o próximo vencimento", () => {
    const html = render(withDraft({ dueDay: "31" }));
    expect(html).toContain("o vencimento cai no último dia do mês");
    expect(html).toContain("Próximo vencimento: 30 de novembro.");
  });

  test("com o dia errado, não mostra próximo vencimento", () => {
    expect(render(withDraft({ dueDay: "40" }))).not.toContain("Próximo vencimento");
  });

  test("tem os caminhos para as outras telas", () => {
    const html = render(ready);
    for (const path of ["/students", "/lessons", "/closing", "/rules", "/account"]) expect(html).toContain(`href="${path}"`);
  });

  test("aponta o erro no campo certo", () => {
    const html = render({ ...ready, errors: { pixKey: paymentSettingsMessages.pixKeyInvalid } });
    expect(html).toContain('id="payment-pix-key-error"');
    expect(html).toContain('aria-describedby="payment-pix-key-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Confira a chave Pix");
  });

  test("mostra o aviso de guardado e a falha ao guardar", () => {
    expect(render({ ...ready, notice: paymentSettingsMessages.saved })).toContain(paymentSettingsMessages.saved);
    expect(render({ ...ready, message: paymentSettingsMessages.saveFailed })).toContain(paymentSettingsMessages.saveFailed);
  });

  test("enquanto guarda, trava o formulário e avisa no botão", () => {
    const html = render(ready, true);
    expect(html).toContain("Guardando...");
    expect(html).toContain(lockedForm);
  });

  test("se não abriu os dados, não mostra o formulário e deixa tentar de novo", () => {
    const failed: PaymentSettingsState = { ...initialPaymentSettings, status: "failed" };
    const { form, button, props } = controls(failed);
    expect(render(failed)).toContain(paymentSettingsMessages.loadFailed);
    expect(form).toBeUndefined();
    (button!.props.onClick as () => void)();
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  test("digitar avisa o campo certo", () => {
    const { inputs, props } = controls(ready);
    (inputs[0].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "joao@email.com" } });
    expect(props.onChange).toHaveBeenCalledWith("pixKey", "joao@email.com");
    (inputs[2].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "20" } });
    expect(props.onChange).toHaveBeenCalledWith("dueDay", "20");
  });

  test("guardar não recarrega a página e envia o formulário", () => {
    const { form, props } = controls(ready);
    const preventDefault = vi.fn();
    (form!.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });
});
