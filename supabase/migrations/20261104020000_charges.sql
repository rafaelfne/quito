create table public."charges" (
  "id" uuid primary key default gen_random_uuid(),
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "charge_month" date not null check (extract(day from "charge_month") = 1),
  "guardian_phone" text not null check ("guardian_phone" ~ '^[1-9]{2}(9[0-9]{8}|[2-9][0-9]{7})$'),
  "guardian_name" text not null check (char_length("guardian_name") > 0),
  "total_cents" integer not null check ("total_cents" >= 0),
  "account" jsonb not null check (jsonb_typeof("account") = 'array'),
  "created_at" timestamptz not null default now(),
  constraint "charges_owner_month_guardian_key" unique ("owner_id", "charge_month", "guardian_phone")
);

alter table public."charges" enable row level security;
create policy "virgilio_charges_select_own" on public."charges" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_charges_insert_own" on public."charges" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_charges_update_own" on public."charges" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_charges_delete_own" on public."charges" for delete to authenticated using ((select auth.uid()) = "owner_id");
