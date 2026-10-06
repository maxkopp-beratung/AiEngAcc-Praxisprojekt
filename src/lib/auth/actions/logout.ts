'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Ends the session on this device only (AC-17, EC-6).
export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}
