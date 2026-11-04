alter table public."students"
  add column "lesson_weekday" smallint check ("lesson_weekday" between 0 and 6),
  add column "lesson_time" time,
  add constraint "students_schedule_complete" check (("lesson_weekday" is null) = ("lesson_time" is null));
