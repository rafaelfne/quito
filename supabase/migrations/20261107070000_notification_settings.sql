create table if not exists public."notification_settings" (
  "owner_id" uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  "hour" smallint not null default 9 check ("hour" between 0 and 23),
  "time_zone" text not null check (char_length("time_zone") between 1 and 64),
  "updated_at" timestamptz not null default now()
);

alter table public."notification_settings" enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_settings' and policyname = 'virgilio_notification_settings_select_own'
  ) then
    create policy "virgilio_notification_settings_select_own" on public."notification_settings" for select to authenticated using ((select auth.uid()) = "owner_id");
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_settings' and policyname = 'virgilio_notification_settings_insert_own'
  ) then
    create policy "virgilio_notification_settings_insert_own" on public."notification_settings" for insert to authenticated with check ((select auth.uid()) = "owner_id");
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_settings' and policyname = 'virgilio_notification_settings_update_own'
  ) then
    create policy "virgilio_notification_settings_update_own" on public."notification_settings" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_settings' and policyname = 'virgilio_notification_settings_delete_own'
  ) then
    create policy "virgilio_notification_settings_delete_own" on public."notification_settings" for delete to authenticated using ((select auth.uid()) = "owner_id");
  end if;
end;
$$;
