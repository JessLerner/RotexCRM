import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Sesión requerida');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) throw new Error('Sesión inválida');
    const { name, email, capacity = 15, dailyTarget = 5, role = 'vendedor', supervisorId: requestedSupervisorId, brandIds: requestedBrandIds } = await request.json();
    if (!name?.trim() || !email?.trim()) throw new Error('Nombre y correo son obligatorios');
    if (!['vendedor', 'supervisor', 'gerencia', 'administracion'].includes(role)) throw new Error('Rol de invitación inválido');

    const admin = createClient(url, serviceKey);
    const { data: caller } = await admin.from('profiles').select('role, status').eq('id', user.id).single();
    if (!caller || caller.status !== 'active' || !['supervisor', 'gerencia', 'administracion'].includes(caller.role)) throw new Error('No tenés permiso para invitar asesores');
    let { data: membership } = await admin.from('team_memberships').select('team_id').eq('profile_id', user.id).is('left_at', null).maybeSingle();
    if (!membership && caller.role === 'administracion') {
      const { data: teams } = await admin.from('teams').select('id').eq('active', true).limit(2);
      if ((teams || []).length !== 1) throw new Error('Administración debe elegir un equipo cuando existe más de uno');
      membership = { team_id: teams![0].id };
    }
    if (!membership) throw new Error('Tu perfil todavía no tiene un equipo asignado');

    if (role === 'gerencia' || role === 'administracion') {
      if (caller.role !== 'administracion') throw new Error('Solo Administración puede crear perfiles de Gerencia o Administración');
      const appUrl = Deno.env.get('ROTEX_APP_URL') || 'https://rotexcrm.naveplan.workers.dev';
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim(), { data: { display_name: name.trim() }, redirectTo: `${appUrl}/auth/activate` });
      if (inviteError || !invited.user) throw new Error(inviteError?.message || 'No se pudo enviar la invitación');
      const profileId = invited.user.id;
      const { error: profileError } = await admin.from('profiles').upsert({ id: profileId, display_name: name.trim(), role, status: 'active' });
      if (profileError) throw profileError;
      const { error: teamError } = await admin.from('team_memberships').insert({ profile_id: profileId, team_id: membership.team_id, reports_to: role === 'gerencia' ? user.id : null, status: 'active', capacity: 0, daily_target: 1 });
      if (teamError) throw teamError;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (role === 'supervisor') {
      if (caller.role === 'supervisor') throw new Error('Un supervisor no puede crear otro supervisor');
      let managerId = user.id;
      if (caller.role === 'administracion') {
        const { data: managers } = await admin.from('team_memberships').select('profile_id').eq('team_id', membership.team_id).is('left_at', null);
        const managerIds = (managers || []).map(({ profile_id }) => profile_id);
        const { data: manager } = await admin.from('profiles').select('id').in('id', managerIds).eq('role', 'gerencia').eq('status', 'active').limit(1).maybeSingle();
        if (!manager) throw new Error('El equipo necesita una Gerencia activa antes de crear supervisores');
        managerId = manager.id;
      }
      if (!Array.isArray(requestedBrandIds) || requestedBrandIds.length === 0) throw new Error('Seleccioná al menos una marca para el supervisor');
      const { data: requestedBrands } = await admin.from('brands').select('id').in('id', requestedBrandIds).eq('active', true);
      if ((requestedBrands || []).length !== requestedBrandIds.length) throw new Error('Una de las marcas seleccionadas no está disponible');
      const appUrl = Deno.env.get('ROTEX_APP_URL') || 'https://rotexcrm.naveplan.workers.dev';
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim(), { data: { display_name: name.trim() }, redirectTo: `${appUrl}/auth/activate` });
      if (inviteError || !invited.user) throw new Error(inviteError?.message || 'No se pudo enviar la invitación');
      const profileId = invited.user.id;
      const { error: profileError } = await admin.from('profiles').upsert({ id: profileId, display_name: name.trim(), role: 'supervisor', status: 'active' });
      if (profileError) throw profileError;
      const { error: teamError } = await admin.from('team_memberships').insert({ profile_id: profileId, team_id: membership.team_id, reports_to: managerId, status: 'active', capacity: Math.max(1, Math.min(Number(capacity) || 15, 100)), daily_target: Math.max(1, Math.min(Number(dailyTarget) || 5, 10)) });
      if (teamError) throw teamError;
      const { error: brandError } = await admin.from('seller_brands').insert(requestedBrands!.map(({ id }) => ({ profile_id: profileId, brand_id: id })));
      if (brandError) throw brandError;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }
    let supervisorId = user.id;
    if (caller.role !== 'supervisor') {
      const { data: members } = await admin.from('team_memberships').select('profile_id').eq('team_id', membership.team_id).is('left_at', null);
      const memberIds = (members || []).map(({ profile_id }) => profile_id);
      const { data: supervisors } = await admin.from('profiles').select('id').in('id', memberIds).eq('role', 'supervisor').eq('status', 'active').limit(1);
      if (!supervisors?.[0]) throw new Error('El equipo no tiene un supervisor activo para asignar al asesor');
      supervisorId = requestedSupervisorId || supervisors[0].id;
      if (!supervisors?.some((supervisor) => supervisor.id === supervisorId)) throw new Error('El supervisor elegido debe pertenecer al mismo equipo y estar activo');
    }
    const { data: inheritedBrands } = await admin.from('seller_brands').select('brand_id').eq('profile_id', supervisorId);
    if (!inheritedBrands?.length) throw new Error('Tu equipo todavía no tiene una marca asignada');
    let brandIds = inheritedBrands.map(({ brand_id }) => brand_id);
    if (requestedBrandIds !== undefined && caller.role !== 'supervisor') {
      if (!Array.isArray(requestedBrandIds) || requestedBrandIds.length === 0) throw new Error('Seleccioná al menos una marca');
      const { data: requestedBrands } = await admin.from('brands').select('id').in('id', requestedBrandIds).eq('active', true);
      if ((requestedBrands || []).length !== requestedBrandIds.length) throw new Error('Una de las marcas seleccionadas no está disponible');
      brandIds = requestedBrands!.map(({ id }) => id);
    }

    const appUrl = Deno.env.get('ROTEX_APP_URL') || 'https://rotexcrm.naveplan.workers.dev';
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
      data: { display_name: name.trim() },
      redirectTo: `${appUrl}/auth/activate`,
    });
    if (inviteError || !invited.user) throw new Error(inviteError?.message || 'No se pudo enviar la invitación');
    const sellerId = invited.user.id;
    const { error: profileError } = await admin.from('profiles').upsert({ id: sellerId, display_name: name.trim(), role: 'vendedor', status: 'active' });
    if (profileError) throw profileError;
    const { error: teamError } = await admin.from('team_memberships').insert({ profile_id: sellerId, team_id: membership.team_id, reports_to: supervisorId, status: 'active', capacity: Math.max(1, Math.min(Number(capacity) || 15, 100)), daily_target: Math.max(1, Math.min(Number(dailyTarget) || 5, 10)) });
    if (teamError) throw teamError;
    const { error: brandError } = await admin.from('seller_brands').insert(brandIds.map((brand_id) => ({ profile_id: sellerId, brand_id })));
    if (brandError) throw brandError;
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Error inesperado' }, { status: 400, headers: corsHeaders });
  }
});
