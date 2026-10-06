vi.mock('server-only', () => ({}))

// Edge cases of the price service (design.md → Preis-Dienst, Zwischenspeicher), added by /qa.
// No test here reaches Energy-Charts: the fetch and the clock are always injected.
import { berlinDaySlotStarts } from './berlin-time'
import type { EnergyChartsResult } from './energy-charts'
import { getPrices } from './get-prices'
import { resetPriceStore } from './price-cache'
import type { Slot } from './types'

const points = (date: string, price = 100): Slot[] => berlinDaySlotStarts(date).map((start) => ({ start, priceEurMwh: price }))
const ok = (...days: Slot[][]): EnergyChartsResult => ({ ok: true, points: days.flat() })
const at = (iso: string) => () => new Date(iso)

beforeEach(() => resetPriceStore())

describe('getPrices — edge cases', () => {
  it('inside the back-off window serves the expired cached entry without asking again (AC-24)', async () => {
    // 13:00 Berlin, tomorrow missing → entry valid for 60 s only
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06', 77)))
    const first = await getPrices({ now: at('2026-10-06T11:00:00Z'), fetchPrices })

    fetchPrices.mockResolvedValue({ ok: false, kind: 'timeout' })
    const failed = await getPrices({ now: at('2026-10-06T11:01:00Z'), fetchPrices })
    const blocked = await getPrices({ now: at('2026-10-06T11:01:20Z'), fetchPrices })

    expect(fetchPrices).toHaveBeenCalledTimes(2)
    expect(failed).toEqual(first)
    expect(blocked).toEqual(first)
  })

  it("after midnight without yesterday's 'tomorrow' and with the source down → error state (AC-21, AC-23, EC-8)", async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06')))
    await getPrices({ now: at('2026-10-06T20:00:00Z'), fetchPrices })

    fetchPrices.mockResolvedValue({ ok: false, kind: 'network' })
    const p = await getPrices({ now: at('2026-10-06T22:05:00Z'), fetchPrices }) // 00:05 on the 7th
    expect(p.today).toEqual({ date: '2026-10-07', status: 'error' })
    expect(p.tomorrow).toEqual({ date: '2026-10-08', status: 'not_published' })
  })

  it('source reachable but empty for today while a cached entry exists → cached prices, no error (EC-5 + AC-24)', async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06', 55)))
    const first = await getPrices({ now: at('2026-10-06T11:00:00Z'), fetchPrices })

    fetchPrices.mockResolvedValue(ok())
    const p = await getPrices({ now: at('2026-10-06T11:02:00Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(2)
    expect(p).toEqual(first)
    expect(p.today.status).toBe('ok')
  })

  it('concurrent callers during a failing request share one request and all get the error state (EC-9, AC-23)', async () => {
    let resolve!: (r: EnergyChartsResult) => void
    const fetchPrices = vi.fn().mockReturnValue(new Promise<EnergyChartsResult>((r) => (resolve = r)))
    const calls = [1, 2, 3, 4].map(() => getPrices({ now: at('2026-10-06T12:00:00Z'), fetchPrices }))
    resolve({ ok: false, kind: 'http', status: 503 })
    const results = await Promise.all(calls)

    expect(fetchPrices).toHaveBeenCalledTimes(1)
    for (const r of results) expect(r.today).toEqual({ date: '2026-10-06', status: 'error' })
  })

  it('after a shared request has finished, the next call past validity asks again (no stuck in-flight request)', async () => {
    const fetchPrices = vi.fn().mockResolvedValue(ok(points('2026-10-06')))
    await Promise.all([1, 2, 3].map(() => getPrices({ now: at('2026-10-06T11:00:00Z'), fetchPrices })))
    expect(fetchPrices).toHaveBeenCalledTimes(1)

    fetchPrices.mockResolvedValue(ok(points('2026-10-06'), points('2026-10-07', 30)))
    const later = await getPrices({ now: at('2026-10-06T11:01:00Z'), fetchPrices })
    expect(fetchPrices).toHaveBeenCalledTimes(2)
    expect(later.tomorrow.status).toBe('ok')
  })
})
