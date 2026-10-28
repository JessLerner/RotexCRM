-- Rotex operational lifecycle. All assignment and management mutations run in the database,
-- so they remain correct when several users work at the same time.

alter table public.team_memberships
  add column if not exists daily_target integer not null default 5 check (daily_target between 1 and 10);

alter table public.leads
  add column if not exists no_response_count integer not null default 0 check (no_response_count >= 0),
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id),
  add column if not exists closure_outcome text,
  add column if not exists closure_notes text;

create index if not exists leads_rotation_queue_idx on public.leads(state, brand_id, created_at)
  where state = 'queued';
create index if not exists lead_assignments_seller_active_idx on public.lead_assignments(seller_id, assigned_at)
  where released_at is null;

-- The business clock has one explicit rule: time only advances between 09:00 and 20:00
-- in Argentina. It deliberately applies every calendar day; weekends can later be excluded
-- by changing this single function if the commercial calendar requires it.
create or replace function public.rotex_add_work_minutes(p_start timestamptz, p_minutes integer)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp := p_start at time zone 'America/Argentina/Buenos_Aires';
  v_remaining integer := greatest(coalesce(p_minutes, 0), 0);
  v_open timestamp;
  v_close timestamp;
  v_available integer;
  v_take integer;
begin
  while v_remaining > 0 loop
    v_open := date_trunc('day', v_local) + time '09:00';
    v_close := date_trunc('day', v_local) + time '20:00';
    if v_local < v_open then
      v_local := v_open;
    elsif v_local >= v_close then
      v_local := date_trunc('day', v_local + interval '1 day') + time '09:00';
    else
      v_available := floor(extract(epoch from (v_close - v_local)) / 60)::integer;
      v_take := least(v_remaining, v_available);
      v_local := v_local + make_interval(mins => v_take);
      v_remaining := v_remaining - v_take;
    end if;
  end loop;
  return v_local at time zone 'America/Argentina/Buenos_Aires';
end;
$$;

-- Internal primitive: it locks the lead and creates precisely one active assignment.
create or replace function public.rotex_assign_lead(p_lead_id uuid, p_seller_id uuid, p_actor_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_assignment_id uuid;
  v_capacity integer;
  v_active integer;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found or v_lead.state <> 'queued' then return null; end if;

  select tm.capacity into v_capacity
  from public.team_memberships tm join public.profiles p on p.id = tm.profile_id
  where tm.profile_id = p_seller_id and tm.left_at is null and tm.status = 'active'
    and p.role = 'vendedor' and p.status = 'active'
  order by tm.joined_at desc limit 1;
  if v_capacity is null then return null; end if;

  if v_lead.brand_id is not null and not exists (
    select 1 from public.seller_brands sb where sb.profile_id = p_seller_id and sb.brand_id = v_lead.brand_id
  ) then return null; end if;

  select count(*) into v_active from public.lead_assignments
  where seller_id = p_seller_id and released_at is null;
  if v_active >= v_capacity then return null; end if;

  insert into public.lead_assignments(
    lead_id, seller_id, assigned_by, first_management_due_at, seller_close_due_at
  ) values (
    v_lead.id, p_seller_id, p_actor_id,
    public.rotex_add_work_minutes(now(), 30),
    public.rotex_add_work_minutes(now(), 6600)
  ) returning id into v_assignment_id;

  update public.leads
  set state = 'assigned', current_assignment_id = v_assignment_id,
      first_assigned_at = coalesce(first_assigned_at, now())
  where id = v_lead.id;

  insert into public.lead_activities(lead_id, assignment_id, author_id, kind, result, body)
  values (v_lead.id, v_assignment_id, p_actor_id, 'sistema', 'asignado', p_reason);
  return v_assignment_id;
end;
$$;

-- Fill each visible seller to the initial daily target (5 by default, configurable up to 10).
create or replace function public.fill_rotation_cupos(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.rotex_role;
  v_seller record;
  v_lead_id uuid;
  v_assignment_id uuid;
  v_active integer;
  v_target integer;
  v_done integer := 0;
  v_max integer := least(greatest(coalesce(p_limit, 500), 1), 1000);
begin
  select role into v_role from public.profiles where id = v_actor and status = 'active';
  if v_role is null or v_role not in ('administracion', 'gerencia', 'supervisor') then
    raise exception 'No tenés permisos para completar cupos de rotación' using errcode = '42501';
  end if;

  for v_seller in
    select distinct tm.profile_id, tm.capacity, tm.daily_target
    from public.team_memberships tm join public.profiles p on p.id = tm.profile_id
    where tm.left_at is null and tm.status = 'active' and p.status = 'active' and p.role = 'vendedor'
      and (v_role = 'administracion' or tm.team_id in (
        select mine.team_id from public.team_memberships mine
        where mine.profile_id = v_actor and mine.left_at is null
      ))
    order by tm.profile_id
  loop
    select count(*) into v_active from public.lead_assignments where seller_id = v_seller.profile_id and released_at is null;
    v_target := least(v_seller.capacity, v_seller.daily_target);
    while v_active < v_target and v_done < v_max loop
      select l.id into v_lead_id
      from public.leads l
      where l.state = 'queued'
        and (l.brand_id is null or exists (select 1 from public.seller_brands sb where sb.profile_id = v_seller.profile_id and sb.brand_id = l.brand_id))
      order by case when l.brand_id is null then 1 else 0 end, l.created_at
      for update skip locked limit 1;
      exit when v_lead_id is null;
      v_assignment_id := public.rotex_assign_lead(v_lead_id, v_seller.profile_id, v_actor, 'Asignación automática para completar el cupo operativo diario.');
      if v_assignment_id is not null then
        insert into public.lead_rotations(lead_id, to_assignment_id, reason)
        values (v_lead_id, v_assignment_id, 'initial_assignment');
        v_active := v_active + 1;
        v_done := v_done + 1;
      else
        exit;
      end if;
    end loop;
    exit when v_done >= v_max;
  end loop;
  return jsonb_build_object('assigned', v_done);
end;
$$;

-- A seller may request another lead only while below their configured maximum capacity.
create or replace function public.claim_next_lead()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_lead_id uuid;
  v_assignment_id uuid;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role = 'vendedor' and status = 'active') then
    raise exception 'Solo un vendedor activo puede pedir un dato' using errcode = '42501';
  end if;
  select l.id into v_lead_id from public.leads l
  where l.state = 'queued'
    and (l.brand_id is null or exists (select 1 from public.seller_brands sb where sb.profile_id = v_actor and sb.brand_id = l.brand_id))
  order by case when l.brand_id is null then 1 else 0 end, l.created_at
  for update skip locked limit 1;
  if v_lead_id is null then return jsonb_build_object('assigned', false, 'reason', 'No hay datos disponibles para tu marca o cartera general.'); end if;
  v_assignment_id := public.rotex_assign_lead(v_lead_id, v_actor, v_actor, 'Dato solicitado por el vendedor.');
  if v_assignment_id is null then return jsonb_build_object('assigned', false, 'reason', 'No tenés capacidad disponible para recibir otro dato.'); end if;
  insert into public.lead_rotations(lead_id, to_assignment_id, reason) values (v_lead_id, v_assignment_id, 'requested_by_vendor');
  return jsonb_build_object('assigned', true, 'lead_id', v_lead_id);
end;
$$;

create or replace function public.record_no_response(p_lead_id uuid, p_after_minutes integer, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid(); v_assignment public.lead_assignments%rowtype; v_count integer; v_due timestamptz;
begin
  if p_after_minutes is null or p_after_minutes < 15 or p_after_minutes > 300 then
    raise exception 'La reprogramación debe ser de 15 minutos a 5 horas hábiles' using errcode = '22023';
  end if;
  select a.* into v_assignment from public.lead_assignments a where a.lead_id = p_lead_id and a.seller_id = v_actor and a.released_at is null for update;
  if not found then raise exception 'El dato no está asignado a tu bandeja' using errcode = '42501'; end if;
  select no_response_count into v_count from public.leads where id = p_lead_id for update;
  if v_count >= 5 then raise exception 'Ya se realizaron cinco intentos. Ahora corresponde rotar el dato.' using errcode = 'P0001'; end if;
  v_due := public.rotex_add_work_minutes(now(), p_after_minutes);
  update public.leads set no_response_count = no_response_count + 1, state = 'in_progress' where id = p_lead_id;
  update public.lead_assignments set follow_up_due_at = v_due where id = v_assignment.id;
  insert into public.follow_up_tasks(lead_id, assignment_id, created_by, due_at, details)
  values(p_lead_id, v_assignment.id, v_actor, v_due, coalesce(nullif(trim(p_notes), ''), 'No responde: recontactar.'));
  insert into public.lead_activities(lead_id, assignment_id, author_id, kind, result, body)
  values(p_lead_id, v_assignment.id, v_actor, 'gestion', 'no_responde', coalesce(nullif(trim(p_notes), ''), 'No responde; contacto reprogramado.'));
  return jsonb_build_object('attempt', v_count + 1, 'due_at', v_due, 'must_rotate_next', v_count + 1 >= 5);
end;
$$;

create or replace function public.rotate_my_lead(p_lead_id uuid, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid(); v_old public.lead_assignments%rowtype; v_new_seller uuid; v_new_assignment uuid; v_rotation_id uuid;
begin
  select a.* into v_old from public.lead_assignments a where a.lead_id = p_lead_id and a.seller_id = v_actor and a.released_at is null for update;
  if not found then raise exception 'El dato no está asignado a tu bandeja' using errcode = '42501'; end if;
  if not exists(select 1 from public.leads where id = p_lead_id and no_response_count >= 5) then
    raise exception 'La rotación por no respuesta se habilita después de cinco intentos' using errcode = '42501';
  end if;
  update public.lead_assignments set released_at = now(), release_reason = 'Sexto intento sin respuesta' where id = v_old.id;
  update public.leads set state = 'queued', current_assignment_id = null where id = p_lead_id;
  select tm.profile_id into v_new_seller
  from public.team_memberships tm join public.profiles p on p.id = tm.profile_id
  where tm.left_at is null and tm.status = 'active' and p.status = 'active' and p.role = 'vendedor' and tm.profile_id <> v_actor
    and (not exists(select 1 from public.leads l where l.id = p_lead_id and l.brand_id is not null)
      or exists(select 1 from public.leads l join public.seller_brands sb on sb.brand_id = l.brand_id where l.id = p_lead_id and sb.profile_id = tm.profile_id))
  order by (select count(*) from public.lead_assignments a where a.seller_id = tm.profile_id and a.released_at is null), tm.joined_at
  limit 1;
  if v_new_seller is not null then v_new_assignment := public.rotex_assign_lead(p_lead_id, v_new_seller, v_actor, 'Rotado tras cinco intentos sin respuesta.'); end if;
  insert into public.lead_rotations(lead_id, from_assignment_id, to_assignment_id, reason)
  values(p_lead_id, v_old.id, v_new_assignment, 'requested_by_vendor') returning id into v_rotation_id;
  insert into public.lead_activities(lead_id, assignment_id, author_id, kind, result, body)
  values(p_lead_id, v_old.id, v_actor, 'rotacion', 'no_responde_6', coalesce(nullif(trim(p_notes), ''), 'Rotado luego de cinco intentos sin respuesta.'));
  return jsonb_build_object('rotated', true, 'assigned_to_other_seller', v_new_assignment is not null);
end;
$$;

create or replace function public.close_my_lead(p_lead_id uuid, p_outcome text, p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_assignment public.lead_assignments%rowtype; v_state public.lead_state;
begin
  if p_outcome not in ('venta','dato_erroneo','ya_compro_en_otro_lado','ya_es_cliente_nuestro','otro') then raise exception 'Motivo de cierre inválido' using errcode = '22023'; end if;
  if p_outcome <> 'venta' and char_length(trim(coalesce(p_notes,''))) < 5 then raise exception 'El cierre sin venta requiere una descripción' using errcode = '22023'; end if;
  select a.* into v_assignment from public.lead_assignments a where a.lead_id=p_lead_id and a.seller_id=v_actor and a.released_at is null for update;
  if not found then raise exception 'El dato no está asignado a tu bandeja' using errcode = '42501'; end if;
  v_state := case when p_outcome = 'venta' then 'closed_won'::public.lead_state else 'closed_lost'::public.lead_state end;
  update public.lead_assignments set released_at=now(), release_reason='Cierre: ' || p_outcome where id=v_assignment.id;
  update public.leads set state=v_state, current_assignment_id=null, closed_at=now(), closed_by=v_actor, closure_outcome=p_outcome, closure_notes=nullif(trim(p_notes),'') where id=p_lead_id;
  update public.follow_up_tasks set completed_at=now() where assignment_id=v_assignment.id and completed_at is null;
  insert into public.lead_activities(lead_id,assignment_id,author_id,kind,result,body)
  values(p_lead_id,v_assignment.id,v_actor,'cierre',p_outcome,coalesce(nullif(trim(p_notes),''),'Cierre registrado.'));
  return jsonb_build_object('closed',true,'state',v_state);
end;
$$;

create or replace function public.record_follow_up_task(p_lead_id uuid, p_description text, p_task_type text, p_after_minutes integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_actor uuid := auth.uid(); v_assignment public.lead_assignments%rowtype; v_due timestamptz;
begin
  if char_length(trim(coalesce(p_description,''))) = 0 or p_after_minutes < 15 or p_after_minutes > 300 then raise exception 'La tarea debe tener detalle y plazo de 15 minutos a 5 horas hábiles' using errcode='22023'; end if;
  select a.* into v_assignment from public.lead_assignments a where a.lead_id=p_lead_id and a.seller_id=v_actor and a.released_at is null for update;
  if not found then raise exception 'El dato no está asignado a tu bandeja' using errcode='42501'; end if;
  v_due:=public.rotex_add_work_minutes(now(),p_after_minutes);
  update public.leads set state='in_progress' where id=p_lead_id;
  update public.lead_assignments set follow_up_due_at=v_due where id=v_assignment.id;
  insert into public.follow_up_tasks(lead_id,assignment_id,created_by,due_at,details) values(p_lead_id,v_assignment.id,v_actor,v_due,trim(p_description));
  insert into public.lead_activities(lead_id,assignment_id,author_id,kind,result,body) values(p_lead_id,v_assignment.id,v_actor,'tarea',p_task_type,trim(p_description));
  return jsonb_build_object('due_at',v_due);
end;
$$;

-- Moves SLA-expired leads back into the queue and gives them to another eligible seller when possible.
-- It is safe to call repeatedly; each row is locked before changing its assignment.
create or replace function public.process_due_rotations(p_limit integer default 100)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid(); v_item record; v_new_seller uuid; v_new_assignment uuid;
  v_rotated integer := 0; v_assigned integer := 0;
begin
  if not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Perfil activo requerido' using errcode='42501'; end if;
  for v_item in
    select l.id as lead_id, l.state as previous_state, a.id as assignment_id, a.seller_id
    from public.leads l join public.lead_assignments a on a.id=l.current_assignment_id
    where a.released_at is null and (
      (l.state='assigned' and a.first_management_due_at <= now())
      or (l.state='in_progress' and a.follow_up_due_at is not null and a.follow_up_due_at <= now())
    )
    order by coalesce(a.follow_up_due_at,a.first_management_due_at)
    limit least(greatest(coalesce(p_limit,100),1),500)
    for update of l, a skip locked
  loop
    update public.lead_assignments set released_at=now(), release_reason='Vencimiento de plazo operativo' where id=v_item.assignment_id and released_at is null;
    update public.leads set state='queued', current_assignment_id=null where id=v_item.lead_id;
    select tm.profile_id into v_new_seller
    from public.team_memberships tm join public.profiles p on p.id=tm.profile_id
    where tm.left_at is null and tm.status='active' and p.status='active' and p.role='vendedor' and tm.profile_id<>v_item.seller_id
      and (not exists(select 1 from public.leads l where l.id=v_item.lead_id and l.brand_id is not null)
        or exists(select 1 from public.leads l join public.seller_brands sb on sb.brand_id=l.brand_id where l.id=v_item.lead_id and sb.profile_id=tm.profile_id))
    order by (select count(*) from public.lead_assignments a where a.seller_id=tm.profile_id and a.released_at is null), tm.joined_at
    limit 1;
    if v_new_seller is not null then
      v_new_assignment:=public.rotex_assign_lead(v_item.lead_id,v_new_seller,v_actor,'Rotación automática por vencimiento del plazo operativo.');
    else v_new_assignment:=null; end if;
    insert into public.lead_rotations(lead_id,from_assignment_id,to_assignment_id,reason)
    values(v_item.lead_id,v_item.assignment_id,v_new_assignment,case when v_item.previous_state='assigned' then 'timeout_30m' else 'timeout_5h_task' end);
    insert into public.lead_activities(lead_id,assignment_id,author_id,kind,result,body)
    values(v_item.lead_id,v_item.assignment_id,v_actor,'rotacion','vencimiento','Rotación automática por vencimiento del plazo operativo.');
    v_rotated:=v_rotated+1; if v_new_assignment is not null then v_assigned:=v_assigned+1; end if;
  end loop;
  return jsonb_build_object('rotated',v_rotated,'reassigned',v_assigned);
end;
$$;

-- The operational read model is intentionally scoped: vendors only receive their own live leads.
create or replace function public.get_operational_leads()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_actor uuid:=auth.uid(); v_role public.rotex_role;
begin
  select role into v_role from public.profiles where id=v_actor and status='active';
  if v_role is null then raise exception 'Perfil activo requerido' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
    'id',l.id,'fox_lead_id',l.fox_lead_id,'full_name',l.full_name,'phone',coalesce(l.mobile_original,l.phone_original),'brand',coalesce(b.name,'Sin marca · cartera general'),'model_interest',l.model_interest,
    'state',l.state,'assigned_at',a.assigned_at,'first_management_due_at',a.first_management_due_at,'follow_up_due_at',a.follow_up_due_at,
    'seller_id',a.seller_id,'seller_name',seller.display_name,'supervisor_name',supervisor.display_name,'no_response_count',l.no_response_count,
    'rotation_count',(select count(*) from public.lead_rotations r where r.lead_id=l.id),'source_metadata',l.source_metadata
    ) order by coalesce(a.follow_up_due_at,a.first_management_due_at,l.created_at))
    from public.leads l
    left join public.brands b on b.id=l.brand_id
    left join public.lead_assignments a on a.id=l.current_assignment_id
    left join public.profiles seller on seller.id=a.seller_id
    left join public.team_memberships seller_tm on seller_tm.profile_id=a.seller_id and seller_tm.left_at is null
    left join public.profiles supervisor on supervisor.id=seller_tm.reports_to
    where l.state in ('assigned','in_progress') and (
      v_role='administracion'
      or (v_role='vendedor' and a.seller_id=v_actor)
      or (v_role in ('gerencia','supervisor') and seller_tm.team_id in (
        select mine.team_id from public.team_memberships mine where mine.profile_id=v_actor and mine.left_at is null
      ))
    )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_operational_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_actor uuid:=auth.uid(); v_role public.rotex_role;
begin
  select role into v_role from public.profiles where id=v_actor and status='active';
  if v_role is null then raise exception 'Perfil activo requerido' using errcode='42501'; end if;
  return (
    with visible as (
      select l.* from public.leads l
      left join public.lead_assignments a on a.id=l.current_assignment_id
      left join public.team_memberships tm on tm.profile_id=a.seller_id and tm.left_at is null
      where v_role='administracion'
        or (v_role='vendedor' and a.seller_id=v_actor)
        or (
          v_role in ('gerencia','supervisor')
          and (
            tm.team_id in (
              select mine.team_id from public.team_memberships mine where mine.profile_id=v_actor and mine.left_at is null
            )
            or (
              l.state in ('queued','review') and (
                l.brand_id is null or exists (
                  select 1
                  from public.seller_brands sb
                  join public.team_memberships member on member.profile_id=sb.profile_id
                  where member.left_at is null
                    and member.team_id in (
                      select mine.team_id from public.team_memberships mine where mine.profile_id=v_actor and mine.left_at is null
                    )
                    and sb.brand_id=l.brand_id
                )
              )
            )
          )
        )
    ) select jsonb_build_object(
      'total',count(*), 'queued',count(*) filter(where state='queued'), 'review',count(*) filter(where state='review'),
      'assigned',count(*) filter(where state in ('assigned','in_progress')), 'in_progress',count(*) filter(where state='in_progress'),
      'closed_won',count(*) filter(where state='closed_won'), 'closed_lost',count(*) filter(where state='closed_lost')
    ) from visible
  );
end;
$$;

revoke all on function public.rotex_assign_lead(uuid,uuid,uuid,text), public.fill_rotation_cupos(integer), public.claim_next_lead(), public.record_no_response(uuid,integer,text), public.rotate_my_lead(uuid,text), public.close_my_lead(uuid,text,text), public.record_follow_up_task(uuid,text,text,integer), public.process_due_rotations(integer), public.get_operational_leads(), public.get_operational_metrics() from public;
grant execute on function public.fill_rotation_cupos(integer), public.claim_next_lead(), public.record_no_response(uuid,integer,text), public.rotate_my_lead(uuid,text), public.close_my_lead(uuid,text,text), public.record_follow_up_task(uuid,text,text,integer), public.process_due_rotations(integer), public.get_operational_leads(), public.get_operational_metrics() to authenticated;

-- Extend the roster read model with server-derived workload and sales counters.
create or replace function public.get_roster()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); actor_role public.rotex_role; visible_profiles uuid[];
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select role into actor_role from public.profiles where id=actor_id and status='active';
  if actor_role is null then raise exception 'Active profile required'; end if;
  if actor_role='administracion' then select array_agg(id) into visible_profiles from public.profiles;
  elsif actor_role in ('gerencia','supervisor') then
    select array_agg(distinct tm.profile_id) into visible_profiles from public.team_memberships tm where tm.left_at is null and tm.team_id in (select mine.team_id from public.team_memberships mine where mine.profile_id=actor_id and mine.left_at is null);
    visible_profiles:=array_append(coalesce(visible_profiles,'{}'::uuid[]),actor_id);
  else
    select array_agg(distinct person_id) into visible_profiles from (select actor_id as person_id union select tm.reports_to from public.team_memberships tm where tm.profile_id=actor_id and tm.left_at is null and tm.reports_to is not null) people;
  end if;
  return jsonb_build_object(
    'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'role',p.role,'status',p.status) order by p.display_name) from public.profiles p where p.id=any(visible_profiles)),'[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(jsonb_build_object(
      'profile_id',tm.profile_id,'team_id',tm.team_id,'reports_to',tm.reports_to,'status',tm.status,'capacity',tm.capacity,'daily_target',tm.daily_target,
      'active_assignments',(select count(*) from public.lead_assignments a where a.seller_id=tm.profile_id and a.released_at is null),
      'total_conversions',(select count(*) from public.leads l where l.closed_by=tm.profile_id and l.closure_outcome='venta')
    )) from public.team_memberships tm where tm.profile_id=any(visible_profiles) and tm.left_at is null),'[]'::jsonb),
    'seller_brands',coalesce((select jsonb_agg(jsonb_build_object('profile_id',sb.profile_id,'brand_name',b.name)) from public.seller_brands sb join public.brands b on b.id=sb.brand_id where sb.profile_id=any(visible_profiles)),'[]'::jsonb)
  );
end;
$$;
