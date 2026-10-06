// Marks a session that came from a valid reset link (AC-20). A recovery session cannot be told
// apart from a normal one by its token, so /reset-password and the update action require this
// httpOnly cookie, bound to the user id and valid for the same hour as the reset link.
import 'server-only'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'password_reset'

export async function setResetCookie(userId: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  })
}

export async function hasResetCookieFor(userId: string): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value === userId
}

export async function clearResetCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
