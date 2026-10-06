vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const signUp = vi.fn()
const rpc = vi.fn()
const setPendingEmail = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signUp } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))
vi.mock('@/lib/auth/pending-email', () => ({ setPendingEmail: (e: string) => setPendingEmail(e) }))

import { signup } from './signup'
import { MESSAGES, initialActionState } from '@/lib/auth/action-state'

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}
const valid = { email: ' Max@Example.de ', password: 'geheim123', displayName: ' Max ' }

beforeEach(() => {
  signUp.mockReset().mockResolvedValue({ data: {}, error: null })
  rpc.mockReset().mockResolvedValue({ data: false, error: null })
  setPendingEmail.mockReset()
})

describe('signup', () => {
  it('creates the account with the normalized email and display name, then shows "check your inbox" (AC-1, AC-3, EC-7)', async () => {
    await expect(signup(initialActionState, form(valid))).rejects.toThrow('REDIRECT:/signup/check-email')
    expect(signUp).toHaveBeenCalledWith({
      email: 'max@example.de',
      password: 'geheim123',
      options: { data: { display_name: 'Max' } },
    })
    expect(setPendingEmail).toHaveBeenCalledWith('max@example.de')
  })

  it('returns field errors and calls nothing on invalid input (AC-2)', async () => {
    const state = await signup(initialActionState, form({ email: 'x', password: '123', displayName: 'y'.repeat(51) }))
    expect(state.status).toBe('error')
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(['displayName', 'email', 'password'])
    expect(rpc).not.toHaveBeenCalled()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('keeps the email and name, never the password, after an error (EC-5)', async () => {
    const state = await signup(initialActionState, form({ ...valid, password: '1' }))
    expect(state.values).toEqual({ email: valid.email, displayName: valid.displayName })
    expect(JSON.stringify(state)).not.toContain('geheim')
  })

  it('answers an existing address exactly like a new one and does not touch the account (AC-7)', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await expect(signup(initialActionState, form(valid))).rejects.toThrow('REDIRECT:/signup/check-email')
    expect(signUp).not.toHaveBeenCalled()
    expect(setPendingEmail).toHaveBeenCalledWith('max@example.de')
  })

  it('shows the mail message when sending fails (EC-4)', async () => {
    signUp.mockResolvedValue({ error: { status: 500, code: 'unexpected_failure', name: 'AuthApiError' } })
    const state = await signup(initialActionState, form(valid))
    expect(state).toMatchObject({ status: 'error', code: 'mail', message: MESSAGES.mail })
    expect(setPendingEmail).not.toHaveBeenCalled()
  })

  it('shows the connection message when the server is unreachable (EC-5)', async () => {
    rpc.mockRejectedValue(new Error('fetch failed'))
    const state = await signup(initialActionState, form(valid))
    expect(state).toMatchObject({ status: 'error', code: 'connection', values: { email: valid.email } })
  })
})
