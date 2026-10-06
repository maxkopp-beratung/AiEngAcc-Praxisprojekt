// "Prüfe dein Postfach" reads the address from a short-lived httpOnly cookie, never from the URL.
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

import { getPendingEmail, setPendingEmail } from './pending-email'

beforeEach(() => store.clear())

describe('pending email cookie (AC-1, AC-6)', () => {
  it('keeps the address in an httpOnly cookie for one hour, not in the URL', async () => {
    await setPendingEmail('max@example.de')
    expect(store.get('pending_email')).toEqual({
      value: 'max@example.de',
      options: expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 }),
    })
    expect(await getPendingEmail()).toBe('max@example.de')
  })

  it('returns null when there is no cookie', async () => {
    expect(await getPendingEmail()).toBeNull()
  })
})
