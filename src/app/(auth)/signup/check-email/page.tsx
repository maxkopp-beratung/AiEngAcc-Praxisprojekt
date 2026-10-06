import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendButton } from "@/components/auth/resend-button";
import { getPendingEmail } from "@/lib/auth/pending-email";

export const metadata: Metadata = { title: "Prüfe dein Postfach – WattWann" };

export default async function CheckEmailPage() {
  const email = await getPendingEmail();
  if (!email) redirect("/signup");

  return (
    <AuthCard
      title="Prüfe dein Postfach"
      footer={
        <p>
          Adresse bestätigt?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Anmelden
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-dashed p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm">
            Wir haben einen Bestätigungslink an <strong className="break-all font-semibold">{email}</strong>{" "}
            geschickt. Klicke darauf, um deine Adresse zu bestätigen. Der Link gilt 24 Stunden.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Keine Mail bekommen? Schau auch im Spam-Ordner nach.</p>
        <ResendButton />
      </div>
    </AuthCard>
  );
}
