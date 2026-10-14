-- Run only in the isolated E2E database. Every fixture is rolled back.
begin;
do $$ begin
  if not exists (select 1 from public.e2e_environment where environment = 'test' and project_ref = 'nazyeklqgcygfuvzzgql') then
    raise exception 'Isolated E2E database required';
  end if;
end $$;
insert into public.user_permissions (id,email,role,permissions) values
  (gen_random_uuid()::text, 'equipment-rls-field@example.invalid', 'field', '{"maint_list":true}'),
  (gen_random_uuid()::text, 'equipment-rls-denied@example.invalid', 'field', '{"maint_list":true,"maint_equipment":false}'),
  (gen_random_uuid()::text, 'equipment-rls-office@example.invalid', 'office', '{}');
insert into public.maintenance_equipment_items(category,name,source_key,shared_note_key,notes) values
  ('RLS test', 'Item A', 'rls-item-a', 'rls-shared-note', 'Original'),
  ('RLS test', 'Item B', 'rls-item-b', 'rls-shared-note', 'Original');
select set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',(select u.id from auth.users u join public.user_permissions p on lower(u.email)=lower(p.email) where p.role='admin' limit 1),'email',(select u.email from auth.users u join public.user_permissions p on lower(u.email)=lower(p.email) where p.role='admin' limit 1))::text, true);
set local role authenticated;
do $$ declare a public.maintenance_equipment_items%rowtype; n integer; begin
  select * into a from public.maintenance_equipment_items where source_key='rls-item-a';
  if a.id is null then raise exception 'Admin cannot read'; end if;
  perform * from public.save_maintenance_equipment_item(a.id,a.updated_at,'{"category":"RLS test","name":"Item A changed","notes":"Shared update"}');
  select count(*) into n from public.maintenance_equipment_items where shared_note_key='rls-shared-note' and notes='Shared update';
  if n<>2 then raise exception 'Shared notes not atomic'; end if;
  begin
    perform * from public.save_maintenance_equipment_item(a.id,a.updated_at,'{"category":"RLS test","name":"Stale"}');
    raise exception 'Stale write accepted';
  exception when sqlstate 'PT409' then null; end;
  begin
    insert into public.maintenance_equipment_history(equipment_item_id,work_date,work_type,cycle_included) values (a.id,'2026-01-01','inspection',true);
    raise exception 'Inspection cycle accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid(),'email','equipment-rls-field@example.invalid')::text,true);
do $$ declare n integer; begin
  select count(*) into n from public.maintenance_equipment_items where shared_note_key='rls-shared-note';
  if n<>2 then raise exception 'Inherited field permission cannot read'; end if;
  update public.maintenance_equipment_items set notes='Unauthorized' where source_key='rls-item-a';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Field edit accepted'; end if;
  begin
    insert into public.maintenance_equipment_items(category,name) values ('RLS test','Unauthorized');
    raise exception 'Field insert accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid(),'email','equipment-rls-denied@example.invalid')::text,true);
do $$ begin
  if exists(select 1 from public.maintenance_equipment_items) then raise exception 'Explicitly denied field can read'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid(),'email','equipment-rls-office@example.invalid')::text,true);
do $$ declare n integer; begin
  insert into public.maintenance_equipment_items(category,name) values ('RLS test','Office create');
  update public.maintenance_equipment_items set notes='Unauthorized' where source_key='rls-item-a';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Office edit accepted'; end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid(),'email','equipment-rls-unapproved@example.invalid')::text,true);
do $$ begin
  if exists(select 1 from public.maintenance_equipment_items) then raise exception 'Unapproved can read'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform id from public.maintenance_equipment_items;
    raise exception 'Anonymous can read';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Equipment RLS, shared-note transaction, conflict and constraint checks passed; fixtures rolled back.' as result;
