import { Vendor, VendorStatus } from '../types/crm';
import { supabase } from '../lib/supabase';

type RosterProfile = { id: string; display_name: string; role: string; status: VendorStatus };
type RosterMembership = { profile_id: string; reports_to: string | null; status: VendorStatus; capacity: number; active_assignments?: number; total_conversions?: number };
type RosterBrand = { profile_id: string; brand_name: string };
type RosterPayload = { profiles?: RosterProfile[]; memberships?: RosterMembership[]; seller_brands?: RosterBrand[] };
const WORKING_BRANDS = new Set(['LEAPMOTOR', 'RENAULT', 'PEUGEOT', 'CITROEN', 'JEEP', 'FIAT']);

/** Reads the authoritative personnel roster. No browser fixture is used here. */
export async function loadRoster(): Promise<Vendor[]> {
  const { data, error } = await supabase.rpc('get_roster');
  if (error) throw error;
  const roster = (data || {}) as RosterPayload;
  const people = new Map((roster.profiles || []).map((profile) => [profile.id, profile]));
  const memberships = new Map((roster.memberships || []).map((membership) => [membership.profile_id, membership]));
  const brands = new Map<string, string[]>();
  for (const item of roster.seller_brands || []) {
    if (WORKING_BRANDS.has(item.brand_name)) brands.set(item.profile_id, [...(brands.get(item.profile_id) || []), item.brand_name]);
  }

  return (roster.profiles || [])
    .filter((profile) => profile.role === 'vendedor')
    .map((profile) => {
      const membership = memberships.get(profile.id);
      const supervisor = membership?.reports_to ? people.get(membership.reports_to)?.display_name : undefined;
      return {
        id: profile.id,
        name: profile.display_name,
        supervisor: supervisor || 'Sin supervisor asignado',
        brand: (brands.get(profile.id) || []).join(', ') || 'Sin marca asignada',
        status: membership?.status || profile.status,
        maxAssignments: membership?.capacity || 15,
        activeAssignments: membership?.active_assignments || 0,
        totalAssignedCount: 0,
        totalConversions: membership?.total_conversions || 0,
      };
    });
}
