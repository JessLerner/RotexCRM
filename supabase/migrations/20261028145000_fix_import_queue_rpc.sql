-- Keep exactly one no-argument RPC so PostgREST can resolve it reliably.
drop function if exists public.get_import_queue(integer);

create or replace function public.get_import_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.profiles
    where id = v_actor and status = 'active'
      and role in ('administracion', 'gerencia', 'supervisor')
  ) then
    raise exception 'No tenés permisos para consultar la cola importada' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'fox_lead_id', q.fox_lead_id, 'full_name', q.full_name,
      'phone', q.phone, 'brand', q.brand, 'model_interest', q.model_interest,
      'state', q.state, 'source_metadata', q.source_metadata, 'created_at', q.created_at
    ) order by q.created_at desc)
    from (
      select l.id, l.fox_lead_id, l.full_name,
        coalesce(l.mobile_original, l.phone_original) as phone,
        b.name as brand, l.model_interest, l.state, l.source_metadata, l.created_at
      from public.leads l
      left join public.brands b on b.id = l.brand_id
      where l.state in ('queued', 'review')
      order by l.created_at desc
      limit 200
    ) q
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_import_queue() from public;
grant execute on function public.get_import_queue() to authenticated;
