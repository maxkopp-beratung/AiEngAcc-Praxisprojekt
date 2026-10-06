import {
  cheapestIndex,
  currentSlotIndex,
  dayAverage,
  formatCt,
  formatCtKwh,
  mostExpensiveIndex,
  rangeStartIndex,
  tiers,
} from './price-math'
import type { Slot } from './types'

// 2026-10-06 is CEST (UTC+2): the German day starts at 2026-10-05T22:00Z.
const DAY_START = Date.parse('2026-10-05T22:00:00.000Z')
const SLOT_MS = 15 * 60 * 1000

function day(prices: (number | null)[]): Slot[] {
  return prices.map((priceEurMwh, i) => ({
    start: new Date(DAY_START + i * SLOT_MS).toISOString(),
    priceEurMwh,
  }))
}

const at = (slotIndex: number, minutes = 0) =>
  new Date(DAY_START + slotIndex * SLOT_MS + minutes * 60 * 1000)

describe('formatCt / formatCtKwh (AC-4, AC-6)', () => {
  it.each([
    [160.55, '16,1'],
    [160.45, '16,0'],
    [160.5, '16,1'],
    [-160.5, '\u221216,1'],
    [-4.95, '\u22120,5'],
    [0, '0,0'],
    [-0.04, '0,0'],
    [-0.5, '\u22120,1'],
    // toFixed would round these down (0.15 is 0.1499\u2026 in binary)
    [1.5, '0,2'],
    [11.5, '1,2'],
    [-1.5, '\u22120,2'],
    [0.49, '0,0'],
    [99.96, '10,0'],
    [1234.4, '123,4'],
  ])('formats %s EUR/MWh as %s', (eur, text) => {
    expect(formatCt(eur)).toBe(text)
  })

  it('ignores binary noise: 100.49999999999999 (= 1.005 * 100) counts as 100.5', () => {
    expect(formatCt(1.005 * 100)).toBe('10,1')
  })

  it('uses the real minus sign U+2212, never an ASCII hyphen', () => {
    expect(formatCtKwh(-5)).toBe('\u22120,5 ct/kWh')
    expect(formatCtKwh(-5)).not.toContain('-')
  })

  it('never shows a negative zero', () => {
    expect(formatCtKwh(-0.04)).toBe('0,0 ct/kWh')
    expect(formatCtKwh(-0)).toBe('0,0 ct/kWh')
  })

  it('appends the unit', () => {
    expect(formatCtKwh(160.55)).toBe('16,1 ct/kWh')
  })
})

describe('currentSlotIndex', () => {
  const slots = day(Array(96).fill(50))

  it('finds the slot with start ≤ now < start + 15 min', () => {
    expect(currentSlotIndex(slots, at(0))).toBe(0)
    expect(currentSlotIndex(slots, at(10, 14.99))).toBe(10)
    expect(currentSlotIndex(slots, at(11))).toBe(11)
    expect(currentSlotIndex(slots, at(95, 10))).toBe(95)
  })

  it('returns -1 before and after the day', () => {
    expect(currentSlotIndex(slots, at(0, -1))).toBe(-1)
    expect(currentSlotIndex(slots, at(96))).toBe(-1)
    expect(currentSlotIndex([], at(0))).toBe(-1)
  })
})

describe('rangeStartIndex', () => {
  const slots = day(Array(96).fill(50))

  it("'today' starts at the current slot", () => {
    expect(rangeStartIndex(slots, at(40, 7), 'today')).toBe(40)
  })

  it("'today' before the day covers all slots, after the day none", () => {
    expect(rangeStartIndex(slots, at(-4), 'today')).toBe(0)
    expect(rangeStartIndex(slots, at(96), 'today')).toBe(96)
  })

  it("'day' always covers all slots", () => {
    expect(rangeStartIndex(slots, at(40), 'day')).toBe(0)
    expect(rangeStartIndex(slots, at(200), 'day')).toBe(0)
  })
})

describe('cheapestIndex / mostExpensiveIndex (AC-9, AC-10, AC-12)', () => {
  it('finds the lowest and highest price, negative prices included', () => {
    const slots = day([30, -12.5, 80, 5, 120.3, 0])
    expect(cheapestIndex(slots)).toBe(1)
    expect(mostExpensiveIndex(slots)).toBe(4)
  })

  it('takes the earliest slot on a tie, for min and for max', () => {
    const slots = day([50, 10, 90, 10, 90, 40])
    expect(cheapestIndex(slots)).toBe(1)
    expect(mostExpensiveIndex(slots)).toBe(2)
  })

  it('all prices equal → cheapest = most expensive = earliest', () => {
    const slots = day([42, 42, 42, 42])
    expect(cheapestIndex(slots)).toBe(0)
    expect(mostExpensiveIndex(slots)).toBe(0)
  })

  it('ignores slots without a price (EC-4)', () => {
    const slots = day([null, 20, null, 70, null])
    expect(cheapestIndex(slots)).toBe(1)
    expect(mostExpensiveIndex(slots)).toBe(3)
  })

  it('only looks at the range from `from` on, past slots excluded', () => {
    const slots = day([-50, 500, 30, 60, 20])
    expect(cheapestIndex(slots, 2)).toBe(4)
    expect(mostExpensiveIndex(slots, 2)).toBe(3)
  })

  it('last slot of the day: one slot in range → cheapest = most expensive = current (EC-3)', () => {
    const slots = day([...Array(95).fill(10), 80])
    const now = at(95, 3) // 23:48 German time
    const from = rangeStartIndex(slots, now, 'today')
    expect(from).toBe(95)
    expect(currentSlotIndex(slots, now)).toBe(95)
    expect(cheapestIndex(slots, from)).toBe(95)
    expect(mostExpensiveIndex(slots, from)).toBe(95)
  })

  it('returns null for an empty day, an all-null day and an empty range', () => {
    expect(cheapestIndex([])).toBeNull()
    expect(mostExpensiveIndex([])).toBeNull()
    expect(cheapestIndex(day([null, null]))).toBeNull()
    expect(mostExpensiveIndex(day([null, null]))).toBeNull()
    const slots = day([10, 20])
    expect(cheapestIndex(slots, rangeStartIndex(slots, at(5), 'today'))).toBeNull()
  })
})

describe('dayAverage', () => {
  it('is the mean of all priced slots, gaps ignored', () => {
    expect(dayAverage(day([10, null, -20, 40]))).toBe(10)
  })

  it('is null without prices', () => {
    expect(dayAverage([])).toBeNull()
    expect(dayAverage(day([null, null]))).toBeNull()
  })
})

describe('tiers (AC-7, EC-6)', () => {
  it('splits the day range into thirds', () => {
    expect(tiers(day([0, 20, 50, 80, 100]))).toEqual(['cheap', 'cheap', 'mid', 'expensive', 'expensive'])
  })

  it("puts values exactly on 1/3 and 2/3 into 'mid'", () => {
    expect(tiers(day([0, 10, 20, 30]))).toEqual(['cheap', 'mid', 'mid', 'expensive'])
    expect(tiers(day([0, 1, 2, 3]))).toEqual(['cheap', 'mid', 'mid', 'expensive'])
  })

  it("all prices equal → every priced slot is 'mid' (EC-6)", () => {
    expect(tiers(day([42, null, 42]))).toEqual(['mid', null, 'mid'])
  })

  it('uses min/max of the whole day and handles negative prices and gaps', () => {
    // min -30, max 60 → thresholds at 0 and 30
    expect(tiers(day([-30, null, -1, 0, 30, 31, 60]))).toEqual([
      'cheap',
      null,
      'cheap',
      'mid',
      'mid',
      'expensive',
      'expensive',
    ])
  })

  it('returns only nulls when nothing is priced', () => {
    expect(tiers(day([null, null]))).toEqual([null, null])
    expect(tiers([])).toEqual([])
  })
})
