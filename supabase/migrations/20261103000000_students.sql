create table public."students" (
  "id" uuid primary key default gen_random_uuid(),
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "name" text not null check (char_length(btrim("name")) between 1 and 120),
  "guardian_name" text not null check (char_length(btrim("guardian_name")) between 1 and 120),
  "guardian_phone" text not null check ("guardian_phone" ~ '^[1-9]{2}(9[0-9]{8}|[2-9][0-9]{7})$'),
  "created_at" timestamptz not null default now()
);

create index "students_owner_id_idx" on public."students" ("owner_id");

alter table public."students" enable row level security;
create policy "virgilio_students_select_own" on public."students" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_students_insert_own" on public."students" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_students_update_own" on public."students" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_students_delete_own" on public."students" for delete to authenticated using ((select auth.uid()) = "owner_id");
