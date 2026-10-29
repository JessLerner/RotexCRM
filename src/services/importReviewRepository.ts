import { supabase } from '../lib/supabase';

export type ImportReviewLead = { id: string; name: string; phone: string; model_interest: string | null; brand_id: string | null; brand: string; reason: string; batch_filename: string; created_at: string };
export type ImportBatch = { id: string; filename: string; created_at: string; summary: { inserted?: number; skipped?: number; invalid?: number; review?: number } };

export async function loadImportReviewQueue() {
  const { data, error } = await supabase.rpc('get_import_review_queue', { p_limit: 200 });
  if (error) throw error;
  return (data || { batches: [], leads: [] }) as { batches: ImportBatch[]; leads: ImportReviewLead[] };
}

export async function resolveImportReview(leadId: string, phone: string, brandId?: string) {
  const { error } = await supabase.rpc('resolve_import_review', { p_lead_id: leadId, p_phone: phone, p_brand_id: brandId || null });
  if (error) throw error;
}

export async function discardImportReview(leadId: string) {
  const { error } = await supabase.rpc('discard_import_review', { p_lead_id: leadId });
  if (error) throw error;
}
