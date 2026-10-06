import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendForm } from "@/components/auth/resend-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link ungültig – WattWann" };

// Shown for expired or already used mail links (AC-21, EC-2, EC-3). Supabase cannot tell
// "used" from "expired", so the page offers both ways out.
export default async function LinkInvalidPage({
  searchParams,
}: {
  searchParams: Promise<{ typ?: string }>;
}) {
  const { typ } = await searchParams;
  const isReset = typ === "reset";

  if (isReset) {
    return (
      <AuthCard
        title="Dieser Link ist ungültig oder abgelaufen"
        description="Links zum Zurücksetzen des Passworts gelten 1 Stunde und nur einmal. Fordere einfach einen neuen an."
      >
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Neues Passwort anfordern</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Anmelden</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Dieser Link ist ungültig oder abgelaufen"
      description="Hast du deine Adresse schon bestätigt? Dann melde dich einfach an. Sonst fordere hier einen neuen Bestätigungslink an."
    >
      <div className="space-y-6">
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Anmelden</Link>
        </Button>
        <ResendForm />
      </div>
    </AuthCard>
  );
}
