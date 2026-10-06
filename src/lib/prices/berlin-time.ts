// German-time helpers (Europe/Berlin) for PROJ-2. Pure functions, no I/O, usable in browser and server.
// Every calendar decision is made in German time, never in the device/process time zone (AC-18).
// DST days: 92 slots in spring (EC-1), 100 slots in autumn with MESZ/MEZ labels (EC-2).
import { format } from 'date-fns'
import { TZDate, tzOffset } from '@date-fns/tz'

export const BERLIN_TZ = 'Europe/Berlin'
export const SLOT_MINUTES = 15
const SLOT_MS = SLOT_MINUTES * 60 * 1000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function toBerlin(instant: Date | string): TZDate {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant.getTime()
  if (Number.isNaN(ms)) throw new Error(`Invalid instant: ${String(instant)}`)
  return new TZDate(ms, BERLIN_TZ)
}

function parseDate(date: string): [number, number, number] {
  const m = DATE_RE.exec(date)
  if (!m) throw new Error(`Invalid Berlin date (expected YYYY-MM-DD): ${date}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Calendar day of an instant in German time, `YYYY-MM-DD` (AC-18). */
export function berlinDate(instant: Date | string): string {
  return format(toBerlin(instant), 'yyyy-MM-dd')
}

/** The calendar day after `date` (`YYYY-MM-DD` → `YYYY-MM-DD`); plain calendar arithmetic, no time zone involved. */
export function nextBerlinDate(date: string): string {
  const [y, m, d] = parseDate(date)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** "Today" in German time for the given moment, `YYYY-MM-DD` (AC-18). */
export function berlinToday(now: Date): string {
  return berlinDate(now)
}

/** "Tomorrow" in German time for the given moment, `YYYY-MM-DD` (AC-18). */
export function berlinTomorrow(now: Date): string {
  return nextBerlinDate(berlinDate(now))
}

/** UTC instant of German midnight at the start of `date`. */
export function berlinDayStart(date: string): Date {
  const [y, m, d] = parseDate(date)
  // Midnight always exists in Berlin (the DST switch happens at 02:00/03:00).
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, 0, BERLIN_TZ).getTime())
}

/** UTC instant of the next German midnight, i.e. the (exclusive) end of `date`. */
export function berlinDayEnd(date: string): Date {
  return berlinDayStart(nextBerlinDate(date))
}

/**
 * Gap-free 15-minute slot starts (UTC ISO strings) of a German calendar day, sorted.
 * 96 normally, 92 on the spring-forward day (EC-1), 100 on the fall-back day (EC-2).
 */
export function berlinDaySlotStarts(date: string): string[] {
  const start = berlinDayStart(date).getTime()
  const end = berlinDayEnd(date).getTime()
  const slots: string[] = []
  for (let t = start; t < end; t += SLOT_MS) slots.push(new Date(t).toISOString())
  return slots
}

/** Number of 15-minute slots of a German calendar day: 96, 92 (EC-1) or 100 (EC-2). */
export function berlinDaySlotCount(date: string): number {
  return (berlinDayEnd(date).getTime() - berlinDayStart(date).getTime()) / SLOT_MS
}

/**
 * Label of a slot in German time, `HH:MM–HH:MM` (en dash). The end of the day's last slot is `24:00`.
 * On a 100-slot day the duplicated 02:xx slots get ` MESZ` (first pass, UTC+2) or ` MEZ` (second pass,
 * UTC+1) so both are distinguishable (EC-2). The end is the wall-clock time of start + 15 min, so the
 * first 02:45 slot reads `02:45–02:00 MESZ`.
 */
export function slotLabel(start: string): string {
  const from = toBerlin(start)
  const day = berlinDate(start)
  const endMs = from.getTime() + SLOT_MS
  const to = endMs === berlinDayEnd(day).getTime() ? '24:00' : format(toBerlin(new Date(endMs)), 'HH:mm')

  let suffix = ''
  if (berlinDaySlotCount(day) === 100 && from.getHours() === 2) {
    // Offset in minutes east of UTC: 120 = summer time (MESZ), 60 = standard time (MEZ).
    suffix = tzOffset(BERLIN_TZ, from) === 120 ? ' MESZ' : ' MEZ'
  }
  return `${format(from, 'HH:mm')}–${to}${suffix}`
}

/** Start time in German time, e.g. `13:15 Uhr`. */
export function startTimeLabel(start: string): string {
  return `${format(toBerlin(start), 'HH:mm')} Uhr`
}
