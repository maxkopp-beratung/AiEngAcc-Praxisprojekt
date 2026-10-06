vi.mock('server-only', () => ({}))

import { berlinDaySlotStarts } from './berlin-time'
import { blockedUntilAfterFailure, validUntil } from './price-cache'
import type { DayPrices, PricesPayload } from './types'

const full = (date: string, price = 100): DayPrices => ({
  date,
  status: 'ok',
  slots: berlinDaySlotStarts(date).map((start) => ({ start, priceEurMwh: price })),
})
const payload = (today: DayPrices, tomorrow: DayPrices): PricesPayload => ({ generatedAt: '', today, tomorrow })
const notPublished = (date: string): DayPrices => ({ date, status: 'not_published' })
const ms = (iso: string) => Date.parse(iso)

describe('validUntil', () => {
  it('keeps two complete days until Berlin midnight', () => {
    const p = payload(full('2026-10-06'), full('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T12:00:00Z'))).toBe(ms('2026-10-06T22:00:00Z'))
  })

  it('does not ask for tomorrow before 12:00 Berlin time, the auction closes then', () => {
    const p = payload(full('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T08:00:00Z'))).toBe(ms('2026-10-06T10:00:00Z'))
  })

  it('asks again after 60 s once it is past 12:00 and tomorrow is still missing (AC-20)', () => {
    const p = payload(full('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T10:30:00Z'))).toBe(ms('2026-10-06T10:31:00Z'))
  })

  it('takes 12:00 in German time on a DST day, not midnight + 12 h', () => {
    const p = payload(full('2026-03-29'), notPublished('2026-03-30'))
    expect(validUntil(p, new Date('2026-03-29T08:00:00Z'))).toBe(ms('2026-03-29T10:00:00Z'))
  })

  it('asks again after 15 minutes when a day has gaps (EC-4)', () => {
    const today = full('2026-10-06')
    if (today.status === 'ok') today.slots[5].priceEurMwh = null
    const p = payload(today, full('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T12:00:00Z'))).toBe(ms('2026-10-06T12:15:00Z'))
  })

  it('never lasts past midnight', () => {
    const p = payload(full('2026-10-06'), notPublished('2026-10-07'))
    expect(validUntil(p, new Date('2026-10-06T21:59:30Z'))).toBe(ms('2026-10-06T22:00:00Z'))
  })
})

describe('blockedUntilAfterFailure', () => {
  const now = new Date('2026-10-06T12:00:00Z')

  it('waits 30 s after a failure', () => {
    expect(blockedUntilAfterFailure(now)).toBe(now.getTime() + 30_000)
  })

  it('honours a longer Retry-After, but never waits less than 30 s', () => {
    expect(blockedUntilAfterFailure(now, 120)).toBe(now.getTime() + 120_000)
    expect(blockedUntilAfterFailure(now, 5)).toBe(now.getTime() + 30_000)
  })
})
