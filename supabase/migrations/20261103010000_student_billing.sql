alter table public."students"
  add column "billing_kind" text check ("billing_kind" in ('monthly', 'per_class', 'package')),
  add column "billing_amount_cents" integer check ("billing_amount_cents" between 1 and 10000000),
  add column "package_lessons" integer check ("package_lessons" between 1 and 100),
  add constraint "students_billing_complete" check (
    ("billing_kind" is null) = ("billing_amount_cents" is null)
    and ("package_lessons" is not null) = ("billing_kind" is not distinct from 'package')
  );
