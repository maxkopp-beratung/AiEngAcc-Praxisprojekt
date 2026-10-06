import {
  displayNameFormSchema,
  emailOnlySchema,
  loginSchema,
  newPasswordFormSchema,
  signupSchema,
  toFieldErrors,
} from './schemas'

const errorsOf = (result: { success: boolean; error?: Parameters<typeof toFieldErrors>[0] }) =>
  result.success ? {} : toFieldErrors(result.error!)

describe('signupSchema', () => {
  it('accepts valid input and normalizes the email (EC-7)', () => {
    const result = signupSchema.safeParse({
      email: '  Max@Example.DE ',
      password: 'abcdefgh',
      displayName: '  Max  ',
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ email: 'max@example.de', password: 'abcdefgh', displayName: 'Max' })
  })

  it('reports every invalid field with its own message (AC-2)', () => {
    const errors = errorsOf(
      signupSchema.safeParse({ email: '', password: 'short', displayName: 'x'.repeat(51) })
    )
    expect(errors.email).toBe('Bitte gib deine E-Mail-Adresse ein.')
    expect(errors.password).toBe('Das Passwort muss mindestens 8 Zeichen lang sein.')
    expect(errors.displayName).toBe('Der Anzeigename darf höchstens 50 Zeichen lang sein.')
  })

  it('rejects a malformed email', () => {
    expect(errorsOf(signupSchema.safeParse({ email: 'max@', password: 'abcdefgh' })).email).toBe(
      'Bitte gib eine gültige E-Mail-Adresse ein.'
    )
  })

  it('treats missing fields (FormData null) as empty', () => {
    const errors = errorsOf(signupSchema.safeParse({ email: null, password: null, displayName: null }))
    expect(errors.email).toBeDefined()
    expect(errors.password).toBeDefined()
    expect(errors.displayName).toBeUndefined()
  })

  it('enforces 8–72 characters and at most 72 bytes', () => {
    expect(signupSchema.safeParse({ email: 'a@b.de', password: 'a'.repeat(72) }).success).toBe(true)
    expect(errorsOf(signupSchema.safeParse({ email: 'a@b.de', password: 'a'.repeat(73) })).password).toBe(
      'Das Passwort darf höchstens 72 Zeichen lang sein.'
    )
    // 40 umlauts = 40 characters but 80 bytes
    expect(signupSchema.safeParse({ email: 'a@b.de', password: 'ä'.repeat(40) }).success).toBe(false)
  })
})

describe('displayName (EC-10)', () => {
  it('turns whitespace-only into "no name"', () => {
    expect(displayNameFormSchema.parse({ displayName: '   ' })).toEqual({ displayName: null })
    expect(displayNameFormSchema.parse({ displayName: null })).toEqual({ displayName: null })
  })
  it('keeps markup as plain text (rendering escapes it)', () => {
    expect(displayNameFormSchema.parse({ displayName: '<b>Max</b>' })).toEqual({ displayName: '<b>Max</b>' })
  })
  it('allows exactly 50 characters', () => {
    expect(displayNameFormSchema.safeParse({ displayName: 'x'.repeat(50) }).success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('has no minimum password length', () => {
    expect(loginSchema.safeParse({ email: 'a@b.de', password: 'x', next: null }).success).toBe(true)
  })
  it('requires a password', () => {
    expect(errorsOf(loginSchema.safeParse({ email: 'a@b.de', password: '' })).password).toBe(
      'Bitte gib dein Passwort ein.'
    )
  })
})

describe('emailOnlySchema / newPasswordFormSchema', () => {
  it('validate their single field', () => {
    expect(emailOnlySchema.safeParse({ email: 'nope' }).success).toBe(false)
    expect(newPasswordFormSchema.safeParse({ password: '1234567' }).success).toBe(false)
    expect(newPasswordFormSchema.safeParse({ password: '12345678' }).success).toBe(true)
  })
})
