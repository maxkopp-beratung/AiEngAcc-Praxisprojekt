import 'server-only'
// Process-wide price cache of PROJ-2 (design.md → Zwischenspeicher). One store for the page, /api/prices
// and every user (EC-9). It lives on globalThis so dev reloads and separate bundles share it.
import { TZDate } from '@date-fns/tz'
import { BERLIN_TZ, berlinDayEnd } from './berlin-time'
import type { DayPrices, PricesPayload } from './types'

const MINUTE_MS = 60 * 1000
const NOT_PUBLISHED_TTL_MS = MINUTE_MS
const GAPS_TTL_MS = 15 * MINUTE_MS
const FAILURE_BACKOFF_MS = 30 * 1000

export type CacheEntry = {
  /** Berlin calendar day the entry was built for ("today" at that time). */
  today: string
  payload: PricesPayload
  /** Epoch ms until which the entry is served without asking Energy-Charts. */
  validUntil: number
}

export type PriceStore = {
  entry: CacheEntry | null
  /** No request to Energy-Charts before this epoch ms (after a failure or a 429). */
  blockedUntil: number
  /** The request currently in flight; concurrent callers wait for it instead of asking again (EC-9). */
  inflight: Promise<PricesPayload> | null
}

const STORE_KEY = Symbol.for('wattwann.priceStore')
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: PriceStore }

export function getPriceStore(): PriceStore {
  const g = globalThis as GlobalWithStore
  g[STORE_KEY] ??= { entry: null, blockedUntil: 0, inflight: null }
  return g[STORE_KEY]
}

/** Empties the store. For tests only. */
export function resetPriceStore(): void {
  const store = getPriceStore()
  store.entry = null
  store.blockedUntil = 0
  store.inflight = null
}

function hasGaps(day: DayPrices): boolean {
  return day.status === 'ok' && day.slots.some((s) => s.priceEurMwh === null)
}

function berlinNoon(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new TZDate(y, m - 1, d, 12, 0, 0, 0, BERLIN_TZ).getTime()
}

/**
 * How long a freshly loaded payload may be served (epoch ms). Complete → until Berlin midnight;
 * tomorrow missing → until 12:00 (the auction closes then) or 60 s after it (AC-20); gaps → 15 min (EC-4).
 * The earliest applicable limit wins.
 */
export function validUntil(payload: PricesPayload, now: Date): number {
  const t = now.getTime()
  const limits = [berlinDayEnd(payload.today.date).getTime()]
  if (payload.tomorrow.status !== 'ok') {
    const noon = berlinNoon(payload.today.date)
    limits.push(t < noon ? noon : t + NOT_PUBLISHED_TTL_MS)
  }
  if (hasGaps(payload.today) || hasGaps(payload.tomorrow)) limits.push(t + GAPS_TTL_MS)
  return Math.min(...limits)
}

/** Earliest next request after a failure: 30 s, or longer when Energy-Charts says so via Retry-After. */
export function blockedUntilAfterFailure(now: Date, retryAfterSeconds?: number): number {
  return now.getTime() + Math.max(FAILURE_BACKOFF_MS, (retryAfterSeconds ?? 0) * 1000)
}
