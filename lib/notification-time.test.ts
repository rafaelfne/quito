import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  chooseNotificationHour,
  defaultNotificationHour,
  deviceTimeZone,
  fallbackTimeZone,
  formatHour,
  initialNotificationTime,
  isNotificationHour,
  loadNotificationTime,
  notificationHours,
  notificationTimeMessages,
  openNotificationTime,
  saveNotificationTime,
  savedNotice,
  type NotificationTimeClient,
} from "./notification-time";

const now = new Date("2026-11-07T12:00:00.000Z");
const zone = "America/Manaus";

const maybeSingle = vi.fn();
const select = vi.fn(() => ({ maybeSingle }));
const upsert = vi.fn();
const from = vi.fn(() => ({ select, upsert }));
const client = { from } as unknown as NotificationTimeClient;

beforeEach(() => {
  from.mockClear();
  select.mockClear();
  maybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
});

describe("horas que o professor pode escolher", () => {
  test("só horas cheias, de 0h a 23h, começando em 9h", () => {
    expect(defaultNotificationHour).toBe(9);
    expect(notificationHours).toHaveLength(24);
    expect(notificationHours[0]).toBe(0);
    expect(notificationHours[23]).toBe(23);
    expect(notificationHours.map(formatHour)).toContain("9h");
  });

  test("recusa o que não é hora cheia", () => {
    expect(isNotificationHour(9)).toBe(true);
    expect(isNotificationHour(0)).toBe(true);
    expect(isNotificationHour(23)).toBe(true);
    expect(isNotificationHour(9.5)).toBe(false);
    expect(isNotificationHour(24)).toBe(false);
    expect(isNotificationHour(-1)).toBe(false);
    expect(isNotificationHour("9")).toBe(false);
    expect(isNotificationHour(undefined)).toBe(false);
  });

  test("o aviso de guardado diz a hora no relógio do celular", () => {
    expect(savedNotice(7)).toBe("Horário guardado. O aviso chega às 7h, no horário deste celular.");
  });
});

describe("fuso do celular", () => {
  test("usa o fuso que o aparelho informa", () => {
    expect(deviceTimeZone(() => zone)).toBe(zone);
  });

  test("sem fuso, com fuso estranho ou com erro, usa o de Brasília", () => {
    expect(deviceTimeZone(() => undefined)).toBe(fallbackTimeZone);
    expect(deviceTimeZone(() => "x".repeat(65))).toBe(fallbackTimeZone);
    expect(
      deviceTimeZone(() => {
        throw new Error("sem Intl");
      }),
    ).toBe(fallbackTimeZone);
  });

  test("sem argumento, lê o fuso do navegador", () => {
    expect(deviceTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

describe("banco", () => {
  test("lê a hora e o fuso do professor", async () => {
    maybeSingle.mockResolvedValue({ data: { hour: 7, time_zone: zone }, error: null });
    expect(await loadNotificationTime(client)).toEqual({ ok: true, settings: { hour: 7, time_zone: zone } });
    expect(from).toHaveBeenCalledWith("notification_settings");
    expect(select).toHaveBeenCalledWith("hour, time_zone");
  });

  test("erro ou queda na leitura viram falha", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await loadNotificationTime(client)).toEqual({ ok: false });
    maybeSingle.mockRejectedValue(new Error("rede"));
    expect(await loadNotificationTime(client)).toEqual({ ok: false });
  });

  test("guarda uma linha por professor", async () => {
    const row = { hour: 7, time_zone: zone, updated_at: now.toISOString() };
    expect(await saveNotificationTime(client, row)).toBe(true);
    expect(upsert).toHaveBeenCalledWith(row, { onConflict: "owner_id" });
  });

  test("erro ou queda ao guardar viram falha", async () => {
    upsert.mockResolvedValue({ error: { message: "x" } });
    expect(await saveNotificationTime(client, { hour: 7, time_zone: zone, updated_at: now.toISOString() })).toBe(false);
    upsert.mockRejectedValue(new Error("rede"));
    expect(await saveNotificationTime(client, { hour: 7, time_zone: zone, updated_at: now.toISOString() })).toBe(false);
  });

  test("a migração roda de novo num banco que já tem a tabela", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261107070000_notification_settings.sql"), "utf8");
    expect(migration).toContain('create table if not exists public."notification_settings"');
    expect(migration).toContain(`default ${defaultNotificationHour} check ("hour" between 0 and 23)`);
    const policies = [...migration.matchAll(/create policy "(\w+)"/g)].map((match) => match[1]);
    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(migration).toContain(`policyname = '${policy}'`);
    }
  });
});

describe("abrir o horário do aviso", () => {
  test("sem escolha guardada, parte de 9h e já guarda com o fuso do celular", async () => {
    const state = await openNotificationTime(client, zone, now);
    expect(state).toMatchObject({ status: "ready", hour: 9, timeZone: zone, message: null });
    expect(upsert).toHaveBeenCalledWith({ hour: 9, time_zone: zone, updated_at: now.toISOString() }, { onConflict: "owner_id" });
  });

  test("com a hora guardada no mesmo fuso, mostra a hora sem gravar de novo", async () => {
    maybeSingle.mockResolvedValue({ data: { hour: 18, time_zone: zone }, error: null });
    const state = await openNotificationTime(client, zone, now);
    expect(state).toMatchObject({ status: "ready", hour: 18 });
    expect(upsert).not.toHaveBeenCalled();
  });

  test("quando o celular muda de fuso, mantém a hora e passa a usar o fuso novo", async () => {
    maybeSingle.mockResolvedValue({ data: { hour: 18, time_zone: "America/Sao_Paulo" }, error: null });
    const state = await openNotificationTime(client, zone, now);
    expect(state).toMatchObject({ status: "ready", hour: 18, timeZone: zone });
    expect(upsert).toHaveBeenCalledWith({ hour: 18, time_zone: zone, updated_at: now.toISOString() }, { onConflict: "owner_id" });
  });

  test("hora estranha no banco volta para 9h", async () => {
    maybeSingle.mockResolvedValue({ data: { hour: 30, time_zone: zone }, error: null });
    const state = await openNotificationTime(client, zone, now);
    expect(state.hour).toBe(9);
    expect(upsert).toHaveBeenCalledWith({ hour: 9, time_zone: zone, updated_at: now.toISOString() }, { onConflict: "owner_id" });
  });

  test("sem conseguir ler, avisa e não grava nada", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "x" } });
    const state = await openNotificationTime(client, zone, now);
    expect(state).toMatchObject({ status: "failed", message: notificationTimeMessages.loadFailed });
    expect(upsert).not.toHaveBeenCalled();
  });

  test("usa a hora de agora quando não recebe outra", async () => {
    await openNotificationTime(client, zone);
    expect(upsert).toHaveBeenCalled();
  });
});

describe("escolher a hora", () => {
  const ready = { ...initialNotificationTime(zone), status: "ready" as const, saving: true };

  test("guarda a hora com o fuso do celular e confirma", async () => {
    const state = await chooseNotificationHour(client, ready, 7, now);
    expect(state).toMatchObject({ hour: 7, saving: false, message: null, notice: savedNotice(7) });
    expect(upsert).toHaveBeenCalledWith({ hour: 7, time_zone: zone, updated_at: now.toISOString() }, { onConflict: "owner_id" });
  });

  test("sem conseguir guardar, volta para a hora anterior e avisa", async () => {
    upsert.mockResolvedValue({ error: { message: "x" } });
    const state = await chooseNotificationHour(client, ready, 7, now);
    expect(state).toMatchObject({ hour: 9, saving: false, message: notificationTimeMessages.saveFailed, notice: null });
  });

  test("hora que não é cheia não é guardada", async () => {
    expect(await chooseNotificationHour(client, ready, 7.5, now)).toBe(ready);
    expect(upsert).not.toHaveBeenCalled();
  });

  test("usa a hora de agora quando não recebe outra", async () => {
    await chooseNotificationHour(client, ready, 7);
    expect(upsert).toHaveBeenCalled();
  });
});
