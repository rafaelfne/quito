import { describe, expect, test, vi } from "vitest";
import { canSendTest, installStatusOf, isFirstChargeReady, loadStartedAt, offersNotificationsGuide, requestPushTest, testStatusFrom, type InstallPromptEvent } from "./activation-guide";
import type { Charge, ChargesState } from "./charges";
import { pushTestPath } from "./push-test-request";

const charge = { id: "c1", total_cents: 30000 } as Charge;

function panel(overrides: Partial<ChargesState> = {}): Pick<ChargesState, "status" | "month" | "trainingMonth" | "charges" | "today"> {
  return { status: "ready", month: { year: 2026, month: 11 }, trainingMonth: { year: 2026, month: 10 }, charges: [charge], today: "2026-12-05", ...overrides };
}

const enteredInOctober = "2026-10-15T12:00:00.000Z";

describe("quem recebe a oferta do guia", () => {
  test("só no Android, quando as notificações ainda não estão ativas", () => {
    for (const status of ["off", "blocked", "failed"] as const) expect(offersNotificationsGuide("android", status)).toBe(true);
    for (const status of ["active", "checking", "unsupported", "needs-install"] as const) expect(offersNotificationsGuide("android", status)).toBe(false);
    expect(offersNotificationsGuide("iphone", "off")).toBe(false);
    expect(offersNotificationsGuide("computer", "off")).toBe(false);
  });
});

describe("primeira cobrança pronta", () => {
  test("no mês da primeira cobrança, com cobrança no painel", () => {
    expect(isFirstChargeReady(panel(), enteredInOctober)).toBe(true);
    expect(isFirstChargeReady(panel({ today: "2026-12-31" }), enteredInOctober)).toBe(true);
  });

  test("depois do mês da primeira cobrança, não conta mais", () => {
    expect(isFirstChargeReady(panel({ today: "2027-01-05" }), enteredInOctober)).toBe(false);
  });

  test("sem cobrança de verdade no painel, não conta", () => {
    expect(isFirstChargeReady(panel({ charges: [] }), enteredInOctober)).toBe(false);
    expect(isFirstChargeReady(panel({ charges: [{ ...charge, total_cents: 0 }] }), enteredInOctober)).toBe(false);
    expect(isFirstChargeReady(panel({ month: { year: 2026, month: 10 }, charges: [] }), enteredInOctober)).toBe(false);
  });

  test("enquanto carrega ou sem a data de entrada, não conta", () => {
    expect(isFirstChargeReady(panel({ status: "loading" }), enteredInOctober)).toBe(false);
    expect(isFirstChargeReady(panel({ today: "" }), enteredInOctober)).toBe(false);
    expect(isFirstChargeReady(panel(), null)).toBe(false);
  });
});

describe("data de entrada", () => {
  function client(result: unknown) {
    return { from: vi.fn(() => ({ select: () => ({ maybeSingle: async () => result }) })) } as unknown as Parameters<typeof loadStartedAt>[0];
  }

  test("lê quando o professor começou os primeiros passos", async () => {
    expect(await loadStartedAt(client({ data: { started_at: enteredInOctober }, error: null }))).toBe(enteredInOctober);
    expect(await loadStartedAt(client({ data: null, error: null }))).toBeNull();
  });

  test("sem resposta do banco, fica sem data", async () => {
    expect(await loadStartedAt(client({ data: null, error: { message: "fora do ar" } }))).toBeNull();
    const broken = { from: () => { throw new Error("sem rede"); } } as unknown as Parameters<typeof loadStartedAt>[0];
    expect(await loadStartedAt(broken)).toBeNull();
  });
});

describe("passos do guia", () => {
  test("instalação: feita no app aberto pelo ícone, por botão quando o Chrome oferece, ou pelo menu", () => {
    const prompt = {} as InstallPromptEvent;
    expect(installStatusOf(true, prompt)).toBe("installed");
    expect(installStatusOf(false, prompt)).toBe("can-prompt");
    expect(installStatusOf(false, null)).toBe("manual");
  });

  test("o toque na notificação de teste chega ao guia como teste recebido", () => {
    expect(testStatusFrom("test")).toBe("arrived");
    expect(testStatusFrom(null)).toBe("idle");
    expect(testStatusFrom("notification")).toBe("idle");
  });

  test("o teste só sai com as notificações ativas", () => {
    expect(canSendTest("active")).toBe(true);
    expect(canSendTest("off")).toBe(false);
  });
});

describe("pedir a notificação de teste", () => {
  test("manda o endereço deste aparelho com a sessão do professor", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ result: "sent" }) }));
    expect(await requestPushTest(fetcher, "token", "https://push.exemplo/a")).toBe("sent");
    expect(fetcher).toHaveBeenCalledWith(pushTestPath, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer token" },
      body: JSON.stringify({ endpoint: "https://push.exemplo/a" }),
    });
  });

  test("inscrição que sumiu volta como vencida", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ result: "gone" }) }));
    expect(await requestPushTest(fetcher, "token", "https://push.exemplo/a")).toBe("gone");
    expect(await requestPushTest(fetcher, "token", null)).toBe("gone");
  });

  test("sem sessão, resposta estranha ou falha de rede, aparece como falha", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ result: "outra coisa" }) }));
    expect(await requestPushTest(fetcher, null, "https://push.exemplo/a")).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
    expect(await requestPushTest(fetcher, "token", "https://push.exemplo/a")).toBe("failed");
    expect(await requestPushTest(async () => ({ ok: false, json: async () => ({}) }), "token", "https://push.exemplo/a")).toBe("failed");
    expect(await requestPushTest(async () => Promise.reject(new Error("sem rede")), "token", "https://push.exemplo/a")).toBe("failed");
  });
});
