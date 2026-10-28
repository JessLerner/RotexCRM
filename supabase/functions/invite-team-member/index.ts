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
    const { name, email, capacity = 15 } = await request.json();
    if (!name?.trim() || !email?.trim()) throw new Error('Nombre y correo son obligatorios');

    const admin = createClient(url, serviceKey);
    const { data: caller } = await admin.from('profiles').select('role, status').eq('id', user.id).single();
    if (!caller || caller.status !== 'active' || !['supervisor', 'gerencia', 'administracion'].includes(caller.role)) throw new Error('No tenés permiso para invitar asesores');
    const { data: membership } = await admin.from('team_memberships').select('team_id').eq('profile_id', user.id).is('left_at', null).maybeSingle();
    if (!membership) throw new Error('Tu perfil todavía no tiene un equipo asignado');
    let supervisorId = user.id;
    if (caller.role !== 'supervisor') {
      const { data: members } = await admin.from('team_memberships').select('profile_id').eq('team_id', membership.team_id).is('left_at', null);
      const memberIds = (members || []).map(({ profile_id }) => profile_id);
      const { data: supervisors } = await admin.from('profiles').select('id').in('id', memberIds).eq('role', 'supervisor').eq('status', 'active').limit(1);
      if (!supervisors?.[0]) throw new Error('El equipo no tiene un supervisor activo para asignar al asesor');
      supervisorId = supervisors[0].id;
    }
    const { data: inheritedBrands } = await admin.from('seller_brands').select('brand_id').eq('profile_id', supervisorId);
    if (!inheritedBrands?.length) throw new Error('Tu equipo todavía no tiene una marca asignada');

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim(), { data: { display_name: name.trim() } });
    if (inviteError || !invited.user) throw new Error(inviteError?.message || 'No se pudo enviar la invitación');
    const sellerId = invited.user.id;
    const { error: profileError } = await admin.from('profiles').upsert({ id: sellerId, display_name: name.trim(), role: 'vendedor', status: 'active' });
    if (profileError) throw profileError;
    const { error: teamError } = await admin.from('team_memberships').insert({ profile_id: sellerId, team_id: membership.team_id, reports_to: supervisorId, status: 'active', capacity: Math.max(1, Math.min(Number(capacity) || 15, 100)) });
    if (teamError) throw teamError;
    const { error: brandError } = await admin.from('seller_brands').insert(inheritedBrands.map(({ brand_id }) => ({ profile_id: sellerId, brand_id })));
    if (brandError) throw brandError;
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Error inesperado' }, { status: 400, headers: corsHeaders });
  }
});
