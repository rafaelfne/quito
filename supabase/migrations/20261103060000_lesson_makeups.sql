alter table public."lesson_marks"
  add column "makeup_date" date,
  add constraint "lesson_marks_makeup_valid" check (
    "makeup_date" is null
    or ("status" in ('notified_absence', 'teacher_absence') and "makeup_date" >= "lesson_date")
  );
