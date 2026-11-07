import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialMessageSettings, messageSettingsMessages, type MessageSettingsDraft, type MessageSettingsState } from "@/lib/message-settings";
import { reminderMessages } from "@/lib/reminders";
import { MessageSettingsSection } from "./message-settings-section";

type AnyProps = Record<string, unknown> & { children?: ReactNode };

const ready: MessageSettingsState = { ...initialMessageSettings, status: "ready" };
const teacher = { pixKey: "", displayName: "" };

function handlers() {
  return { onMessageChange: vi.fn(), onMessageSubmit: vi.fn(), onMessageRetry: vi.fn() };
}

function withDraft(changes: Partial<MessageSettingsDraft>): MessageSettingsState {
  return { ...ready, draft: { ...ready.draft, ...changes } };
}

function render(state: MessageSettingsState, busy = false) {
  return renderToStaticMarkup(<MessageSettingsSection state={state} busy={busy} teacher={teacher} {...handlers()} />);
}

function expand(node: ReactNode): ReactElement<AnyProps>[] {
  const found: ReactElement<AnyProps>[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement<AnyProps>(child)) return;
    if (typeof child.type === "function") {
      found.push(...expand((child.type as (props: AnyProps) => ReactNode)(child.props)));
      return;
    }
    found.push(child);
    found.push(...expand(child.props.children));
  });
  return found;
}

function controls(state: MessageSettingsState) {
  const props = handlers();
  const all = expand(MessageSettingsSection({ state, busy: false, teacher, ...props }));
  return {
    props,
    inputs: all.filter((element) => element.type === "input"),
    forms: all.filter((element) => element.type === "form"),
    buttons: all.filter((element) => element.type === "button"),
  };
}

describe("mensagem de cobrança na tela", () => {
  test("enquanto carrega, avisa e não mostra o formulário", () => {
    const html = render(initialMessageSettings);
    expect(html).toContain("Carregando");
    expect(html).not.toContain("Guardar mensagem");
  });

  test("oferece os três tons, com o Próximo marcado de partida", () => {
    const html = render(ready);
    for (const label of ["Próximo", "Direto", "Formal"]) expect(html).toContain(label);
    expect(html.match(/type="radio"[^>]*checked=""/g)).toHaveLength(1);
    expect(html).toMatch(/type="radio"[^>]*checked=""[^>]*\/>\s*<span[^>]*><span[^>]*>Próximo/);
  });

  test("o exemplo acompanha o tom e os ajustes, com o total em negrito", () => {
    expect(render(ready)).toContain("Oi, Carla! Tudo bem?");
    expect(render(ready)).toContain("<strong>Total: R$ 405,00</strong>");
    expect(render(withDraft({ tone: "direct" }))).toContain("<strong>R$ 405,00</strong>");
    const adjusted = render(withDraft({ tone: "formal", greeting: "Bom dia,", thanks: "Um abraço", signature: "Tio João", footer: true }));
    expect(adjusted).toContain("Bom dia, Carla.");
    expect(adjusted).toMatch(/Um abraço,<\/span><\/p><p[^>]*><span>Tio João</);
  });

  test("diz o que fica quando o campo está em branco, conforme o tom", () => {
    const html = render(withDraft({ tone: "formal" }));
    expect(html).toContain("Em branco, fica &quot;Olá&quot;");
    expect(html).toContain("Em branco, fica &quot;Atenciosamente&quot;");
    expect(html).toContain("Em branco, fica &quot;Professor João&quot;");
  });

  test("escolher um tom avisa qual foi", () => {
    const { inputs, props } = controls(ready);
    const radios = inputs.filter((input) => input.props.type === "radio");
    (radios[2].props.onChange as () => void)();
    expect(props.onMessageChange).toHaveBeenCalledWith({ tone: "formal" });
  });

  test("digitar avisa o campo certo", () => {
    const { inputs, props } = controls(ready);
    const fields = inputs.filter((input) => input.props.type === "text");
    (fields[0].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "Bom dia" } });
    expect(props.onMessageChange).toHaveBeenCalledWith({ greeting: "Bom dia" });
    (fields[1].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "Obrigada" } });
    expect(props.onMessageChange).toHaveBeenCalledWith({ thanks: "Obrigada" });
    (fields[2].props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "Tio João" } });
    expect(props.onMessageChange).toHaveBeenCalledWith({ signature: "Tio João" });
  });

  test("a linha do Quitô vem ligada e some do exemplo quando desligada", () => {
    const on = render(ready);
    expect(on).toMatch(/type="checkbox"[^>]*checked=""/);
    expect(on).toContain("Terminar com &quot;Conta feita pelo Quitô&quot;");
    expect(on).toMatch(/<span>Conta feita pelo Quitô<\/span>/);
    const off = render(withDraft({ footer: false }));
    expect(off).not.toMatch(/type="checkbox"[^>]*checked=""/);
    expect(off).not.toMatch(/<span>Conta feita pelo Quitô<\/span>/);
  });

  test("ligar e desligar a linha do Quitô avisa a escolha", () => {
    const { inputs, props } = controls(ready);
    const checkbox = inputs.find((input) => input.props.type === "checkbox");
    (checkbox?.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
    expect(props.onMessageChange).toHaveBeenCalledWith({ footer: false });
  });

  test("guardar não recarrega a página", () => {
    const { forms, props } = controls(ready);
    const preventDefault = vi.fn();
    (forms[0].props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(props.onMessageSubmit).toHaveBeenCalledOnce();
  });

  test("aponta o erro no campo, mostra o aviso e a falha ao guardar", () => {
    const html = render({ ...ready, errors: { greeting: messageSettingsMessages.greetingTooLong }, notice: messageSettingsMessages.saved, message: messageSettingsMessages.saveFailed });
    expect(html).toContain('id="message-greeting-error"');
    expect(html).toContain('aria-describedby="message-greeting-error"');
    expect(html).toContain(messageSettingsMessages.greetingTooLong);
    expect(html).toContain(messageSettingsMessages.saved);
    expect(html).toContain(messageSettingsMessages.saveFailed);
  });

  test("o botão diz Guardar mensagem", () => {
    expect(render(ready)).toContain("Guardar mensagem");
  });

  test("enquanto guarda, avisa no botão", () => {
    expect(render(ready, true)).toContain("Guardando...");
  });

  test("se não abriu, deixa tentar de novo", () => {
    const failed: MessageSettingsState = { ...initialMessageSettings, status: "failed" };
    const { buttons, forms, props } = controls(failed);
    expect(render(failed)).toContain(messageSettingsMessages.loadFailed);
    expect(forms).toHaveLength(0);
    (buttons[0].props.onClick as () => void)();
    expect(props.onMessageRetry).toHaveBeenCalledOnce();
  });
});

describe("lembretes na tela", () => {
  test("de partida, dois lembretes com o dia e o exemplo de cada um", () => {
    const html = render(ready);
    expect(html).toContain("Lembretes");
    expect(html).toContain("2 lembretes");
    expect(html).toContain("Lembrete 1 de 2: quantos dias depois do envio");
    expect(html).toContain("Lembrete 2 de 2: quantos dias depois do envio");
    expect(html).toContain('value="3"');
    expect(html).toContain('value="7"');
    expect(html).toContain("Passando para lembrar");
    expect(html).toContain("Ainda não encontrei o pagamento");
  });

  test("sem lembretes, não mostra dias nem exemplo", () => {
    const html = render(withDraft({ reminderDays: [] }));
    expect(html).toContain("Nenhum lembrete");
    expect(html).not.toContain("quantos dias depois do envio");
    expect(html).not.toContain("Passando para lembrar");
  });

  test("o exemplo do lembrete segue o tom escolhido", () => {
    expect(render(withDraft({ tone: "direct", reminderDays: ["3", "7", "14"] }))).toContain("Terceiro lembrete: cobrança");
  });

  test("mostra o erro dos dias", () => {
    const html = render({ ...withDraft({ reminderDays: ["7", "3"] }), errors: { reminderDays: reminderMessages.invalidDays } });
    expect(html).toContain(reminderMessages.invalidDays);
    expect(html).toContain('aria-describedby="reminder-days-error"');
  });

  test("mudar quantos e o dia de um lembrete avisa a página", () => {
    const props = handlers();
    const elements = expand(MessageSettingsSection({ state: ready, busy: false, teacher, ...props }));
    const select = elements.find((element) => element.type === "select");
    (select?.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "3" } });
    expect(props.onMessageChange).toHaveBeenLastCalledWith({ reminderDays: ["3", "7", "14"] });
    const dayInputs = elements.filter((element) => element.type === "input" && element.props.inputMode === "numeric");
    (dayInputs[1]?.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "10" } });
    expect(props.onMessageChange).toHaveBeenLastCalledWith({ reminderDays: ["3", "10"] });
  });
});
