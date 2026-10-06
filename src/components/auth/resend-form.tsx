"use client";

import { useActionState } from "react";
import { resendConfirmation } from "@/lib/auth/actions/resend";
import { initialActionState } from "@/lib/auth/action-state";
import { FormAlert, FormField, SubmitButton } from "@/components/auth/form-parts";

// New confirmation link from /auth/link-invalid (EC-2, EC-3): the address is typed in,
// the answer is neutral.
export function ResendForm() {
  const [state, formAction] = useActionState(resendConfirmation, initialActionState);

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
      <SubmitButton pendingLabel="Wird gesendet …">Neuen Link anfordern</SubmitButton>
    </form>
  );
}
