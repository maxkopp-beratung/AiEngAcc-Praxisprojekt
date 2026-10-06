import { createHash } from 'node:crypto'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn() }))

const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))

import { getLoginThrottle, recordLoginFailure, toRetryMinutes } from './throttle'
import { clientIpFrom } from './request-meta'

const hash = (v: string) => createHash('sha256').update(v).digest('hex')

beforeEach(() => rpc.mockReset())

describe('toRetryMinutes', () => {
  it('rounds up to whole minutes and never shows 0', () => {
    expect(toRetryMinutes(1)).toBe(1)
    expect(toRetryMinutes(60)).toBe(1)
    expect(toRetryMinutes(61)).toBe(2)
    expect(toRetryMinutes(899)).toBe(15)
    expect(toRetryMinutes(0)).toBe(1)
  })
})

describe('getLoginThrottle', () => {
  it('sends only hashes of email and IP to the database', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: false, retry_after_seconds: 0 }], error: null })
    await getLoginThrottle('max@example.de', '203.0.113.7')
    expect(rpc).toHaveBeenCalledWith('login_throttle_status', {
      p_email_hash: hash('max@example.de'),
      p_ip_hash: hash('203.0.113.7'),
    })
    const args = JSON.stringify(rpc.mock.calls[0])
    expect(args).not.toContain('max@example.de')
    expect(args).not.toContain('203.0.113.7')
  })

  it('reports not blocked', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: false, retry_after_seconds: 0 }], error: null })
    await expect(getLoginThrottle('a@b.de', '1.1.1.1')).resolves.toEqual({ blocked: false })
  })

  it('reports blocked with the wait time in minutes (AC-10)', async () => {
    rpc.mockResolvedValue({ data: [{ blocked: true, retry_after_seconds: 541 }], error: null })
    await expect(getLoginThrottle('a@b.de', '1.1.1.1')).resolves.toEqual({
      blocked: true,
      retryAfterMinutes: 10,
    })
  })

  it('fails closed when the database call fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(getLoginThrottle('a@b.de', '1.1.1.1')).rejects.toThrow('login_throttle_status')
  })
})

describe('recordLoginFailure', () => {
  it('records hashes only', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await recordLoginFailure('a@b.de', '1.1.1.1')
    expect(rpc).toHaveBeenCalledWith('record_login_failure', {
      p_email_hash: hash('a@b.de'),
      p_ip_hash: hash('1.1.1.1'),
    })
  })

  it('throws when the insert fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(recordLoginFailure('a@b.de', '1.1.1.1')).rejects.toThrow('record_login_failure')
  })
})

describe('clientIpFrom', () => {
  const h = (values: Record<string, string>) => ({ get: (k: string) => values[k] ?? null })

  it('takes the first x-forwarded-for entry', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })
  it('falls back to x-real-ip, then "unknown"', () => {
    expect(clientIpFrom(h({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientIpFrom(h({}))).toBe('unknown')
  })
})
