'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { listDevices } from './queries'
import { deviceIdSchema, deviceInputSchema, fieldErrorsFromZod } from './schemas'
import type { DeviceActionResult } from './types'

// Server actions for PROJ-3 devices (design.md → Server Actions). Every action checks the session
// first, validates on the server, writes with the user's own session (RLS applies, never the service
// role) and answers with the current list. Raw database messages never leave this file.

type DbError = { code?: string; message?: string } | null

type ListedStatus = 'ok' | 'duplicate_name' | 'limit_reached' | 'not_found'

const isUniqueViolation = (error: DbError) => error?.code === '23505'
const isLimitReached = (error: DbError) =>
  error?.code === 'P0001' && (error.message ?? '').includes('device_limit_reached')

// Finish with the fresh list; a failed read turns any outcome into `error`.
async function withList(supabase: SupabaseClient, status: ListedStatus): Promise<DeviceActionResult> {
  const devices = await listDevices(supabase)
  if (!devices) return { status: 'error' }
  return { status, devices }
}

async function sessionClient(): Promise<SupabaseClient | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? supabase : null
}

// Gerät anlegen (AC-5 to AC-9, EC-7 to EC-9, AC-24).
export async function createDevice(input: unknown): Promise<DeviceActionResult> {
  try {
    const supabase = await sessionClient()
    if (!supabase) return { status: 'unauthorized' }

    const parsed = deviceInputSchema.safeParse(input)
    if (!parsed.success) return { status: 'invalid', fieldErrors: fieldErrorsFromZod(parsed.error) }

    // One statement; user_id and created_at come from the column defaults (column grants forbid them).
    const { error } = await supabase
      .from('devices')
      .insert({ name: parsed.data.name, duration_minutes: parsed.data.durationMinutes })
    if (isUniqueViolation(error)) return withList(supabase, 'duplicate_name')
    if (isLimitReached(error)) return withList(supabase, 'limit_reached')
    if (error) return { status: 'error' }

    return withList(supabase, 'ok')
  } catch {
    return { status: 'error' }
  }
}

// Gerät ändern (AC-11, EC-10, EC-11). Never an upsert: no row changed → not_found.
export async function updateDevice(input: unknown): Promise<DeviceActionResult> {
  try {
    const supabase = await sessionClient()
    if (!supabase) return { status: 'unauthorized' }

    const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
    const parsed = deviceInputSchema.safeParse(raw)
    if (!parsed.success) return { status: 'invalid', fieldErrors: fieldErrorsFromZod(parsed.error) }

    const id = deviceIdSchema.safeParse(raw.id)
    if (!id.success) return withList(supabase, 'not_found')

    const { data, error } = await supabase
      .from('devices')
      .update({ name: parsed.data.name, duration_minutes: parsed.data.durationMinutes })
      .eq('id', id.data)
      .select('id')
    if (isUniqueViolation(error)) return withList(supabase, 'duplicate_name')
    if (error) return { status: 'error' }
    if (!data || data.length === 0) return withList(supabase, 'not_found')

    return withList(supabase, 'ok')
  } catch {
    return { status: 'error' }
  }
}

// Gerät löschen (AC-12, EC-10). No row deleted → not_found.
export async function deleteDevice(input: unknown): Promise<DeviceActionResult> {
  try {
    const supabase = await sessionClient()
    if (!supabase) return { status: 'unauthorized' }

    const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
    const id = deviceIdSchema.safeParse(raw.id)
    if (!id.success) return withList(supabase, 'not_found')

    const { data, error } = await supabase.from('devices').delete().eq('id', id.data).select('id')
    if (error) return { status: 'error' }
    if (!data || data.length === 0) return withList(supabase, 'not_found')

    return withList(supabase, 'ok')
  } catch {
    return { status: 'error' }
  }
}
