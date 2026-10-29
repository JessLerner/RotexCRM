-- Rotex only operates these six brands. Values imported from Fox are normalized or moved
-- to the general queue when they are ambiguous/non-commercial labels.
insert into public.brands(name) values
  ('LEAPMOTOR'), ('RENAULT'), ('PEUGEOT'), ('CITROEN'), ('JEEP'), ('FIAT')
on conflict(name) do update set active=true;

with canonical as (
  select id, name from public.brands where name in ('LEAPMOTOR','RENAULT','PEUGEOT','CITROEN','JEEP','FIAT')
), remap as (
  select b.id as old_id,
    case
      when lower(translate(trim(b.name),'éÉ','eE')) in ('leap','leapmotor','leapmotors') then 'LEAPMOTOR'
      when lower(translate(trim(b.name),'éÉ','eE')) in ('renault') then 'RENAULT'
      when lower(translate(trim(b.name),'éÉ','eE')) in ('peugeot','peugeot 208') then 'PEUGEOT'
      when lower(translate(trim(b.name),'éÉ','eE')) in ('citroen') then 'CITROEN'
      when lower(translate(trim(b.name),'éÉ','eE')) in ('jeep') then 'JEEP'
      when lower(translate(trim(b.name),'éÉ','eE')) in ('fiat','cronos','mobi','pulse') then 'FIAT'
      else null
    end as canonical_name
  from public.brands b
)
insert into public.seller_brands(profile_id,brand_id)
select distinct sb.profile_id,c.id from public.seller_brands sb join remap r on r.old_id=sb.brand_id join canonical c on c.name=r.canonical_name
on conflict do nothing;

with canonical as (select id,name from public.brands where name in ('LEAPMOTOR','RENAULT','PEUGEOT','CITROEN','JEEP','FIAT')),
remap as (
  select b.id as old_id, case
    when lower(translate(trim(b.name),'éÉ','eE')) in ('leap','leapmotor','leapmotors') then 'LEAPMOTOR'
    when lower(translate(trim(b.name),'éÉ','eE'))='renault' then 'RENAULT'
    when lower(translate(trim(b.name),'éÉ','eE')) in ('peugeot','peugeot 208') then 'PEUGEOT'
    when lower(translate(trim(b.name),'éÉ','eE'))='citroen' then 'CITROEN'
    when lower(translate(trim(b.name),'éÉ','eE'))='jeep' then 'JEEP'
    when lower(translate(trim(b.name),'éÉ','eE')) in ('fiat','cronos','mobi','pulse') then 'FIAT'
    else null end as canonical_name from public.brands b
)
update public.leads l set brand_id=c.id
from remap r left join canonical c on c.name=r.canonical_name
where l.brand_id=r.old_id and l.brand_id is distinct from c.id;

-- Keep the original Fox labels for audit, but disable them so they can never be selected
-- in Rotex. Ambiguous labels such as "Fiat o Renault" and non-brand labels such as
-- "AsiaPlan" have their leads moved to the general queue by the update above.
update public.brands
set active=false
where name not in ('LEAPMOTOR','RENAULT','PEUGEOT','CITROEN','JEEP','FIAT');
