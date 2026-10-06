import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { createClient } from "@/lib/supabase/server";
import { hasResetCookieFor } from "@/lib/auth/reset-cookie";

export const metadata: Metadata = { title: "Neues Passwort – WattWann" };

// Only reachable with the session a valid reset link created (AC-20, AC-21).
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await hasResetCookieFor(user.id))) redirect("/auth/link-invalid?typ=reset");

  return (
    <AuthCard title="Neues Passwort setzen" description="Wähle ein neues Passwort für dein Konto.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
