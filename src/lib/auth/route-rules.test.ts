import { decideRoute } from './route-rules'

describe('decideRoute', () => {
  it('sends / to the dashboard or the login (AC-14)', () => {
    expect(decideRoute('/', '', true)).toEqual({ type: 'redirect', location: '/dashboard' })
    expect(decideRoute('/', '', false)).toEqual({ type: 'redirect', location: '/login' })
  })

  it('protects the dashboard and remembers where to return (AC-13)', () => {
    expect(decideRoute('/dashboard', '', false)).toEqual({
      type: 'redirect',
      location: '/login?next=%2Fdashboard',
    })
    expect(decideRoute('/dashboard/x', '?a=1', false)).toEqual({
      type: 'redirect',
      location: '/login?next=%2Fdashboard%2Fx%3Fa%3D1',
    })
    expect(decideRoute('/dashboard', '', true)).toEqual({ type: 'next' })
  })

  it('keeps logged-in users away from login and signup (AC-15)', () => {
    expect(decideRoute('/login', '', true)).toEqual({ type: 'redirect', location: '/dashboard' })
    expect(decideRoute('/signup', '', true)).toEqual({ type: 'redirect', location: '/dashboard' })
    expect(decideRoute('/login', '', false)).toEqual({ type: 'next' })
    expect(decideRoute('/signup', '', false)).toEqual({ type: 'next' })
  })

  it('leaves public pages alone', () => {
    for (const path of ['/datenschutz', '/forgot-password', '/auth/confirm', '/dashboards']) {
      expect(decideRoute(path, '', false)).toEqual({ type: 'next' })
    }
  })
})
