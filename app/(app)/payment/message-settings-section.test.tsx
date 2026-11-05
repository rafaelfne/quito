import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { initialMessageSettings, messageSettingsMessages, type MessageSettingsDraft, type MessageSettingsState } from "@/lib/message-settings";
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
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toMatch(/checked=""[^>]*\/>\s*<span[^>]*><span[^>]*>Próximo/);
  });

  test("o exemplo acompanha o tom e os ajustes, com o total em negrito", () => {
    expect(render(ready)).toContain("Oi, Carla! Tudo bem?");
    expect(render(ready)).toContain("<strong>Total: R$ 405,00</strong>");
    expect(render(withDraft({ tone: "direct" }))).toContain("<strong>R$ 405,00</strong>");
    const adjusted = render(withDraft({ tone: "formal", greeting: "Bom dia,", thanks: "Um abraço", signature: "Tio João" }));
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
