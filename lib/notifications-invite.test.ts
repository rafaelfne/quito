import { describe, expect, test } from "vitest";
import type { GettingStartedStep } from "./getting-started";
import { notificationsGuideLaunched, notificationsGuidePath, notificationsInviteMessages, showsNotificationsInvite } from "./notifications-invite";

const done: GettingStartedStep = { id: "a", title: "Passo", hint: "Dica", path: "/students", done: true };
const pending: GettingStartedStep = { ...done, id: "b", done: false };

describe("convite para as notificações", () => {
  test("fica desligado enquanto o guia de ativação não é lançado", () => {
    expect(notificationsGuideLaunched).toBe(false);
    expect(showsNotificationsInvite({ status: "ready", steps: [done] })).toBe(false);
  });

  test("com o guia lançado, aparece só no fim da sequência", () => {
    expect(showsNotificationsInvite({ status: "ready", steps: [done, done] }, true)).toBe(true);
    expect(showsNotificationsInvite({ status: "ready", steps: [done, pending] }, true)).toBe(false);
  });

  test("não aparece enquanto carrega, quando falha ou sem passos", () => {
    expect(showsNotificationsInvite({ status: "loading", steps: [done] }, true)).toBe(false);
    expect(showsNotificationsInvite({ status: "failed", steps: [done] }, true)).toBe(false);
    expect(showsNotificationsInvite({ status: "ready", steps: [] }, true)).toBe(false);
  });

  test("convida para o aviso no dia de cobrar", () => {
    expect(notificationsGuidePath).toBe("/notifications/guide");
    expect(notificationsInviteMessages.title).toBe("Receba o aviso no dia de cobrar");
    expect(notificationsInviteMessages.action).toBe("Ativar as notificações");
  });
});
