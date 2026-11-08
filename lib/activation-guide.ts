import type { SupabaseClient } from "@supabase/supabase-js";
import { isTrainingCharges, type ChargesState } from "@/lib/charges";
import { isFirstChargeOver } from "@/lib/first-charge";
import type { PushDevice, PushStatus } from "@/lib/push-subscription";
import { guideTestOrigin, pushTestPath, type PushTestResult } from "@/lib/push-test-request";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type InstallStatus = "installed" | "can-prompt" | "manual";

export type TestStatus = "idle" | "sending" | "sent" | "arrived" | "not-arrived" | "failed" | "gone";

export type InstallPromptEvent = Event & { prompt(): Promise<unknown>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type GuideFetch = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

export const androidGuideMessages = {
  title: "Ativar as notificações no Android",
  intro: "Em três passos, o Quitô fica na tela inicial do seu celular e passa a avisar no dia de cobrar.",
  otherDevice: "Este passo a passo é para celular Android. Abra o Quitô no Chrome do seu Android para seguir o guia. Enquanto isso, você pode ver as notificações deste aparelho em Sua conta.",
  checking: "Conferindo este celular...",
  done: "Feito",
  install: {
    title: "Instale o Quitô",
    installed: "O Quitô está instalado neste celular.",
    prompt: "Toque no botão abaixo e confirme em Instalar. O ícone do Quitô aparece na tela inicial.",
    action: "Instalar o Quitô",
    manual: [
      "No Chrome, toque nos três pontinhos no canto de cima da tela.",
      "Toque em Instalar app. Em alguns celulares, a opção se chama Adicionar à tela inicial.",
      "Confirme em Instalar. O ícone do Quitô aparece na tela inicial.",
    ],
    already: "Se o Quitô já está na tela inicial, siga para o passo 2.",
  },
  notifications: {
    title: "Libere as notificações",
    ask: "Toque no botão abaixo. O celular pergunta se o Quitô pode enviar notificações: toque em Permitir.",
    active: "As notificações estão ativas neste celular.",
    unsupported: "Este navegador não recebe notificações. Abra o Quitô pelo Chrome e volte a este guia.",
    failed: "Não deu para ativar as notificações agora. Confira a internet e tente de novo.",
    blocked: [
      "As notificações do Quitô estão bloqueadas neste celular. Para liberar:",
      "No Chrome, toque no ícone ao lado do endereço do Quitô, lá em cima. No app instalado, segure o ícone do Quitô na tela inicial e toque em Informações do app.",
      "Toque em Notificações e ligue a chave.",
      "Volte a esta tela e toque em Conferir de novo.",
    ],
    recheck: "Conferir de novo",
  },
  test: {
    title: "Receba a notificação de teste",
    waiting: "Depois de liberar as notificações, envie um teste para ver como o aviso chega.",
    action: "Enviar notificação de teste",
    sending: "Enviando...",
    sent: "Enviamos a notificação de teste. Ela aparece em alguns segundos, no alto da tela. Chegou?",
    arrivedAction: "Chegou",
    notArrivedAction: "Não chegou",
    arrived: "Tudo pronto. No dia de cobrar, o Quitô avisa assim, e um toque no aviso abre as cobranças do dia.",
    notArrived: [
      "Confira estas coisas e envie de novo:",
      "O modo Não perturbe está desligado.",
      "A economia de bateria não está segurando as notificações do Chrome ou do Quitô.",
      "A internet do celular está funcionando.",
    ],
    again: "Enviar de novo",
    failed: "Não deu para enviar a notificação de teste agora. Confira a internet e tente de novo.",
    gone: "A inscrição deste celular venceu. Ative as notificações de novo no passo 2 e envie outro teste.",
    toCharges: "Ir para as cobranças",
  },
};

export function offersNotificationsGuide(device: PushDevice, status: PushStatus): boolean {
  return device === "android" && (status === "off" || status === "blocked" || status === "failed");
}

export function installStatusOf(standalone: boolean, prompt: InstallPromptEvent | null): InstallStatus {
  if (standalone) return "installed";
  return prompt ? "can-prompt" : "manual";
}

export function testStatusFrom(from: string | null): TestStatus {
  return from === guideTestOrigin ? "arrived" : "idle";
}

export function canSendTest(push: PushStatus): boolean {
  return push === "active";
}

export function isFirstChargeReady(state: Pick<ChargesState, "status" | "month" | "trainingMonth" | "charges" | "today">, startedAt: string | null): boolean {
  if (state.status !== "ready" || startedAt === null || state.today === "") return false;
  if (isTrainingCharges(state) || !state.charges.some((charge) => charge.total_cents > 0)) return false;
  return !isFirstChargeOver(startedAt, state.today);
}

export async function loadStartedAt(client: Pick<SupabaseClient, "from">): Promise<string | null> {
  try {
    const { data, error } = await withTimeout(Promise.resolve(client.from("getting_started").select("started_at").maybeSingle()), requestTimeoutMs);
    if (error) return null;
    return (data as { started_at: string | null } | null)?.started_at ?? null;
  } catch {
    return null;
  }
}

export async function requestPushTest(fetcher: GuideFetch, token: string | null, endpoint: string | null): Promise<PushTestResult> {
  if (!token) return "failed";
  if (!endpoint) return "gone";
  try {
    const response = await withTimeout(fetcher(pushTestPath, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ endpoint }) }), requestTimeoutMs);
    if (!response.ok) return "failed";
    const { result } = (await response.json()) as { result?: unknown };
    return result === "sent" || result === "gone" ? result : "failed";
  } catch {
    return "failed";
  }
}
