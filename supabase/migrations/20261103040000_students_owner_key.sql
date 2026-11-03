alter table public."students"
  add constraint "students_id_owner_id_key" unique ("id", "owner_id");
