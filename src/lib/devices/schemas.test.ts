import { z } from 'zod'
import {
  codePointLength,
  deviceFormSchema,
  deviceIdSchema,
  deviceInputSchema,
  deviceNameSchema,
  durationMinutesSchema,
  fieldErrorsFromZod,
  formatDuration,
  fromDurationMinutes,
  normalizeDeviceName,
  toDurationMinutes,
} from './schemas'
import { DEVICE_MESSAGES } from './types'

const nameError = (value: unknown) => {
  const result = deviceNameSchema.safeParse(value)
  return result.success ? null : result.error.issues[0].message
}

describe('deviceNameSchema', () => {
  it('trims leading and trailing spaces', () => {
    expect(deviceNameSchema.parse(' Waschmaschine ')).toBe('Waschmaschine')
  })

  it('rejects a name of only spaces', () => {
    expect(nameError('    ')).toBe(DEVICE_MESSAGES.nameRequired)
  })

  it('treats a non-string as empty', () => {
    expect(nameError(null)).toBe(DEVICE_MESSAGES.nameRequired)
    expect(nameError(42)).toBe(DEVICE_MESSAGES.nameRequired)
  })

  it('accepts exactly 40 characters and rejects 41', () => {
    expect(deviceNameSchema.parse('a'.repeat(40))).toBe('a'.repeat(40))
    expect(nameError('a'.repeat(41))).toBe(DEVICE_MESSAGES.nameTooLong)
  })

  it('counts code points, not UTF-16 units: 40 emojis ok, 41 rejected', () => {
    const forty = '🔌'.repeat(40)
    expect(forty.length).toBe(80)
    expect(codePointLength(forty)).toBe(40)
    expect(deviceNameSchema.parse(forty)).toBe(forty)
    expect(nameError('🔌'.repeat(41))).toBe(DEVICE_MESSAGES.nameTooLong)
  })

  it('normalizes to NFC (decomposed ä becomes one code point)', () => {
    const decomposed = 'ä'
    expect(codePointLength(decomposed)).toBe(2)
    const normalized = normalizeDeviceName(decomposed)
    expect(normalized).toBe('ä')
    expect(codePointLength(normalized)).toBe(1)
    expect(deviceNameSchema.parse(` K${decomposed}ltegerät `)).toBe('K\u00e4ltegerät')
  })

  it('passes HTML through unchanged (escaped on output, not stripped)', () => {
    expect(deviceNameSchema.parse('<b>Trockner</b>')).toBe('<b>Trockner</b>')
  })
})

describe('durationMinutesSchema', () => {
  it.each([15, 30, 150, 720])('accepts %s', (value) => {
    expect(durationMinutesSchema.parse(value)).toBe(value)
  })

  it.each([0, 14, 25, 30.5, 735, '60', Number.NaN, null, undefined])('rejects %s', (value) => {
    const result = durationMinutesSchema.safeParse(value)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(DEVICE_MESSAGES.durationRange)
  })
})

describe('deviceInputSchema', () => {
  it('returns the normalized name and the duration', () => {
    expect(deviceInputSchema.parse({ name: ' Spülmaschine ', durationMinutes: 120 })).toEqual({
      name: 'Spülmaschine',
      durationMinutes: 120,
    })
  })

  it('reports both fields', () => {
    const result = deviceInputSchema.safeParse({ name: '', durationMinutes: 0 })
    expect(result.success).toBe(false)
    expect(fieldErrorsFromZod(result.error!)).toEqual({
      name: DEVICE_MESSAGES.nameRequired,
      duration: DEVICE_MESSAGES.durationRange,
    })
  })
})

describe('deviceFormSchema', () => {
  const formErrors = (values: unknown) => {
    const result = deviceFormSchema.safeParse(values)
    return result.success ? {} : fieldErrorsFromZod(result.error)
  }

  it('accepts 2:30 and normalizes the name', () => {
    const result = deviceFormSchema.safeParse({ name: ' E-Auto ', hours: 2, minutes: 30 })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ name: 'E-Auto', hours: 2, minutes: 30 })
  })

  it('rejects 0:00 on path duration', () => {
    const result = deviceFormSchema.safeParse({ name: 'Trockner', hours: 0, minutes: 0 })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0].path).toEqual(['duration'])
    expect(result.error!.issues[0].message).toBe(DEVICE_MESSAGES.durationRange)
  })

  it('rejects 12:15', () => {
    expect(formErrors({ name: 'Trockner', hours: 12, minutes: 15 })).toEqual({
      duration: DEVICE_MESSAGES.durationRange,
    })
  })

  it('rejects hours and minutes outside their own ranges', () => {
    expect(formErrors({ name: 'Trockner', hours: 13, minutes: 0 })).toEqual({
      duration: DEVICE_MESSAGES.durationRange,
    })
    expect(formErrors({ name: 'Trockner', hours: 1, minutes: 10 })).toEqual({
      duration: DEVICE_MESSAGES.durationRange,
    })
    expect(formErrors({ name: 'Trockner', hours: -1, minutes: 30 })).toEqual({
      duration: DEVICE_MESSAGES.durationRange,
    })
  })

  it('reports name and duration errors together', () => {
    expect(formErrors({ name: '', hours: 0, minutes: 0 })).toEqual({
      name: DEVICE_MESSAGES.nameRequired,
      duration: DEVICE_MESSAGES.durationRange,
    })
  })

  it('validates the name like the server', () => {
    expect(formErrors({ name: '   ', hours: 1, minutes: 0 })).toEqual({
      name: DEVICE_MESSAGES.nameRequired,
    })
    expect(formErrors({ name: 'x'.repeat(41), hours: 1, minutes: 0 })).toEqual({
      name: DEVICE_MESSAGES.nameTooLong,
    })
  })
})

describe('duration helpers', () => {
  it.each([
    [150, '2:30'],
    [15, '0:15'],
    [60, '1:00'],
    [720, '12:00'],
  ])('formatDuration(%s) → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })

  it('round-trips every valid duration', () => {
    for (let total = 15; total <= 720; total += 15) {
      const { hours, minutes } = fromDurationMinutes(total)
      expect(toDurationMinutes(hours, minutes)).toBe(total)
    }
    expect(fromDurationMinutes(150)).toEqual({ hours: 2, minutes: 30 })
    expect(toDurationMinutes(12, 0)).toBe(720)
  })
})

describe('fieldErrorsFromZod', () => {
  it('maps name and all duration paths; first message per field wins', () => {
    const error = new z.ZodError([
      { code: 'custom', path: ['name'], message: 'first name' },
      { code: 'custom', path: ['name'], message: 'second name' },
      { code: 'custom', path: ['hours'], message: 'from hours' },
      { code: 'custom', path: ['duration'], message: 'from duration' },
      { code: 'custom', path: ['other'], message: 'ignored' },
    ])
    expect(fieldErrorsFromZod(error)).toEqual({ name: 'first name', duration: 'from hours' })
  })

  it.each(['durationMinutes', 'duration', 'hours', 'minutes'])('maps %s to duration', (key) => {
    const error = new z.ZodError([{ code: 'custom', path: [key], message: 'x' }])
    expect(fieldErrorsFromZod(error)).toEqual({ duration: 'x' })
  })
})

describe('deviceIdSchema', () => {
  it('accepts UUIDs of any version', () => {
    expect(deviceIdSchema.safeParse('3f2504e0-4f89-41d3-9a0c-0305e82c3301').success).toBe(true)
    expect(deviceIdSchema.safeParse('0190b8a0-7a3e-7c4d-8b2f-1a2b3c4d5e6f').success).toBe(true)
  })

  it.each(['', 'not-a-uuid', '3f2504e0-4f89-41d3-9a0c-0305e82c330', 42, null])(
    'rejects %s',
    (value) => {
      expect(deviceIdSchema.safeParse(value).success).toBe(false)
    }
  )
})
