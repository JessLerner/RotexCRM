import { Lead } from '../types/crm';
import { supabase } from '../lib/supabase';

type OperationalLeadRow = {
  id: string; fox_lead_id: string; full_name: string; phone: string | null; brand: string;
  model_interest: string | null; state: 'assigned' | 'in_progress'; assigned_at: string;
  first_management_due_at: string | null; follow_up_due_at: string | null;
  seller_id: string; seller_name: string; supervisor_name: string | null;
  no_response_count: number; rotation_count: number; source_metadata: Record<string, string> | null;
};

export type OperationalMetrics = {
  total: number; queued: number; review: number; assigned: number; in_progress: number;
  closed_won: number; closed_lost: number;
  due_soon: number; overdue: number; rotated_today: number;
  seller_breakdown: Array<{ profile_id: string; name: string; status: 'active' | 'paused' | 'inactive'; daily_target: number; capacity: number; active_leads: number; received_today: number; managed_today: number; recontacts_today: number; sales_total: number }>;
};

function toLead(row: OperationalLeadRow): Lead {
  const meta = row.source_metadata || {};
  return {
    id: row.id, foxLeadId: row.fox_lead_id, clientName: row.full_name,
    phone: row.phone || '', email: meta.email || '', brand: row.brand,
    modelInterest: row.model_interest || '', foxOriginalCloseDate: meta.foxOriginalCloseDate,
    foxOriginalCloseReason: meta.foxOriginalCloseReason, foxBranch: meta.foxBranch, foxNotes: meta.foxNotes,
    status: row.state === 'assigned' ? 'pending_contact' : 'in_progress',
    currentVendorId: row.seller_id, currentVendorName: row.seller_name, currentSupervisorName: row.supervisor_name,
    assignedAt: row.assigned_at, firstGestionAt: row.state === 'in_progress' ? row.assigned_at : null,
    lastGestionAt: null, hasContacted: row.state === 'in_progress',
    contactDeadline: row.first_management_due_at || row.assigned_at, activeTaskDeadline: row.follow_up_due_at,
    currentTask: row.follow_up_due_at ? {
      id: `followup-${row.id}`,
      description: row.no_response_count > 0 ? `No responde · intento ${row.no_response_count} de 5` : 'Seguimiento programado',
      type: 'seguimiento', dueAt: row.follow_up_due_at, createdAt: row.assigned_at, completed: false,
    } : null,
    globalClosureDeadline: row.assigned_at, rotationCount: row.rotation_count, previousVendorIds: [], comments: [], closureHistory: [],
    importedAt: row.assigned_at, noResponseCount: row.no_response_count,
  };
}

/** Loads the role-scoped operational queue. Vendors never receive other vendors' data. */
export async function loadOperationalLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.rpc('get_operational_leads');
  if (error) throw error;
  return ((data || []) as OperationalLeadRow[]).map(toLead);
}

/** Exact aggregate counts; unlike the on-screen list these are never capped at 200 rows. */
export async function loadOperationalMetrics(): Promise<OperationalMetrics> {
  const { data, error } = await supabase.rpc('get_operational_metrics');
  if (error) throw error;
  return { total: 0, queued: 0, review: 0, assigned: 0, in_progress: 0, closed_won: 0, closed_lost: 0, due_soon: 0, overdue: 0, rotated_today: 0, seller_breakdown: [], ...(data || {}) } as OperationalMetrics;
}

export async function fillRotationCupos(): Promise<number> {
  const { data, error } = await supabase.rpc('fill_rotation_cupos', { p_limit: 500 });
  if (error) throw error;
  return Number(data?.assigned || 0);
}

export async function processDueRotations(): Promise<number> {
  const { data, error } = await supabase.rpc('process_due_rotations', { p_limit: 100 });
  if (error) throw error;
  return Number(data?.rotated || 0);
}

export async function requestNextLead(): Promise<{ assigned: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('claim_next_lead');
  if (error) throw error;
  return data as { assigned: boolean; reason?: string };
}

export async function saveFollowUp(leadId: string, description: string, type: string, afterMinutes: number) {
  const { error } = await supabase.rpc('record_follow_up_task', { p_lead_id: leadId, p_description: description, p_task_type: type, p_after_minutes: afterMinutes });
  if (error) throw error;
}

export async function registerNoResponse(leadId: string, afterMinutes: number, notes: string) {
  const { data, error } = await supabase.rpc('record_no_response', { p_lead_id: leadId, p_after_minutes: afterMinutes, p_notes: notes || null });
  if (error) throw error;
  return data as { attempt: number; due_at: string; must_rotate_next: boolean };
}

export async function rotateMyLead(leadId: string, notes = '') {
  const { data, error } = await supabase.rpc('rotate_my_lead', { p_lead_id: leadId, p_notes: notes || null });
  if (error) throw error;
  return data as { rotated: boolean; assigned_to_other_seller: boolean };
}

export async function closeMyLead(leadId: string, outcome: string, notes: string) {
  const { error } = await supabase.rpc('close_my_lead', { p_lead_id: leadId, p_outcome: outcome, p_notes: notes || null });
  if (error) throw error;
}
