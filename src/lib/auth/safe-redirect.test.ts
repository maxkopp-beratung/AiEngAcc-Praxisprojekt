import { safeRedirectPath } from './safe-redirect'

describe('safeRedirectPath (EC-12)', () => {
  it('keeps internal paths', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard')
    expect(safeRedirectPath('/dashboard?tab=1')).toBe('/dashboard?tab=1')
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'evil.example',
    'javascript:alert(1)',
    '/dash\nboard',
    '',
    null,
    undefined,
    42,
  ])('falls back to /dashboard for %s', (value) => {
    expect(safeRedirectPath(value)).toBe('/dashboard')
  })
})
