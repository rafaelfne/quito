import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { notificationsAlertMessages, notificationsGuidePath, notificationsInviteMessages } from "@/lib/notifications-invite";
import { NotificationsAlert, NotificationsInvite } from "./notifications-invite";

describe("convite para o guia de ativação", () => {
  test("tem título, texto e o link do guia", () => {
    const html = renderToStaticMarkup(<NotificationsInvite />);
    expect(html).toContain('aria-labelledby="notifications-invite-title"');
    expect(html).toContain(notificationsInviteMessages.text);
    expect(html).toMatch(new RegExp(`href="${notificationsGuidePath}"[^>]*>${notificationsInviteMessages.action}<`));
  });

  test("na primeira cobrança pronta, troca o texto e leva ao mesmo guia", () => {
    const html = renderToStaticMarkup(<NotificationsInvite text={notificationsInviteMessages.firstChargeText} />);
    expect(html).toContain("Sua primeira cobrança está pronta.");
    expect(html).not.toContain(notificationsInviteMessages.text);
    expect(html).toContain(`href="${notificationsGuidePath}"`);
  });
});

describe("alerta de notificação desligada", () => {
  test("com a inscrição sumida, avisa, lembra do painel como reserva e leva de volta ao guia", () => {
    const html = renderToStaticMarkup(<NotificationsAlert loss="lost" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain(notificationsAlertMessages.title);
    expect(html).toContain(notificationsAlertMessages.lostText);
    expect(html).not.toContain(notificationsAlertMessages.blockedText);
    expect(html).toContain(notificationsAlertMessages.fallbackText);
    expect(html).toMatch(new RegExp(`href="${notificationsGuidePath}"[^>]*>${notificationsAlertMessages.action}<`));
  });

  test("com a permissão negada, explica que está bloqueada", () => {
    const html = renderToStaticMarkup(<NotificationsAlert loss="blocked" />);
    expect(html).toContain(notificationsAlertMessages.blockedText);
    expect(html).not.toContain(notificationsAlertMessages.lostText);
    expect(html).toContain(`href="${notificationsGuidePath}"`);
  });

  test("os textos dizem o que parou e que o painel continua valendo", () => {
    expect(notificationsAlertMessages.title).toBe("O aviso do dia de cobrar parou neste celular");
    expect(notificationsAlertMessages.fallbackText).toContain("as cobranças do dia aparecem aqui no painel");
    expect(notificationsAlertMessages.action).toBe("Ativar de novo");
  });
});
