create table public."push_subscriptions" (
  "id" uuid primary key default gen_random_uuid(),
  "owner_id" uuid not null default auth.uid() references auth.users (id) on delete cascade,
  "endpoint" text not null check (char_length("endpoint") between 1 and 2048),
  "p256dh" text not null check (char_length("p256dh") between 1 and 256),
  "auth" text not null check (char_length("auth") between 1 and 256),
  "device" text not null check ("device" in ('android', 'iphone', 'computer')),
  "created_at" timestamptz not null default now(),
  "seen_at" timestamptz not null default now(),
  unique ("owner_id", "endpoint")
);

alter table public."push_subscriptions" enable row level security;
create policy "virgilio_push_subscriptions_select_own" on public."push_subscriptions" for select to authenticated using ((select auth.uid()) = "owner_id");
create policy "virgilio_push_subscriptions_insert_own" on public."push_subscriptions" for insert to authenticated with check ((select auth.uid()) = "owner_id");
create policy "virgilio_push_subscriptions_update_own" on public."push_subscriptions" for update to authenticated using ((select auth.uid()) = "owner_id") with check ((select auth.uid()) = "owner_id");
create policy "virgilio_push_subscriptions_delete_own" on public."push_subscriptions" for delete to authenticated using ((select auth.uid()) = "owner_id");
