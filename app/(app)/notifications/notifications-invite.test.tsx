import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { notificationsGuidePath, notificationsInviteMessages } from "@/lib/notifications-invite";
import { NotificationsInvite } from "./notifications-invite";

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
