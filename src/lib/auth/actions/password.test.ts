vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const resetPasswordForEmail = vi.fn()
const getUser = vi.fn()
const updateUser = vi.fn()
const hasResetCookieFor = vi.fn()
const clearResetCookie = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { resetPasswordForEmail, getUser, updateUser } }),
}))
vi.mock('@/lib/auth/reset-cookie', () => ({
  hasResetCookieFor: (id: string) => hasResetCookieFor(id),
  clearResetCookie: () => clearResetCookie(),
}))

import { requestPasswordReset, updatePassword } from './password'
import { MESSAGES, initialActionState } from '@/lib/auth/action-state'

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null })
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } } })
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null })
  hasResetCookieFor.mockReset().mockResolvedValue(true)
  clearResetCookie.mockReset()
})

describe('requestPasswordReset (AC-19)', () => {
  it('always answers with the same neutral message', async () => {
    const state = await requestPasswordReset(initialActionState, form({ email: ' Max@Example.de ' }))
    expect(resetPasswordForEmail).toHaveBeenCalledWith('max@example.de')
    expect(state).toMatchObject({ status: 'success', message: MESSAGES.resetNeutral })
  })

  it('stays neutral on a rate limit, so it reveals nothing about the address', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', name: 'AuthApiError' } })
    expect(await requestPasswordReset(initialActionState, form({ email: 'a@b.de' }))).toMatchObject({
      status: 'success',
      message: MESSAGES.resetNeutral,
    })
  })

  it('reports send and connection failures (EC-4, EC-5)', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 500, code: 'unexpected_failure', name: 'AuthApiError' } })
    expect(await requestPasswordReset(initialActionState, form({ email: 'a@b.de' }))).toMatchObject({ code: 'mail' })
    resetPasswordForEmail.mockResolvedValue({ error: { status: 0, name: 'AuthRetryableFetchError' } })
    expect(await requestPasswordReset(initialActionState, form({ email: 'a@b.de' }))).toMatchObject({ code: 'connection' })
  })

  it('validates the email', async () => {
    const state = await requestPasswordReset(initialActionState, form({ email: 'nope' }))
    expect(state.fieldErrors?.email).toBeDefined()
    expect(resetPasswordForEmail).not.toHaveBeenCalled()
  })
})

describe('updatePassword (AC-20)', () => {
  it('sets the new password, clears the reset marker and goes to the dashboard', async () => {
    await expect(updatePassword(initialActionState, form({ password: 'neuesPasswort' }))).rejects.toThrow(
      'REDIRECT:/dashboard?hinweis=passwort-geaendert'
    )
    expect(updateUser).toHaveBeenCalledWith({ password: 'neuesPasswort' })
    expect(hasResetCookieFor).toHaveBeenCalledWith('user-1')
    expect(clearResetCookie).toHaveBeenCalled()
  })

  it('refuses without a reset session (no session, or a normal one)', async () => {
    hasResetCookieFor.mockResolvedValue(false)
    await expect(updatePassword(initialActionState, form({ password: 'neuesPasswort' }))).rejects.toThrow(
      'REDIRECT:/auth/link-invalid?typ=reset'
    )
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(updatePassword(initialActionState, form({ password: 'neuesPasswort' }))).rejects.toThrow(
      'REDIRECT:/auth/link-invalid?typ=reset'
    )
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('validates 8–72 characters before anything else', async () => {
    const state = await updatePassword(initialActionState, form({ password: 'kurz' }))
    expect(state.fieldErrors?.password).toBe('Das Passwort muss mindestens 8 Zeichen lang sein.')
    expect(getUser).not.toHaveBeenCalled()
  })

  it('explains a reused password', async () => {
    updateUser.mockResolvedValue({ error: { status: 422, code: 'same_password', name: 'AuthApiError' } })
    const state = await updatePassword(initialActionState, form({ password: 'altesPasswort' }))
    expect(state.fieldErrors?.password).toContain('unterscheiden')
    expect(clearResetCookie).not.toHaveBeenCalled()
  })
})
