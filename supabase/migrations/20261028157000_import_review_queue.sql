-- Manual quality-control queue for imported records that could not safely enter rotation.
create or replace function public.get_import_review_queue(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_actor uuid := auth.uid(); v_role public.rotex_role;
begin
  select role into v_role from public.profiles where id = v_actor and status = 'active';
  if v_role is null or v_role not in ('administracion', 'gerencia') then
    raise exception 'Solo Administración o Gerencia puede revisar importaciones' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'batches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'filename', b.filename, 'created_at', b.created_at, 'summary', b.summary) order by b.created_at desc)
      from public.import_batches b where b.status = 'committed'), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(item) from (
      select jsonb_build_object(
        'id', l.id, 'name', l.full_name, 'phone', coalesce(l.mobile_original, l.phone_original, ''),
        'model_interest', l.model_interest, 'brand_id', l.brand_id, 'brand', coalesce(br.name, ''),
        'reason', coalesce(l.source_metadata->>'phoneReviewReason', 'Revisión requerida'),
        'batch_filename', b.filename, 'created_at', l.created_at
      ) as item
      from public.leads l left join public.brands br on br.id = l.brand_id join public.import_batches b on b.id = l.imported_batch_id
      where l.state = 'review'
      order by l.created_at desc
      limit least(greatest(coalesce(p_limit,100),1),500)
    ) review_rows), '[]'::jsonb)
  );
end;
$$;

create or replace function public.resolve_import_review(p_lead_id uuid, p_phone text, p_brand_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_digits text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  v_reason text := null;
begin
  if not exists (select 1 from public.profiles where id = v_actor and role in ('administracion', 'gerencia') and status = 'active') then
    raise exception 'No tenés permisos para corregir importaciones' using errcode = '42501';
  end if;
  if v_digits is null then v_reason := 'Ingresá un teléfono válido';
  elsif length(v_digits) < 8 or length(v_digits) > 15 then v_reason := 'El teléfono debe tener entre 8 y 15 dígitos';
  elsif length(replace(v_digits, left(v_digits, 1), '')) = 0 then v_reason := 'El teléfono no puede tener todos los dígitos iguales';
  elsif position(v_digits in '0123456789012345') > 0 or position(v_digits in '987654321098765') > 0 then v_reason := 'El teléfono parece una secuencia ficticia';
  end if;
  if v_reason is not null then raise exception '%', v_reason using errcode = '22023'; end if;
  if p_brand_id is not null and not exists (select 1 from public.brands where id = p_brand_id and active) then raise exception 'La marca seleccionada no está disponible' using errcode = '22023'; end if;
  if not exists (select 1 from public.leads where id = p_lead_id and state = 'review' for update) then raise exception 'El dato ya no está disponible para revisión' using errcode = 'P0001'; end if;
  update public.leads set phone_original = p_phone, mobile_original = p_phone, phone_normalized = v_digits, mobile_normalized = v_digits,
    brand_id = coalesce(p_brand_id, brand_id), state = 'queued',
    source_metadata = coalesce(source_metadata, '{}'::jsonb) || jsonb_build_object('phoneValidation', 'valid', 'phoneReviewReason', null, 'manuallyReviewedAt', now()::text)
  where id = p_lead_id;
  insert into public.lead_activities(lead_id, author_id, kind, result, body)
  values (p_lead_id, v_actor, 'sistema', 'revision_resuelta', 'Dato corregido manualmente y habilitado para asignación.');
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
  values (v_actor, 'import_review_resolved', 'lead', p_lead_id, jsonb_build_object('brand_id', p_brand_id));
  return jsonb_build_object('resolved', true);
end;
$$;

revoke all on function public.get_import_review_queue(integer), public.resolve_import_review(uuid, text, uuid) from public;
grant execute on function public.get_import_review_queue(integer), public.resolve_import_review(uuid, text, uuid) to authenticated;
