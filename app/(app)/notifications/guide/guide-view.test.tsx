import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { androidGuideMessages as messages, type InstallStatus, type TestStatus } from "@/lib/activation-guide";
import type { PushDevice, PushStatus } from "@/lib/push-subscription";
import { GuideView, type GuideViewProps } from "./guide-view";

const noop = vi.fn();

function render(overrides: Partial<GuideViewProps> = {}) {
  const props: GuideViewProps = { device: "android" as PushDevice, install: "manual" as InstallStatus, push: "off" as PushStatus, test: "idle" as TestStatus, enabling: false, onInstall: noop, onEnable: noop, onRecheck: noop, onSendTest: noop, onArrived: noop, onNotArrived: noop, ...overrides };
  return renderToStaticMarkup(<GuideView {...props} />);
}

function textOf(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");
}

describe("guia de ativação no Android", () => {
  test("mostra os três passos em ordem: instalar, liberar e testar", () => {
    const html = render();
    expect(html).toContain(messages.title);
    expect(html).toContain(messages.intro);
    const order = [messages.install.title, messages.notifications.title, messages.test.title].map((title) => html.indexOf(title));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order[0]).toBeGreaterThan(-1);
  });

  test("sem o botão do Chrome, ensina a instalar pelo menu, com imagens", () => {
    const html = render();
    for (const step of messages.install.manual) expect(html).toContain(step);
    expect(html).toContain('aria-label="Chrome com os três pontinhos e a opção Instalar app destacadas"');
    expect(html).toContain('aria-label="Pergunta do Chrome para instalar o Quitô, com o botão Instalar destacado"');
    expect(html).not.toContain(messages.install.action);
  });

  test("quando o Chrome oferece, instala com um toque", () => {
    const html = render({ install: "can-prompt" });
    expect(html).toContain(messages.install.prompt);
    expect(html).toContain(`>${messages.install.action}<`);
    expect(html).not.toContain(messages.install.manual[0]);
  });

  test("com o app instalado, o primeiro passo aparece feito", () => {
    const html = textOf(render({ install: "installed" }));
    expect(html).toContain(`1. ${messages.install.title} ${messages.done} ${messages.install.installed}`);
  });

  test("pede a permissão com o botão e mostra a pergunta do celular", () => {
    const html = render();
    expect(html).toContain(messages.notifications.ask);
    expect(html).toContain(">Ativar as notificações<");
    expect(html).toContain('aria-label="Pergunta do celular para o Quitô enviar notificações, com o botão Permitir destacado"');
    expect(render({ enabling: true })).toContain("Ativando...");
  });

  test("quando falha ao ativar, avisa e deixa tentar de novo", () => {
    const html = render({ push: "failed" });
    expect(html).toContain(messages.notifications.failed);
    expect(html).toContain(">Ativar as notificações<");
  });

  test("bloqueada, ensina a liberar nos ajustes e confere de novo", () => {
    const html = render({ push: "blocked" });
    for (const line of messages.notifications.blocked) expect(textOf(html)).toContain(line);
    expect(html).toContain('aria-label="Ajustes do Quitô no Chrome, com a chave de Notificações destacada"');
    expect(html).toContain(messages.notifications.recheck);
    expect(html).not.toContain(messages.test.action);
  });

  test("conferindo, ou em navegador sem notificação, explica sem botão", () => {
    expect(render({ push: "checking" })).toContain(messages.checking);
    const unsupported = render({ push: "unsupported" });
    expect(unsupported).toContain(messages.notifications.unsupported);
    expect(unsupported).not.toContain(">Ativar as notificações<");
    expect(render({ push: "needs-install" })).toContain(messages.notifications.unsupported);
  });

  test("o teste espera as notificações ativas", () => {
    const html = render();
    expect(html).toContain(messages.test.waiting);
    expect(html).not.toContain(messages.test.action);
    expect(html).toContain('aria-label="Notificação de teste do Quitô chegando no alto da tela"');
  });

  test("com as notificações ativas, envia o teste", () => {
    const html = textOf(render({ push: "active" }));
    expect(html).toContain(`2. ${messages.notifications.title} ${messages.done} ${messages.notifications.active}`);
    expect(html).toContain(messages.test.action);
    expect(render({ push: "active", test: "sending" })).toContain(messages.test.sending);
  });

  test("depois de enviar, pergunta se chegou", () => {
    const html = render({ push: "active", test: "sent" });
    expect(html).toContain(messages.test.sent);
    expect(html).toContain(messages.test.arrivedAction);
    expect(html).toContain(messages.test.notArrivedAction);
  });

  test("quando chega, termina o guia e leva às cobranças", () => {
    const html = render({ push: "active", test: "arrived" });
    expect(html).toContain(messages.test.arrived);
    expect(html).toMatch(new RegExp(`href="/charges"[^>]*>${messages.test.toCharges}<`));
  });

  test("quando não chega, mostra o que conferir e deixa enviar de novo", () => {
    const html = render({ push: "active", test: "not-arrived" });
    for (const line of messages.test.notArrived) expect(html).toContain(line);
    expect(html).toContain(messages.test.again);
  });

  test("falha no envio ou inscrição vencida aparecem como aviso", () => {
    expect(render({ push: "active", test: "failed" })).toContain(messages.test.failed);
    const gone = render({ push: "off", test: "gone" });
    expect(gone).toContain(messages.test.gone);
    expect(gone).toContain(">Ativar as notificações<");
  });

  test("fora do Android, explica que o guia é para Android e leva à conta", () => {
    for (const device of ["iphone", "computer"] as const) {
      const html = render({ device });
      expect(html).toContain(messages.otherDevice);
      expect(html).toContain('href="/account"');
      expect(html).not.toContain(messages.install.title);
    }
  });

  test("enquanto não sabe o aparelho, mostra que está conferindo", () => {
    const html = render({ device: null });
    expect(html).toContain(messages.checking);
    expect(html).not.toContain(messages.install.title);
  });
});
