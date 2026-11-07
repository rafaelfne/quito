alter table public."students" drop constraint "students_gender_check";
update public."students" set "gender" = 'male' where "gender" = 'boy';
update public."students" set "gender" = 'female' where "gender" = 'girl';
alter table public."students" add constraint "students_gender_check" check ("gender" in ('male', 'female', 'other'));
