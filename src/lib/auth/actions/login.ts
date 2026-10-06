'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientIp } from '@/lib/auth/request-meta'
import { getLoginThrottle, recordLoginFailure } from '@/lib/auth/throttle'
import { setPendingEmail } from '@/lib/auth/pending-email'
import { safeRedirectPath } from '@/lib/auth/safe-redirect'
import { formDataToObject, loginSchema, toFieldErrors } from '@/lib/auth/schemas'
import {
  type ActionState,
  MESSAGES,
  isConnectionError,
  lockedMessage,
  textValue,
} from '@/lib/auth/action-state'

// Login (AC-6, AC-8 – AC-11, AC-13, EC-5, EC-7, EC-12).
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: textValue(formData.get('email')) }
  const parsed = loginSchema.safeParse(formDataToObject(formData, ['email', 'password', 'next']))
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values }
  }
  const { email, password, next } = parsed.data

  const connectionError: ActionState = { status: 'error', code: 'connection', message: MESSAGES.connection, values }

  // 1. Throttle first: a locked address is not even checked (and unknown addresses lock the same way).
  let ip: string
  try {
    ip = await getClientIp()
    const throttle = await getLoginThrottle(email, ip)
    if (throttle.blocked) {
      return { status: 'error', code: 'locked', message: lockedMessage(throttle.retryAfterMinutes), values }
    }
  } catch {
    return connectionError // fail closed
  }

  // 2. The credential check itself.
  let error
  try {
    const supabase = await createClient()
    ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
  } catch {
    return connectionError
  }

  if (error) {
    if (error.code === 'invalid_credentials') {
      try {
        await recordLoginFailure(email, ip)
      } catch {
        // The answer stays the same; the failure is lost, which only ever loosens the lock.
      }
      return { status: 'error', code: 'invalid', message: MESSAGES.invalidCredentials, values }
    }
    if (error.code === 'email_not_confirmed') {
      // Only reported for a correct password, so it is not counted as a failure (AC-6).
      await setPendingEmail(email)
      return { status: 'error', code: 'unconfirmed', message: MESSAGES.unconfirmed, values }
    }
    if (error.code === 'over_request_rate_limit') {
      return { status: 'error', code: 'locked', message: MESSAGES.tooManyRequests, values }
    }
    if (isConnectionError(error)) return connectionError
    return connectionError
  }

  redirect(safeRedirectPath(next))
}
