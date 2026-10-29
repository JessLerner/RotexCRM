-- Keep assignment fast under load and prevent Gerencia from browsing another team's named portfolio.
create index if not exists leads_queued_fast_claim_idx on public.leads(brand_id, created_at) where state = 'queued';
create index if not exists memberships_active_team_profile_idx on public.team_memberships(team_id, profile_id) where left_at is null;

create or replace function public.claim_next_lead()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_lead_id uuid; v_assignment_id uuid;
begin
  if not exists (select 1 from public.profiles where id=v_actor and role='vendedor' and status='active') then raise exception 'Solo un vendedor activo puede pedir un dato' using errcode='42501'; end if;
  perform set_config('statement_timeout','15s',true);
  select l.id into v_lead_id from public.leads l
  left join public.seller_brands sb on sb.profile_id=v_actor and sb.brand_id=l.brand_id
  where l.state='queued' and (l.brand_id is null or sb.profile_id is not null)
  order by case when l.brand_id is null then 1 else 0 end,l.created_at
  for update of l skip locked limit 1;
  if v_lead_id is null then return jsonb_build_object('assigned',false,'reason','No hay datos disponibles para tu marca o cartera general.'); end if;
  v_assignment_id:=public.rotex_assign_lead(v_lead_id,v_actor,v_actor,'Dato solicitado por el vendedor.');
  if v_assignment_id is null then return jsonb_build_object('assigned',false,'reason','No tenés capacidad disponible para recibir otro dato.'); end if;
  insert into public.lead_rotations(lead_id,to_assignment_id,reason) values(v_lead_id,v_assignment_id,'requested_by_vendor');
  return jsonb_build_object('assigned',true,'lead_id',v_lead_id);
end; $$;

create or replace function public.get_lead_portfolio(p_search text default null,p_state text default 'all',p_brand text default 'all',p_page integer default 1,p_page_size integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_role public.rotex_role; v_offset integer;
begin
  select role into v_role from public.profiles where id=v_actor and status='active';
  if v_role is null or v_role not in ('administracion','gerencia') then raise exception 'Solo Administración o Gerencia puede consultar la cartera' using errcode='42501'; end if;
  v_offset:=(greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,50),10),100);
  return (
    with mine as (
      select team_id from public.team_memberships where profile_id = v_actor and left_at is null
    ), filtered as materialized (
      select l.id, l.fox_lead_id, l.full_name, coalesce(l.mobile_original, l.phone_original, '') as phone,
        coalesce(b.name, 'Sin marca · cartera general') as brand, l.model_interest, l.state, l.created_at,
        l.closed_at, l.closure_outcome, l.closure_notes, seller.display_name as seller_name,
        (select count(*) from public.lead_rotations r where r.lead_id = l.id) as rotations
      from public.leads l
      left join public.brands b on b.id = l.brand_id
      left join public.lead_assignments a on a.id = l.current_assignment_id
      left join public.profiles seller on seller.id = a.seller_id
      where (coalesce(nullif(trim(p_search), ''), '') = '' or concat_ws(' ', l.full_name, l.fox_lead_id, l.phone_original, l.mobile_original, l.model_interest) ilike '%' || trim(p_search) || '%')
        and (coalesce(p_state, 'all') = 'all' or l.state::text = p_state)
        and (coalesce(p_brand, 'all') = 'all' or coalesce(b.name, 'Sin marca · cartera general') = p_brand)
        and (
          v_role = 'administracion'
          or exists (select 1 from public.team_memberships tm where tm.profile_id = coalesce(a.seller_id, l.closed_by) and tm.left_at is null and tm.team_id in (select team_id from mine))
          or (l.state in ('queued', 'review') and (l.brand_id is null or exists (select 1 from public.seller_brands sb join public.team_memberships tm on tm.profile_id = sb.profile_id and tm.left_at is null where sb.brand_id = l.brand_id and tm.team_id in (select team_id from mine))))
        )
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'items', coalesce((select jsonb_agg(to_jsonb(page_rows)) from (select * from filtered order by created_at desc limit least(greatest(coalesce(p_page_size, 50), 10), 100) offset v_offset) page_rows), '[]'::jsonb)
    )
  );
end; $$;

revoke all on function public.claim_next_lead(), public.get_lead_portfolio(text,text,text,integer,integer) from public;
grant execute on function public.claim_next_lead(), public.get_lead_portfolio(text,text,text,integer,integer) to authenticated;
