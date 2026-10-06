import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Passwort vergessen – WattWann" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Passwort vergessen?"
      description="Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst. Der Link gilt 1 Stunde."
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
