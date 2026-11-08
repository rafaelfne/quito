import { remainingSteps, type GettingStartedState } from "@/lib/getting-started";

export const notificationsGuidePath = "/notifications/guide";

export const notificationsInviteMessages = {
  title: "Receba o aviso no dia de cobrar",
  text: "Instale o Quitô no celular e ligue as notificações. No dia do vencimento, ele avisa quem você precisa cobrar.",
  firstChargeText: "Sua primeira cobrança está pronta. Instale o Quitô no celular e ligue as notificações: no dia do vencimento, ele avisa quem você precisa cobrar.",
  action: "Ativar as notificações",
};

export function showsNotificationsInvite(state: GettingStartedState, offered: boolean): boolean {
  return offered && state.status === "ready" && state.steps.length > 0 && remainingSteps(state.steps) === 0;
}
