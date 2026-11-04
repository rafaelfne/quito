create table public."guardian_due_days" (
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "guardian_phone" text not null check ("guardian_phone" ~ '^[1-9]{2}(9[0-9]{8}|[2-9][0-9]{7})$'),
  "due_day" integer not null check ("due_day" between 1 and 31),
  primary key ("owner_id", "guardian_phone")
);

create index "guardian_due_days_owner_id_idx" on public."guardian_due_days" ("owner_id");

alter table public."guardian_due_days" enable row level security;
create policy "virgilio_guardian_due_days_select_own" on public."guardian_due_days" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_guardian_due_days_insert_own" on public."guardian_due_days" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_guardian_due_days_update_own" on public."guardian_due_days" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_guardian_due_days_delete_own" on public."guardian_due_days" for delete to authenticated using ((select auth.uid()) = "owner_id");
