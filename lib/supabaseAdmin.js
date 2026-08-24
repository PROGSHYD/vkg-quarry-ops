// SERVER-ONLY. Never import this from a 'use client' file — the service_role key
// bypasses Row Level Security entirely and must never reach the browser bundle.
import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // no NEXT_PUBLIC_ prefix — stays server-side only
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
