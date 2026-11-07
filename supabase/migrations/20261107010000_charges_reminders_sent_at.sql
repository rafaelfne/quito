alter table public."charges" add column if not exists "reminders_sent_at" timestamptz[] not null default '{}';
