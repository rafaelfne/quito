import type { SupabaseClient } from "@supabase/supabase-js";
import { isTrainingCharges, type ChargesState } from "@/lib/charges";
import { isFirstChargeOver } from "@/lib/first-charge";
import type { PushDevice, PushPermission, PushStatus } from "@/lib/push-subscription";
import { guideTestOrigin, pushTestPath, type PushTestResult } from "@/lib/push-test-request";
import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";

export type InstallStatus = "installed" | "can-prompt" | "manual";

export type TestStatus = "idle" | "sending" | "sent" | "arrived" | "not-arrived" | "failed" | "gone";

export type InstallPromptEvent = Event & { prompt(): Promise<unknown>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export type GuideFetch = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

export type NotificationsLoss = "lost" | "blocked";

export type GuideOffer = "none" | "offer" | "resume" | NotificationsLoss;

export type ChargesInvite = "first-charge" | "resume" | NotificationsLoss;

export const guideMessages = {
  title: "Ativar as notificações no celular",
  otherDevice: "Este passo a passo é para celular. Aponte a câmera do seu Android ou do seu iPhone para o código abaixo e toque no link que aparecer: o guia continua no celular.",
  qrLabel: "Código QR que abre o guia de ativação no celular",
  signInOnPhone: "Se o celular pedir, entre com o mesmo e-mail que você usa aqui.",
  typeLink: "Se a câmera não abrir o link, digite este endereço no navegador do celular:",
  accountNote: "Para ver as notificações deste computador, vá em",
  checking: "Conferindo este celular...",
  done: "Feito",
  enable: "Ativar as notificações",
  enabling: "Ativando...",
};

export const androidGuideMessages = {
  title: "Ativar as notificações no Android",
  intro: "Em três passos, o Quitô fica na tela inicial do seu celular e passa a avisar no dia de cobrar.",
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

export type GuideTestMessages = typeof androidGuideMessages.test;

export const iphoneGuideMessages = {
  title: "Ativar as notificações no iPhone",
  intro: "No iPhone, as notificações só chegam com o Quitô na tela de início. Em cinco passos, você adiciona o Quitô, abre pelo ícone, entra de novo e passa a receber o aviso no dia de cobrar.",
  addToHome: {
    title: "Adicione o Quitô à tela de início",
    installed: "O Quitô está na tela de início deste iPhone.",
    safariOnly: "Use o Safari. Se este link abriu dentro do WhatsApp, do Instagram ou de outro app, abra o Quitô no Safari antes de seguir.",
    steps: [
      "No Safari, toque no botão Compartilhar, o quadrado com a seta para cima. Se ele não aparecer, toque antes nos três pontinhos (···) na barra de baixo.",
      "Role a lista e toque em Adicionar à Tela de Início.",
      "Se aparecer a opção Abrir como App da Web, deixe ligada. Toque em Adicionar. O ícone do Quitô aparece na tela de início.",
    ],
  },
  openFromIcon: {
    title: "Abra o Quitô pelo ícone",
    installed: "Você está no Quitô aberto pelo ícone.",
    text: "Saia do Safari e toque no ícone do Quitô na tela de início. As notificações só funcionam no Quitô aberto por ali.",
  },
  signInAgain: {
    title: "Entre de novo no app",
    installed: "Você está conectado no app.",
    text: "Na primeira vez, o Quitô aberto pelo ícone pede para entrar de novo, mesmo que você já esteja conectado no Safari. Entre com o mesmo e-mail e digite o código de 6 números que chega por e-mail.",
    next: "Depois de entrar, toque em Ativar as notificações, no alto das cobranças, para voltar a este guia no passo 4.",
  },
  notifications: {
    title: "Libere as notificações",
    ask: "Toque no botão abaixo. O iPhone pergunta se o Quitô pode enviar notificações: toque em Permitir.",
    active: "As notificações estão ativas neste iPhone.",
    needsInstall: "Este passo só funciona no Quitô aberto pelo ícone da tela de início. Siga os passos 1 a 3 e continue por lá.",
    unsupported: [
      "Este iPhone precisa de uma atualização para receber notificações do Quitô.",
      "Abra os Ajustes, toque em Geral e depois em Atualização de Software. Instale a versão mais nova (a partir do iOS 16.4) e volte a este guia pelo ícone do Quitô.",
    ],
    failed: "Não deu para ativar as notificações agora. Confira a internet e tente de novo.",
    blocked: [
      "As notificações do Quitô estão bloqueadas neste iPhone. Para liberar:",
      "Abra os Ajustes do iPhone e toque em Notificações.",
      "Toque em Quitô e ligue Permitir Notificações.",
      "Volte ao Quitô pelo ícone e toque em Conferir de novo.",
    ],
    recheck: "Conferir de novo",
  },
  test: {
    ...androidGuideMessages.test,
    notArrived: [
      "Confira estas coisas e envie de novo:",
      "O Foco, como o Não Perturbe, está desligado na Central de Controle.",
      "Em Ajustes, Notificações, Quitô, as notificações estão permitidas.",
      "A internet do iPhone está funcionando.",
    ],
    gone: "A inscrição deste iPhone venceu. Ative as notificações de novo no passo 4 e envie outro teste.",
  } satisfies GuideTestMessages,
};

const offeredStatuses: Record<PushDevice, PushStatus[]> = {
  android: ["off", "blocked", "failed"],
  iphone: ["needs-install", "unsupported", "off", "blocked", "failed"],
  computer: [],
};

export function offersNotificationsGuide(device: PushDevice, status: PushStatus): boolean {
  return offeredStatuses[device].includes(status);
}

export function notificationsLossOf(status: PushStatus, permission: PushPermission): NotificationsLoss | null {
  if (status === "blocked") return "blocked";
  return status === "off" && permission === "granted" ? "lost" : null;
}

export function guideOfferOf(device: PushDevice, standalone: boolean, status: PushStatus, permission: PushPermission = "default"): GuideOffer {
  if (!offersNotificationsGuide(device, status)) return "none";
  const loss = notificationsLossOf(status, permission);
  if (loss) return loss;
  return device === "iphone" && standalone && (status === "off" || status === "failed") ? "resume" : "offer";
}

export function chargesInviteOf(offer: GuideOffer, firstChargeReady: boolean): ChargesInvite | null {
  if (offer === "resume" || offer === "lost" || offer === "blocked") return offer;
  return offer === "offer" && firstChargeReady ? "first-charge" : null;
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
