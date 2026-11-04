alter table public."teacher_rules"
  add column "sibling_discount_percent" integer not null default 0 check ("sibling_discount_percent" between 0 and 100);
