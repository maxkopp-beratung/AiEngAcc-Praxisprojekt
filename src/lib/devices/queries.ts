import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Device } from './types'

type DeviceRow = { id: string; name: string; duration_minutes: number; created_at: string }

// The user's devices, oldest first (AC-10). Ownership comes from RLS: the session client only ever
// sees its own rows. Returns null when the read fails, so callers can show their error state.
export async function listDevices(supabase: SupabaseClient): Promise<Device[] | null> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('id, name, duration_minutes, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (error || !data) return null
    return (data as DeviceRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      durationMinutes: row.duration_minutes,
      createdAt: row.created_at,
    }))
  } catch {
    return null
  }
}
