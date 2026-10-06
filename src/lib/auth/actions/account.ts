'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { displayNameFormSchema, toFieldErrors } from '@/lib/auth/schemas'
import { type ActionState, MESSAGES, textValue } from '@/lib/auth/action-state'

// Change the display name (AC-18, EC-10). Own profile only: filtered by the verified user id here,
// and enforced by RLS plus the column grant in the database.
export async function updateDisplayName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { displayName: textValue(formData.get('displayName')) }
  const parsed = displayNameFormSchema.safeParse({ displayName: formData.get('displayName') })
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error), values }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName })
    .eq('id', user.id)
  if (error) {
    return { status: 'error', code: 'connection', message: MESSAGES.connection, values }
  }

  revalidatePath('/dashboard', 'layout')
  return {
    status: 'success',
    message: parsed.data.displayName ? 'Anzeigename gespeichert.' : 'Anzeigename entfernt.',
    values: { displayName: parsed.data.displayName ?? '' },
  }
}

// Delete the account (AC-25, EC-6, EC-11). The id comes from the verified session, never from the form.
// Deleting the auth user cascades to the profile (and later to the devices of PROJ-3).
export async function deleteAccount(_prev: ActionState): Promise<ActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) {
    return {
      status: 'error',
      code: 'connection',
      message: 'Dein Konto konnte gerade nicht gelöscht werden. Bitte versuche es erneut.',
    }
  }

  // The user no longer exists; signOut still clears the session cookies on this device.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login?konto=geloescht')
}
