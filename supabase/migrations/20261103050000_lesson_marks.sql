create table public."lesson_marks" (
  "id" uuid primary key default gen_random_uuid(),
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "student_id" uuid not null,
  "lesson_date" date not null,
  "status" text not null check ("status" in ('given', 'notified_absence', 'unnotified_absence', 'teacher_absence')),
  "created_at" timestamptz not null default now(),
  constraint "lesson_marks_student_owner_fkey" foreign key ("student_id", "owner_id") references public."students" ("id", "owner_id") on delete cascade,
  constraint "lesson_marks_student_date_key" unique ("student_id", "lesson_date")
);

create index "lesson_marks_owner_date_idx" on public."lesson_marks" ("owner_id", "lesson_date");

alter table public."lesson_marks" enable row level security;
create policy "virgilio_lesson_marks_select_own" on public."lesson_marks" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_lesson_marks_insert_own" on public."lesson_marks" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_lesson_marks_update_own" on public."lesson_marks" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_lesson_marks_delete_own" on public."lesson_marks" for delete to authenticated using ((select auth.uid()) = "owner_id");
