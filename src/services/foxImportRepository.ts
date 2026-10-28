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
}

export interface FoxImportResult {
  batchId: string;
  inserted: number;
  skipped: number;
  invalid: number;
}

async function fingerprint(rows: FoxLeadImportRow[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(rows));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function importFoxLeads(filename: string, rows: FoxLeadImportRow[]): Promise<FoxImportResult> {
  const { data, error } = await supabase.rpc('import_fox_leads', {
    p_filename: filename || 'fox-crm.csv',
    p_sha256: await fingerprint(rows),
    p_rows: rows,
  });
  if (error) throw new Error(error.message);
  return data as FoxImportResult;
}
