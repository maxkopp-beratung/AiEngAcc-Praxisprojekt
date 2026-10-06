"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/lib/auth/actions/signup";
import { initialActionState } from "@/lib/auth/action-state";
import { FormAlert, FormField, SubmitButton } from "@/components/auth/form-parts";

export function SignupForm() {
  const [state, formAction] = useActionState(signup, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormField
        name="email"
        label="E-Mail-Adresse"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={errors.email}
        required
      />
      <FormField
        name="password"
        label="Passwort"
        type="password"
        autoComplete="new-password"
        hint="Mindestens 8 Zeichen."
        error={errors.password}
        required
      />
      <FormField
        name="displayName"
        label="Anzeigename (optional)"
        autoComplete="nickname"
        hint="So sprechen wir dich in der App an. Höchstens 50 Zeichen."
        defaultValue={state.values?.displayName}
        error={errors.displayName}
      />

      {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}

      <p className="text-sm text-muted-foreground">
        Mit der Registrierung gelten unsere{" "}
        <Link href="/datenschutz" className="font-medium text-primary underline-offset-4 hover:underline">
          Datenschutzhinweise
        </Link>
        .
      </p>
      <SubmitButton pendingLabel="Wird registriert …">
        {state.code === "connection" || state.code === "mail" ? "Erneut versuchen" : "Registrieren"}
      </SubmitButton>
    </form>
  );
}
