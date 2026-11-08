import { describe, expect, test, vi } from "vitest";
import type { Charge } from "@/lib/charges";
import { claimFirstChargeEve } from "@/lib/first-charge-eve";
import { claimDispatch, dispatchTitle, isDispatchDue, loadRecentDispatches, loadTeacherTargets, runDailyDispatch, teacherTargets, type DispatchClient, type PushSender, type TeacherTarget } from "@/lib/daily-dispatch";
import { chargeDaysToSend, describeDayWork, loadDayWork, localClock, ownerScoped } from "@/lib/day-work";

type Row = Record<string, unknown>;

type Tables = Record<string, Row[]>;

const keys: Record<string, string[]> = { notification_dispatches: ["owner_id", "day"], first_charge_eves: ["owner_id"] };

function fakeDatabase(tables: Tables, failing: string[] = []) {
  const writes: { table: string; kind: string; row?: Row }[] = [];

  function query(table: string, rows: () => Row[]) {
    const filters: ((row: Row) => boolean)[] = [];
    let window: [number, number] = [0, Infinity];
    const result = () => {
      if (failing.includes(table)) return { data: null, error: { message: "fora do ar" } };
      return { data: rows().filter((row) => filters.every((keep) => keep(row))).slice(...window), error: null };
    };
    const builder = {
      eq: (column: string, value: unknown) => (filters.push((row) => row[column] === value), builder),
      lt: (column: string, value: string) => (filters.push((row) => String(row[column]) < value), builder),
      lte: (column: string, value: string) => (filters.push((row) => String(row[column]) <= value), builder),
      gte: (column: string, value: string) => (filters.push((row) => String(row[column]) >= value), builder),
      in: (column: string, values: unknown[]) => (filters.push((row) => values.includes(row[column])), builder),
      order: () => builder,
      range: (from: number, to: number) => ((window = [from, to + 1]), builder),
      maybeSingle: async () => {
        const found = result();
        return found.error ? found : { data: found.data?.[0] ?? null, error: null };
      },
      then: (resolve: (value: ReturnType<typeof result>) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  }

  const from = vi.fn((table: string) => ({
    select: () => query(table, () => tables[table] ?? []),
    upsert: (row: Row) => {
      const existing = (tables[table] ??= []);
      const clash = existing.some((other) => (keys[table] ?? []).every((key) => other[key] === row[key]));
      const added = clash || failing.includes(`${table}:write`) ? [] : [row];
      existing.push(...added);
      writes.push({ table, kind: "upsert", row });
      return { select: async () => (failing.includes(`${table}:write`) ? { data: null, error: { message: "fora do ar" } } : { data: added, error: null }) };
    },
    update: (changes: Row) => {
      const filters: Row = {};
      const builder = {
        eq: (column: string, value: unknown) => ((filters[column] = value), builder),
        then: (resolve: (value: { error: null }) => unknown) => {
          for (const row of tables[table] ?? []) if (Object.entries(filters).every(([key, wanted]) => row[key] === wanted)) Object.assign(row, changes);
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      writes.push({ table, kind: "update", row: changes });
      return builder;
    },
    delete: () => {
      const filters: Row = {};
      const builder = {
        eq: (column: string, value: unknown) => ((filters[column] = value), builder),
        then: (resolve: (value: { error: null }) => unknown) => {
          tables[table] = (tables[table] ?? []).filter((row) => !Object.entries(filters).every(([key, wanted]) => row[key] === wanted));
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      writes.push({ table, kind: "delete" });
      return builder;
    },
  }));

  return { client: { from } as unknown as DispatchClient, writes, tables };
}

const teacher = "prof-1";
const other = "prof-2";

function student(id: string, ownerId: string, overrides: Row = {}): Row {
  return { id, owner_id: ownerId, name: "Pedro Lima", gender: "male", called_as: null, guardian_name: "Ana Lima", guardian_phone: "11987654321", billing_kind: "monthly", billing_amount_cents: 30000, package_lessons: null, lesson_weekday: 1, lesson_time: "15:00:00", created_at: "2026-10-01T12:00:00Z", ...overrides };
}

function perClass(id: string, ownerId: string, guardianPhone: string): Row {
  return student(id, ownerId, { name: "Bia Rocha", guardian_name: "Rui Rocha", guardian_phone: guardianPhone, billing_kind: "per_class", billing_amount_cents: 10000 });
}

function charge(overrides: Partial<Charge> & Row): Row {
  return {
    id: "c1",
    owner_id: teacher,
    charge_month: "2026-11-01",
    guardian_phone: "11911112222",
    guardian_name: "Caio Melo",
    total_cents: 8000,
    account: [{ studentId: "lia", studentName: "Lia Melo", lines: [{ label: "Aulas", cents: 8000 }], attendance: "", packageBalance: null, credits: [], totalCents: 8000 }],
    sent_at: null,
    paid_at: null,
    reminders_sent_at: [],
    ...overrides,
  };
}

function teacherData(ownerId: string, dueDay: number): Tables {
  return {
    students: [student(`pedro-${ownerId}`, ownerId)],
    payment_settings: [{ owner_id: ownerId, pix_key: "ana@exemplo.com", display_name: "Ana", due_day: dueDay }],
    message_settings: [{ owner_id: ownerId, tone: "friendly", greeting: null, thanks: null, signature: null, footer: true, reminder_days: [3, 7] }],
    teacher_rules: [{ owner_id: ownerId, notice_hours: 24, makeup_deadline_days: null, five_week_policy: "same_price", five_week_extra_cents: null, sibling_discount_percent: 10 }],
  };
}

function merged(...all: Tables[]): Tables {
  const tables: Tables = {};
  for (const one of all) for (const [name, rows] of Object.entries(one)) tables[name] = [...(tables[name] ?? []), ...rows];
  return tables;
}

const saoPaulo = "America/Sao_Paulo";

describe("hora e dia no fuso do professor", () => {
  test("o dia e a hora são os do celular do professor", () => {
    expect(localClock(new Date("2026-12-05T11:30:00Z"), saoPaulo)).toEqual({ date: "2026-12-05", hour: 8 });
    expect(localClock(new Date("2026-12-06T01:30:00Z"), saoPaulo)).toEqual({ date: "2026-12-05", hour: 22 });
    expect(localClock(new Date("2026-12-05T11:30:00Z"), "Europe/Lisbon")).toEqual({ date: "2026-12-05", hour: 11 });
  });

  test("fuso desconhecido vira o de Brasília", () => {
    expect(localClock(new Date("2026-12-05T12:00:00Z"), "Lugar/Nenhum")).toEqual({ date: "2026-12-05", hour: 9 });
  });

  test("meia-noite conta como 0h", () => {
    expect(localClock(new Date("2026-12-05T03:00:00Z"), saoPaulo)).toEqual({ date: "2026-12-05", hour: 0 });
  });
});

describe("texto da notificação, só com a quantidade", () => {
  test("cobranças", () => {
    expect(describeDayWork({ charges: 3, reminders: 0, unmarked: 0 })).toBe("3 cobranças para enviar hoje");
    expect(describeDayWork({ charges: 1, reminders: 0, unmarked: 0 })).toBe("1 cobrança para enviar hoje");
  });

  test("lembretes", () => {
    expect(describeDayWork({ charges: 0, reminders: 2, unmarked: 0 })).toBe("2 lembretes para enviar hoje");
    expect(describeDayWork({ charges: 0, reminders: 1, unmarked: 0 })).toBe("1 lembrete para enviar hoje");
  });

  test("cobranças e lembretes juntos", () => {
    expect(describeDayWork({ charges: 1, reminders: 2, unmarked: 0 })).toBe("1 cobrança e 2 lembretes para enviar hoje");
  });

  test("cobranças que precisam de aula marcada", () => {
    expect(describeDayWork({ charges: 0, reminders: 0, unmarked: 2 })).toBe("2 cobranças precisam de aula marcada");
    expect(describeDayWork({ charges: 0, reminders: 0, unmarked: 1 })).toBe("1 cobrança precisa de aula marcada");
  });

  test("a mesma notificação junta o que enviar e o que falta marcar", () => {
    expect(describeDayWork({ charges: 3, reminders: 1, unmarked: 2 })).toBe("3 cobranças e 1 lembrete para enviar hoje. 2 cobranças precisam de aula marcada");
  });

  test("dia sem nada a fazer não tem texto", () => {
    expect(describeDayWork({ charges: 0, reminders: 0, unmarked: 0 })).toBeNull();
  });
});

describe("o que o professor tem para enviar no dia", () => {
  test("cada professor só enxerga os próprios dados", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), teacherData(other, 5)));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 1, reminders: 0, unmarked: 0 });
  });

  test("conta a cobrança que vence hoje mesmo antes de o professor abrir o painel", async () => {
    const { client, writes } = fakeDatabase(teacherData(teacher, 5));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 1, reminders: 0, unmarked: 0 });
    expect(writes).toEqual([]);
  });

  test("cobrança que vence outro dia não conta", async () => {
    const { client } = fakeDatabase(teacherData(teacher, 10));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("cobrança já enviada não conta de novo", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { charges: [charge({ guardian_phone: "11987654321", sent_at: "2026-12-05T12:00:00Z" })] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("cobrança guardada e ainda não enviada conta", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { charges: [charge({})] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 2, reminders: 0, unmarked: 0 });
  });

  test("conta o lembrete do dia, no fuso do professor", async () => {
    const sentLateAtNight = charge({ sent_at: "2026-12-03T01:00:00Z" });
    const { client } = fakeDatabase(merged(teacherData(teacher, 1), { charges: [sentLateAtNight] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 1, unmarked: 0 });
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", "UTC")).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("cobrança paga não pede lembrete", async () => {
    const paid = charge({ sent_at: "2026-12-02T13:00:00Z", paid_at: "2026-12-04T13:00:00Z" });
    const { client } = fakeDatabase(merged(teacherData(teacher, 1), { charges: [paid] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("mês de treino não conta cobrança", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { getting_started: [{ owner_id: teacher, started_at: "2026-11-10T12:00:00Z" }] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("cobrança que vence hoje com aula sem marcar conta à parte", async () => {
    const { client, writes } = fakeDatabase(merged(teacherData(teacher, 5), { students: [perClass("bia", teacher, "11955556666")] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 1, reminders: 0, unmarked: 1 });
    expect(writes).toEqual([]);
  });

  test("aula sem marcar só conta no dia do vencimento", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 10), { students: [perClass("bia", teacher, "11955556666")] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("o vencimento próprio do responsável vale para a aula sem marcar", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 10), { students: [perClass("bia", teacher, "11955556666")], guardian_due_days: [{ owner_id: teacher, guardian_phone: "11955556666", due_day: 5 }] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 1 });
  });

  test("falta só a forma de cobrança não conta como aula sem marcar", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { students: [student("bia", teacher, { guardian_phone: "11955556666", billing_kind: null, billing_amount_cents: null })] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 1, reminders: 0, unmarked: 0 });
  });

  test("sem chave Pix guardada, não há vencimento para contar", async () => {
    const { client } = fakeDatabase(merged({ ...teacherData(teacher, 5), payment_settings: [] }, { students: [perClass("bia", teacher, "11955556666")] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("sem conseguir ler os dados, não decide nada", async () => {
    const { client } = fakeDatabase(teacherData(teacher, 5), ["payment_settings"]);
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toBeNull();
  });
});

describe("repetição no dia seguinte", () => {
  test("a cobrança conta no dia dela e no dia seguinte", () => {
    expect(chargeDaysToSend("2026-12-05")).toEqual(["2026-12-05", "2026-12-04"]);
    expect(chargeDaysToSend("2026-12-01")).toEqual(["2026-12-01", "2026-11-30"]);
  });

  test("cobrança de ontem ainda não enviada conta de novo hoje", async () => {
    const { client } = fakeDatabase(teacherData(teacher, 5));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-06", saoPaulo)).toEqual({ charges: 1, reminders: 0, unmarked: 0 });
  });

  test("cobrança de ontem já enviada não repete", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { charges: [charge({ guardian_phone: "11987654321", sent_at: "2026-12-05T23:00:00Z" })] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-06", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("a repetição é uma só: dois dias depois não conta mais", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { charges: [charge({})] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-07", saoPaulo)).toEqual({ charges: 0, reminders: 0, unmarked: 0 });
  });

  test("cobrança de ontem soma com a de hoje", async () => {
    const tables = merged(teacherData(teacher, 6), { charges: [charge({})], guardian_due_days: [{ owner_id: teacher, guardian_phone: "11911112222", due_day: 5 }] });
    const { client } = fakeDatabase(tables);
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-06", saoPaulo)).toEqual({ charges: 2, reminders: 0, unmarked: 0 });
  });

  test("no dia seguinte, a cobrança repete e a aula sem marcar não", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { students: [perClass("bia", teacher, "11955556666")] }));
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-05", saoPaulo)).toEqual({ charges: 1, reminders: 0, unmarked: 1 });
    expect(await loadDayWork(ownerScoped(client, teacher), "2026-12-06", saoPaulo)).toEqual({ charges: 1, reminders: 0, unmarked: 0 });
  });

  test("avisa no dia, repete uma vez no dia seguinte e para", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 1, quiet: 0, failed: 0 });
    expect(await runDailyDispatch(client, send, new Date("2026-12-06T12:05:00Z"))).toEqual({ notified: 1, quiet: 0, failed: 0 });
    expect(await runDailyDispatch(client, send, new Date("2026-12-07T12:05:00Z"))).toEqual({ notified: 0, quiet: 1, failed: 0 });
    expect(send.mock.calls.map(([, message]) => message.body)).toEqual(["1 cobrança para enviar hoje", "1 cobrança para enviar hoje"]);
  });

  test("cobrança enviada no dia não repete no dia seguinte", async () => {
    const sent = { charges: [charge({ guardian_phone: "11987654321", guardian_name: "Ana Lima", sent_at: "2026-12-05T13:00:00Z" })] };
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), sent, subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, new Date("2026-12-06T12:05:00Z"))).toEqual({ notified: 0, quiet: 1, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("professores que recebem a notificação", () => {
  test("junta os aparelhos de cada professor com o horário escolhido", () => {
    const subscriptions = [
      { owner_id: teacher, endpoint: "a", p256dh: "k", auth: "s" },
      { owner_id: teacher, endpoint: "b", p256dh: "k", auth: "s" },
      { owner_id: other, endpoint: "c", p256dh: "k", auth: "s" },
    ];
    expect(teacherTargets(subscriptions, [{ owner_id: teacher, hour: 7, time_zone: "America/Manaus" }])).toEqual([
      { ownerId: teacher, hour: 7, timeZone: "America/Manaus", devices: [{ endpoint: "a", p256dh: "k", auth: "s" }, { endpoint: "b", p256dh: "k", auth: "s" }] },
      { ownerId: other, hour: 9, timeZone: saoPaulo, devices: [{ endpoint: "c", p256dh: "k", auth: "s" }] },
    ]);
  });

  test("hora inválida volta para 9h", () => {
    const [target] = teacherTargets([{ owner_id: teacher, endpoint: "a", p256dh: "k", auth: "s" }], [{ owner_id: teacher, hour: 30, time_zone: "" }]);
    expect(target).toMatchObject({ hour: 9, timeZone: saoPaulo });
  });

  test("lê todas as páginas de aparelhos", async () => {
    const many = Array.from({ length: 1001 }, (_, index) => ({ owner_id: `p${index}`, endpoint: `e${index}`, p256dh: "k", auth: "s" }));
    const { client } = fakeDatabase({ push_subscriptions: many, notification_settings: [] });
    expect(await loadTeacherTargets(client)).toHaveLength(1001);
  });

  test("sem conseguir ler os aparelhos, não devolve nada", async () => {
    const { client } = fakeDatabase({}, ["push_subscriptions"]);
    expect(await loadTeacherTargets(client)).toBeNull();
  });

  test("é hora de avisar a partir da hora escolhida, no fuso dele", () => {
    const target: TeacherTarget = { ownerId: teacher, hour: 9, timeZone: saoPaulo, devices: [] };
    expect(isDispatchDue(target, new Date("2026-12-05T11:59:00Z"))).toBe(false);
    expect(isDispatchDue(target, new Date("2026-12-05T12:00:00Z"))).toBe(true);
    expect(isDispatchDue(target, new Date("2026-12-06T02:00:00Z"))).toBe(true);
  });
});

describe("registro do aviso do dia", () => {
  test("só o primeiro registro do dia vale", async () => {
    const { client } = fakeDatabase({ notification_dispatches: [] });
    expect(await claimDispatch(client, teacher, "2026-12-05", { charges: 1, reminders: 0, unmarked: 0 })).toBe(true);
    expect(await claimDispatch(client, teacher, "2026-12-05", { charges: 1, reminders: 0, unmarked: 0 })).toBe(false);
    expect(await claimDispatch(client, teacher, "2026-12-06", { charges: 0, reminders: 0, unmarked: 0 })).toBe(true);
  });

  test("lê os avisos recentes", async () => {
    const { client } = fakeDatabase({ notification_dispatches: [{ owner_id: teacher, day: "2026-12-03" }, { owner_id: teacher, day: "2026-12-05" }] });
    expect(await loadRecentDispatches(client, "2026-12-04")).toEqual(new Set([`${teacher}:2026-12-05`]));
  });

  test("sem conseguir ler os avisos, não devolve nada", async () => {
    const { client } = fakeDatabase({}, ["notification_dispatches"]);
    expect(await loadRecentDispatches(client, "2026-12-04")).toBeNull();
  });
});

function subscribed(ownerId: string, endpoints: string[], hour = 9): Tables {
  return {
    push_subscriptions: endpoints.map((endpoint, index) => ({ id: `${ownerId}-${index}`, owner_id: ownerId, endpoint, p256dh: "k", auth: "s" })),
    notification_settings: [{ owner_id: ownerId, hour, time_zone: saoPaulo }],
  };
}

const nineInSaoPaulo = new Date("2026-12-05T12:05:00Z");

describe("disparo diário", () => {
  test("no horário, avisa cada aparelho só com a quantidade e abre o painel do dia", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a", "b"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 1, quiet: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]).toEqual([{ endpoint: "a", p256dh: "k", auth: "s" }, { title: dispatchTitle, body: "1 cobrança para enviar hoje", path: "/charges?from=notification" }]);
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/Ana Lima|Pedro|300/);
    expect(tables.notification_dispatches).toEqual([{ owner_id: teacher, day: "2026-12-05", charges: 1, reminders: 0 }]);
  });

  test("com aula sem marcar no dia do vencimento, a mesma notificação avisa e o toque leva ao painel", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), { students: [perClass("bia", teacher, "11955556666"), perClass("leo", teacher, "11977778888")] }, subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 1, quiet: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toEqual({ title: dispatchTitle, body: "1 cobrança para enviar hoje. 2 cobranças precisam de aula marcada", path: "/charges?from=notification" });
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/Rocha|Bia|Leo|100/);
  });

  test("dia só com aula sem marcar também avisa", async () => {
    const { client } = fakeDatabase(merged({ ...teacherData(teacher, 5), students: [perClass("bia", teacher, "11955556666")] }, subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 1, quiet: 0, failed: 0 });
    expect(send.mock.calls[0][1].body).toBe("1 cobrança precisa de aula marcada");
  });

  test("avisa uma vez só no dia, mesmo rodando de novo", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    await runDailyDispatch(client, send, nineInSaoPaulo);
    expect(await runDailyDispatch(client, send, new Date("2026-12-05T15:00:00Z"))).toEqual({ notified: 0, quiet: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("dois disparos ao mesmo tempo não avisam duas vezes", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    await Promise.all([runDailyDispatch(client, send, nineInSaoPaulo), runDailyDispatch(client, send, nineInSaoPaulo)]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("antes do horário, não avisa", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a"], 10), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 0, quiet: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  test("domingo e feriado também avisam", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 25), subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, new Date("2026-12-25T12:00:00Z"))).toEqual({ notified: 1, quiet: 0, failed: 0 });
  });

  test("dia sem nada a fazer não tem notificação", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 10), subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 0, quiet: 1, failed: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(tables.notification_dispatches).toHaveLength(1);
  });

  test("aparelho que não existe mais sai da lista", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a", "b"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async ({ endpoint }) => (endpoint === "a" ? "gone" : "sent"));
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 1, quiet: 0, failed: 0 });
    expect(tables.push_subscriptions.map((row) => row.endpoint)).toEqual(["b"]);
  });

  test("se nenhum aparelho recebeu, conta como falha", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a"]), { notification_dispatches: [] }));
    expect(await runDailyDispatch(client, async () => "failed", nineInSaoPaulo)).toEqual({ notified: 0, quiet: 0, failed: 1 });
  });

  test("sem conseguir ler os dados do professor, tenta de novo na próxima volta", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a"]), { notification_dispatches: [] }), ["payment_settings"]);
    expect(await runDailyDispatch(client, async () => "sent", nineInSaoPaulo)).toEqual({ notified: 0, quiet: 0, failed: 1 });
    expect(tables.notification_dispatches).toEqual([]);
  });

  test("sem conseguir registrar o aviso, não avisa", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), subscribed(teacher, ["a"]), { notification_dispatches: [] }), ["notification_dispatches:write"]);
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 0, quiet: 1, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  test("erro inesperado num professor não para os outros", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), teacherData(other, 5), subscribed(teacher, ["a"]), subscribed(other, ["b"]), { notification_dispatches: [] }));
    const send = vi.fn<PushSender>(async ({ endpoint }) => {
      if (endpoint === "a") throw new Error("rede");
      return "sent";
    });
    expect(await runDailyDispatch(client, send, nineInSaoPaulo)).toEqual({ notified: 1, quiet: 0, failed: 1 });
  });

  test("sem conseguir ler quem recebe, não faz nada", async () => {
    const { client } = fakeDatabase({}, ["notification_dispatches"]);
    expect(await runDailyDispatch(client, async () => "sent", nineInSaoPaulo)).toBeNull();
  });
});

describe("aviso na véspera da primeira cobrança", () => {
  const eveInSaoPaulo = new Date("2026-12-04T12:05:00Z");
  const enteredInOctober = { getting_started: [{ owner_id: teacher, started_at: "2026-10-10T12:00:00Z" }] };
  const eveBody = "Amanhã é o dia da sua primeira cobrança: 1 cobrança para enviar. As notificações deste celular estão funcionando.";

  test("na véspera, no horário escolhido, lembra o dia seguinte e guarda que a inscrição continua valendo", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 5), enteredInOctober, subscribed(teacher, ["a", "b"]), { notification_dispatches: [], first_charge_eves: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, eveInSaoPaulo)).toEqual({ notified: 1, quiet: 0, failed: 0 });
    expect(send.mock.calls.map(([device, message]) => [device.endpoint, message])).toEqual([
      ["a", { title: dispatchTitle, body: eveBody, path: "/charges" }],
      ["b", { title: dispatchTitle, body: eveBody, path: "/charges" }],
    ]);
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/Ana Lima|Pedro|300/);
    expect(tables.first_charge_eves).toEqual([{ owner_id: teacher, due_date: "2026-12-05", charges: 1, devices: 2, reached: 2 }]);
  });

  test("é uma única notificação: no dia da cobrança vem só o aviso do dia", async () => {
    const { client } = fakeDatabase(merged(teacherData(teacher, 5), enteredInOctober, subscribed(teacher, ["a"]), { notification_dispatches: [], first_charge_eves: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    await runDailyDispatch(client, send, eveInSaoPaulo);
    await runDailyDispatch(client, send, new Date("2026-12-04T20:00:00Z"));
    await runDailyDispatch(client, send, nineInSaoPaulo);
    expect(send.mock.calls.map(([, message]) => message.body)).toEqual([eveBody, "1 cobrança para enviar hoje"]);
  });

  test("o registro da véspera vale uma vez só por professor", async () => {
    const { client } = fakeDatabase({ first_charge_eves: [] });
    const eve = { dueDate: "2026-12-05", charges: 1 };
    expect(await claimFirstChargeEve(client, teacher, eve, 1)).toBe(true);
    expect(await claimFirstChargeEve(client, teacher, { dueDate: "2027-01-05", charges: 1 }, 1)).toBe(false);
  });

  test("se a inscrição se perdeu na espera, o aparelho sai da lista e o registro mostra que não chegou", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 5), enteredInOctober, subscribed(teacher, ["a"]), { notification_dispatches: [], first_charge_eves: [] }));
    expect(await runDailyDispatch(client, async () => "gone", eveInSaoPaulo)).toEqual({ notified: 0, quiet: 0, failed: 1 });
    expect(tables.push_subscriptions).toEqual([]);
    expect(tables.first_charge_eves).toEqual([{ owner_id: teacher, due_date: "2026-12-05", charges: 1, devices: 1, reached: 0 }]);
  });

  test("quem começou antes e já passou da primeira cobrança não recebe a véspera", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 5), { getting_started: [{ owner_id: teacher, started_at: "2026-09-10T12:00:00Z" }] }, subscribed(teacher, ["a"]), { notification_dispatches: [], first_charge_eves: [] }));
    const send = vi.fn<PushSender>(async () => "sent");
    expect(await runDailyDispatch(client, send, eveInSaoPaulo)).toEqual({ notified: 0, quiet: 1, failed: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(tables.first_charge_eves).toEqual([]);
  });

  test("sem conseguir ler o começo do professor, tenta de novo na próxima volta", async () => {
    const { client, tables } = fakeDatabase(merged(teacherData(teacher, 5), enteredInOctober, subscribed(teacher, ["a"]), { notification_dispatches: [], first_charge_eves: [] }), ["getting_started"]);
    expect(await runDailyDispatch(client, async () => "sent", eveInSaoPaulo)).toEqual({ notified: 0, quiet: 0, failed: 1 });
    expect(tables.notification_dispatches).toEqual([]);
  });
});
