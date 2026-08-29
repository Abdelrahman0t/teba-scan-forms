import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://grqdctpkeitnloobuged.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdycWRjdHBrZWl0bmxvb2J1Z2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNTU1ODEsImV4cCI6MjEwMjgzMTU4MX0.Zak1r5j4A6scelu_PK9NhQDeF2gmPFW-CkSVbSvRdkY';

  return createBrowserClient(url, anonKey);
}
