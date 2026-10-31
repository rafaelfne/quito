create table public."notes" (
  "id" uuid primary key default gen_random_uuid(),
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "body" text not null,
  "created_at" timestamptz not null default now()
);

alter table public."notes" enable row level security;
create policy "virgilio_notes_select_own" on public."notes" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_notes_insert_own" on public."notes" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_notes_update_own" on public."notes" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_notes_delete_own" on public."notes" for delete to authenticated using ((select auth.uid()) = "owner_id");
