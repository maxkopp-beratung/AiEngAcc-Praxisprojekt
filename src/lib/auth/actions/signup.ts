'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setPendingEmail } from '@/lib/auth/pending-email'
import { formDataToObject, signupSchema, toFieldErrors } from '@/lib/auth/schemas'
import { type ActionState, MESSAGES, isConnectionError, isMailError, textValue } from '@/lib/auth/action-state'

// Registration (AC-1, AC-2, AC-3, AC-7, EC-4, EC-7).
export async function signup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: textValue(formData.get('email')), displayName: textValue(formData.get('displayName')) }
  const parsed = signupSchema.safeParse(formDataToObject(formData, ['email', 'password', 'displayName']))
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values }
  }
  const { email, password, displayName } = parsed.data

  try {
    // AC-7: an existing address gets the same answer and is not touched at all.
    const { data: exists, error: existsError } = await createAdminClient().rpc('auth_email_exists', {
      p_email: email,
    })
    if (existsError) throw existsError

    if (!exists) {
      const supabase = await createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error && error.code !== 'user_already_exists') {
        if (error.code === 'weak_password') {
          return { status: 'error', fieldErrors: { password: 'Dieses Passwort ist zu schwach.' }, values }
        }
        if (error.code === 'email_address_invalid') {
          return { status: 'error', fieldErrors: { email: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, values }
        }
        if (isConnectionError(error)) return { status: 'error', code: 'connection', message: MESSAGES.connection, values }
        if (isMailError(error)) return { status: 'error', code: 'mail', message: MESSAGES.mail, values }
        return { status: 'error', code: 'connection', message: MESSAGES.connection, values }
      }
    }
  } catch {
    return { status: 'error', code: 'connection', message: MESSAGES.connection, values }
  }

  await setPendingEmail(email)
  redirect('/signup/check-email')
}
