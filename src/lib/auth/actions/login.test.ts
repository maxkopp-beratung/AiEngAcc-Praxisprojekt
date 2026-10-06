vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const signInWithPassword = vi.fn()
const signOut = vi.fn()
const beginLoginAttempt = vi.fn()
const releaseLoginAttempt = vi.fn()
const setPendingEmail = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signInWithPassword, signOut } }) }))
vi.mock('@/lib/auth/request-meta', () => ({ getClientIp: async () => '203.0.113.7' }))
vi.mock('@/lib/auth/throttle', () => ({
  beginLoginAttempt: (...a: unknown[]) => beginLoginAttempt(...a),
  releaseLoginAttempt: (...a: unknown[]) => releaseLoginAttempt(...a),
}))
vi.mock('@/lib/auth/pending-email', () => ({ setPendingEmail: (e: string) => setPendingEmail(e) }))

import { login } from './login'
import { logout } from './logout'
import { MESSAGES, initialActionState } from '@/lib/auth/action-state'

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}
const creds = { email: ' Max@Example.de ', password: 'geheim123' }
const invalid = { error: { status: 400, code: 'invalid_credentials', name: 'AuthApiError' } }

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null })
  signOut.mockReset().mockResolvedValue({ error: null })
  beginLoginAttempt.mockReset().mockResolvedValue({ blocked: false, attemptId: 7 })
  releaseLoginAttempt.mockReset().mockResolvedValue(undefined)
  setPendingEmail.mockReset()
})

describe('login', () => {
  it('signs in with the normalized email and goes to the dashboard (AC-8, EC-7)', async () => {
    await expect(login(initialActionState, form(creds))).rejects.toThrow('REDIRECT:/dashboard')
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'max@example.de', password: 'geheim123' })
    expect(releaseLoginAttempt).toHaveBeenCalledWith(7) // a success is no failure
  })

  it('returns to an internal "next" path, never to a foreign one (AC-13, EC-12)', async () => {
    await expect(login(initialActionState, form({ ...creds, next: '/dashboard?x=1' }))).rejects.toThrow(
      'REDIRECT:/dashboard?x=1'
    )
    await expect(login(initialActionState, form({ ...creds, next: '//evil.example' }))).rejects.toThrow(
      'REDIRECT:/dashboard'
    )
  })

  it('gives the same message for wrong password and unknown address, and keeps the failure (AC-9, AC-10)', async () => {
    signInWithPassword.mockResolvedValue(invalid)
    const state = await login(initialActionState, form(creds))
    expect(state).toMatchObject({ status: 'error', code: 'invalid', message: MESSAGES.invalidCredentials })
    expect(beginLoginAttempt).toHaveBeenCalledWith('max@example.de', '203.0.113.7')
    expect(releaseLoginAttempt).not.toHaveBeenCalled()
  })

  it('rejects a locked address without checking the password and names the wait (AC-10, AC-11)', async () => {
    beginLoginAttempt.mockResolvedValue({ blocked: true, retryAfterMinutes: 12 })
    const state = await login(initialActionState, form(creds))
    expect(state).toMatchObject({ code: 'locked', message: 'Zu viele Fehlversuche. Bitte versuche es in 12 Minuten erneut.' })
    expect(signInWithPassword).not.toHaveBeenCalled()
    expect(releaseLoginAttempt).not.toHaveBeenCalled()
  })

  it('uses the singular for one minute', async () => {
    beginLoginAttempt.mockResolvedValue({ blocked: true, retryAfterMinutes: 1 })
    expect((await login(initialActionState, form(creds))).message).toContain('in 1 Minute erneut')
  })

  it('fails closed when the throttle cannot be checked', async () => {
    beginLoginAttempt.mockRejectedValue(new Error('db down'))
    expect(await login(initialActionState, form(creds))).toMatchObject({ code: 'connection' })
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('hints at the unconfirmed address without counting a failure (AC-6)', async () => {
    signInWithPassword.mockResolvedValue({ error: { status: 400, code: 'email_not_confirmed', name: 'AuthApiError' } })
    const state = await login(initialActionState, form(creds))
    expect(state).toMatchObject({ code: 'unconfirmed', message: MESSAGES.unconfirmed })
    expect(setPendingEmail).toHaveBeenCalledWith('max@example.de')
    expect(releaseLoginAttempt).toHaveBeenCalledWith(7)
  })

  it('reports connection problems and keeps the email, not the password (EC-5)', async () => {
    signInWithPassword.mockRejectedValue(new Error('fetch failed'))
    const state = await login(initialActionState, form(creds))
    expect(state).toMatchObject({ code: 'connection', values: { email: creds.email } })
    expect(JSON.stringify(state)).not.toContain('geheim')
    expect(releaseLoginAttempt).toHaveBeenCalledWith(7) // no answer is no wrong password
  })

  it('validates input before anything else', async () => {
    const state = await login(initialActionState, form({ email: '', password: '' }))
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(['email', 'password'])
    expect(beginLoginAttempt).not.toHaveBeenCalled()
  })
})

describe('logout', () => {
  it('ends only the local session and goes to /login (AC-17)', async () => {
    await expect(logout()).rejects.toThrow('REDIRECT:/login')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
