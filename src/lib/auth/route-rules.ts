// Redirect rules applied by src/proxy.ts (AC-13, AC-14, AC-15). Pure, so it can be tested
// without a request. The dashboard layout checks the session a second time on its own.
export type RouteDecision = { type: 'next' } | { type: 'redirect'; location: string }

const isDashboard = (pathname: string) => pathname === '/dashboard' || pathname.startsWith('/dashboard/')

export function decideRoute(pathname: string, search: string, isAuthenticated: boolean): RouteDecision {
  if (pathname === '/') {
    return { type: 'redirect', location: isAuthenticated ? '/dashboard' : '/login' }
  }
  if (isDashboard(pathname) && !isAuthenticated) {
    return { type: 'redirect', location: `/login?next=${encodeURIComponent(pathname + search)}` }
  }
  if ((pathname === '/login' || pathname === '/signup') && isAuthenticated) {
    return { type: 'redirect', location: '/dashboard' }
  }
  return { type: 'next' }
}
