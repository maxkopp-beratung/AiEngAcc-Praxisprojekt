vi.mock('server-only', () => ({}))

import { berlinDaySlotStarts } from './berlin-time'
import type { EnergyChartsResult } from './energy-charts'
import { getPrices } from './get-prices'
import { resetPriceStore } from './price-cache'
import type { Slot } from './types'

// No test here ever reaches Energy-Charts: the fetch and the clock are always injected.
const points = (date: string, price = 100): Slot[] => berlinDaySlotStarts(date).map((start) => ({ start, priceEurMwh: price }))
const ok = (...days: Slot[][]): EnergyChartsResult => ({ ok: true, points: days.flat() })
const at = (iso: string) => () => new Date(iso)

// 2026-10-06 14:00 Berlin = 12:00Z
const AFTERNOON = '2026-10-06T12:00:00Z'

beforeEach(() => resetPriceStore())

describe('getPrices', () => {
  it('asks once for today..tomorrow and lays both days onto their full slot grid', async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06'), points('2026-10-07', 50)))
    const p = await getPrices({ now: at(AFTERNOON), fetchPrices })

    expect(fetchPrices).toHaveBeenCalledTimes(1)
    expect(fetchPrices).toHaveBeenCalledWith('2026-10-06', '2026-10-07')
    expect(p.today).toMatchObject({ date: '2026-10-06', status: 'ok' })
    expect(p.tomorrow).toMatchObject({ date: '2026-10-07', status: 'ok' })
    if (p.today.status !== 'ok' || p.tomorrow.status !== 'ok') throw new Error('expected ok')
    expect(p.today.slots).toHaveLength(96)
    expect(p.today.slots[0]).toEqual({ start: '2026-10-05T22:00:00.000Z', priceEurMwh: 100 })
    expect(p.tomorrow.slots[0].priceEurMwh).toBe(50)
  })

  it('serves a complete day from the cache without asking again', async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06'), points('2026-10-07')))
    await getPrices({ now: at(AFTERNOON), fetchPrices })
    await getPrices({ now: at('2026-10-06T21:59:00Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(1)
  })

  it('reports tomorrow as not published and asks again only after 12:00 (AC-13, AC-20)', async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06')))
    const first = await getPrices({ now: at('2026-10-06T07:00:00Z'), fetchPrices })
    expect(first.tomorrow).toEqual({ date: '2026-10-07', status: 'not_published' })

    await getPrices({ now: at('2026-10-06T09:59:00Z'), fetchPrices }) // 11:59 Berlin
    expect(fetchPrices).toHaveBeenCalledTimes(1)

    fetchPrices.mockResolvedValue(ok(points('2026-10-06'), points('2026-10-07')))
    const later = await getPrices({ now: at('2026-10-06T10:00:00Z'), fetchPrices }) // 12:00 Berlin
    expect(fetchPrices).toHaveBeenCalledTimes(2)
    expect(later.tomorrow.status).toBe('ok')
  })

  it('fills missing slots with null and drops values outside today/tomorrow (EC-4)', async () => {
    const today = points('2026-10-06').filter((_, i) => i !== 10)
    const outside = points('2026-10-05')
    const fetchPrices = vi.fn().mockResolvedValue(ok(outside, today))
    const p = await getPrices({ now: at(AFTERNOON), fetchPrices })
    if (p.today.status !== 'ok') throw new Error('expected ok')
    expect(p.today.slots).toHaveLength(96)
    expect(p.today.slots[10].priceEurMwh).toBeNull()
    expect(p.today.slots[11].priceEurMwh).toBe(100)
  })

  it('treats a reachable source without any value for today as an error (EC-5)', async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok())
    const p = await getPrices({ now: at(AFTERNOON), fetchPrices })
    expect(p.today).toEqual({ date: '2026-10-06', status: 'error' })
    expect(p.tomorrow).toEqual({ date: '2026-10-07', status: 'not_published' })
  })

  it('returns the error state without cache, and holds back for 30 s (AC-23)', async () => {
    const fetchPrices = vi.fn().mockResolvedValue({ ok: false, kind: 'timeout' })
    const p = await getPrices({ now: at(AFTERNOON), fetchPrices })
    expect(p.today.status).toBe('error')

    await getPrices({ now: at('2026-10-06T12:00:29Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(1)
    await getPrices({ now: at('2026-10-06T12:00:30Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(2)
  })

  it('shows cached prices without a warning when Energy-Charts fails later (AC-24)', async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06')))
    const first = await getPrices({ now: at('2026-10-06T10:30:00Z'), fetchPrices })

    fetchPrices.mockResolvedValue({ ok: false, kind: 'http', status: 500 })
    const p = await getPrices({ now: at('2026-10-06T10:45:00Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(2)
    expect(p).toEqual(first)
  })

  it('honours Retry-After from a 429', async () => {
    const fetchPrices = vi.fn().mockResolvedValue({ ok: false, kind: 'rate_limited', status: 429, retryAfterSeconds: 120 })
    await getPrices({ now: at(AFTERNOON), fetchPrices })
    await getPrices({ now: at('2026-10-06T12:01:59Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(1)
    await getPrices({ now: at('2026-10-06T12:02:00Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(2)
  })

  it('lets concurrent callers share one request (EC-9)', async () => {
    let resolve!: (r: EnergyChartsResult) => void
    const fetchPrices = vi.fn().mockReturnValue(new Promise<EnergyChartsResult>((r) => (resolve = r)))
    const calls = [1, 2, 3].map(() => getPrices({ now: at(AFTERNOON), fetchPrices }))
    resolve(ok(points('2026-10-06'), points('2026-10-07')))
    const results = await Promise.all(calls)

    expect(fetchPrices).toHaveBeenCalledTimes(1)
    expect(results[1]).toEqual(results[0])
    expect(results[2]).toEqual(results[0])
  })

  it("keeps yesterday's 'tomorrow' as today's prices across midnight when the source fails (AC-21, AC-24)", async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06'), points('2026-10-07', 42)))
    await getPrices({ now: at(AFTERNOON), fetchPrices })

    fetchPrices.mockResolvedValue({ ok: false, kind: 'network' })
    const p = await getPrices({ now: at('2026-10-06T22:05:00Z'), fetchPrices }) // 00:05 on the 7th
    expect(fetchPrices).toHaveBeenCalledTimes(2)
    expect(p.today).toMatchObject({ date: '2026-10-07', status: 'ok' })
    if (p.today.status !== 'ok') throw new Error('expected ok')
    expect(p.today.slots[0].priceEurMwh).toBe(42)
    expect(p.tomorrow).toEqual({ date: '2026-10-08', status: 'not_published' })
  })

  it('never throws, even when the fetch itself does', async () => {
    const fetchPrices = vi.fn().mockRejectedValue(new Error('boom'))
    const p = await getPrices({ now: at(AFTERNOON), fetchPrices })
    expect(p.today.status).toBe('error')
  })
})
