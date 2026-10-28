import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    !supabaseUrl.includes('YOUR_PROJECT_REF') &&
    !supabaseKey.includes('YOUR_PUBLISHABLE')
);

// A harmless placeholder keeps local builds working until the administrator adds
// the public project configuration. No request is made when it is unconfigured.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://unconfigured.supabase.co',
  isSupabaseConfigured ? supabaseKey! : 'unconfigured-public-key'
);
