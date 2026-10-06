// Integration test against the real Supabase project (AC-23, AC-24, AC-10, AC-11).
// Creates two confirmed throwaway accounts through the admin API and deletes them afterwards.
// Skipped when the Supabase keys are not available (e.g. in a fresh clone without .env.local).
import { randomBytes, randomUUID } from 'node:crypto'
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

describe.skipIf(!configured)('database access rules (real Supabase project)', { timeout: 60_000 }, () => {
  const admin = configured ? createClient(url, serviceKey, noSession) : (null as unknown as SupabaseClient)
  const anon = configured ? createClient(url, anonKey, noSession) : (null as unknown as SupabaseClient)
  let a: TestUser
  let b: TestUser

  async function createUser(name: string): Promise<TestUser> {
    const email = `rls-${name}-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`
    const password = randomBytes(16).toString('base64url')
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    })
    if (error) throw error
    const client = createClient(url, anonKey, noSession)
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    if (signInError) throw signInError
    return { id: data.user.id, email, client }
  }

  beforeAll(async () => {
    a = await createUser('A')
    b = await createUser('B')
  })

  afterAll(async () => {
    for (const user of [a, b]) {
      if (user) await admin.auth.admin.deleteUser(user.id)
    }
  })

  it('creates exactly one profile per account with the signup name (AC-3)', async () => {
    const { data, error } = await a.client.from('profiles').select('id, display_name')
    expect(error).toBeNull()
    expect(data).toEqual([{ id: a.id, display_name: 'A' }])
  })

  it('never shows A the profile of B (AC-23)', async () => {
    const { data, error } = await a.client.from('profiles').select('id').eq('id', b.id)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('does not let A change the profile of B (AC-23)', async () => {
    const { data } = await a.client.from('profiles').update({ display_name: 'gehackt' }).eq('id', b.id).select()
    expect(data ?? []).toEqual([])
    const { data: ofB } = await b.client.from('profiles').select('display_name').eq('id', b.id).single()
    expect(ofB?.display_name).toBe('B')
  })

  it('lets A change only the display name of the own profile', async () => {
    const ok = await a.client.from('profiles').update({ display_name: 'A2' }).eq('id', a.id).select('display_name')
    expect(ok.data).toEqual([{ display_name: 'A2' }])

    const idChange = await a.client.from('profiles').update({ id: randomUUID() }).eq('id', a.id)
    expect(idChange.error?.code).toBe('42501')
    const insert = await a.client.from('profiles').insert({ id: randomUUID(), display_name: 'x' })
    expect(insert.error).not.toBeNull()
  })

  it('rejects names that break the database rule even without the app (EC-10)', async () => {
    const tooLong = await a.client.from('profiles').update({ display_name: 'x'.repeat(51) }).eq('id', a.id)
    expect(tooLong.error?.code).toBe('23514')
    const untrimmed = await a.client.from('profiles').update({ display_name: ' A ' }).eq('id', a.id)
    expect(untrimmed.error?.code).toBe('23514')
  })

  it('gives anonymous visitors no profile data at all (AC-24)', async () => {
    const { data, error } = await anon.from('profiles').select('*')
    expect(data ?? []).toEqual([])
    expect(error?.code).toBe('42501')
  })

  it('keeps the throttle and existence functions away from browsers', async () => {
    const hashes = { p_email_hash: 'e'.repeat(64), p_ip_hash: 'i'.repeat(64) }
    for (const client of [anon, a.client]) {
      expect((await client.rpc('login_throttle_status', hashes)).error?.code).toBe('42501')
      expect((await client.rpc('record_login_failure', hashes)).error?.code).toBe('42501')
      expect((await client.rpc('auth_email_exists', { p_email: b.email })).error?.code).toBe('42501')
    }
  })

  it('reports an existing address only to the server (AC-7)', async () => {
    expect((await admin.rpc('auth_email_exists', { p_email: ` ${b.email.toUpperCase()} ` })).data).toBe(true)
    expect((await admin.rpc('auth_email_exists', { p_email: `none-${randomUUID()}@example.com` })).data).toBe(false)
  })

  it('locks after 5 failures per email and 20 per IP within 15 minutes (AC-10, AC-11)', async () => {
    const hex = () => randomBytes(32).toString('hex')
    const status = async (email: string, ip: string) =>
      (await admin.rpc('login_throttle_status', { p_email_hash: email, p_ip_hash: ip })).data[0]
    const fail = (email: string, ip: string) => admin.rpc('record_login_failure', { p_email_hash: email, p_ip_hash: ip })

    const email = hex()
    for (let i = 0; i < 4; i++) await fail(email, hex())
    expect((await status(email, hex())).blocked).toBe(false)
    await fail(email, hex())
    const locked = await status(email, hex())
    expect(locked.blocked).toBe(true)
    expect(locked.retry_after_seconds).toBeGreaterThan(840)
    expect(locked.retry_after_seconds).toBeLessThanOrEqual(900)

    const ip = hex()
    for (let i = 0; i < 19; i++) await fail(hex(), ip)
    expect((await status(hex(), ip)).blocked).toBe(false)
    await fail(hex(), ip)
    expect((await status(hex(), ip)).blocked).toBe(true)
  })

  it('deletes the profile together with the account (AC-25, EC-11)', async () => {
    const temp = await createUser('Temp')
    const { error } = await admin.auth.admin.deleteUser(temp.id)
    expect(error).toBeNull() // would fail with a foreign-key error without the cascade
    expect((await admin.rpc('auth_email_exists', { p_email: temp.email })).data).toBe(false)
  })
})
