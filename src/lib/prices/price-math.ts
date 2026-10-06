// Price logic of PROJ-2 as pure functions (no I/O, "now" is always a parameter), shared by
// server and browser. Comparisons always use the unrounded EUR/MWh value; rounding happens
// only in the format functions (AC-4).
import type { PriceTier, Slot } from './types'

const SLOT_MS = 15 * 60 * 1000
const MINUS = '\u2212'

/** How much of the day counts: 'today' = current slot and later, 'day' = every slot. */
export type RangeMode = 'today' | 'day'

/**
 * EUR/MWh as ct/kWh with one decimal, German format, without unit (AC-4, AC-6), e.g. '16,1'.
 * One decimal of ct/kWh is exactly 1 EUR/MWh, so we round the source value to an integer,
 * half away from zero. toPrecision strips binary noise (160.55 must not become 160.5499…).
 */
export function formatCt(priceEurMwh: number): string {
  const abs = Number(Math.abs(priceEurMwh).toPrecision(12))
  const tenths = Math.round(abs)
  // A value that rounds to zero is '0,0', never '−0,0'.
  const sign = priceEurMwh < 0 && tenths !== 0 ? MINUS : ''
  return `${sign}${Math.floor(tenths / 10)},${tenths % 10}`
}

/** Same as formatCt, with unit (AC-4), e.g. '16,1 ct/kWh' or '−0,5 ct/kWh'. */
export function formatCtKwh(priceEurMwh: number): string {
  return `${formatCt(priceEurMwh)} ct/kWh`
}

function endMs(slot: Slot): number {
  return Date.parse(slot.start) + SLOT_MS
}

/** Index of the slot with start ≤ now < start + 15 min, or -1 (before/after the day). */
export function currentSlotIndex(slots: Slot[], now: Date): number {
  const t = now.getTime()
  return slots.findIndex((s) => Date.parse(s.start) <= t && t < endMs(s))
}

/**
 * First index of the considered range. 'day' → 0. 'today' → the current slot; before the day
 * → 0 (all slots); after the day → slots.length (empty range).
 */
export function rangeStartIndex(slots: Slot[], now: Date, mode: RangeMode): number {
  if (mode === 'day') return 0
  const t = now.getTime()
  const i = slots.findIndex((s) => t < endMs(s))
  return i === -1 ? slots.length : i
}

// Strict comparison keeps the first hit, so a tie goes to the earliest slot (AC-9).
function extremeIndex(slots: Slot[], from: number, better: (a: number, b: number) => boolean) {
  let best = -1
  for (let i = Math.max(0, from); i < slots.length; i++) {
    const price = slots[i].priceEurMwh
    if (price === null) continue
    if (best === -1 || better(price, slots[best].priceEurMwh as number)) best = i
  }
  return best === -1 ? null : best
}

/** Index of the cheapest priced slot from `from` on; tie → earliest; none priced → null (AC-9, AC-12). */
export function cheapestIndex(slots: Slot[], from = 0): number | null {
  return extremeIndex(slots, from, (a, b) => a < b)
}

/** Index of the most expensive priced slot from `from` on; tie → earliest; none → null (AC-10, AC-12). */
export function mostExpensiveIndex(slots: Slot[], from = 0): number | null {
  return extremeIndex(slots, from, (a, b) => a > b)
}

/** Arithmetic mean of all priced slots of the day in EUR/MWh; none priced → null. */
export function dayAverage(slots: Slot[]): number | null {
  const prices = slots.flatMap((s) => (s.priceEurMwh === null ? [] : [s.priceEurMwh]))
  if (prices.length === 0) return null
  return prices.reduce((sum, p) => sum + p, 0) / prices.length
}

/**
 * Tier per slot relative to min/max of ALL priced slots of the day, past ones included (AC-7).
 * Lower third → 'cheap', upper third → 'expensive', boundaries → 'mid'; all equal → 'mid' (EC-6).
 * Slots without a price → null.
 */
export function tiers(slots: Slot[]): (PriceTier | null)[] {
  const prices = slots.flatMap((s) => (s.priceEurMwh === null ? [] : [s.priceEurMwh]))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return slots.map(({ priceEurMwh: price }) => {
    if (price === null) return null
    if (max === min) return 'mid'
    const t = (price - min) / (max - min)
    if (t < 1 / 3) return 'cheap'
    if (t > 2 / 3) return 'expensive'
    return 'mid'
  })
}
