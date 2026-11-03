create table public."teacher_rules" (
  "owner_id" uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  "notice_hours" integer not null default 24 check ("notice_hours" between 1 and 168),
  "makeup_deadline_days" integer check ("makeup_deadline_days" between 1 and 365),
  "five_week_policy" text not null default 'same_price' check ("five_week_policy" in ('same_price', 'add_lesson')),
  "five_week_extra_cents" integer check ("five_week_extra_cents" between 1 and 10000000),
  constraint "teacher_rules_extra_complete" check (("five_week_policy" = 'add_lesson') = ("five_week_extra_cents" is not null))
);

alter table public."teacher_rules" enable row level security;
create policy "virgilio_teacher_rules_select_own" on public."teacher_rules" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_teacher_rules_insert_own" on public."teacher_rules" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_teacher_rules_update_own" on public."teacher_rules" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_teacher_rules_delete_own" on public."teacher_rules" for delete to authenticated using ((select auth.uid()) = "owner_id");
