-- Server-side portfolio search: paging and filters never load the full lead table in the browser.
create or replace function public.get_lead_portfolio(
  p_search text default null, p_state text default 'all', p_brand text default 'all',
  p_page integer default 1, p_page_size integer default 50
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_actor uuid := auth.uid(); v_role public.rotex_role; v_offset integer;
begin
  select role into v_role from public.profiles where id=v_actor and status='active';
  if v_role is null or v_role not in ('administracion','gerencia') then raise exception 'Solo Administración o Gerencia puede consultar la cartera completa' using errcode='42501'; end if;
  v_offset := (greatest(coalesce(p_page,1),1)-1) * least(greatest(coalesce(p_page_size,50),10),100);
  return (with filtered as materialized (
    select l.id,l.fox_lead_id,l.full_name,coalesce(l.mobile_original,l.phone_original,'') as phone,coalesce(b.name,'Sin marca · cartera general') as brand,
      l.model_interest,l.state,l.created_at,l.closed_at,l.closure_outcome,l.closure_notes,
      seller.display_name as seller_name,(select count(*) from public.lead_rotations r where r.lead_id=l.id) as rotations
    from public.leads l left join public.brands b on b.id=l.brand_id left join public.lead_assignments a on a.id=l.current_assignment_id left join public.profiles seller on seller.id=a.seller_id
    where (coalesce(nullif(trim(p_search),''),'')='' or concat_ws(' ',l.full_name,l.fox_lead_id,l.phone_original,l.mobile_original,l.model_interest) ilike '%'||trim(p_search)||'%')
      and (coalesce(p_state,'all')='all' or l.state::text=p_state)
      and (coalesce(p_brand,'all')='all' or coalesce(b.name,'Sin marca · cartera general')=p_brand)
  ) select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(to_jsonb(page_rows)) from (select * from filtered order by created_at desc limit least(greatest(coalesce(p_page_size,50),10),100) offset v_offset) page_rows),'[]'::jsonb)));
end;
$$;
revoke all on function public.get_lead_portfolio(text,text,text,integer,integer) from public;
grant execute on function public.get_lead_portfolio(text,text,text,integer,integer) to authenticated;
