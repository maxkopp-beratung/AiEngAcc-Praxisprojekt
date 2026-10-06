// Shared result shape of every PROJ-1 server action (used with React's useActionState).
import type { AuthError } from '@supabase/supabase-js'
import type { FieldErrors } from './schemas'

export type ActionState = {
  status: 'idle' | 'error' | 'success'
  /** Form-level message (alert above the button, or toast on success). */
  message?: string
  /** Distinguishes error kinds the UI renders differently. */
  code?: 'connection' | 'mail' | 'locked' | 'unconfirmed' | 'invalid' | 'cooldown'
  fieldErrors?: FieldErrors
  /** Non-secret input echoed back so the form keeps it after an error (EC-5). */
  values?: { email?: string; displayName?: string }
}

export const initialActionState: ActionState = { status: 'idle' }

export const MESSAGES = {
  connection: 'Es gab ein Verbindungsproblem. Bitte versuche es erneut.',
  mail: 'Wir konnten gerade keine E-Mail senden, bitte versuche es in einigen Minuten erneut.',
  invalidCredentials: 'E-Mail-Adresse oder Passwort ist falsch.',
  unconfirmed: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
  resendNeutral:
    'Falls ein unbestätigtes Konto mit dieser Adresse existiert, haben wir dir einen neuen Link geschickt.',
  resendCooldown: 'Bitte warte noch kurz, bevor du einen neuen Link anforderst.',
  resetNeutral: 'Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link geschickt.',
  tooManyRequests: 'Zu viele Anfragen. Bitte versuche es in ein paar Minuten erneut.',
} as const

export function lockedMessage(minutes: number): string {
  return `Zu viele Fehlversuche. Bitte versuche es in ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'} erneut.`
}

export function textValue(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

// Network failures surface as status 0 / AuthRetryableFetchError in supabase-js.
export function isConnectionError(error: Pick<AuthError, 'status' | 'name'>): boolean {
  return error.name === 'AuthRetryableFetchError' || !error.status
}

// SMTP failures come back as 5xx; "over_email_send_rate_limit" means the mail quota is used up.
export function isMailError(error: Pick<AuthError, 'status' | 'code'>): boolean {
  return error.code === 'over_email_send_rate_limit' || (error.status ?? 0) >= 500
}
