vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const getUser = vi.fn()
const signOut = vi.fn()
const eq = vi.fn()
const update = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ update }))
const deleteUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser, signOut }, from }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { deleteUser } } }) }))

import { deleteAccount, updateDisplayName } from './account'
import { initialActionState } from '@/lib/auth/action-state'

const form = (fields: Record<string, string>) => {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } } })
  signOut.mockReset().mockResolvedValue({ error: null })
  eq.mockReset().mockResolvedValue({ error: null })
  update.mockClear()
  from.mockClear()
  deleteUser.mockReset().mockResolvedValue({ data: {}, error: null })
})

describe('updateDisplayName (AC-18, EC-10)', () => {
  it('updates only the own profile with the trimmed name', async () => {
    const state = await updateDisplayName(initialActionState, form({ displayName: '  Max  ', id: 'someone-else' }))
    expect(from).toHaveBeenCalledWith('profiles')
    expect(update).toHaveBeenCalledWith({ display_name: 'Max' })
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
    expect(state).toMatchObject({ status: 'success', message: 'Anzeigename gespeichert.' })
  })

  it('removes the name when the field is emptied', async () => {
    const state = await updateDisplayName(initialActionState, form({ displayName: '   ' }))
    expect(update).toHaveBeenCalledWith({ display_name: null })
    expect(state.message).toBe('Anzeigename entfernt.')
  })

  it('rejects more than 50 characters without writing', async () => {
    const state = await updateDisplayName(initialActionState, form({ displayName: 'x'.repeat(51) }))
    expect(state.fieldErrors?.displayName).toBeDefined()
    expect(update).not.toHaveBeenCalled()
  })

  it('sends a logged-out user to /login', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(updateDisplayName(initialActionState, form({ displayName: 'Max' }))).rejects.toThrow('REDIRECT:/login')
    expect(update).not.toHaveBeenCalled()
  })

  it('reports a failed write', async () => {
    eq.mockResolvedValue({ error: { message: 'boom' } })
    expect(await updateDisplayName(initialActionState, form({ displayName: 'Max' }))).toMatchObject({ status: 'error' })
  })
})

describe('deleteAccount (AC-25, EC-6)', () => {
  it('deletes the user of the verified session, signs out and says so on /login', async () => {
    await expect(deleteAccount(initialActionState)).rejects.toThrow('REDIRECT:/login?konto=geloescht')
    expect(deleteUser).toHaveBeenCalledWith('user-1')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('does nothing without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    await expect(deleteAccount(initialActionState)).rejects.toThrow('REDIRECT:/login')
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('keeps the session and reports when deletion fails', async () => {
    deleteUser.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await deleteAccount(initialActionState)).toMatchObject({ status: 'error' })
    expect(signOut).not.toHaveBeenCalled()
  })
})
