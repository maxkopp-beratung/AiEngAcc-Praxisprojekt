'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPendingEmail } from '@/lib/auth/pending-email'
import { emailOnlySchema, toFieldErrors } from '@/lib/auth/schemas'
import { type ActionState, MESSAGES, isConnectionError, isMailError, textValue } from '@/lib/auth/action-state'

// "Link erneut senden" (AC-5, AC-6, EC-3). The address comes from the form field when there is one
// (/auth/link-invalid), otherwise from the pending_email cookie (/signup/check-email).
// The answer is always neutral, so it reveals nothing about which addresses have an account.
export async function resendConfirmation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const fromForm = formData.has('email')
  const email = fromForm ? textValue(formData.get('email')) : ((await getPendingEmail()) ?? '')

  const parsed = emailOnlySchema.safeParse({ email })
  if (!parsed.success) {
    if (!fromForm) redirect('/signup') // cookie expired: start over
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values: { email } }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email: parsed.data.email })
    if (error) {
      if (isConnectionError(error)) return { status: 'error', code: 'connection', message: MESSAGES.connection, values: { email } }
      if (error.code === 'over_email_send_rate_limit') {
        return { status: 'error', code: 'cooldown', message: MESSAGES.resendCooldown, values: { email } }
      }
      if (isMailError(error)) return { status: 'error', code: 'mail', message: MESSAGES.mail, values: { email } }
      // Anything else (already confirmed, unknown address …) gets the neutral answer.
    }
  } catch {
    return { status: 'error', code: 'connection', message: MESSAGES.connection, values: { email } }
  }

  return { status: 'success', message: MESSAGES.resendNeutral, values: { email } }
}
