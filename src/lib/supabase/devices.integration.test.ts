// Integration test of the database rules for `devices` against the real Supabase project
// (AC-2, AC-6, AC-7, AC-8, AC-9, AC-10, AC-27, EC-8, EC-9). Every rule is checked by calling the
// Data API directly with a signed-in user's own session, i.e. without the app's validation.
// Creates up to three confirmed throwaway accounts through the admin API and deletes them afterwards.
// Skipped when the Supabase keys are not available (e.g. in a fresh clone without .env.local).
import { randomBytes } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Next.js does not load .env.local in test mode, so read it directly (values never printed).
try {
  process.loadEnvFile('.env.local')
} catch {
  // no .env.local: the suite is skipped below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const configured = Boolean(url && anonKey && serviceKey)

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

type TestUser = { id: string; email: string; client: SupabaseClient }

describe.skipIf(!configured)('database rules for devices (real Supabase project)', { timeout: 60_000 }, () => {
  const admin = configured ? createClient(url, serviceKey, noSession) : (null as unknown as SupabaseClient)
  const anon = configured ? createClient(url, anonKey, noSession) : (null as unknown as SupabaseClient)
  const created: string[] = []
  let a: TestUser
  let b: TestUser

  async function createUser(name: string): Promise<TestUser> {
    const email = `devices-${name}-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`
    const password = randomBytes(16).toString('base64url')
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    })
    if (error) throw error
    created.push(data.user.id)
    const client = createClient(url, anonKey, noSession)
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
    return { id: data.user.id, email, client }
  }

  // Each test starts from empty device lists, so counts and names never depend on another test.
  async function clearDevices(user: TestUser) {
    const { error } = await user.client.from('devices').delete().eq('user_id', user.id)
    if (error) throw error
  }

  async function namesOf(user: TestUser): Promise<string[]> {
    const { data, error } = await user.client.from('devices').select('name')
    if (error) throw error
    return (data ?? []).map((row) => row.name as string)
  }

  const insert = (user: TestUser, name: string, duration_minutes = 60) =>
    user.client.from('devices').insert({ name, duration_minutes }).select().single()

  beforeAll(async () => {
    a = await createUser('A')
    b = await createUser('B')
  })

  beforeEach(async () => {
    await clearDevices(a)
    await clearDevices(b)
  })

  afterAll(async () => {
    // Deleting the accounts removes every remaining device through the cascade.
    for (const id of created) await admin.auth.admin.deleteUser(id)
  })

  it('keeps the devices of A invisible and untouchable for B (AC-2)', async () => {
    const { data: row, error } = await insert(a, 'Waschmaschine', 150)
    expect(error).toBeNull()
    expect(row).toMatchObject({ user_id: a.id, name: 'Waschmaschine', duration_minutes: 150 })

    const all = await b.client.from('devices').select('id')
    expect(all.error).toBeNull()
    expect(all.data).toEqual([])
    const byId = await b.client.from('devices').select('id').eq('id', row.id)
    expect(byId.data).toEqual([])

    const update = await b.client.from('devices').update({ name: 'gehackt', duration_minutes: 15 }).eq('id', row.id).select()
    expect(update.data ?? []).toEqual([])
    const remove = await b.client.from('devices').delete().eq('id', row.id).select()
    expect(remove.data ?? []).toEqual([])

    const { data: still } = await a.client.from('devices').select('name, duration_minutes').eq('id', row.id)
    expect(still).toEqual([{ name: 'Waschmaschine', duration_minutes: 150 }])
  })

  it('gives anonymous visitors no access to devices at all (AC-2)', async () => {
    await insert(a, 'Spülmaschine')
    const read = await anon.from('devices').select('*')
    expect(read.data ?? []).toEqual([])
    expect(read.error).not.toBeNull()
    expect(read.error?.code).toBe('42501')

    const write = await anon.from('devices').insert({ name: 'Anonym', duration_minutes: 60 })
    expect(write.error).not.toBeNull()
    expect(write.error?.code).toBe('42501')
    expect(await namesOf(a)).toEqual(['Spülmaschine'])
  })

  it('rejects names and run times that break the rules even without the app (AC-6, AC-7)', async () => {
    for (const name of ['', ' Lampe', 'Lampe ', 'x'.repeat(41)]) {
      const { error } = await insert(a, name)
      expect(error?.code, `name ${JSON.stringify(name)}`).toBe('23514')
    }
    for (const minutes of [0, 10, 20, 735, 1440]) {
      const { error } = await insert(a, `Gerät ${minutes}`, minutes)
      expect(error?.code, `duration ${minutes}`).toBe('23514')
    }
    expect(await namesOf(a)).toEqual([])

    // 40 characters are allowed, counted as code points (40 emojis are 80 UTF-16 units in JS).
    const emojis = '🔌'.repeat(40)
    for (const name of ['x'.repeat(40), emojis]) {
      const { error } = await insert(a, name, 720)
      expect(error, `name of length ${[...name].length}`).toBeNull()
    }
    const ok15 = await insert(a, 'Kurz', 15)
    expect(ok15.error).toBeNull()
    expect((await namesOf(a)).sort()).toEqual(['Kurz', 'x'.repeat(40), emojis].sort())
  })

  it('does not let A set the owner or the creation time (AC-2, AC-10)', async () => {
    const asB = await a.client.from('devices').insert({ name: 'Fremd', duration_minutes: 60, user_id: b.id })
    expect(asB.error?.code).toBe('42501')
    const asSelf = await a.client.from('devices').insert({ name: 'Eigen', duration_minutes: 60, user_id: a.id })
    expect(asSelf.error?.code).toBe('42501')
    const backdated = await a.client
      .from('devices')
      .insert({ name: 'Alt', duration_minutes: 60, created_at: '2000-01-01T00:00:00Z' })
    expect(backdated.error?.code).toBe('42501')
    expect(await namesOf(a)).toEqual([])
    expect(await namesOf(b)).toEqual([])

    const { data: row } = await insert(a, 'Trockner', 90)
    const moveToB = await a.client.from('devices').update({ user_id: b.id }).eq('id', row.id)
    expect(moveToB.error?.code).toBe('42501')
    const redate = await a.client.from('devices').update({ created_at: '2000-01-01T00:00:00Z' }).eq('id', row.id)
    expect(redate.error?.code).toBe('42501')

    const { data: after } = await a.client.from('devices').select('user_id, created_at').eq('id', row.id).single()
    expect(after).toEqual({ user_id: a.id, created_at: row.created_at })
    expect(await namesOf(b)).toEqual([])
  })

  it('allows a name only once per account, ignoring case (AC-8)', async () => {
    expect((await insert(a, 'Waschmaschine')).error).toBeNull()
    const duplicate = await insert(a, 'waschmaschine')
    expect(duplicate.error?.code).toBe('23505')
    expect(await namesOf(a)).toEqual(['Waschmaschine'])

    // Renaming another device onto an existing name is refused as well.
    const { data: other } = await insert(a, 'Trockner')
    const rename = await a.client.from('devices').update({ name: 'WASCHMASCHINE' }).eq('id', other.id)
    expect(rename.error?.code).toBe('23505')

    // Uniqueness is per user: B may have the same name.
    expect((await insert(b, 'Waschmaschine')).error).toBeNull()
  })

  it('creates exactly one device when the same name is saved twice at once (EC-8)', async () => {
    const results = await Promise.all([insert(a, 'Wallbox', 240), insert(a, 'Wallbox', 240)])
    const ok = results.filter((r) => r.error === null)
    const failed = results.filter((r) => r.error !== null)
    expect(ok).toHaveLength(1)
    expect(failed.map((r) => r.error?.code)).toEqual(['23505'])
    expect(await namesOf(a)).toEqual(['Wallbox'])
  })

  it('never stores more than 20 devices, even with parallel inserts (AC-9, EC-9)', async () => {
    const nineteen = Array.from({ length: 19 }, (_, i) => ({ name: `Gerät ${i + 1}`, duration_minutes: 60 }))
    expect((await a.client.from('devices').insert(nineteen)).error).toBeNull()

    const results = await Promise.all([insert(a, 'Parallel A'), insert(a, 'Parallel B')])
    const ok = results.filter((r) => r.error === null)
    const failed = results.filter((r) => r.error !== null)
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0].error?.code).toBe('P0001')
    expect(failed[0].error?.message).toContain('device_limit_reached')
    expect(await namesOf(a)).toHaveLength(20)

    const twentyFirst = await insert(a, 'Noch eins')
    expect(twentyFirst.error?.code).toBe('P0001')
    expect(twentyFirst.error?.message).toContain('device_limit_reached')
    expect(await namesOf(a)).toHaveLength(20)

    const remove = await a.client.from('devices').delete().eq('name', 'Gerät 1').select('id')
    expect(remove.data).toHaveLength(1)
    expect((await insert(a, 'Wieder Platz')).error).toBeNull()
    expect(await namesOf(a)).toHaveLength(20)
  })

  it('refuses a single bulk insert of 21 devices as a whole (AC-9)', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ name: `Massen ${i + 1}`, duration_minutes: 30 }))
    const bulk = await a.client.from('devices').insert(rows)
    expect(bulk.error?.code).toBe('P0001')
    expect(bulk.error?.message).toContain('device_limit_reached')
    expect(await namesOf(a)).toEqual([])
  })

  it('deletes all devices together with the account (AC-27)', async () => {
    const c = await createUser('C')
    expect((await insert(c, 'Waschmaschine')).error).toBeNull()
    expect((await insert(c, 'Spülmaschine')).error).toBeNull()
    expect(await namesOf(c)).toHaveLength(2)

    const { error } = await admin.auth.admin.deleteUser(c.id)
    expect(error).toBeNull() // would fail with a foreign-key error without the cascade
    created.splice(created.indexOf(c.id), 1)

    // C's access token is still signed and unexpired, so RLS still filters on C's id: nothing is left.
    const left = await c.client.from('devices').select('id')
    expect(left.error).toBeNull()
    expect(left.data).toEqual([])
    // And nothing was handed over to anyone else.
    expect(await namesOf(a)).toEqual([])
    expect(await namesOf(b)).toEqual([])
  })
})
