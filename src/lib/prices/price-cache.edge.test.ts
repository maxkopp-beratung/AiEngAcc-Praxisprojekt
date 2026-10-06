vi.mock('server-only', () => ({}))

// Edge cases of the cache validity rules (design.md → Zwischenspeicher), added by /qa.
import { berlinDaySlotStarts } from './berlin-time'
import { blockedUntilAfterFailure, validUntil } from './price-cache'
import type { DayPrices, PricesPayload } from './types'

const full = (date: string, price = 100): DayPrices => ({
  date,
  status: 'ok',
  slots: berlinDaySlotStarts(date).map((start) => ({ start, priceEurMwh: price })),
})
const withGap = (date: string): DayPrices => {
  const day = full(date)
  if (day.status !== 'ok') throw new Error('expected ok')
  return { ...day, slots: day.slots.map((s, i) => (i === 5 ? { ...s, priceEurMwh: null } : s)) }
}
const payload = (today: DayPrices, tomorrow: DayPrices): PricesPayload => ({ generatedAt: '', today, tomorrow })
const notPublished = (date: string): DayPrices => ({ date, status: 'not_published' })
const ms = (iso: string) => Date.parse(iso)

describe('validUntil — boundaries and combined rules', () => {
  it('exactly at 12:00 Berlin with tomorrow missing → 60 s, not noon (AC-20)', () => {
    const p = payload(full('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T10:00:00Z'))).toBe(ms('2026-10-06T10:01:00Z'))
  })

  it('one millisecond before 12:00 Berlin → still until 12:00', () => {
    const p = payload(full('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T09:59:59.999Z'))).toBe(ms('2026-10-06T10:00:00Z'))
  })

  it('tomorrow missing in the morning and today has gaps → the 15 min rule wins (EC-4)', () => {
    const p = payload(withGap('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T06:00:00Z'))).toBe(ms('2026-10-06T06:15:00Z'))
  })

  it('tomorrow missing at 11:50 Berlin and today has gaps → noon wins over 15 min', () => {
    const p = payload(withGap('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T09:50:00Z'))).toBe(ms('2026-10-06T10:00:00Z'))
  })

  it('tomorrow missing after 12:00 and today has gaps → 60 s wins over 15 min', () => {
    const p = payload(withGap('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T13:00:00Z'))).toBe(ms('2026-10-06T13:01:00Z'))
  })

  it('gaps only in tomorrow → 15 min (EC-4)', () => {
    const p = payload(full('2026-10-06'), withGap('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T13:00:00Z'))).toBe(ms('2026-10-06T13:15:00Z'))
  })

  it('on the fall-back day (25 h) a complete entry lasts until German midnight = 23:00Z (EC-2)', () => {
    const p = payload(full('2026-10-25'), full('2026-10-26'))
    expect(validUntil(p, new Date('2026-10-25T12:00:00Z'))).toBe(ms('2026-10-25T23:00:00Z'))
  })

  it('on the spring-forward day (23 h) a complete entry lasts until German midnight = 22:00Z (EC-1)', () => {
    const p = payload(full('2026-03-29'), full('2026-03-30'))
    expect(validUntil(p, new Date('2026-03-29T12:00:00Z'))).toBe(ms('2026-03-29T22:00:00Z'))
  })
})

describe('blockedUntilAfterFailure — Retry-After edge values', () => {
  const now = new Date('2026-10-06T12:00:00Z')

  it('Retry-After 0 still waits the 30 s floor', () => {
    expect(blockedUntilAfterFailure(now, 0)).toBe(ms('2026-10-06T12:00:30Z'))
  })

  it('Retry-After 31 s waits 31 s', () => {
    expect(blockedUntilAfterFailure(now, 31)).toBe(ms('2026-10-06T12:00:31Z'))
  })
})
