import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { FormAlert } from "@/components/auth/form-parts";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Anmelden – WattWann" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; konto?: string }>;
}) {
  const { next, konto } = await searchParams;

  return (
    <AuthCard
      title="Anmelden"
      description="Melde dich an, um deine Geräte und Startfenster zu sehen."
      footer={
        <p>
          Noch kein Konto?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Registrieren
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        {konto === "geloescht" ? <FormAlert tone="success">Dein Konto wurde gelöscht.</FormAlert> : null}
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </AuthCard>
  );
}
