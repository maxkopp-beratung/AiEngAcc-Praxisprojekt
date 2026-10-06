"use client";

import { useActionState } from "react";
import { requestPasswordReset, updatePassword } from "@/lib/auth/actions/password";
import { initialActionState } from "@/lib/auth/action-state";
import { FormAlert, FormField, SubmitButton } from "@/components/auth/form-parts";

// "Passwort vergessen?" (AC-19): the answer is the same neutral message for every address.
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialActionState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormField
        name="email"
        label="E-Mail-Adresse"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        required
      />
      {state.message ? (
        <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>
      ) : null}
      <SubmitButton pendingLabel="Wird gesendet …">
        {state.status === "error" && state.message ? "Erneut versuchen" : "Link anfordern"}
      </SubmitButton>
    </form>
  );
}

// New password after a valid reset link (AC-20).
export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialActionState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormField
        name="password"
        label="Neues Passwort"
        type="password"
        autoComplete="new-password"
        hint="Mindestens 8 Zeichen."
        error={state.fieldErrors?.password}
        required
      />
      {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      <SubmitButton pendingLabel="Wird gespeichert …">
        {state.code === "connection" ? "Erneut versuchen" : "Passwort speichern"}
      </SubmitButton>
    </form>
  );
}
