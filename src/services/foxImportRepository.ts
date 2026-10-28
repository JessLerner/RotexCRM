import { supabase } from '../lib/supabase';

export interface FoxLeadImportRow {
  foxLeadId: string;
  clientName: string;
  brand: string;
  phone?: string;
  email?: string;
  modelInterest?: string;
  foxOriginalCloseDate?: string;
  foxOriginalCloseReason?: string;
  foxBranch?: string;
  foxNotes?: string;
  sourceMetadata?: Record<string, string>;
}

export interface FoxImportResult {
  batchId: string;
  inserted: number;
  skipped: number;
  invalid: number;
  review: number;
}

async function fingerprint(rows: FoxLeadImportRow[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(rows));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function importFoxLeads(filename: string, rows: FoxLeadImportRow[]): Promise<FoxImportResult> {
  const batches = Array.from({ length: Math.ceil(rows.length / 1000) }, (_, index) => rows.slice(index * 1000, (index + 1) * 1000));
  const results = await Promise.all(batches.map(async (batch, index) => {
    const { data, error } = await supabase.rpc('import_fox_leads', {
      p_filename: batches.length > 1 ? `${filename || 'fox-crm.csv'} · lote ${index + 1}/${batches.length}` : (filename || 'fox-crm.csv'),
      p_sha256: await fingerprint(batch), p_rows: batch,
    });
    if (error) throw new Error(error.message);
    return data as FoxImportResult;
  }));
  return results.reduce<FoxImportResult>((total, result) => ({ batchId: total.batchId || result.batchId, inserted: total.inserted + result.inserted, skipped: total.skipped + result.skipped, invalid: total.invalid + result.invalid, review: total.review + (result.review || 0) }), { batchId: '', inserted: 0, skipped: 0, invalid: 0, review: 0 });
}
