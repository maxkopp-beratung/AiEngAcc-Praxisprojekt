// /qa (PROJ-1, re-verification of BUG-1): which login outcomes give the throttle reservation back.
// Only a wrong password may stay counted as a failure (AC-6, AC-8, AC-10).
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const signInWithPassword = vi.fn()
const beginLoginAttempt = vi.fn()
const releaseLoginAttempt = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signInWithPassword } }) }))
vi.mock('@/lib/auth/request-meta', () => ({ getClientIp: async () => '203.0.113.7' }))
vi.mock('@/lib/auth/throttle', () => ({
  beginLoginAttempt: (...a: unknown[]) => beginLoginAttempt(...a),
  releaseLoginAttempt: (...a: unknown[]) => releaseLoginAttempt(...a),
}))
vi.mock('@/lib/auth/pending-email', () => ({ setPendingEmail: vi.fn() }))

import { login } from './login'
import { MESSAGES, initialActionState } from '@/lib/auth/action-state'

const form = () => {
  const fd = new FormData()
  fd.set('email', 'max@example.de')
  fd.set('password', 'geheim123')
  return fd
}
const authError = (code: string, status = 400) => ({ data: {}, error: { status, code, name: 'AuthApiError' } })

beforeEach(() => {
  signInWithPassword.mockReset()
  beginLoginAttempt.mockReset().mockResolvedValue({ blocked: false, attemptId: 42 })
  releaseLoginAttempt.mockReset().mockResolvedValue(undefined)
})

describe('login reservation', () => {
  it('releases on a Supabase rate limit and says so, without the failure message', async () => {
    signInWithPassword.mockResolvedValue(authError('over_request_rate_limit', 429))
    const state = await login(initialActionState, form())
    expect(state).toMatchObject({ code: 'locked', message: MESSAGES.tooManyRequests })
    expect(state.message).not.toBe(MESSAGES.invalidCredentials)
    expect(releaseLoginAttempt).toHaveBeenCalledExactlyOnceWith(42)
  })

  it('releases on an unexpected auth error code', async () => {
    signInWithPassword.mockResolvedValue(authError('unexpected_failure', 500))
    expect(await login(initialActionState, form())).toMatchObject({ code: 'connection' })
    expect(releaseLoginAttempt).toHaveBeenCalledExactlyOnceWith(42)
  })

  it('releases when the credential check throws', async () => {
    signInWithPassword.mockRejectedValue(new TypeError('fetch failed'))
    expect(await login(initialActionState, form())).toMatchObject({ code: 'connection' })
    expect(releaseLoginAttempt).toHaveBeenCalledExactlyOnceWith(42)
  })

  it('keeps the reservation for a wrong password', async () => {
    signInWithPassword.mockResolvedValue(authError('invalid_credentials'))
    expect(await login(initialActionState, form())).toMatchObject({ code: 'invalid' })
    expect(releaseLoginAttempt).not.toHaveBeenCalled()
  })

  it('still signs in when the release itself fails', async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: null })
    releaseLoginAttempt.mockRejectedValue(new Error('db down'))
    await expect(login(initialActionState, form())).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('still reports the unconfirmed account when the release itself fails (AC-6)', async () => {
    signInWithPassword.mockResolvedValue(authError('email_not_confirmed'))
    releaseLoginAttempt.mockRejectedValue(new Error('db down'))
    expect(await login(initialActionState, form())).toMatchObject({ code: 'unconfirmed', message: MESSAGES.unconfirmed })
  })
})
