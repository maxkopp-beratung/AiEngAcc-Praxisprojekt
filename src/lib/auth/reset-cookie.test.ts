// The reset cookie is what separates a reset-link session from a normal login (AC-20):
// it must be httpOnly, last one hour and only count for the user it was issued to.
vi.mock('server-only', () => ({}))

const store = new Map<string, { value: string; options?: Record<string, unknown> }>()
const cookieStore = {
  get: (name: string) => (store.has(name) ? { name, value: store.get(name)!.value } : undefined),
  set: (name: string, value: string, options?: Record<string, unknown>) => {
    store.set(name, { value, options })
  },
  delete: (name: string) => {
    store.delete(name)
  },
}
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }))

import { clearResetCookie, hasResetCookieFor, setResetCookie } from './reset-cookie'

beforeEach(() => store.clear())

describe('reset cookie (AC-20)', () => {
  it('is set httpOnly, SameSite=Lax, for one hour on the whole site', async () => {
    await setResetCookie('user-a')
    expect(store.get('password_reset')).toEqual({
      value: 'user-a',
      options: expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 }),
    })
  })

  it('only counts for the user it was issued to', async () => {
    await setResetCookie('user-a')
    expect(await hasResetCookieFor('user-a')).toBe(true)
    expect(await hasResetCookieFor('user-b')).toBe(false)
  })

  it('is gone after clearing, and absent by default', async () => {
    expect(await hasResetCookieFor('user-a')).toBe(false)
    await setResetCookie('user-a')
    await clearResetCookie()
    expect(await hasResetCookieFor('user-a')).toBe(false)
  })
})
