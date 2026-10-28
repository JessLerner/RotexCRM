-- Management roles can inspect imported leads before the assignment engine distributes them.
create or replace function public.get_import_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
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
      'id', l.id, 'fox_lead_id', l.fox_lead_id, 'full_name', l.full_name,
      'phone', coalesce(l.mobile_original, l.phone_original), 'brand', b.name,
      'model_interest', l.model_interest, 'state', l.state,
      'source_metadata', l.source_metadata, 'created_at', l.created_at
    ) order by l.created_at desc)
    from public.leads l
    left join public.brands b on b.id = l.brand_id
    where l.state in ('queued', 'review')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_import_queue() from public;
grant execute on function public.get_import_queue() to authenticated;
