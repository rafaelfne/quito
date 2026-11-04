import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  calendarMonthOf,
  describePlannedLessons,
  describeSchedule,
  plannedLessons,
  scheduleDraftFrom,
  scheduleMessages,
  validateSchedule,
  weekdayOptions,
} from "./schedule";

const noSchedule = { lesson_weekday: null, lesson_time: null };
const november2026 = { year: 2026, month: 11 };

function daysOf(weekday: number, calendarMonth: { year: number; month: number }) {
  return plannedLessons({ lesson_weekday: weekday, lesson_time: "15:00" }, calendarMonth).map((lesson) => lesson.date);
}

describe("validateSchedule", () => {
  test("aceita o dia e o horário e guarda o dia como número", () => {
    expect(validateSchedule({ lessonWeekday: "2", lessonTime: " 15:30 " })).toEqual({ ok: true, row: { lesson_weekday: 2, lesson_time: "15:30" } });
  });

  test.each(["0", "6"])("aceita o dia %s, nas pontas da semana", (lessonWeekday) => {
    expect(validateSchedule({ lessonWeekday, lessonTime: "00:00" }).ok).toBe(true);
    expect(validateSchedule({ lessonWeekday, lessonTime: "23:59" }).ok).toBe(true);
  });

  test("sem nada escolhido, aponta os dois campos", () => {
    expect(validateSchedule({ lessonWeekday: "", lessonTime: "" })).toEqual({
      ok: false,
      errors: { lessonWeekday: scheduleMessages.weekdayMissing, lessonTime: scheduleMessages.timeInvalid },
    });
  });

  test.each(["7", "-1", "segunda", "11"])("recusa o dia %s", (lessonWeekday) => {
    expect(validateSchedule({ lessonWeekday, lessonTime: "15:00" })).toEqual({ ok: false, errors: { lessonWeekday: scheduleMessages.weekdayMissing } });
  });

  test.each(["24:00", "15:60", "15", "3:00", "15h", "15:00:00"])("recusa o horário %s", (lessonTime) => {
    expect(validateSchedule({ lessonWeekday: "1", lessonTime })).toEqual({ ok: false, errors: { lessonTime: scheduleMessages.timeInvalid } });
  });
});

describe("scheduleDraftFrom", () => {
  test("abre com o que está guardado, sem os segundos que o banco devolve", () => {
    expect(scheduleDraftFrom({ lesson_weekday: 0, lesson_time: "15:30:00" })).toEqual({ lessonWeekday: "0", lessonTime: "15:30" });
  });

  test("aluno sem horário abre em branco", () => {
    expect(scheduleDraftFrom(noSchedule)).toEqual({ lessonWeekday: "", lessonTime: "" });
  });
});

describe("calendarMonthOf", () => {
  test("usa o mês do relógio do aparelho, contando de 1 a 12", () => {
    expect(calendarMonthOf(new Date(2026, 0, 31, 23, 59))).toEqual({ year: 2026, month: 1 });
    expect(calendarMonthOf(new Date(2026, 11, 1, 0, 0))).toEqual({ year: 2026, month: 12 });
  });
});

describe("plannedLessons", () => {
  test("mês em que o dia aparece 5 vezes gera 5 aulas", () => {
    expect(daysOf(1, november2026)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  });

  test("mês em que o dia aparece 4 vezes gera 4 aulas", () => {
    expect(daysOf(2, november2026)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  test("a aula pode cair no primeiro dia do mês", () => {
    expect(daysOf(0, november2026)[0]).toBe("2026-11-01");
  });

  test("a aula pode cair no último dia do mês", () => {
    expect(daysOf(6, { year: 2026, month: 1 }).at(-1)).toBe("2026-01-31");
  });

  test("fevereiro de ano comum tem 4 aulas e o de ano bissexto dá a quinta no dia 29", () => {
    expect(daysOf(0, { year: 2026, month: 2 })).toHaveLength(4);
    expect(daysOf(2, { year: 2028, month: 2 }).at(-1)).toBe("2028-02-29");
    expect(daysOf(2, { year: 2028, month: 2 })).toHaveLength(5);
  });

  test("dezembro não passa para o ano seguinte", () => {
    expect(daysOf(4, { year: 2026, month: 12 })).toEqual(["2026-12-03", "2026-12-10", "2026-12-17", "2026-12-24", "2026-12-31"]);
  });

  test("todo dia de 2026 a 2028 cai no dia da semana certo, e cada dia da semana dá 4 ou 5 aulas", () => {
    for (const year of [2026, 2027, 2028]) {
      for (let month = 1; month <= 12; month += 1) {
        for (const { value } of weekdayOptions) {
          const dates = daysOf(value, { year, month });
          expect([4, 5]).toContain(dates.length);
          for (const date of dates) expect(new Date(`${date}T12:00:00Z`).getUTCDay()).toBe(value);
        }
      }
    }
  });

  test("cada aula leva o horário, sem os segundos que o banco devolve", () => {
    expect(plannedLessons({ lesson_weekday: 2, lesson_time: "15:30:00" }, november2026)[0]).toEqual({ date: "2026-11-03", time: "15:30" });
  });

  test("sem horário, não há aula prevista", () => {
    expect(plannedLessons(noSchedule, november2026)).toEqual([]);
    expect(plannedLessons({ lesson_weekday: 1, lesson_time: null }, november2026)).toEqual([]);
    expect(plannedLessons({ lesson_weekday: null, lesson_time: "15:00" }, november2026)).toEqual([]);
  });
});

describe("describeSchedule", () => {
  test.each([
    [0, "Todo domingo, 09:00"],
    [1, "Toda segunda, 09:00"],
    [2, "Toda terça, 09:00"],
    [3, "Toda quarta, 09:00"],
    [4, "Toda quinta, 09:00"],
    [5, "Toda sexta, 09:00"],
    [6, "Todo sábado, 09:00"],
  ])("o dia %i vira \"%s\"", (lesson_weekday, text) => {
    expect(describeSchedule({ lesson_weekday, lesson_time: "09:00:00" })).toBe(text);
  });

  test("avisa quem ainda não tem horário", () => {
    expect(describeSchedule(noSchedule)).toBe("Horário ainda não definido");
    expect(describeSchedule({ lesson_weekday: 1, lesson_time: null })).toBe("Horário ainda não definido");
  });
});

describe("describePlannedLessons", () => {
  test("mostra o mês, a conta e os dias, com as 5 aulas quando é o caso", () => {
    expect(describePlannedLessons({ lesson_weekday: 1, lesson_time: "15:00" }, november2026)).toBe("Em novembro: 5 aulas previstas, nos dias 2, 9, 16, 23 e 30");
    expect(describePlannedLessons({ lesson_weekday: 2, lesson_time: "15:00" }, november2026)).toBe("Em novembro: 4 aulas previstas, nos dias 3, 10, 17 e 24");
  });

  test("sem horário, não mostra nada", () => {
    expect(describePlannedLessons(noSchedule, november2026)).toBeNull();
  });
});

describe("regras do horário no banco", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261103020000_student_schedule.sql"), "utf8");

  test("aceita os mesmos dias da tela", () => {
    expect(migration).toContain(`"lesson_weekday" between 0 and 6`);
    for (const { value } of weekdayOptions) expect(value).toBeLessThanOrEqual(6);
  });

  test("não deixa o horário pela metade e aceita aluno antigo sem horário", () => {
    expect(migration).toContain(`("lesson_weekday" is null) = ("lesson_time" is null)`);
    expect(migration).not.toMatch(/not null/i);
  });
});
