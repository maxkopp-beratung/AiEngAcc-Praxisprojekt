// Shared shapes and limits for PROJ-3 devices and start-window recommendations.
// Other modules (actions, recommendation, UI) build against these — do not rename.

export const MAX_DEVICES = 20
export const NAME_MAX_LENGTH = 40 // counted in Unicode code points, like Postgres char_length
export const DURATION_MIN_MINUTES = 15
export const DURATION_MAX_MINUTES = 720
export const DURATION_STEP_MINUTES = 15

export type Device = {
  id: string
  name: string
  durationMinutes: number
  createdAt: string // ISO
}

/** Field errors shown in the device dialog; `duration` is shown under the two duration selects. */
export type DeviceFieldErrors = { name?: string; duration?: string }

export type DeviceActionResult =
  | { status: 'ok'; devices: Device[] }
  | { status: 'invalid'; fieldErrors: DeviceFieldErrors }
  | { status: 'duplicate_name'; devices: Device[] }
  | { status: 'limit_reached'; devices: Device[] }
  | { status: 'not_found'; devices: Device[] }
  | { status: 'unauthorized' }
  | { status: 'error' }

/** A start window: `start` = start of its first slot, `end` = start + n × 15 min, both UTC ISO strings. */
export type StartWindow = { start: string; end: string; avgEurMwh: number }

export type Recommendation =
  | { kind: 'prices_unavailable' } // today's prices have status 'error' (AC-23)
  | { kind: 'not_enough_prices' } // duration longer than the known range (AC-18, EC-6)
  | { kind: 'price_gaps' } // fits, but every window contains a slot without price (EC-14)
  | {
      kind: 'recommendation'
      best: StartWindow
      startsNow: boolean // best window starts in the current slot (AC-17)
      immediateAvgEurMwh: number | null // average of the window starting now; null if that window has a gap (EC-14)
      tomorrowMissing: boolean // tomorrow's status is not 'ok' (AC-19)
    }

// User-facing messages, shown verbatim.
export const DEVICE_MESSAGES = {
  nameRequired: 'Bitte gib einen Namen ein.',
  nameTooLong: 'Der Name darf höchstens 40 Zeichen lang sein.',
  durationRange: 'Die Laufzeit muss zwischen 0:15 und 12:00 h liegen, in 15-Minuten-Schritten.',
  duplicateName: 'Du hast schon ein Gerät mit diesem Namen.',
  limitReached:
    'Du hast die Höchstzahl von 20 Geräten erreicht. Lösche ein Gerät, um ein neues anzulegen.',
  notFound: 'Dieses Gerät gibt es nicht mehr.',
  failed: 'Das hat nicht geklappt. Bitte versuche es erneut.',
  saved: 'Gerät gespeichert',
  deleted: 'Gerät gelöscht',
} as const
