create table public."payment_settings" (
  "owner_id" uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  "pix_key" text not null check (char_length("pix_key") between 1 and 77),
  "display_name" text not null check (char_length("display_name") between 1 and 80),
  "due_day" integer not null default 5 check ("due_day" between 1 and 31)
);

alter table public."payment_settings" enable row level security;
create policy "virgilio_payment_settings_select_own" on public."payment_settings" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_payment_settings_insert_own" on public."payment_settings" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_payment_settings_update_own" on public."payment_settings" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_payment_settings_delete_own" on public."payment_settings" for delete to authenticated using ((select auth.uid()) = "owner_id");
