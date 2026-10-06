// Card texts for a start-window recommendation (PROJ-3 design.md → "Anzeige der Zeiten" and
// "Anzeige der Preise und der Ersparnis"). Pure functions; "now" is a parameter, all times in German time.
import { format } from 'date-fns'
import { TZDate, tzOffset } from '@date-fns/tz'

import { BERLIN_TZ, berlinDate, berlinDayEnd, berlinDaySlotCount, berlinToday } from '@/lib/prices/berlin-time'
import { formatCt } from '@/lib/prices/price-math'
import { formatDuration } from './schemas'
import type { Recommendation } from './types'

const NBSP = ' '

export const RECOMMENDATION_TEXTS = {
  pricesUnavailable: 'Empfehlung gerade nicht verfügbar – die Strompreise konnten nicht geladen werden.',
  noCheaper: 'Günstiger wird es im bekannten Zeitraum nicht.',
  tomorrowMissing: 'Die Preise für morgen fehlen noch – die Empfehlung kann sich ab ca. 13 Uhr ändern.',
} as const

export type RecommendationText =
  | { kind: 'notice'; text: string }
  | {
      kind: 'recommendation'
      /** e.g. 'Starte um 13:15 Uhr · fertig um 15:45 Uhr · Ø 8,4 ct/kWh' (AC-15, AC-17). */
      headline: string
      /** Comparison (AC-16, EC-3, EC-4), 'Günstiger wird es …' (AC-17), or null when the window from now has a gap (EC-14). */
      detail: string | null
      /** Shown while tomorrow's prices are missing (AC-19). */
      tomorrowHint: string | null
    }

/** 'Für 4:00 h sind noch nicht genug Preise bekannt. …' (AC-18). */
export function notEnoughPricesText(durationMinutes: number): string {
  return `Für ${formatDuration(durationMinutes)} h sind noch nicht genug Preise bekannt. Die Preise für morgen erscheinen meist ab ca. 13 Uhr.`
}

/** 'Für 2:30 h fehlen gerade einzelne Preise in den Daten – …' (EC-14). */
export function priceGapsText(durationMinutes: number): string {
  return `Für ${formatDuration(durationMinutes)} h fehlen gerade einzelne Preise in den Daten – eine Empfehlung ist nicht möglich.`
}

/**
 * A point in time as shown on the card: '[morgen ]um HH:MM Uhr[ MESZ|MEZ]'.
 * As an end, German midnight reads '24:00' and belongs to the day before (like '24:00' in PROJ-2).
 * 'morgen' when the calendar day lies after today (German time) of `now` (AC-15).
 * 'MESZ'/'MEZ' only in the doubled 02:xx hour of the 100-slot day (EC-2).
 */
export function clockText(instant: string, now: Date, asEnd = false): string {
  const ms = Date.parse(instant)
  const dayBefore = berlinDate(new Date(ms - 1))
  const isMidnightEnd = asEnd && berlinDayEnd(dayBefore).getTime() === ms

  const day = isMidnightEnd ? dayBefore : berlinDate(instant)
  const local = new TZDate(ms, BERLIN_TZ)
  const time = isMidnightEnd ? '24:00' : format(local, 'HH:mm')

  let suffix = ''
  if (!isMidnightEnd && berlinDaySlotCount(day) === 100 && local.getHours() === 2) {
    // Offset in minutes east of UTC: 120 = summer time (MESZ), 60 = standard time (MEZ).
    suffix = tzOffset(BERLIN_TZ, local) === 120 ? ' MESZ' : ' MEZ'
  }

  const prefix = day > berlinToday(now) ? 'morgen ' : ''
  return `${prefix}um ${time} Uhr${suffix}`
}

// EUR/MWh → integer tenths of ct/kWh, rounded exactly like formatCt (one tenth of ct/kWh = 1 EUR/MWh).
function shownTenths(priceEurMwh: number): number {
  const tenths = Math.round(Number(Math.abs(priceEurMwh).toPrecision(12)))
  return priceEurMwh < 0 ? -tenths : tenths
}

/**
 * Comparison line (AC-16, EC-3, EC-4). Computed from the shown, rounded averages so the numbers on the
 * card add up (11,7 − 8,4 = 3,3); the percentage is that difference over the shown average from now.
 */
export function comparisonText(immediateAvgEurMwh: number, bestAvgEurMwh: number): string {
  const immediate = shownTenths(immediateAvgEurMwh)
  const diff = immediate - shownTenths(bestAvgEurMwh)
  const now = `Sofort: Ø ${formatCt(immediateAvgEurMwh)} ct/kWh`

  if (diff <= 0) return `${now} – kaum Unterschied (unter 0,1 ct/kWh)`

  // No percentage when the average from now is 0 or negative (EC-3).
  const percent = immediate > 0 ? ` (${Math.round((diff / immediate) * 100)}${NBSP}%)` : ''
  return `${now} – du sparst ${formatCt(diff)} ct/kWh${percent}`
}

/** All texts of one card, from the computed recommendation. */
export function recommendationText(
  recommendation: Recommendation,
  now: Date,
  durationMinutes: number
): RecommendationText {
  switch (recommendation.kind) {
    case 'prices_unavailable':
      return { kind: 'notice', text: RECOMMENDATION_TEXTS.pricesUnavailable }
    case 'not_enough_prices':
      return { kind: 'notice', text: notEnoughPricesText(durationMinutes) }
    case 'price_gaps':
      return { kind: 'notice', text: priceGapsText(durationMinutes) }
  }

  const { best, startsNow, immediateAvgEurMwh, tomorrowMissing } = recommendation
  const start = startsNow ? 'Jetzt starten' : `Starte ${clockText(best.start, now)}`
  const headline = `${start} · fertig ${clockText(best.end, now, true)} · Ø ${formatCt(best.avgEurMwh)} ct/kWh`

  let detail: string | null = null
  if (startsNow) detail = RECOMMENDATION_TEXTS.noCheaper
  else if (immediateAvgEurMwh !== null) detail = comparisonText(immediateAvgEurMwh, best.avgEurMwh)

  return {
    kind: 'recommendation',
    headline,
    detail,
    tomorrowHint: tomorrowMissing ? RECOMMENDATION_TEXTS.tomorrowMissing : null,
  }
}
