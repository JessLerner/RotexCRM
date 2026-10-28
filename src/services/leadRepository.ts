import { Lead } from '../types/crm';
import { supabase } from '../lib/supabase';

type ImportedLeadRow = { id: string; fox_lead_id: string; full_name: string; phone: string | null; brand: string | null; model_interest: string | null; state: string; source_metadata: Record<string, string> | null; created_at: string };

/** Loads persisted Fox queue records for management dashboards. */
export async function loadImportedLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.rpc('get_import_queue');
  if (error) throw error;
  return ((data || []) as ImportedLeadRow[]).map((row) => {
    const meta = row.source_metadata || {};
    return {
      id: row.id, foxLeadId: row.fox_lead_id, clientName: row.full_name,
      phone: row.phone || '', email: meta.email || '', brand: row.brand || 'Sin marca · cartera general', modelInterest: row.model_interest || '',
      foxOriginalCloseDate: meta.foxOriginalCloseDate, foxOriginalCloseReason: meta.foxOriginalCloseReason, foxBranch: meta.foxBranch, foxNotes: meta.foxNotes,
      status: 'expired_unassigned', currentVendorId: null, currentVendorName: null, assignedAt: row.created_at,
      firstGestionAt: null, lastGestionAt: null, hasContacted: false, contactDeadline: row.created_at, activeTaskDeadline: null,
      currentTask: null, comments: [], rotationCount: 0,
    } as Lead;
  });
}
