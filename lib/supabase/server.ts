/**
 * server.ts - Supabase server client
 *
 * Purpose: Provide Supabase client for server-side operations (API routes, server actions)
 * Responsibilities: Uses service role key when elevated access needed
 * Dependencies: @supabase/supabase-js
 *
 * Note: Phase 2 uses browser client only. This file is prepared for future API routes.
 *
 * @example
 * ```ts
 * import { createServerClient } from '@/lib/supabase/server'
 * const supabase = createServerClient()
 * ```
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE env vars for server client')
}

/** Server client with service role - use only in server context */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}
