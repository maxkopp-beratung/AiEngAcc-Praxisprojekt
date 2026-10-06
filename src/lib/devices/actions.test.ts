vi.mock('server-only', () => ({}))

type DbResult = { data?: unknown; error: { code?: string; message?: string } | null }

const getUser = vi.fn()
const insert = vi.fn()
const update = vi.fn()
const del = vi.fn()
const updateEq = vi.fn()
const deleteEq = vi.fn()
const listSelect = vi.fn()
const listOrder = vi.fn()

let insertResult: DbResult
let updateResult: DbResult
let deleteResult: DbResult
let listResult: DbResult

// A chainable fake of `supabase.from('devices')` for the four statements the module issues.
const from = vi.fn(() => ({
  insert: (payload: unknown) => {
    insert(payload)
    return Promise.resolve(insertResult)
  },
  update: (payload: unknown) => {
    update(payload)
    return {
      eq: (column: string, value: unknown) => {
        updateEq(column, value)
        return { select: () => Promise.resolve(updateResult) }
      },
    }
  },
  delete: () => {
    del()
    return {
      eq: (column: string, value: unknown) => {
        deleteEq(column, value)
        return { select: () => Promise.resolve(deleteResult) }
      },
    }
  },
  select: (columns: string) => {
    listSelect(columns)
    const chain = {
      order: (column: string, options: unknown) => {
        listOrder(column, options)
        return chain
      },
      then: (resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(listResult).then(resolve, reject),
    }
    return chain
  },
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser }, from }) }))

import { createDevice, deleteDevice, updateDevice } from './actions'
import { DEVICE_MESSAGES } from './types'

const ID = '7f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const rows = [
  { id: 'b-1', name: 'Waschmaschine', duration_minutes: 150, created_at: '2026-10-01T08:00:00Z' },
  { id: 'a-2', name: 'Spülmaschine', duration_minutes: 120, created_at: '2026-10-02T08:00:00Z' },
]
const devices = [
  { id: 'b-1', name: 'Waschmaschine', durationMinutes: 150, createdAt: '2026-10-01T08:00:00Z' },
  { id: 'a-2', name: 'Spülmaschine', durationMinutes: 120, createdAt: '2026-10-02T08:00:00Z' },
]
const RAW = 'duplicate key value violates unique constraint "devices_user_name_key"'

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  insertResult = { error: null }
  updateResult = { data: [{ id: ID }], error: null }
  deleteResult = { data: [{ id: ID }], error: null }
  listResult = { data: rows, error: null }
})

describe('listing after a write (AC-10)', () => {
  it('reads id, name, duration and created_at sorted by created_at, then id', async () => {
    await createDevice({ name: 'Trockner', durationMinutes: 90 })
    expect(listSelect).toHaveBeenCalledWith('id, name, duration_minutes, created_at')
    expect(listOrder.mock.calls).toEqual([
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
  })
})

describe('createDevice (AC-5 to AC-9, EC-7 to EC-9, AC-24)', () => {
  it('rejects a logged-out user without touching the database', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await createDevice({ name: 'Trockner', durationMinutes: 90 })).toEqual({ status: 'unauthorized' })
    expect(from).not.toHaveBeenCalled()
  })

  it('inserts only the normalized name and duration, then returns the list as read', async () => {
    const result = await createDevice({ name: '  Trockner  ', durationMinutes: 90, user_id: 'x', created_at: 'y' })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith({ name: 'Trockner', duration_minutes: 90 })
    expect(result).toEqual({ status: 'ok', devices })
  })

  it('returns field errors for name and duration without writing', async () => {
    const result = await createDevice({ name: '   ', durationMinutes: 20 })
    expect(result).toEqual({
      status: 'invalid',
      fieldErrors: { name: DEVICE_MESSAGES.nameRequired, duration: DEVICE_MESSAGES.durationRange },
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('maps a unique violation (23505) to duplicate_name with the list', async () => {
    insertResult = { error: { code: '23505', message: RAW } }
    expect(await createDevice({ name: 'Waschmaschine', durationMinutes: 90 })).toEqual({
      status: 'duplicate_name',
      devices,
    })
  })

  it('maps the trigger error device_limit_reached (P0001) to limit_reached with the list', async () => {
    insertResult = { error: { code: 'P0001', message: 'device_limit_reached' } }
    expect(await createDevice({ name: 'Trockner', durationMinutes: 90 })).toEqual({
      status: 'limit_reached',
      devices,
    })
  })

  it('maps any other database error to error without the raw message', async () => {
    insertResult = { error: { code: '42501', message: 'permission denied for table devices' } }
    const result = await createDevice({ name: 'Trockner', durationMinutes: 90 })
    expect(result).toEqual({ status: 'error' })
    expect(JSON.stringify(result)).not.toContain('permission')
  })

  it('treats another P0001 message as error', async () => {
    insertResult = { error: { code: 'P0001', message: 'something else' } }
    expect(await createDevice({ name: 'Trockner', durationMinutes: 90 })).toEqual({ status: 'error' })
  })

  it('returns error when the list cannot be read after the write', async () => {
    listResult = { data: null, error: { message: 'timeout' } }
    expect(await createDevice({ name: 'Trockner', durationMinutes: 90 })).toEqual({ status: 'error' })
  })

  it('returns error when the client throws (network)', async () => {
    getUser.mockRejectedValue(new Error('fetch failed'))
    expect(await createDevice({ name: 'Trockner', durationMinutes: 90 })).toEqual({ status: 'error' })
  })
})

describe('updateDevice (AC-11, EC-10, EC-11)', () => {
  const valid = { id: ID, name: ' Trockner ', durationMinutes: 45 }

  it('rejects a logged-out user without touching the database', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await updateDevice(valid)).toEqual({ status: 'unauthorized' })
    expect(from).not.toHaveBeenCalled()
  })

  it('updates the one row by id and returns the list', async () => {
    const result = await updateDevice(valid)
    expect(update).toHaveBeenCalledWith({ name: 'Trockner', duration_minutes: 45 })
    expect(updateEq).toHaveBeenCalledWith('id', ID)
    expect(result).toEqual({ status: 'ok', devices })
  })

  it('returns field errors for name and duration without writing', async () => {
    const result = await updateDevice({ id: ID, name: 'x'.repeat(41), durationMinutes: 'abc' })
    expect(result).toEqual({
      status: 'invalid',
      fieldErrors: { name: DEVICE_MESSAGES.nameTooLong, duration: DEVICE_MESSAGES.durationRange },
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('returns not_found when no row changed and never inserts (no upsert)', async () => {
    updateResult = { data: [], error: null }
    expect(await updateDevice(valid)).toEqual({ status: 'not_found', devices })
    expect(insert).not.toHaveBeenCalled()
  })

  it('treats a non-UUID id as not_found without writing', async () => {
    expect(await updateDevice({ ...valid, id: 'not-a-uuid' })).toEqual({ status: 'not_found', devices })
    expect(update).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('maps 23505 to duplicate_name with the list', async () => {
    updateResult = { data: null, error: { code: '23505', message: RAW } }
    expect(await updateDevice(valid)).toEqual({ status: 'duplicate_name', devices })
  })

  it('maps any other error to error without the raw message', async () => {
    updateResult = { data: null, error: { code: '08006', message: 'connection failure' } }
    const result = await updateDevice(valid)
    expect(result).toEqual({ status: 'error' })
    expect(JSON.stringify(result)).not.toContain('connection')
  })

  it('returns error when the list cannot be read after the write', async () => {
    listResult = { data: null, error: { message: 'timeout' } }
    expect(await updateDevice(valid)).toEqual({ status: 'error' })
  })

  it('returns error when the database call throws', async () => {
    from.mockImplementationOnce(() => {
      throw new Error('fetch failed')
    })
    expect(await updateDevice(valid)).toEqual({ status: 'error' })
  })
})

describe('deleteDevice (AC-12, EC-10)', () => {
  it('rejects a logged-out user without touching the database', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await deleteDevice({ id: ID })).toEqual({ status: 'unauthorized' })
    expect(from).not.toHaveBeenCalled()
  })

  it('deletes the row by id and returns the list', async () => {
    const result = await deleteDevice({ id: ID })
    expect(del).toHaveBeenCalledTimes(1)
    expect(deleteEq).toHaveBeenCalledWith('id', ID)
    expect(result).toEqual({ status: 'ok', devices })
  })

  it('returns not_found when no row was deleted, and never inserts', async () => {
    deleteResult = { data: [], error: null }
    expect(await deleteDevice({ id: ID })).toEqual({ status: 'not_found', devices })
    expect(insert).not.toHaveBeenCalled()
  })

  it('treats a non-UUID or missing id as not_found without deleting', async () => {
    expect(await deleteDevice({ id: '1; drop table devices' })).toEqual({ status: 'not_found', devices })
    expect(await deleteDevice(null)).toEqual({ status: 'not_found', devices })
    expect(del).not.toHaveBeenCalled()
  })

  it('maps a database error to error without the raw message', async () => {
    deleteResult = { data: null, error: { code: '42501', message: 'permission denied' } }
    const result = await deleteDevice({ id: ID })
    expect(result).toEqual({ status: 'error' })
    expect(JSON.stringify(result)).not.toContain('permission')
  })

  it('returns error when the list cannot be read after the write', async () => {
    listResult = { data: null, error: { message: 'timeout' } }
    expect(await deleteDevice({ id: ID })).toEqual({ status: 'error' })
  })

  it('returns error when the client throws (network)', async () => {
    getUser.mockRejectedValue(new Error('fetch failed'))
    expect(await deleteDevice({ id: ID })).toEqual({ status: 'error' })
  })
})
