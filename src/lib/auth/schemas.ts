// Server-side input validation for every PROJ-1 form (AC-2, EC-7, EC-10).
// Messages are shown to the user verbatim, under the field they belong to.
import { z } from 'zod'

// FormData.get() returns null for a missing field — treat it as an empty string.
const asText = (value: unknown) => (typeof value === 'string' ? value : '')

const byteLength = (value: string) => new TextEncoder().encode(value).length

export const PASSWORD_TOO_LONG = 'Das Passwort darf höchstens 72 Zeichen lang sein.'

export const emailSchema = z.preprocess(
  asText,
  z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Bitte gib deine E-Mail-Adresse ein.')
    .pipe(z.email('Bitte gib eine gültige E-Mail-Adresse ein.'))
)

// New passwords: 8–72 characters, and at most 72 bytes (the hashing limit; umlauts count twice).
export const newPasswordSchema = z.preprocess(
  asText,
  z
    .string()
    .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.')
    .max(72, PASSWORD_TOO_LONG)
    .refine((value) => byteLength(value) <= 72, {
      message: 'Das Passwort ist zu lang (Umlaute und Sonderzeichen zählen doppelt).',
    })
)

// Login: no minimum length, so the message reveals nothing about the rules.
export const loginPasswordSchema = z.preprocess(
  asText,
  z.string().min(1, 'Bitte gib dein Passwort ein.').max(72, PASSWORD_TOO_LONG)
)

// Optional display name: trimmed, empty means "no name" (null), at most 50 characters.
export const displayNameSchema = z.preprocess(
  asText,
  z
    .string()
    .trim()
    .max(50, 'Der Anzeigename darf höchstens 50 Zeichen lang sein.')
    .transform((value) => (value === '' ? null : value))
)

export const signupSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  displayName: displayNameSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
  next: z.preprocess(asText, z.string()),
})

export const emailOnlySchema = z.object({ email: emailSchema })

export const newPasswordFormSchema = z.object({ password: newPasswordSchema })

export const displayNameFormSchema = z.object({ displayName: displayNameSchema })

export type FieldErrors = Partial<Record<string, string>>

// First message per field, keyed by field name.
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!result[key]) result[key] = issue.message
  }
  return result
}

export function formDataToObject(formData: FormData, fields: readonly string[]) {
  return Object.fromEntries(fields.map((field) => [field, formData.get(field)]))
}
