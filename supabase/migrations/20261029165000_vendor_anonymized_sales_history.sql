-- A seller may learn that a lead they once worked later became a sale, without
-- receiving reusable personal data or the identity of the closing seller.
create or replace function public.get_vendor_anonymized_sales_history()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_actor uuid:=auth.uid();
begin
  if not exists(select 1 from public.profiles where id=v_actor and role='vendedor' and status='active') then
    raise exception 'Solo un asesor activo puede consultar este historial' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'lead_id', row_data.id,
    'contact', case when char_length(trim(row_data.full_name))<=2 then left(row_data.full_name,1)||'•' else left(row_data.full_name,1)||repeat('•',least(14,char_length(trim(row_data.full_name))-1)) end,
    'phone_hint', case when char_length(regexp_replace(coalesce(row_data.phone,''),'[^0-9]','','g'))>=4 then '•••• '||right(regexp_replace(row_data.phone,'[^0-9]','','g'),4) else 'Número protegido' end,
    'brand',coalesce(row_data.brand,'Sin marca'),
    'model',row_data.model_interest,
    'closed_at',row_data.closed_at
  ) order by row_data.closed_at desc)
  from (
    select distinct l.id,l.full_name,coalesce(l.mobile_original,l.phone_original) as phone,b.name as brand,l.model_interest,l.closed_at
    from public.leads l join public.lead_assignments previous on previous.lead_id=l.id
    left join public.brands b on b.id=l.brand_id
    where previous.seller_id=v_actor and l.state='closed_won' and l.closed_by is distinct from v_actor
  ) row_data), '[]'::jsonb);
end; $$;
revoke all on function public.get_vendor_anonymized_sales_history() from public;
grant execute on function public.get_vendor_anonymized_sales_history() to authenticated;
