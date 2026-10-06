import {
  clockText,
  comparisonText,
  notEnoughPricesText,
  priceGapsText,
  recommendationText,
  RECOMMENDATION_TEXTS,
} from './recommendation-text'
import type { Recommendation } from './types'

const NBSP = ' '
// 2026-10-06 is a normal day in summer time (UTC+2): 13:00 Berlin = 11:00Z.
const NOW = new Date('2026-10-06T11:07:00Z')

function rec(over: Partial<Extract<Recommendation, { kind: 'recommendation' }>> = {}): Recommendation {
  return {
    kind: 'recommendation',
    best: { start: '2026-10-06T11:15:00Z', end: '2026-10-06T13:45:00Z', avgEurMwh: 84 },
    startsNow: false,
    immediateAvgEurMwh: 117,
    tomorrowMissing: false,
    ...over,
  }
}

describe('clockText (AC-15, EC-2)', () => {
  it('shows German time with "Uhr"', () => {
    expect(clockText('2026-10-06T11:15:00Z', NOW)).toBe('um 13:15 Uhr')
  })

  it('puts "morgen" before a time on the next German day', () => {
    expect(clockText('2026-10-07T00:00:00Z', NOW)).toBe('morgen um 02:00 Uhr')
    // 23:30 Berlin today is 21:30Z — still today.
    expect(clockText('2026-10-06T21:30:00Z', NOW)).toBe('um 23:30 Uhr')
  })

  it('shows an end exactly at German midnight as 24:00 of the day before', () => {
    expect(clockText('2026-10-06T22:00:00Z', NOW, true)).toBe('um 24:00 Uhr')
    // As a start, the same instant is 00:00 tomorrow.
    expect(clockText('2026-10-06T22:00:00Z', NOW)).toBe('morgen um 00:00 Uhr')
    // Midnight at the end of tomorrow → "morgen um 24:00 Uhr".
    expect(clockText('2026-10-07T22:00:00Z', NOW, true)).toBe('morgen um 24:00 Uhr')
  })

  it('marks the doubled hour on the fall-back day with MESZ / MEZ', () => {
    const now = new Date('2026-10-24T20:00:00Z') // evening before, 22:00 Berlin
    expect(clockText('2026-10-25T00:15:00Z', now)).toBe('morgen um 02:15 Uhr MESZ')
    expect(clockText('2026-10-25T01:15:00Z', now)).toBe('morgen um 02:15 Uhr MEZ')
    // Outside the doubled hour, no suffix.
    expect(clockText('2026-10-25T02:15:00Z', now)).toBe('morgen um 03:15 Uhr')
  })

  it('never adds a suffix on normal days or the spring-forward day', () => {
    const now = new Date('2026-03-28T20:00:00Z')
    // 2026-03-29: 01:30 CET = 00:30Z, 2.5 h later = 03:00Z = 05:00 CEST (EC-1).
    expect(clockText('2026-03-29T00:30:00Z', now)).toBe('morgen um 01:30 Uhr')
    expect(clockText('2026-03-29T03:00:00Z', now, true)).toBe('morgen um 05:00 Uhr')
    expect(clockText('2026-10-06T00:15:00Z', NOW)).toBe('um 02:15 Uhr')
  })

  it('does not depend on the time zone of the device (AC-20)', () => {
    const original = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      expect(clockText('2026-10-06T11:15:00Z', NOW)).toBe('um 13:15 Uhr')
      expect(clockText('2026-10-07T00:00:00Z', NOW)).toBe('morgen um 02:00 Uhr')
    } finally {
      process.env.TZ = original
    }
  })
})

describe('comparisonText (AC-16, EC-3, EC-4)', () => {
  it('shows saving and percentage from the shown, rounded averages', () => {
    // 11,7 − 8,4 = 3,3; 3,3 / 11,7 = 28 %.
    expect(comparisonText(117, 84)).toBe(`Sofort: Ø 11,7 ct/kWh – du sparst 3,3 ct/kWh (28${NBSP}%)`)
    // Unrounded 117.44 − 83.56 = 33.88 would read 3,4 — the card must add up to 11,7 − 8,4 = 3,3.
    expect(comparisonText(117.44, 83.56)).toBe(`Sofort: Ø 11,7 ct/kWh – du sparst 3,3 ct/kWh (28${NBSP}%)`)
  })

  it('rounds the percentage to whole percent', () => {
    // 1,0 / 3,0 = 33,3 % → 33; 2,0 / 3,0 = 66,7 % → 67.
    expect(comparisonText(30, 20)).toContain(`(33${NBSP}%)`)
    expect(comparisonText(30, 10)).toContain(`(67${NBSP}%)`)
  })

  it('drops the percentage when the average from now is 0 or negative (EC-3)', () => {
    expect(comparisonText(-4, -16)).toBe('Sofort: Ø −0,4 ct/kWh – du sparst 1,2 ct/kWh')
    expect(comparisonText(0, -5)).toBe('Sofort: Ø 0,0 ct/kWh – du sparst 0,5 ct/kWh')
  })

  it('says "kaum Unterschied" when both shown averages are equal (EC-4)', () => {
    expect(comparisonText(84.4, 84.0)).toBe('Sofort: Ø 8,4 ct/kWh – kaum Unterschied (unter 0,1 ct/kWh)')
  })
})

describe('notice texts (AC-18, EC-14)', () => {
  it('names the run time as H:MM', () => {
    expect(notEnoughPricesText(240)).toBe(
      'Für 4:00 h sind noch nicht genug Preise bekannt. Die Preise für morgen erscheinen meist ab ca. 13 Uhr.'
    )
    expect(priceGapsText(150)).toBe(
      'Für 2:30 h fehlen gerade einzelne Preise in den Daten – eine Empfehlung ist nicht möglich.'
    )
  })
})

describe('recommendationText', () => {
  it('builds the card for a later window with comparison (AC-15, AC-16)', () => {
    expect(recommendationText(rec(), NOW, 150)).toEqual({
      kind: 'recommendation',
      headline: 'Starte um 13:15 Uhr · fertig um 15:45 Uhr · Ø 8,4 ct/kWh',
      detail: `Sofort: Ø 11,7 ct/kWh – du sparst 3,3 ct/kWh (28${NBSP}%)`,
      tomorrowHint: null,
    })
  })

  it('builds "Jetzt starten" without a comparison (AC-17)', () => {
    const text = recommendationText(
      rec({ startsNow: true, best: { start: '2026-10-06T11:00:00Z', end: '2026-10-06T13:30:00Z', avgEurMwh: 84 } }),
      NOW,
      150
    )
    expect(text).toEqual({
      kind: 'recommendation',
      headline: 'Jetzt starten · fertig um 15:30 Uhr · Ø 8,4 ct/kWh',
      detail: RECOMMENDATION_TEXTS.noCheaper,
      tomorrowHint: null,
    })
  })

  it('puts "morgen" on start and end separately (AC-15)', () => {
    const text = recommendationText(
      rec({ best: { start: '2026-10-06T20:00:00Z', end: '2026-10-06T22:30:00Z', avgEurMwh: 50 } }),
      NOW,
      150
    )
    expect(text.kind === 'recommendation' && text.headline).toBe(
      'Starte um 22:00 Uhr · fertig morgen um 00:30 Uhr · Ø 5,0 ct/kWh'
    )
  })

  it('adds the hint while tomorrow is missing (AC-19)', () => {
    const text = recommendationText(rec({ tomorrowMissing: true }), NOW, 150)
    expect(text.kind === 'recommendation' && text.tomorrowHint).toBe(RECOMMENDATION_TEXTS.tomorrowMissing)
  })

  it('has no comparison line when the window from now has a gap (EC-14)', () => {
    const text = recommendationText(rec({ immediateAvgEurMwh: null }), NOW, 150)
    expect(text.kind === 'recommendation' && text.detail).toBeNull()
  })

  it('maps the notice states (AC-18, AC-23, EC-14)', () => {
    expect(recommendationText({ kind: 'prices_unavailable' }, NOW, 150)).toEqual({
      kind: 'notice',
      text: 'Empfehlung gerade nicht verfügbar – die Strompreise konnten nicht geladen werden.',
    })
    expect(recommendationText({ kind: 'not_enough_prices' }, NOW, 240)).toEqual({
      kind: 'notice',
      text: notEnoughPricesText(240),
    })
    expect(recommendationText({ kind: 'price_gaps' }, NOW, 150)).toEqual({
      kind: 'notice',
      text: priceGapsText(150),
    })
  })
})
