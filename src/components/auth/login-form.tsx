"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/lib/auth/actions/login";
import { initialActionState } from "@/lib/auth/action-state";
import { FormAlert, FormField, SubmitButton } from "@/components/auth/form-parts";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(login, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
        autoComplete="current-password"
        error={errors.password}
        required
      />
      <div className="text-sm">
        <Link
          href="/forgot-password"
          className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Passwort vergessen?
        </Link>
      </div>

      {state.status === "error" && state.message ? (
        <FormAlert tone="error">
          {state.message}
          {state.code === "unconfirmed" ? (
            <>
              {" "}
              <Link href="/signup/check-email" className="font-medium underline underline-offset-4">
                Bestätigungslink erneut senden
              </Link>
            </>
          ) : null}
        </FormAlert>
      ) : null}

      <SubmitButton pendingLabel="Wird angemeldet …">
        {state.code === "connection" ? "Erneut versuchen" : "Anmelden"}
      </SubmitButton>
    </form>
  );
}
