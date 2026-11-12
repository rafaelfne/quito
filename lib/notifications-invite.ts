import { remainingSteps, type GettingStartedState } from "@/lib/getting-started";

export const notificationsGuidePath = "/notifications/guide";

export const notificationsInviteMessages = {
  title: "Receba o aviso no dia de cobrar",
  text: "Instale o Quitô no celular e ligue as notificações. No dia do vencimento, ele avisa quem você precisa cobrar.",
  firstChargeText: "Sua primeira cobrança está pronta. Instale o Quitô no celular e ligue as notificações: no dia do vencimento, ele avisa quem você precisa cobrar.",
  resumeText: "O Quitô já está na tela de início deste iPhone. Falta liberar as notificações para ele avisar no dia de cobrar.",
  action: "Ativar as notificações",
};

export const notificationsAlertMessages = {
  title: "O aviso do dia de cobrar parou neste celular",
  lostText: "As notificações do Quitô se desligaram neste celular. O guia ajuda a ativar de novo.",
  blockedText: "As notificações do Quitô estão bloqueadas neste celular. O guia mostra como liberar de novo.",
  fallbackText: "Enquanto isso, abra o Quitô no dia de cobrar: as cobranças do dia aparecem aqui no painel.",
  action: "Ativar de novo",
};

export function showsNotificationsInvite(state: GettingStartedState, offered: boolean): boolean {
  return offered && state.status === "ready" && state.steps.length > 0 && remainingSteps(state.steps) === 0;
}
