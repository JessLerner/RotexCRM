-- Availability (franco) is different from disabling a user. A franco retains the portfolio
-- and freezes its operational clock; a disabled user is a real departure and releases data.
alter table public.team_memberships add column if not exists availability_paused_at timestamptz;

create or replace function public.rotex_add_work_minutes(p_start timestamptz, p_minutes integer)
returns timestamptz language plpgsql stable set search_path=public as $$
declare v_local timestamp:=p_start at time zone 'America/Argentina/Buenos_Aires'; v_remaining integer:=greatest(coalesce(p_minutes,0),0); v_open timestamp; v_close timestamp; v_take integer;
begin
  while v_remaining>0 loop
    if extract(dow from v_local)=0 then v_local:=date_trunc('day',v_local+interval '1 day')+time '09:00'; continue; end if;
    v_open:=date_trunc('day',v_local)+time '09:00'; v_close:=date_trunc('day',v_local)+time '20:00';
    if v_local<v_open then v_local:=v_open;
    elsif v_local>=v_close then v_local:=date_trunc('day',v_local+interval '1 day')+time '09:00';
    else v_take:=least(v_remaining,floor(extract(epoch from(v_close-v_local))/60)::integer); v_local:=v_local+make_interval(mins=>v_take); v_remaining:=v_remaining-v_take; end if;
  end loop;
  return v_local at time zone 'America/Argentina/Buenos_Aires';
end; $$;

create or replace function public.rotex_work_minutes_between(p_start timestamptz,p_end timestamptz)
returns integer language plpgsql stable set search_path=public as $$
declare v_local timestamp:=p_start at time zone 'America/Argentina/Buenos_Aires'; v_end timestamp:=p_end at time zone 'America/Argentina/Buenos_Aires'; v_open timestamp; v_close timestamp; v_total integer:=0;
begin
  while v_local<v_end loop
    if extract(dow from v_local)=0 then v_local:=date_trunc('day',v_local+interval '1 day'); continue; end if;
    v_open:=date_trunc('day',v_local)+time '09:00'; v_close:=date_trunc('day',v_local)+time '20:00';
    if v_local<v_open then v_local:=v_open;
    elsif v_local>=v_close then v_local:=date_trunc('day',v_local+interval '1 day');
    else v_total:=v_total+greatest(0,floor(extract(epoch from(least(v_close,v_end)-v_local))/60)::integer); v_local:=date_trunc('day',v_local+interval '1 day'); end if;
  end loop;
  return v_total;
end; $$;

create or replace function public.set_member_status(p_member_id uuid,p_status public.member_status)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_paused_at timestamptz; v_pause_minutes integer:=0; v_assignment record; v_released integer:=0;
begin
  if not public.can_manage_member(p_member_id) then raise exception 'No tenés permisos para cambiar este estado' using errcode='42501'; end if;
  if p_status='paused' then
    update public.team_memberships set status='paused',availability_paused_at=coalesce(availability_paused_at,now()) where profile_id=p_member_id and left_at is null;
  elsif p_status='active' then
    select availability_paused_at into v_paused_at from public.team_memberships where profile_id=p_member_id and left_at is null order by joined_at desc limit 1 for update;
    if v_paused_at is not null then
      v_pause_minutes:=public.rotex_work_minutes_between(v_paused_at,now());
      update public.lead_assignments set first_management_due_at=public.rotex_add_work_minutes(first_management_due_at,v_pause_minutes),follow_up_due_at=case when follow_up_due_at is null then null else public.rotex_add_work_minutes(follow_up_due_at,v_pause_minutes) end where seller_id=p_member_id and released_at is null;
    end if;
    update public.team_memberships set status='active',availability_paused_at=null where profile_id=p_member_id and left_at is null;
  else
    for v_assignment in select id,lead_id from public.lead_assignments where seller_id=p_member_id and released_at is null for update loop
      update public.lead_assignments set released_at=now(),release_reason='Usuario deshabilitado' where id=v_assignment.id;
      update public.leads set state='queued',current_assignment_id=null where id=v_assignment.lead_id;
      v_released:=v_released+1;
    end loop;
    update public.team_memberships set status='inactive',availability_paused_at=null where profile_id=p_member_id and left_at is null;
  end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(v_actor,'member_availability_updated','profile',p_member_id,jsonb_build_object('status',p_status,'released_leads',v_released,'paused_work_minutes',v_pause_minutes));
  return jsonb_build_object('updated',true,'released_leads',v_released);
end; $$;

-- A paused seller is excluded from SLA rotation. After seven working days (Sunday excluded),
-- the portfolio is released to the queue; normal allocation can then distribute it again.
create or replace function public.process_due_rotations(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_item record; v_rotated integer:=0; v_released integer:=0;
begin
  if not exists(select 1 from public.profiles where id=v_actor and status='active') then raise exception 'Perfil activo requerido' using errcode='42501'; end if;
  for v_item in
    select l.id as lead_id,a.id as assignment_id from public.leads l join public.lead_assignments a on a.id=l.current_assignment_id join public.team_memberships tm on tm.profile_id=a.seller_id and tm.left_at is null
    where tm.status='active' and a.released_at is null and ((l.state='assigned' and a.first_management_due_at<=now()) or (l.state='in_progress' and a.follow_up_due_at is not null and a.follow_up_due_at<=now()))
    order by coalesce(a.follow_up_due_at,a.first_management_due_at) limit least(greatest(coalesce(p_limit,100),1),500) for update of l,a skip locked
  loop
    update public.lead_assignments set released_at=now(),release_reason='Vencimiento de plazo operativo' where id=v_item.assignment_id;
    update public.leads set state='queued',current_assignment_id=null where id=v_item.lead_id;
    insert into public.lead_activities(lead_id,assignment_id,author_id,kind,result,body) values(v_item.lead_id,v_item.assignment_id,v_actor,'rotacion','vencimiento','Dato liberado por vencimiento del plazo operativo.');
    v_rotated:=v_rotated+1;
  end loop;
  for v_item in
    select a.id as assignment_id,a.lead_id from public.lead_assignments a join public.team_memberships tm on tm.profile_id=a.seller_id and tm.left_at is null
    where tm.status='paused' and tm.availability_paused_at is not null and public.rotex_work_minutes_between(tm.availability_paused_at,now())>=4620 and a.released_at is null
    limit least(greatest(coalesce(p_limit,100),1),500) for update of a skip locked
  loop
    update public.lead_assignments set released_at=now(),release_reason='Inactividad laboral superior a siete días' where id=v_item.assignment_id;
    update public.leads set state='queued',current_assignment_id=null where id=v_item.lead_id;
    insert into public.lead_activities(lead_id,assignment_id,author_id,kind,result,body) values(v_item.lead_id,v_item.assignment_id,v_actor,'rotacion','inactividad_prolongada','Dato liberado tras siete días laborales de inactividad.');
    v_released:=v_released+1;
  end loop;
  return jsonb_build_object('rotated',v_rotated,'released_after_long_inactivity',v_released);
end; $$;
