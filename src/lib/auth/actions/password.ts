'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clearResetCookie, hasResetCookieFor } from '@/lib/auth/reset-cookie'
import { emailOnlySchema, newPasswordFormSchema, toFieldErrors } from '@/lib/auth/schemas'
import { type ActionState, MESSAGES, isConnectionError, textValue } from '@/lib/auth/action-state'

// "Passwort vergessen" (AC-19, EC-8): always the same answer, whether the address exists or not.
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: textValue(formData.get('email')) }
  const parsed = emailOnlySchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)
    if (error) {
      if (isConnectionError(error)) return { status: 'error', code: 'connection', message: MESSAGES.connection, values }
      // A send failure (5xx) is shown; a rate limit is answered neutrally — the first link still works,
      // and a different answer would tell a stranger that this address has an account.
      if ((error.status ?? 0) >= 500) return { status: 'error', code: 'mail', message: MESSAGES.mail, values }
    }
  } catch {
    return { status: 'error', code: 'connection', message: MESSAGES.connection, values }
  }

  return { status: 'success', message: MESSAGES.resetNeutral, values }
}

// New password after a reset link (AC-20). Requires the reset session from /auth/confirm.
export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordFormSchema.safeParse({ password: formData.get('password') })
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasResetCookieFor(user.id))) {
    redirect('/auth/link-invalid?typ=reset')
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) {
      if (error.code === 'same_password') {
        return { status: 'error', fieldErrors: { password: 'Das neue Passwort muss sich vom alten unterscheiden.' } }
      }
      if (error.code === 'weak_password') {
        return { status: 'error', fieldErrors: { password: 'Dieses Passwort ist zu schwach.' } }
      }
      return { status: 'error', code: 'connection', message: MESSAGES.connection }
    }
  } catch {
    return { status: 'error', code: 'connection', message: MESSAGES.connection }
  }

  await clearResetCookie()
  redirect('/dashboard?hinweis=passwort-geaendert')
}
