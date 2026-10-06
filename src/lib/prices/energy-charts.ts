import 'server-only'
// Fetches day-ahead prices from Energy-Charts (PROJ-2, T5). One request covers today and tomorrow.
// No day splitting and no caching here — that is the price service's job (get-prices.ts).
import { z } from 'zod'
import type { Slot } from './types'

export const ENERGY_CHARTS_PRICE_URL = 'https://api.energy-charts.info/price'
export const BIDDING_ZONE = 'DE-LU'
export const DEFAULT_TIMEOUT_MS = 8_000

export type EnergyChartsErrorKind = 'timeout' | 'network' | 'http' | 'rate_limited' | 'invalid'

export type EnergyChartsResult =
  | { ok: true; points: Slot[] }
  | { ok: false; kind: EnergyChartsErrorKind; status?: number; retryAfterSeconds?: number }

export type FetchEnergyChartsOptions = {
  /** Abort after this many milliseconds (default 8 s, AC-23). */
  timeoutMs?: number
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

// Only the two arrays matter; unit, license_info, deprecated are ignored.
const priceResponseSchema = z
  .object({
    unix_seconds: z.array(z.number().int()),
    price: z.array(z.number().nullable()),
  })
  .refine((body) => body.unix_seconds.length === body.price.length, {
    message: 'unix_seconds and price differ in length',
  })

/** Builds the request URL; both dates are Berlin calendar dates `YYYY-MM-DD`. */
export function buildPriceUrl(startDate: string, endDate: string): string {
  const params = new URLSearchParams({ bzn: BIDDING_ZONE, start: startDate, end: endDate })
  return `${ENERGY_CHARTS_PRICE_URL}?${params.toString()}`
}

/** `Retry-After` in whole seconds; the HTTP-date form is not supported (→ undefined). */
export function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) return undefined
  const value = header.trim()
  if (!/^\d+$/.test(value)) return undefined
  return Number.parseInt(value, 10)
}

/**
 * Fetches prices for `startDate`..`endDate` (inclusive). Never throws: every failure comes back
 * as a typed error (AC-23). Prices stay exactly as delivered, unrounded and possibly negative (AC-4).
 */
export async function fetchEnergyChartsPrices(
  startDate: string,
  endDate: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }: FetchEnergyChartsOptions = {}
): Promise<EnergyChartsResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    let response: Response
    try {
      // no-store: our own cache decides, Next's fetch cache must not interfere.
      response = await fetchImpl(buildPriceUrl(startDate, endDate), {
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch {
      return { ok: false, kind: controller.signal.aborted ? 'timeout' : 'network' }
    }

    if (response.status === 429) {
      return {
        ok: false,
        kind: 'rate_limited',
        status: 429,
        retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
      }
    }
    // 404 means "not published yet" for a lone future day; still an http error here.
    if (response.status !== 200) {
      return { ok: false, kind: 'http', status: response.status }
    }

    let text: string
    try {
      text = await response.text()
    } catch {
      return { ok: false, kind: controller.signal.aborted ? 'timeout' : 'network' }
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, kind: 'invalid' }
    }

    const parsed = priceResponseSchema.safeParse(json)
    if (!parsed.success) return { ok: false, kind: 'invalid' }

    const { unix_seconds, price } = parsed.data
    const points: Slot[] = unix_seconds.map((seconds, i) => ({
      start: new Date(seconds * 1000).toISOString(),
      priceEurMwh: price[i],
    }))
    return { ok: true, points }
  } catch {
    // Safety net (e.g. an out-of-range timestamp in toISOString): never throw to the caller.
    return { ok: false, kind: 'invalid' }
  } finally {
    clearTimeout(timer)
  }
}
