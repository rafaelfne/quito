create table public."notification_dispatches" (
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "day" date not null,
  "charges" integer not null default 0 check ("charges" >= 0),
  "reminders" integer not null default 0 check ("reminders" >= 0),
  "created_at" timestamptz not null default now(),
  primary key ("owner_id", "day")
);

alter table public."notification_dispatches" enable row level security;
create policy "virgilio_notification_dispatches_select_own" on public."notification_dispatches" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_notification_dispatches_insert_own" on public."notification_dispatches" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_notification_dispatches_update_own" on public."notification_dispatches" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_notification_dispatches_delete_own" on public."notification_dispatches" for delete to authenticated using ((select auth.uid()) = "owner_id");
