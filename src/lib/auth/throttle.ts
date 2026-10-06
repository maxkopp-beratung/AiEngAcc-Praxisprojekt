// Login throttle (AC-10, AC-11): 5 failures per email / 20 per IP within 15 minutes.
// The counting itself lives in the database (login_throttle_status / record_login_failure);
// only hashes of the normalized email and the IP ever leave this module.
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sha256 } from './request-meta'

export type ThrottleStatus = { blocked: false } | { blocked: true; retryAfterMinutes: number }

export function toRetryMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60))
}

export async function getLoginThrottle(email: string, ip: string): Promise<ThrottleStatus> {
  const { data, error } = await createAdminClient().rpc('login_throttle_status', {
    p_email_hash: sha256(email),
    p_ip_hash: sha256(ip),
  })
  // Fail closed: without a working throttle the login must not proceed.
  if (error) throw new Error(`login_throttle_status failed: ${error.message}`)

  const row = (Array.isArray(data) ? data[0] : data) as
    | { blocked: boolean; retry_after_seconds: number }
    | undefined
  if (!row?.blocked) return { blocked: false }
  return { blocked: true, retryAfterMinutes: toRetryMinutes(row.retry_after_seconds) }
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  const { error } = await createAdminClient().rpc('record_login_failure', {
    p_email_hash: sha256(email),
    p_ip_hash: sha256(ip),
  })
  if (error) throw new Error(`record_login_failure failed: ${error.message}`)
}
