-- A seller may see the name of their direct supervisor in their own header.
create or replace function public.get_roster()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.rotex_role;
  visible_profiles uuid[];
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select role into actor_role from public.profiles where id = actor_id and status = 'active';
  if actor_role is null then raise exception 'Active profile required'; end if;
  if actor_role = 'administracion' then
    select array_agg(id) into visible_profiles from public.profiles;
  elsif actor_role in ('gerencia', 'supervisor') then
    select array_agg(distinct tm.profile_id) into visible_profiles from public.team_memberships tm
    where tm.left_at is null and tm.team_id in (select mine.team_id from public.team_memberships mine where mine.profile_id = actor_id and mine.left_at is null);
    visible_profiles := array_append(coalesce(visible_profiles, '{}'::uuid[]), actor_id);
  else
    select array_agg(distinct person_id) into visible_profiles from (
      select actor_id as person_id
      union
      select tm.reports_to from public.team_memberships tm where tm.profile_id = actor_id and tm.left_at is null and tm.reports_to is not null
    ) direct_people;
  end if;
  return jsonb_build_object(
    'profiles', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'role', p.role, 'status', p.status) order by p.display_name) from public.profiles p where p.id = any(visible_profiles)), '[]'::jsonb),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object('profile_id', tm.profile_id, 'team_id', tm.team_id, 'reports_to', tm.reports_to, 'status', tm.status, 'capacity', tm.capacity)) from public.team_memberships tm where tm.profile_id = any(visible_profiles) and tm.left_at is null), '[]'::jsonb),
    'seller_brands', coalesce((select jsonb_agg(jsonb_build_object('profile_id', sb.profile_id, 'brand_name', b.name)) from public.seller_brands sb join public.brands b on b.id = sb.brand_id where sb.profile_id = any(visible_profiles)), '[]'::jsonb)
  );
end;
$$;
