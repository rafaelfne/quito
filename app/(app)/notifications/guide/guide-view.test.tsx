import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { androidGuideMessages as messages, guideMessages, iphoneGuideMessages as iphone, type InstallStatus, type TestStatus } from "@/lib/activation-guide";
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
    expect(html).toContain(`1. ${messages.install.title} ${guideMessages.done} ${messages.install.installed}`);
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
    expect(render({ push: "checking" })).toContain(guideMessages.checking);
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
    expect(html).toContain(`2. ${messages.notifications.title} ${guideMessages.done} ${messages.notifications.active}`);
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

  test("no computador, explica que o guia é para celular e leva à conta", () => {
    const html = render({ device: "computer" });
    expect(html).toContain(guideMessages.title);
    expect(html).toContain(guideMessages.otherDevice);
    expect(html).toContain('href="/account"');
    expect(html).not.toContain(messages.install.title);
    expect(html).not.toContain(iphone.addToHome.title);
  });

  test("enquanto não sabe o aparelho, mostra que está conferindo", () => {
    const html = render({ device: null });
    expect(html).toContain(guideMessages.checking);
    expect(html).not.toContain(messages.install.title);
  });
});

describe("guia de ativação no iPhone", () => {
  function renderIphone(overrides: Partial<GuideViewProps> = {}) {
    return render({ device: "iphone", push: "needs-install", ...overrides });
  }

  test("mostra os cinco passos em ordem: adicionar, abrir pelo ícone, entrar, liberar e testar", () => {
    const html = renderIphone();
    expect(html).toContain(iphone.title);
    expect(html).toContain(iphone.intro);
    const order = [iphone.addToHome.title, iphone.openFromIcon.title, iphone.signInAgain.title, iphone.notifications.title, iphone.test.title].map((title) => html.indexOf(title));
    expect(order[0]).toBeGreaterThan(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).not.toContain(messages.install.title);
  });

  test("no Safari, ensina a adicionar à tela de início pelo Compartilhar, com imagens", () => {
    const html = renderIphone();
    expect(html).toContain(iphone.addToHome.safariOnly);
    for (const step of iphone.addToHome.steps) expect(html).toContain(step);
    expect(html).toContain('aria-label="Safari com o botão Compartilhar destacado na barra de baixo"');
    expect(html).toContain('aria-label="Lista do Compartilhar no Safari, com a opção Adicionar à Tela de Início destacada"');
    expect(html).toContain('aria-label="Tela Adicionar à Tela de Início, com Abrir como App da Web ligado e o botão Adicionar destacado"');
  });

  test("no Safari, manda abrir pelo ícone e entrar de novo antes de liberar", () => {
    const html = renderIphone();
    expect(html).toContain(iphone.openFromIcon.text);
    expect(html).toContain('aria-label="Tela de início do iPhone com o ícone do Quitô destacado"');
    expect(html).toContain(iphone.signInAgain.text);
    expect(html).toContain(iphone.signInAgain.next);
    expect(html).toContain(iphone.notifications.needsInstall);
    expect(html).not.toContain(">Ativar as notificações<");
    expect(html).toContain(iphone.test.waiting);
    expect(html).not.toContain(guideMessages.done);
  });

  test("aberto pelo ícone, os três primeiros passos aparecem feitos e pede a permissão", () => {
    const html = renderIphone({ install: "installed", push: "off" });
    const text = textOf(html);
    expect(text).toContain(`1. ${iphone.addToHome.title} ${guideMessages.done} ${iphone.addToHome.installed}`);
    expect(text).toContain(`2. ${iphone.openFromIcon.title} ${guideMessages.done} ${iphone.openFromIcon.installed}`);
    expect(text).toContain(`3. ${iphone.signInAgain.title} ${guideMessages.done} ${iphone.signInAgain.installed}`);
    expect(html).not.toContain(iphone.addToHome.steps[0]);
    expect(html).toContain(iphone.notifications.ask);
    expect(html).toContain('aria-label="Pergunta do iPhone para o Quitô enviar notificações, com o botão Permitir destacado"');
    expect(html).toContain(">Ativar as notificações<");
    expect(renderIphone({ install: "installed", push: "off", enabling: true })).toContain("Ativando...");
  });

  test("quando falha ao ativar, avisa e deixa tentar de novo", () => {
    const html = renderIphone({ install: "installed", push: "failed" });
    expect(html).toContain(iphone.notifications.failed);
    expect(html).toContain(">Ativar as notificações<");
  });

  test("bloqueada, ensina a liberar nos Ajustes do iPhone e confere de novo", () => {
    const html = renderIphone({ install: "installed", push: "blocked" });
    for (const line of iphone.notifications.blocked) expect(textOf(html)).toContain(line);
    expect(html).toContain('aria-label="Ajustes do iPhone em Notificações, Quitô, com a chave Permitir Notificações destacada"');
    expect(html).toContain(iphone.notifications.recheck);
    expect(html).not.toContain(iphone.test.action);
  });

  test("em iPhone antigo, explica como atualizar, sem botão", () => {
    const html = renderIphone({ push: "unsupported" });
    for (const line of iphone.notifications.unsupported) expect(html).toContain(line);
    expect(html).not.toContain(">Ativar as notificações<");
  });

  test("conferindo, mostra que está conferindo", () => {
    expect(renderIphone({ install: "installed", push: "checking" })).toContain(guideMessages.checking);
  });

  test("com as notificações ativas, envia o teste e pergunta se chegou", () => {
    const html = textOf(renderIphone({ install: "installed", push: "active" }));
    expect(html).toContain(`4. ${iphone.notifications.title} ${guideMessages.done} ${iphone.notifications.active}`);
    expect(html).toContain(iphone.test.action);
    const sent = renderIphone({ install: "installed", push: "active", test: "sent" });
    expect(sent).toContain(iphone.test.arrivedAction);
    expect(sent).toContain(iphone.test.notArrivedAction);
  });

  test("quando não chega, mostra o que conferir no iPhone", () => {
    const html = renderIphone({ install: "installed", push: "active", test: "not-arrived" });
    for (const line of iphone.test.notArrived) expect(html).toContain(line);
    expect(html).toContain(iphone.test.again);
  });

  test("quando chega, termina o guia e leva às cobranças", () => {
    const html = renderIphone({ install: "installed", push: "active", test: "arrived" });
    expect(html).toContain(iphone.test.arrived);
    expect(html).toMatch(new RegExp(`href="/charges"[^>]*>${iphone.test.toCharges}<`));
  });

  test("inscrição vencida manda ativar de novo no passo 4", () => {
    const html = renderIphone({ install: "installed", push: "off", test: "gone" });
    expect(html).toContain(iphone.test.gone);
    expect(html).toContain(">Ativar as notificações<");
  });
});
