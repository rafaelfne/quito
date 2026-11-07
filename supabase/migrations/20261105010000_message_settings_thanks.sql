alter table public."message_settings" add column "thanks" text check (char_length("thanks") between 1 and 40);
