import { supabase } from '../lib/supabase';
import { VendorStatus } from '../types/crm';

export type StructureSupervisor = { id: string; name: string };
export type StructureBrand = { id: string; name: string };
export type MemberStructure = { supervisorId: string; brandIds: string[]; capacity: number; dailyTarget: number };

type RosterProfile = { id: string; display_name: string; role: string; status: VendorStatus };
type RosterMembership = { profile_id: string; reports_to: string | null; capacity: number; daily_target?: number };
type RosterBrand = { profile_id: string; brand_name: string };
const WORKING_BRANDS = new Set(['LEAPMOTOR', 'RENAULT', 'PEUGEOT', 'CITROEN', 'JEEP', 'FIAT']);

export async function loadStructureOptions(): Promise<{ supervisors: StructureSupervisor[]; brands: StructureBrand[]; memberships: Map<string, RosterMembership>; brandNames: Map<string, string[]> }> {
  const [{ data: rosterData, error: rosterError }, { data: brandsData, error: brandsError }] = await Promise.all([
    supabase.rpc('get_roster'),
    supabase.from('brands').select('id, name').eq('active', true).order('name'),
  ]);
  if (rosterError) throw rosterError;
  if (brandsError) throw brandsError;
  const roster = (rosterData || {}) as { profiles?: RosterProfile[]; memberships?: RosterMembership[]; seller_brands?: RosterBrand[] };
  const memberships = new Map((roster.memberships || []).map((item) => [item.profile_id, item]));
  const brandNames = new Map<string, string[]>();
  for (const item of roster.seller_brands || []) {
    if (WORKING_BRANDS.has(item.brand_name)) brandNames.set(item.profile_id, [...(brandNames.get(item.profile_id) || []), item.brand_name]);
  }
  return {
    supervisors: (roster.profiles || []).filter((profile) => profile.role === 'supervisor' && profile.status === 'active').map((profile) => ({ id: profile.id, name: profile.display_name })),
    brands: (brandsData || []) as StructureBrand[], memberships, brandNames,
  };
}

export async function updateMemberStructure(memberId: string, structure: MemberStructure) {
  const { error } = await supabase.rpc('update_member_structure', {
    p_member_id: memberId, p_supervisor_id: structure.supervisorId, p_brand_ids: structure.brandIds,
    p_capacity: structure.capacity, p_daily_target: structure.dailyTarget,
  });
  if (error) throw error;
}

export async function setMemberStatus(memberId: string, status: VendorStatus) {
  const { data, error } = await supabase.rpc('set_member_status', { p_member_id: memberId, p_status: status });
  if (error) throw error;
  return data as { released_leads: number };
}

export async function retireMember(memberId: string, reason = '') {
  const { error } = await supabase.rpc('retire_member', { p_member_id: memberId, p_reason: reason || null });
  if (error) throw error;
}
