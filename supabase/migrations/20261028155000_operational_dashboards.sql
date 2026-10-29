-- Exact operational dashboard data. Counts are computed in the database and are never
-- derived from the limited list rendered by the browser.

create or replace function public.get_operational_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.rotex_role;
  v_team_ids uuid[];
begin
  select role into v_role from public.profiles where id = v_actor and status = 'active';
  if v_role is null then
    raise exception 'Perfil activo requerido' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct team_id), '{}'::uuid[])
    into v_team_ids
  from public.team_memberships
  where profile_id = v_actor and left_at is null;

  return (
    with visible_sellers as materialized (
      select distinct tm.profile_id
      from public.team_memberships tm
      join public.profiles p on p.id = tm.profile_id
      where tm.left_at is null
        and p.role = 'vendedor'
        and (
          v_role in ('administracion', 'gerencia')
          or (v_role = 'supervisor' and tm.team_id = any(v_team_ids))
          or (v_role = 'vendedor' and tm.profile_id = v_actor)
        )
    ), visible_leads as materialized (
      select l.*
      from public.leads l
      left join public.lead_assignments current_assignment on current_assignment.id = l.current_assignment_id
      where v_role in ('administracion', 'gerencia')
        or (v_role = 'vendedor' and (current_assignment.seller_id = v_actor or l.closed_by = v_actor))
        or (
          v_role = 'supervisor' and (
            current_assignment.seller_id in (select profile_id from visible_sellers)
            or l.closed_by in (select profile_id from visible_sellers)
            or (
              l.state in ('queued', 'review') and (
                l.brand_id is null or exists (
                  select 1 from public.seller_brands sb
                  where sb.profile_id in (select profile_id from visible_sellers)
                    and sb.brand_id = l.brand_id
                )
              )
            )
          )
        )
    ), seller_rows as (
      select
        p.id,
        p.display_name,
        tm.daily_target,
        tm.capacity,
        tm.status,
        count(distinct active_assignment.id) filter (where active_assignment.released_at is null) as active_leads,
        count(distinct received_today.id) as received_today,
        count(distinct managed_today.id) as managed_today,
        count(distinct recontact.id) as recontacts_today,
        count(distinct won.id) as sales_total
      from visible_sellers vs
      join public.profiles p on p.id = vs.profile_id
      join lateral (
        select * from public.team_memberships m
        where m.profile_id = p.id and m.left_at is null
        order by m.joined_at desc limit 1
      ) tm on true
      left join public.lead_assignments active_assignment
        on active_assignment.seller_id = p.id and active_assignment.released_at is null
      left join public.lead_assignments received_today
        on received_today.seller_id = p.id
        and received_today.assigned_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
      left join public.lead_activities managed_today
        on managed_today.author_id = p.id
        and managed_today.kind in ('gestion', 'tarea')
        and managed_today.occurred_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
      left join public.lead_activities recontact
        on recontact.author_id = p.id
        and recontact.result = 'no_responde'
        and recontact.occurred_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
      left join public.leads won on won.closed_by = p.id and won.closure_outcome = 'venta'
      group by p.id, p.display_name, tm.daily_target, tm.capacity, tm.status
    )
    select jsonb_build_object(
      'total', (select count(*) from visible_leads),
      'queued', (select count(*) from visible_leads where state = 'queued'),
      'review', (select count(*) from visible_leads where state = 'review'),
      'assigned', (select count(*) from visible_leads where state in ('assigned', 'in_progress')),
      'in_progress', (select count(*) from visible_leads where state = 'in_progress'),
      'closed_won', (select count(*) from visible_leads where state = 'closed_won'),
      'closed_lost', (select count(*) from visible_leads where state = 'closed_lost'),
      'due_soon', (
        select count(*)
        from visible_leads l
        join public.lead_assignments a on a.id = l.current_assignment_id
        where l.state in ('assigned', 'in_progress')
          and coalesce(a.follow_up_due_at, a.first_management_due_at) > now()
          and coalesce(a.follow_up_due_at, a.first_management_due_at) <= now() + interval '30 minutes'
      ),
      'overdue', (
        select count(*)
        from visible_leads l
        join public.lead_assignments a on a.id = l.current_assignment_id
        where l.state in ('assigned', 'in_progress')
          and coalesce(a.follow_up_due_at, a.first_management_due_at) <= now()
      ),
      'rotated_today', (
        select count(*) from public.lead_rotations r
        join visible_leads l on l.id = r.lead_id
        where r.executed_at >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
      ),
      'seller_breakdown', coalesce((
        select jsonb_agg(jsonb_build_object(
          'profile_id', id,
          'name', display_name,
          'status', status,
          'daily_target', daily_target,
          'capacity', capacity,
          'active_leads', active_leads,
          'received_today', received_today,
          'managed_today', managed_today,
          'recontacts_today', recontacts_today,
          'sales_total', sales_total
        ) order by display_name)
        from seller_rows
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_operational_metrics() from public;
grant execute on function public.get_operational_metrics() to authenticated;
