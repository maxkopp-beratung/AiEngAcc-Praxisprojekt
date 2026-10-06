// Endpoint for the links in the confirmation and reset mails (AC-4, AC-20, AC-21, EC-2, EC-3, EC-9).
// The mail templates point here with ?token_hash=…&type=signup|recovery.
import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setResetCookie } from '@/lib/auth/reset-cookie'

const RESET_LINK_MAX_AGE_MS = 60 * 60 * 1000 // the reset link is valid for 1 hour (AC-20/AC-21)

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const isRecovery = type === 'recovery'
  const supabase = await createClient()

  if (tokenHash && (type === 'signup' || type === 'email' || isRecovery)) {
    const { data, error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash })

    if (!error && data.user) {
      if (!isRecovery) redirect('/dashboard') // AC-4: confirmed and signed in

      // Supabase has one expiry for all mail links (24 h); the reset link gets its own hour here.
      const sentAt = data.user.recovery_sent_at ? Date.parse(data.user.recovery_sent_at) : Number.NaN
      if (!Number.isFinite(sentAt) || Date.now() - sentAt > RESET_LINK_MAX_AGE_MS) {
        await supabase.auth.signOut({ scope: 'local' })
        redirect('/auth/link-invalid?typ=reset') // AC-21
      }
      await setResetCookie(data.user.id)
      redirect('/reset-password') // AC-20, EC-9 (verifying also confirms the address)
    }
  }

  // Invalid, expired or already used. Supabase cannot tell "used" from "expired" (EC-2, EC-3).
  if (!isRecovery) {
    const { data } = await supabase.auth.getClaims()
    if (data?.claims?.sub) redirect('/dashboard') // EC-2: already signed in
  }
  redirect(`/auth/link-invalid?typ=${isRecovery ? 'reset' : 'signup'}`)
}
