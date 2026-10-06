import 'server-only'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// First entry of x-forwarded-for, then x-real-ip, else "unknown". Locally every request comes
// from the same address, so all local logins share the IP counter (documented in design.md).
export function clientIpFrom(headerList: Pick<Headers, 'get'>): string {
  const forwarded = headerList.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const realIp = headerList.get('x-real-ip')?.trim()
  return realIp || 'unknown'
}

export async function getClientIp(): Promise<string> {
  return clientIpFrom(await headers())
}
