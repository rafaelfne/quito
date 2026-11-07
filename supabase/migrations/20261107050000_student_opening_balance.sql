alter table public."students"
  add column "opening_balance_on" date,
  add column "opening_package_balance" integer check ("opening_package_balance" between 0 and 100),
  add column "opening_makeup_credits" integer check ("opening_makeup_credits" between 0 and 100),
  add constraint "students_opening_balance_complete" check (("opening_balance_on" is null) = ("opening_makeup_credits" is null));
