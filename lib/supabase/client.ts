import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // In the browser, route through the current origin so Next.js rewrites can proxy
  // requests to the VPS backend. This prevents Mixed Content (HTTPS -> HTTP) errors on Vercel.
  const url = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://135.181.168.228:8080');

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

  return createBrowserClient(url, anonKey);
}
