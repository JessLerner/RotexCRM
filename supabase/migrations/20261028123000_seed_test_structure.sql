-- Pilot roster requested for the three test accounts.
-- Florencia (gerencia) > Equipo Juana Benitez (supervisora) > Ailen (vendedora), Peugeot.
do $$
declare
  v_florencia_id uuid := '15d03098-9a65-416c-b435-51e6edb615c5';
  v_juana_id uuid := 'ec899b9c-0a2f-4073-a5e6-19dcd26f60fa';
  v_ailen_id uuid := '768cb223-579d-4f96-a770-e2e17a74768b';
  v_management_id uuid;
  v_team_id uuid;
  v_peugeot_id uuid;
begin
  if not exists (select 1 from public.profiles where id = v_florencia_id and role = 'gerencia')
     or not exists (select 1 from public.profiles where id = v_juana_id and role = 'supervisor')
     or not exists (select 1 from public.profiles where id = v_ailen_id and role = 'vendedor') then
    raise exception 'The three pilot profiles must exist with their expected roles before seeding the structure';
  end if;

  insert into public.managements (name) values ('Gerencia Florencia Rodriguez')
  on conflict (name) do update set active = true
  returning id into v_management_id;

  insert into public.teams (management_id, name) values (v_management_id, 'Equipo Juana Benitez')
  on conflict (management_id, name) do update set active = true
  returning id into v_team_id;

  insert into public.brands (name) values ('Peugeot')
  on conflict (name) do update set active = true
  returning id into v_peugeot_id;

  if not exists (select 1 from public.team_memberships tm where tm.profile_id = v_florencia_id and tm.team_id = v_team_id and tm.left_at is null) then
    insert into public.team_memberships (profile_id, team_id, status, capacity) values (v_florencia_id, v_team_id, 'active', 0);
  end if;
  if not exists (select 1 from public.team_memberships tm where tm.profile_id = v_juana_id and tm.team_id = v_team_id and tm.reports_to = v_florencia_id and tm.left_at is null) then
    insert into public.team_memberships (profile_id, team_id, reports_to, status, capacity) values (v_juana_id, v_team_id, v_florencia_id, 'active', 15);
  end if;
  if not exists (select 1 from public.team_memberships tm where tm.profile_id = v_ailen_id and tm.team_id = v_team_id and tm.reports_to = v_juana_id and tm.left_at is null) then
    insert into public.team_memberships (profile_id, team_id, reports_to, status, capacity) values (v_ailen_id, v_team_id, v_juana_id, 'active', 15);
  end if;

  insert into public.seller_brands (profile_id, brand_id) values
    (v_juana_id, v_peugeot_id),
    (v_ailen_id, v_peugeot_id)
  on conflict do nothing;
end;
$$;
