import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { guardianDueDaysMessages, initialGuardianDueDays, type GuardianDueDaysState } from "@/lib/guardian-due-days";
import { initialPaymentSettings, paymentSettingsMessages, type PaymentSettingsDraft, type PaymentSettingsState } from "@/lib/payment-settings";
import { PaymentSettingsView } from "./payment-view";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const today = "2026-11-04";
const ready: PaymentSettingsState = { ...initialPaymentSettings, status: "ready" };
const lockedForm = '<fieldset class="flex flex-col gap-4" disabled';
const anaPhone = "11987654321";

const guardiansReady: GuardianDueDaysState = {
  ...initialGuardianDueDays,
  status: "ready",
  defaultDueDay: 5,
  groups: [{ phone: anaPhone, guardianName: "Ana Lima", studentNames: ["Pedro Lima", "Lia Lima"], dueDay: "10" }],
};

function withDraft(changes: Partial<PaymentSettingsDraft>): PaymentSettingsState {
  return { ...ready, draft: { ...ready.draft, ...changes } };
}

function handlers() {
  return {
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onRetry: vi.fn(),
    onGuardianDueChange: vi.fn(),
    onGuardianDueSubmit: vi.fn(),
    onGuardianDueRetry: vi.fn(),
  };
}

function render(state: PaymentSettingsState, guardianDueDays: GuardianDueDaysState = guardiansReady, busy = false, busyPhone: string | null = null) {
  return renderToStaticMarkup(
    <PaymentSettingsView state={state} guardianDueDays={guardianDueDays} busy={busy} busyPhone={busyPhone} today={today} {...handlers()} />,
  );
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

function controls(state: PaymentSettingsState, guardianDueDays: GuardianDueDaysState = guardiansReady) {
  const props = handlers();
  const all = expand(PaymentSettingsView({ state, guardianDueDays, busy: false, busyPhone: null, today, ...props }));
  return {
    props,
    inputs: all.filter((element) => element.type === "input"),
    forms: all.filter((element) => element.type === "form"),
    buttons: all.filter((element) => element.type === "button"),
  };
}

describe("tela de recebimento", () => {
  test("enquanto carrega, avisa e não deixa guardar ainda", () => {
    const html = render(initialPaymentSettings);
    expect(html).toContain("Carregando");
    expect(html).toContain(lockedForm);
  });

  test("pede a chave Pix, o nome e o dia padrão, com o dia 5 de partida", () => {
    const html = render(ready);
    expect(html).not.toContain(lockedForm);
    expect(html).toContain("Sua chave Pix");
    expect(html).toContain("Nome que aparece para o responsável");
    expect(html).toContain("Dia de vencimento padrão");
    expect(html).toContain('value="5"');
  });

  test("explica o que acontece em mês mais curto e mostra o próximo vencimento", () => {
    const html = render(withDraft({ dueDay: "31" }));
    expect(html).toContain("o vencimento cai no último dia do mês");
    expect(html).toContain("Próximo vencimento: 30 de novembro.");
  });

  test("com o dia padrão errado, não mostra próximo vencimento nesse formulário", () => {
    const emptyGuardians: GuardianDueDaysState = { ...initialGuardianDueDays, status: "ready", groups: [], defaultDueDay: 5 };
    expect(render(withDraft({ dueDay: "40" }), emptyGuardians)).not.toContain("Próximo vencimento");
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
    const html = render(ready, guardiansReady, true);
    expect(html).toContain("Guardando...");
    expect(html).toContain(lockedForm);
  });

  test("se não abriu os dados, não mostra o formulário e deixa tentar de novo", () => {
    const failed: PaymentSettingsState = { ...initialPaymentSettings, status: "failed" };
    const { forms, buttons, props } = controls(failed);
    expect(render(failed)).toContain(paymentSettingsMessages.loadFailed);
    expect(forms).toHaveLength(1);
    (buttons[0].props.onClick as () => void)();
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
    const { forms, props } = controls(ready);
    const preventDefault = vi.fn();
    (forms[0].props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });
});

describe("vencimento por responsável na tela", () => {
  test("lista o responsável, os irmãos e o dia trocado", () => {
    const html = render(ready);
    expect(html).toContain("Vencimento por responsável");
    expect(html).toContain("Ana Lima");
    expect(html).toContain("(11) 98765-4321");
    expect(html).toContain("Alunos: Pedro Lima e Lia Lima.");
    expect(html).toContain('value="10"');
    expect(html).toContain("Próximo vencimento: 10 de novembro.");
    expect(html).toContain("Vale para todos os irmãos deste responsável.");
  });

  test("sem alunos, explica o que falta", () => {
    const empty: GuardianDueDaysState = { ...initialGuardianDueDays, status: "ready", groups: [], defaultDueDay: 5 };
    expect(render(ready, empty)).toContain(guardianDueDaysMessages.empty);
  });

  test("se a lista não abriu, deixa tentar de novo", () => {
    const failed: GuardianDueDaysState = { ...initialGuardianDueDays, status: "failed" };
    const { buttons, props } = controls(ready, failed);
    expect(render(ready, failed)).toContain(guardianDueDaysMessages.loadFailed);
    const retry = buttons.find((button) => button.props.children === "Tentar de novo");
    (retry!.props.onClick as () => void)();
    expect(props.onGuardianDueRetry).toHaveBeenCalledOnce();
  });

  test("digitar e guardar o vencimento do responsável", () => {
    const { inputs, forms, props } = controls(ready);
    const guardianInput = inputs[3];
    (guardianInput.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "15" } });
    expect(props.onGuardianDueChange).toHaveBeenCalledWith(anaPhone, "15");
    const preventDefault = vi.fn();
    (forms[1].props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(props.onGuardianDueSubmit).toHaveBeenCalledWith(anaPhone);
  });

  test("mostra aviso e erro do responsável", () => {
    const withNotice: GuardianDueDaysState = {
      ...guardiansReady,
      notices: { [anaPhone]: guardianDueDaysMessages.saved },
      errors: { [anaPhone]: guardianDueDaysMessages.dueDayInvalid },
    };
    const html = render(ready, withNotice);
    expect(html).toContain(guardianDueDaysMessages.saved);
    expect(html).toContain(guardianDueDaysMessages.dueDayInvalid);
  });

  test("mostra a falha ao guardar o vencimento do responsável", () => {
    const withMessage: GuardianDueDaysState = { ...guardiansReady, messages: { [anaPhone]: guardianDueDaysMessages.saveFailed } };
    expect(render(ready, withMessage)).toContain(guardianDueDaysMessages.saveFailed);
  });

  test("enquanto a lista carrega, avisa e não mostra os responsáveis", () => {
    const html = render(ready, initialGuardianDueDays);
    expect(html).toContain("Carregando");
    expect(html).not.toContain("Guardar vencimento");
  });

  test("enquanto guarda o vencimento, avisa no botão daquele responsável", () => {
    expect(render(ready, guardiansReady, false, anaPhone)).toContain("Guardando...");
    expect(render(ready, guardiansReady, false, "2134567890")).not.toContain("Guardando...");
  });

  test("com o dia do responsável errado, não mostra próximo vencimento", () => {
    const wrongDay: GuardianDueDaysState = { ...guardiansReady, groups: [{ ...guardiansReady.groups[0], dueDay: "40" }] };
    expect(render(withDraft({ dueDay: "40" }), wrongDay)).not.toContain("Próximo vencimento");
  });
});
