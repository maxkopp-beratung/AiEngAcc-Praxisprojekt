// Validation for PROJ-3 device input — server actions (create/update/delete) and the device dialog.
// Messages are shown to the user verbatim (see DEVICE_MESSAGES).
import { z } from 'zod'
import {
  DEVICE_MESSAGES,
  DURATION_MAX_MINUTES,
  DURATION_MIN_MINUTES,
  DURATION_STEP_MINUTES,
  NAME_MAX_LENGTH,
  type DeviceFieldErrors,
} from './types'

const asText = (value: unknown) => (typeof value === 'string' ? value : '')

// NFC first, so 'a' + combining umlaut and 'ä' are the same name (duplicate check), then trim.
export function normalizeDeviceName(value: string): string {
  return value.normalize('NFC').trim()
}

// Postgres char_length counts code points; JS .length would count an emoji as 2.
export function codePointLength(value: string): number {
  return Array.from(value).length
}

const isValidDuration = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= DURATION_MIN_MINUTES &&
  value <= DURATION_MAX_MINUTES &&
  value % DURATION_STEP_MINUTES === 0

// Name rules on an already normalized string: required, at most 40 code points.
const normalizedNameSchema = z
  .string()
  .min(1, DEVICE_MESSAGES.nameRequired)
  .refine((value) => codePointLength(value) <= NAME_MAX_LENGTH, {
    message: DEVICE_MESSAGES.nameTooLong,
  })

// Server: any input, non-strings count as empty. Output is the normalized name.
export const deviceNameSchema = z.preprocess(
  (value) => normalizeDeviceName(asText(value)),
  normalizedNameSchema
)

// Server: 15–720 minutes in 15-minute steps; anything else (string, NaN, fraction) is rejected.
export const durationMinutesSchema = z
  .unknown()
  .refine(isValidDuration, { message: DEVICE_MESSAGES.durationRange })
  .transform((value) => value as number)

export const deviceInputSchema = z.object({
  name: deviceNameSchema,
  durationMinutes: durationMinutesSchema,
})

export const deviceIdSchema = z.uuid()

export function toDurationMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes
}

export function fromDurationMinutes(total: number): { hours: number; minutes: number } {
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

// 150 → '2:30' (callers append ' h').
export function formatDuration(minutes: number): string {
  const { hours, minutes: rest } = fromDurationMinutes(minutes)
  return `${hours}:${String(rest).padStart(2, '0')}`
}

const FORM_MINUTES = [0, 15, 30, 45]

// Dialog form: name plus two selects. Every duration problem lands on path ['duration'].
export const deviceFormSchema = z
  .object({
    name: z.string().transform(normalizeDeviceName).pipe(normalizedNameSchema),
    hours: z.number(),
    minutes: z.number(),
  })
  .superRefine((value, ctx) => {
    const { hours, minutes } = value
    const validParts =
      Number.isInteger(hours) && hours >= 0 && hours <= 12 && FORM_MINUTES.includes(minutes)
    if (!validParts || !isValidDuration(toDurationMinutes(hours, minutes))) {
      ctx.addIssue({ code: 'custom', path: ['duration'], message: DEVICE_MESSAGES.durationRange })
    }
  })

export type DeviceFormValues = z.input<typeof deviceFormSchema>

const DURATION_PATHS = new Set(['durationMinutes', 'duration', 'hours', 'minutes'])

// First message per field wins.
export function fieldErrorsFromZod(error: z.ZodError): DeviceFieldErrors {
  const result: DeviceFieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '')
    const field = key === 'name' ? 'name' : DURATION_PATHS.has(key) ? 'duration' : null
    if (field && !result[field]) result[field] = issue.message
  }
  return result
}
