alter table public."getting_started"
add column "baseline_delay_days" integer check ("baseline_delay_days" between 0 and 365);
