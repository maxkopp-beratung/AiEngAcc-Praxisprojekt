// Start-window recommendation of PROJ-3 as a pure function (no I/O, "now" is a parameter).
// Counts in 15-minute slots, never in wall-clock time, so DST days give the real duration (EC-1, EC-2).
import { rangeStartIndex } from '@/lib/prices/price-math'
import { SLOT_MINUTES } from '@/lib/prices/berlin-time'
import type { PricesPayload, Slot } from '@/lib/prices/types'
import type { Recommendation, StartWindow } from './types'

const SLOT_MS = SLOT_MINUTES * 60 * 1000

/**
 * Cheapest contiguous window of `durationMinutes` from the current slot on (AC-13, AC-14).
 * Prices are compared as integer hundredths of EUR/MWh so ties are exact; tie → earliest.
 */
export function recommendStartWindow(
  payload: PricesPayload,
  now: Date,
  durationMinutes: number,
): Recommendation {
  const { today, tomorrow } = payload
  if (today.status !== 'ok') return { kind: 'prices_unavailable' } // AC-23

  const tomorrowOk = tomorrow.status === 'ok'
  // Known range: today's slots, then tomorrow's if published; contiguous UTC instants (AC-13).
  const slots: Slot[] = tomorrowOk ? [...today.slots, ...tomorrow.slots] : today.slots
  const from = rangeStartIndex(slots, now, 'today') // current slot, or slots.length if none left

  const n = durationMinutes / SLOT_MINUTES
  if (!Number.isInteger(n) || n <= 0) return { kind: 'not_enough_prices' }
  // Exactly n slots left is allowed (EC-5); fewer → not enough (AC-18, EC-6).
  if (slots.length - from < n) return { kind: 'not_enough_prices' }

  // Hundredths of EUR/MWh as integers; null slots count 0 and are tracked separately (EC-14).
  const cents = slots.map((s) => (s.priceEurMwh === null ? 0 : Math.round(s.priceEurMwh * 100)))
  const isGap = slots.map((s) => (s.priceEurMwh === null ? 1 : 0))

  let sum = 0
  let gaps = 0
  for (let i = from; i < from + n; i++) {
    sum += cents[i]
    gaps += isGap[i]
  }

  // Window starting in the current slot: comparison value, or none if it has a gap (EC-14).
  const immediateSum = gaps === 0 ? sum : null
  let bestIndex = -1
  let bestSum = 0
  for (let i = from; ; i++) {
    // Strict < keeps the first hit, so a tie goes to the earliest window (AC-14).
    if (gaps === 0 && (bestIndex === -1 || sum < bestSum)) {
      bestIndex = i
      bestSum = sum
    }
    if (i + n >= slots.length) break
    // Slide by one slot: drop slot i, add slot i + n.
    sum += cents[i + n] - cents[i]
    gaps += isGap[i + n] - isGap[i]
  }

  if (bestIndex === -1) return { kind: 'price_gaps' } // fits, but every window has a gap (EC-14)

  const startMs = Date.parse(slots[bestIndex].start)
  const best: StartWindow = {
    start: slots[bestIndex].start,
    // Counted in slots → real duration across a DST change (EC-1).
    end: new Date(startMs + n * SLOT_MS).toISOString(),
    avgEurMwh: bestSum / 100 / n,
  }

  return {
    kind: 'recommendation',
    best,
    startsNow: bestIndex === from, // AC-17
    immediateAvgEurMwh: immediateSum === null ? null : immediateSum / 100 / n,
    tomorrowMissing: !tomorrowOk, // AC-19
  }
}
