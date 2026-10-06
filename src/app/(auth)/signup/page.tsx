import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Registrieren – WattWann" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Konto anlegen"
      description="Speichere deine Geräte und sieh, wann Strom am günstigsten ist."
      footer={
        <p>
          Schon ein Konto?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Anmelden
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
