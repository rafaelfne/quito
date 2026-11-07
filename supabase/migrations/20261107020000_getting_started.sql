create table public."getting_started" (
  "owner_id" uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  "started_at" timestamptz not null default now(),
  "finished_at" timestamptz
);

alter table public."getting_started" enable row level security;
create policy "virgilio_getting_started_select_own" on public."getting_started" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_getting_started_insert_own" on public."getting_started" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_getting_started_update_own" on public."getting_started" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_getting_started_delete_own" on public."getting_started" for delete to authenticated using ((select auth.uid()) = "owner_id");
