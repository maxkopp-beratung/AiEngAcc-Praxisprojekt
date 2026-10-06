'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getClientIp } from '@/lib/auth/request-meta'
import { beginLoginAttempt, releaseLoginAttempt } from '@/lib/auth/throttle'
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
  //    A free attempt is reserved as a failure right away, so parallel attempts count (BUG-1).
  let attemptId: number
  try {
    const attempt = await beginLoginAttempt(email, await getClientIp())
    if (attempt.blocked) {
      return { status: 'error', code: 'locked', message: lockedMessage(attempt.retryAfterMinutes), values }
    }
    attemptId = attempt.attemptId
  } catch {
    return connectionError // fail closed
  }

  // Only a wrong password counts; every other outcome gives the reservation back.
  const release = async () => {
    try {
      await releaseLoginAttempt(attemptId)
    } catch {
      // The reservation then stays a failure for 15 minutes, which only ever tightens the lock.
    }
  }

  // 2. The credential check itself.
  let error
  try {
    const supabase = await createClient()
    ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
  } catch {
    await release()
    return connectionError
  }

  if (error?.code === 'invalid_credentials') {
    return { status: 'error', code: 'invalid', message: MESSAGES.invalidCredentials, values }
  }
  await release()
  if (error) {
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
