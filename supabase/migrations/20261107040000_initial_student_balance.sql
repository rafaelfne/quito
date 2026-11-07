alter table public."students"
  add column if not exists "package_balance" integer not null default 0 check ("package_balance" between 0 and 100),
  add column if not exists "makeup_credits" integer not null default 0 check ("makeup_credits" between 0 and 100);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_package_balance_valid'
      and conrelid = 'public.students'::regclass
  ) then
    alter table public."students"
      add constraint "students_package_balance_valid" check (
        "billing_kind" is distinct from 'package'
        or "package_balance" <= "package_lessons"
      );
  end if;
end;
$$;
