create table public."notification_events" (
  "id" uuid primary key default gen_random_uuid(),
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "kind" text not null check ("kind" in ('active', 'inactive', 'tap')),
  "device" text not null check ("device" in ('android', 'iphone', 'computer')),
  "day" date not null,
  "occurred_at" timestamptz not null default now(),
  unique ("owner_id", "kind", "device", "day")
);

alter table public."notification_events" enable row level security;
create policy "virgilio_notification_events_select_own" on public."notification_events" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_notification_events_insert_own" on public."notification_events" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_notification_events_update_own" on public."notification_events" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_notification_events_delete_own" on public."notification_events" for delete to authenticated using ((select auth.uid()) = "owner_id");
