// Only internal paths are allowed as a post-login destination (EC-12): exactly one leading "/",
// no "//" or "/\" (protocol-relative URLs to foreign hosts), no control characters.
export function safeRedirectPath(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string' || next.length === 0) return fallback
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback
  return next
}
