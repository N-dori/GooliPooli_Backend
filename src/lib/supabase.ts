import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Service-role Supabase client. Bypasses RLS — never expose to untrusted code paths.
 * All authorization decisions in the API are enforced by our own middleware
 * (`authRequired`, `requireRole`, `requireProjectAccess`), not RLS.
 */
export const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SECRET,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
