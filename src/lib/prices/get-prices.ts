import 'server-only'
// Price service of PROJ-2: "get prices for today and tomorrow". Used by the dashboard section, by
// /api/prices and later by PROJ-3. Never throws — a failure without cached data is `today.status = error`.
import { berlinDaySlotStarts, berlinToday, nextBerlinDate } from './berlin-time'
import { fetchEnergyChartsPrices, type EnergyChartsResult } from './energy-charts'
import { blockedUntilAfterFailure, getPriceStore, validUntil, type CacheEntry } from './price-cache'
import type { DayPrices, PricesPayload, Slot } from './types'

export type GetPricesDeps = {
  now?: () => Date
  fetchPrices?: (startDate: string, endDate: string) => Promise<EnergyChartsResult>
}

/** Puts the source values onto the full slot grid of a Berlin day; missing slots become null (EC-4). */
function toDay(date: string, prices: Map<string, number | null>, whenEmpty: 'error' | 'not_published'): DayPrices {
  const slots: Slot[] = berlinDaySlotStarts(date).map((start) => ({ start, priceEurMwh: prices.get(start) ?? null }))
  // Not a single value: today is an error (EC-5), tomorrow is simply not published yet (AC-13).
  if (slots.every((s) => s.priceEurMwh === null)) return { date, status: whenEmpty }
  return { date, status: 'ok', slots }
}

function buildPayload(points: Slot[], today: string, tomorrow: string, now: Date): PricesPayload {
  // Values outside today/tomorrow simply find no slot and are dropped.
  const prices = new Map(points.map((p) => [p.start, p.priceEurMwh]))
  return {
    generatedAt: now.toISOString(),
    today: toDay(today, prices, 'error'),
    tomorrow: toDay(tomorrow, prices, 'not_published'),
  }
}

function errorPayload(today: string, tomorrow: string, now: Date): PricesPayload {
  return {
    generatedAt: now.toISOString(),
    today: { date: today, status: 'error' },
    tomorrow: { date: tomorrow, status: 'not_published' },
  }
}

/**
 * After midnight the old entry belongs to yesterday. Its "tomorrow" is today, so keep that as an
 * already expired fallback: a fresh request is made, but an outage still shows today's prices (AC-24).
 */
function rollOver(entry: CacheEntry | null, today: string, tomorrow: string): CacheEntry | null {
  if (!entry || entry.today === today) return entry
  const carried = entry.payload.tomorrow
  if (carried.status !== 'ok' || carried.date !== today) return null
  return {
    today,
    payload: { generatedAt: entry.payload.generatedAt, today: carried, tomorrow: { date: tomorrow, status: 'not_published' } },
    validUntil: 0,
  }
}

export async function getPrices({ now = () => new Date(), fetchPrices = fetchEnergyChartsPrices }: GetPricesDeps = {}): Promise<PricesPayload> {
  const at = now()
  const today = berlinToday(at)
  const tomorrow = nextBerlinDate(today)
  const store = getPriceStore()

  store.entry = rollOver(store.entry, today, tomorrow)
  const entry = store.entry
  if (entry && at.getTime() < entry.validUntil) return entry.payload
  if (store.inflight) return store.inflight
  // After a failure or a 429: serve what we have, ask Energy-Charts again only later.
  if (at.getTime() < store.blockedUntil) return entry?.payload ?? errorPayload(today, tomorrow, at)

  // One request covers both days; every concurrent caller waits for this same request (EC-9).
  store.inflight = (async () => {
    const result: EnergyChartsResult = await fetchPrices(today, tomorrow).catch(() => ({ ok: false, kind: 'network' }))
    if (result.ok) {
      const payload = buildPayload(result.points, today, tomorrow, at)
      if (payload.today.status === 'ok') {
        store.entry = { today, payload, validUntil: validUntil(payload, at) }
        store.blockedUntil = 0
        return payload
      }
    }
    // Failed, or the source had nothing for today (EC-5): day-ahead prices never change once
    // published, so cached ones are shown without a warning (AC-24); otherwise the error state (AC-23).
    const retryAfter = result.ok ? undefined : result.retryAfterSeconds
    store.blockedUntil = blockedUntilAfterFailure(at, retryAfter)
    return store.entry?.payload ?? errorPayload(today, tomorrow, at)
  })()

  try {
    return await store.inflight
  } finally {
    store.inflight = null
  }
}
