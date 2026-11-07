alter table public."students"
  add column "called_as" text check (char_length("called_as") between 1 and 120),
  add constraint "students_called_as_complete" check (("called_as" is not null) = ("gender" is not distinct from 'other'));
