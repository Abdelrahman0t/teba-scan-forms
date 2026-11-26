import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use same origin in the browser so requests pass through the Next.js /rest/v1 proxy
  // This completely eliminates any CORS or preflight header issues between domains.
  const url = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.modreck.com');

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

  return createBrowserClient(url, anonKey);
}
