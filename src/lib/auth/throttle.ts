// Login throttle (AC-10, AC-11): 5 failures per email / 20 per IP within 15 minutes.
// The counting itself lives in the database (begin_login_attempt / release_login_attempt);
// only hashes of the normalized email and the IP ever leave this module.
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sha256 } from './request-meta'

export type LoginAttempt = { blocked: false; attemptId: number } | { blocked: true; retryAfterMinutes: number }

export function toRetryMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60))
}

// Checks the lock and, if free, reserves this attempt as a failure in one serialized database
// step, so parallel attempts cannot all pass the check (BUG-1). Release it when it was no failure.
export async function beginLoginAttempt(email: string, ip: string): Promise<LoginAttempt> {
  const { data, error } = await createAdminClient().rpc('begin_login_attempt', {
    p_email_hash: sha256(email),
    p_ip_hash: sha256(ip),
  })
  // Fail closed: without a working throttle the login must not proceed.
  if (error) throw new Error(`begin_login_attempt failed: ${error.message}`)

  const row = (Array.isArray(data) ? data[0] : data) as
    | { blocked: boolean; retry_after_seconds: number; attempt_id: number | null }
    | undefined
  if (!row) throw new Error('begin_login_attempt returned no row')
  if (row.blocked) return { blocked: true, retryAfterMinutes: toRetryMinutes(row.retry_after_seconds) }
  return { blocked: false, attemptId: row.attempt_id! }
}

export async function releaseLoginAttempt(attemptId: number): Promise<void> {
  const { error } = await createAdminClient().rpc('release_login_attempt', { p_attempt_id: attemptId })
  if (error) throw new Error(`release_login_attempt failed: ${error.message}`)
}
