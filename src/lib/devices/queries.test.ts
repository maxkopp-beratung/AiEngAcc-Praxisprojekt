vi.mock('server-only', () => ({}))

import type { SupabaseClient } from '@supabase/supabase-js'
import { listDevices } from './queries'

type DbResult = { data: unknown; error: { code?: string; message?: string } | null }

// Chainable fake of `supabase.from('devices').select(...).order(...).order(...)`.
function fakeClient(result: DbResult | (() => never)) {
  const calls = { table: '', columns: '', orders: [] as Array<[string, unknown]> }
  const chain = {
    order(column: string, options: unknown) {
      calls.orders.push([column, options])
      return chain
    },
    then(resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve()
        .then(() => (typeof result === 'function' ? result() : result))
        .then(resolve, reject)
    },
  }
  const client = {
    from(table: string) {
      calls.table = table
      return {
        select(columns: string) {
          calls.columns = columns
          return chain
        },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('listDevices (AC-10)', () => {
  it('reads the devices table oldest first, ties broken by id', async () => {
    const { client, calls } = fakeClient({ data: [], error: null })
    await listDevices(client)
    expect(calls.table).toBe('devices')
    expect(calls.columns).toBe('id, name, duration_minutes, created_at')
    expect(calls.orders).toEqual([
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
  })

  it('maps database rows to devices in the order returned', async () => {
    const { client } = fakeClient({
      data: [
        { id: 'a', name: 'Waschmaschine', duration_minutes: 150, created_at: '2026-10-06T08:00:00Z' },
        { id: 'b', name: '<b>Trockner</b>', duration_minutes: 15, created_at: '2026-10-06T09:00:00Z' },
      ],
      error: null,
    })
    expect(await listDevices(client)).toEqual([
      { id: 'a', name: 'Waschmaschine', durationMinutes: 150, createdAt: '2026-10-06T08:00:00Z' },
      { id: 'b', name: '<b>Trockner</b>', durationMinutes: 15, createdAt: '2026-10-06T09:00:00Z' },
    ])
  })

  it('returns an empty list for a user without devices', async () => {
    const { client } = fakeClient({ data: [], error: null })
    expect(await listDevices(client)).toEqual([])
  })

  it('returns null when the database reports an error', async () => {
    const { client } = fakeClient({ data: null, error: { code: '42501', message: 'permission denied' } })
    expect(await listDevices(client)).toBeNull()
  })

  it('returns null when the request throws (e.g. no connection)', async () => {
    const { client } = fakeClient(() => {
      throw new Error('fetch failed')
    })
    expect(await listDevices(client)).toBeNull()
  })

  it('returns null when data is missing without an error', async () => {
    const { client } = fakeClient({ data: null, error: null })
    expect(await listDevices(client)).toBeNull()
  })
})
