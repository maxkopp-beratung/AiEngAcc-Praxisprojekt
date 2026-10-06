// The address shown on "Prüfe dein Postfach" travels in a short-lived httpOnly cookie,
// never in the URL (security rules: no PII in URLs).
import 'server-only'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'pending_email'

export async function setPendingEmail(email: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, email, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  })
}

export async function getPendingEmail(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}
