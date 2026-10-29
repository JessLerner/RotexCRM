import { supabase } from '../lib/supabase';

export type PresenceRecord = { profile_id: string; name: string; role: string; last_seen_at: string | null; session_started_at: string | null; connected: boolean; connected_minutes: number | null };

export async function touchPresence() {
  const { error } = await supabase.rpc('touch_presence');
  if (error) throw error;
}

export async function endPresence() {
  const { error } = await supabase.rpc('end_presence');
  if (error) throw error;
}

export async function loadPresenceReport(): Promise<PresenceRecord[]> {
  const { data, error } = await supabase.rpc('get_presence_report');
  if (error) throw error;
  return (data || []) as PresenceRecord[];
}
