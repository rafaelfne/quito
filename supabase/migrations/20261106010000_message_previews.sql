create table public."message_previews" (
  "owner_id" uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  "confirmed_at" timestamptz not null default now()
);

alter table public."message_previews" enable row level security;
create policy "virgilio_message_previews_select_own" on public."message_previews" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_message_previews_insert_own" on public."message_previews" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_message_previews_update_own" on public."message_previews" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_message_previews_delete_own" on public."message_previews" for delete to authenticated using ((select auth.uid()) = "owner_id");
