create table public."first_charge_eves" (
  "owner_id" uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  "due_date" date not null,
  "charges" integer not null default 0 check ("charges" >= 0),
  "devices" integer not null default 0 check ("devices" >= 0),
  "reached" integer check ("reached" >= 0),
  "created_at" timestamptz not null default now()
);

alter table public."first_charge_eves" enable row level security;
create policy "virgilio_first_charge_eves_select_own" on public."first_charge_eves" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_first_charge_eves_insert_own" on public."first_charge_eves" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_first_charge_eves_update_own" on public."first_charge_eves" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_first_charge_eves_delete_own" on public."first_charge_eves" for delete to authenticated using ((select auth.uid()) = "owner_id");
