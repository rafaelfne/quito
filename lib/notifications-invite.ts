import { remainingSteps, type GettingStartedState } from "@/lib/getting-started";

export const notificationsGuideLaunched = false;

export const notificationsGuidePath = "/notifications/guide";

export const notificationsInviteMessages = {
  title: "Receba o aviso no dia de cobrar",
  text: "Instale o Quitô no celular e ligue as notificações. No dia do vencimento, ele avisa quem você precisa cobrar.",
  action: "Ativar as notificações",
};

export function showsNotificationsInvite(state: GettingStartedState, launched: boolean = notificationsGuideLaunched): boolean {
  return launched && state.status === "ready" && state.steps.length > 0 && remainingSteps(state.steps) === 0;
}
