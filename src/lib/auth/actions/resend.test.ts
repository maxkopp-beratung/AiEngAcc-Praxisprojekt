vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const resend = vi.fn()
const getPendingEmail = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { resend } }) }))
vi.mock('@/lib/auth/pending-email', () => ({ getPendingEmail: () => getPendingEmail() }))

import { resendConfirmation } from './resend'
import { MESSAGES, initialActionState } from '@/lib/auth/action-state'

const form = (fields: Record<string, string> = {}) => {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  resend.mockReset().mockResolvedValue({ data: {}, error: null })
  getPendingEmail.mockReset().mockResolvedValue('max@example.de')
})

describe('resendConfirmation', () => {
  it('resends to the address from the cookie and answers neutrally (AC-5)', async () => {
    const state = await resendConfirmation(initialActionState, form())
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'max@example.de' })
    expect(state).toMatchObject({ status: 'success', message: MESSAGES.resendNeutral })
  })

  it('uses the form field when there is one (EC-3, link-invalid page)', async () => {
    await resendConfirmation(initialActionState, form({ email: ' Other@Example.de ' }))
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'other@example.de' })
  })

  it('answers neutrally for unknown or already confirmed addresses', async () => {
    resend.mockResolvedValue({ error: { status: 422, code: 'validation_failed', name: 'AuthApiError' } })
    expect((await resendConfirmation(initialActionState, form())).status).toBe('success')
  })

  it('reports the cooldown when Supabase rate-limits (AC-5)', async () => {
    resend.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', name: 'AuthApiError' } })
    expect(await resendConfirmation(initialActionState, form())).toMatchObject({ code: 'cooldown' })
  })

  it('reports a send failure (EC-4) and a connection failure (EC-5)', async () => {
    resend.mockResolvedValue({ error: { status: 500, code: 'unexpected_failure', name: 'AuthApiError' } })
    expect(await resendConfirmation(initialActionState, form())).toMatchObject({ code: 'mail' })
    resend.mockResolvedValue({ error: { status: 0, name: 'AuthRetryableFetchError' } })
    expect(await resendConfirmation(initialActionState, form())).toMatchObject({ code: 'connection' })
  })

  it('validates the form field and starts over when the cookie has expired', async () => {
    const state = await resendConfirmation(initialActionState, form({ email: 'nope' }))
    expect(state.fieldErrors?.email).toBeDefined()
    expect(resend).not.toHaveBeenCalled()

    getPendingEmail.mockResolvedValue(null)
    await expect(resendConfirmation(initialActionState, form())).rejects.toThrow('REDIRECT:/signup')
  })
})
