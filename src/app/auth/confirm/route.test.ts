vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const verifyOtp = vi.fn()
const getClaims = vi.fn()
const signOut = vi.fn()
const setResetCookie = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { verifyOtp, getClaims, signOut } }) }))
vi.mock('@/lib/auth/reset-cookie', () => ({ setResetCookie: (id: string) => setResetCookie(id) }))

import { NextRequest } from 'next/server'
import { GET } from './route'

const call = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/confirm${query}`))
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

beforeEach(() => {
  verifyOtp.mockReset()
  getClaims.mockReset().mockResolvedValue({ data: null })
  signOut.mockReset().mockResolvedValue({ error: null })
  setResetCookie.mockReset()
})

describe('/auth/confirm', () => {
  it('confirms a signup link and goes to the dashboard (AC-4)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await expect(call('?token_hash=abc&type=signup')).rejects.toThrow('REDIRECT:/dashboard')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'signup', token_hash: 'abc' })
  })

  it('opens the reset form for a fresh reset link and marks the session (AC-20, EC-9)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: 'u1', recovery_sent_at: minutesAgo(10) } }, error: null })
    await expect(call('?token_hash=abc&type=recovery')).rejects.toThrow('REDIRECT:/reset-password')
    expect(setResetCookie).toHaveBeenCalledWith('u1')
  })

  it('rejects a reset link older than one hour and signs out again (AC-21)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: 'u1', recovery_sent_at: minutesAgo(61) } }, error: null })
    await expect(call('?token_hash=abc&type=recovery')).rejects.toThrow('REDIRECT:/auth/link-invalid?typ=reset')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(setResetCookie).not.toHaveBeenCalled()
  })

  it('sends an expired or used reset link to the hint page (AC-21, EC-8)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired', status: 403 } })
    await expect(call('?token_hash=abc&type=recovery')).rejects.toThrow('REDIRECT:/auth/link-invalid?typ=reset')
  })

  it('sends an expired or used signup link to the hint page when not signed in (EC-2, EC-3)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired', status: 403 } })
    await expect(call('?token_hash=abc&type=signup')).rejects.toThrow('REDIRECT:/auth/link-invalid?typ=signup')
  })

  it('sends a signed-in user with a used signup link to the dashboard (EC-2)', async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: 'otp_expired', status: 403 } })
    getClaims.mockResolvedValue({ data: { claims: { sub: 'u1' } } })
    await expect(call('?token_hash=abc&type=signup')).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('treats missing or unknown parameters as an invalid link', async () => {
    await expect(call('')).rejects.toThrow('REDIRECT:/auth/link-invalid?typ=signup')
    await expect(call('?token_hash=abc&type=magiclink')).rejects.toThrow('REDIRECT:/auth/link-invalid?typ=signup')
    expect(verifyOtp).not.toHaveBeenCalled()
  })
})
