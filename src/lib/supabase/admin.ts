// Service-role Supabase client — server only. It bypasses Row Level Security, so it is used in
// exactly three places (PROJ-1 design): the login throttle, the signup existence check and
// account deletion. `server-only` makes the build fail if a client component ever imports it.
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
