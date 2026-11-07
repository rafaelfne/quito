create table public."message_settings" (
  "owner_id" uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  "tone" text not null default 'friendly' check ("tone" in ('friendly', 'direct', 'formal')),
  "greeting" text check (char_length("greeting") between 1 and 40),
  "signature" text check (char_length("signature") between 1 and 80)
);

alter table public."message_settings" enable row level security;
create policy "virgilio_message_settings_select_own" on public."message_settings" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_message_settings_insert_own" on public."message_settings" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_message_settings_update_own" on public."message_settings" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_message_settings_delete_own" on public."message_settings" for delete to authenticated using ((select auth.uid()) = "owner_id");
