import {
  berlinDate,
  berlinDayEnd,
  berlinDaySlotCount,
  berlinDaySlotStarts,
  berlinDayStart,
  berlinToday,
  berlinTomorrow,
  nextBerlinDate,
  slotLabel,
  startTimeLabel,
} from './berlin-time'

const SLOT_MS = 15 * 60 * 1000

function expectGapFree(slots: string[]) {
  for (let i = 1; i < slots.length; i++) {
    expect(Date.parse(slots[i]) - Date.parse(slots[i - 1])).toBe(SLOT_MS)
  }
}

describe('normal day (96 slots)', () => {
  it('starts at German midnight and ends at the next one (summer time)', () => {
    const slots = berlinDaySlotStarts('2026-10-06')
    expect(slots).toHaveLength(96)
    expect(slots[0]).toBe('2026-10-05T22:00:00.000Z')
    expect(slots[95]).toBe('2026-10-06T21:45:00.000Z')
    expectGapFree(slots)
    expect(berlinDayStart('2026-10-06').toISOString()).toBe('2026-10-05T22:00:00.000Z')
    expect(berlinDayEnd('2026-10-06').toISOString()).toBe('2026-10-06T22:00:00.000Z')
    expect(berlinDaySlotCount('2026-10-06')).toBe(96)
  })

  it('starts at German midnight in winter time too (UTC+1)', () => {
    const slots = berlinDaySlotStarts('2026-01-15')
    expect(slots).toHaveLength(96)
    expect(slots[0]).toBe('2026-01-14T23:00:00.000Z')
    expect(slots[95]).toBe('2026-01-15T22:45:00.000Z')
  })

  it('labels slots in German time, the last one ending at 24:00, without suffix', () => {
    const slots = berlinDaySlotStarts('2026-10-06')
    expect(slotLabel('2026-10-06T11:15:00.000Z')).toBe('13:15–13:30')
    expect(slotLabel(slots[0])).toBe('00:00–00:15')
    expect(slotLabel(slots[95])).toBe('23:45–24:00')
    expect(slots.map(slotLabel).filter((l) => /MES?Z/.test(l))).toEqual([])
  })

  it('writes start times as "HH:MM Uhr"', () => {
    expect(startTimeLabel('2026-10-06T11:15:00.000Z')).toBe('13:15 Uhr')
    expect(startTimeLabel('2026-10-05T22:00:00.000Z')).toBe('00:00 Uhr')
  })
})

describe('spring-forward day 2026-03-29 (EC-1)', () => {
  const slots = berlinDaySlotStarts('2026-03-29')
  const labels = slots.map(slotLabel)

  it('has 92 gap-free slots', () => {
    expect(slots).toHaveLength(92)
    expect(berlinDaySlotCount('2026-03-29')).toBe(92)
    expect(slots[0]).toBe('2026-03-28T23:00:00.000Z')
    expect(slots[91]).toBe('2026-03-29T21:45:00.000Z')
    expectGapFree(slots)
  })

  it('has no 02:xx slot; 01:45 is followed by 03:00', () => {
    expect(labels.filter((l) => l.startsWith('02:'))).toEqual([])
    const i = labels.indexOf('01:45–03:00')
    expect(i).toBe(7)
    expect(labels[8]).toBe('03:00–03:15')
    expect(labels[91]).toBe('23:45–24:00')
    expect(labels.filter((l) => /MES?Z/.test(l))).toEqual([])
  })
})

describe('fall-back day 2026-10-25 (EC-2)', () => {
  const slots = berlinDaySlotStarts('2026-10-25')
  const labels = slots.map(slotLabel)

  it('has 100 gap-free slots', () => {
    expect(slots).toHaveLength(100)
    expect(berlinDaySlotCount('2026-10-25')).toBe(100)
    expect(slots[0]).toBe('2026-10-24T22:00:00.000Z')
    expect(slots[99]).toBe('2026-10-25T22:45:00.000Z')
    expectGapFree(slots)
  })

  it('suffixes exactly the 8 duplicated-hour slots with MESZ, then MEZ', () => {
    const suffixed = labels.filter((l) => /MES?Z/.test(l))
    expect(suffixed).toEqual([
      '02:00–02:15 MESZ',
      '02:15–02:30 MESZ',
      '02:30–02:45 MESZ',
      '02:45–02:00 MESZ',
      '02:00–02:15 MEZ',
      '02:15–02:30 MEZ',
      '02:30–02:45 MEZ',
      '02:45–03:00 MEZ',
    ])
    // They sit right after 01:45 and before 03:00, in that order.
    expect(labels.slice(7, 17)).toEqual(['01:45–02:00', ...suffixed, '03:00–03:15'])
    expect(slotLabel('2026-10-25T00:00:00.000Z')).toBe('02:00–02:15 MESZ')
    expect(slotLabel('2026-10-25T01:00:00.000Z')).toBe('02:00–02:15 MEZ')
    expect(labels[99]).toBe('23:45–24:00')
  })
})

describe('today / tomorrow in German time (AC-18)', () => {
  it('23:59 German time is still today', () => {
    const now = new Date('2026-10-06T21:59:00.000Z') // 23:59 MESZ
    expect(berlinToday(now)).toBe('2026-10-06')
    expect(berlinTomorrow(now)).toBe('2026-10-07')
  })

  it('00:00 German time is already the next day', () => {
    const now = new Date('2026-10-06T22:00:00.000Z') // 00:00 MESZ on 2026-10-07
    expect(berlinToday(now)).toBe('2026-10-07')
    expect(berlinTomorrow(now)).toBe('2026-10-08')
  })

  it('handles the year boundary in winter time', () => {
    expect(berlinToday(new Date('2026-12-31T22:59:00.000Z'))).toBe('2026-12-31')
    expect(berlinTomorrow(new Date('2026-12-31T22:59:00.000Z'))).toBe('2027-01-01')
    expect(berlinToday(new Date('2026-12-31T23:00:00.000Z'))).toBe('2027-01-01')
  })

  it('accepts ISO strings and does calendar arithmetic on dates', () => {
    expect(berlinDate('2026-10-05T22:00:00.000Z')).toBe('2026-10-06')
    expect(nextBerlinDate('2026-02-28')).toBe('2026-03-01')
    expect(nextBerlinDate('2028-02-28')).toBe('2028-02-29')
  })

  it('rejects malformed input', () => {
    expect(() => berlinDayStart('6.10.2026')).toThrow()
    expect(() => berlinDate('not a date')).toThrow()
  })
})

// Independence from the process time zone (AC-18): Node (v13+) re-reads process.env.TZ when it is
// assigned at runtime, so the key assertions are re-run with the process switched to New York and
// Tokyo. A guard asserts the switch really took effect (local hours of a fixed UTC instant change);
// without it the test could pass vacuously on a machine that already runs in German time.
describe.each([
  ['America/New_York', 19],
  ['Asia/Tokyo', 9],
])('with process TZ %s', (zone, localHourOfUtcMidnight) => {
  const original = process.env.TZ

  beforeAll(() => {
    process.env.TZ = zone
  })
  afterAll(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it('really runs in that zone (guard)', () => {
    expect(new Date('2026-01-01T00:00:00.000Z').getHours()).toBe(localHourOfUtcMidnight)
  })

  it('still computes German days, slots and labels', () => {
    expect(berlinDaySlotStarts('2026-10-06')[0]).toBe('2026-10-05T22:00:00.000Z')
    expect(berlinDaySlotStarts('2026-10-06')).toHaveLength(96)
    expect(berlinDaySlotStarts('2026-03-29')).toHaveLength(92)
    expect(berlinDaySlotStarts('2026-10-25')).toHaveLength(100)
    expect(slotLabel('2026-10-06T11:15:00.000Z')).toBe('13:15–13:30')
    expect(slotLabel('2026-10-06T21:45:00.000Z')).toBe('23:45–24:00')
    expect(slotLabel('2026-10-25T00:45:00.000Z')).toBe('02:45–02:00 MESZ')
    expect(slotLabel('2026-10-25T01:00:00.000Z')).toBe('02:00–02:15 MEZ')
    expect(startTimeLabel('2026-10-06T11:15:00.000Z')).toBe('13:15 Uhr')
    expect(berlinToday(new Date('2026-10-06T21:59:00.000Z'))).toBe('2026-10-06')
    expect(berlinToday(new Date('2026-10-06T22:00:00.000Z'))).toBe('2026-10-07')
    expect(berlinTomorrow(new Date('2026-10-06T22:00:00.000Z'))).toBe('2026-10-08')
  })
})
