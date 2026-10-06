"use client";

import { useActionState, useEffect, useState } from "react";
import { resendConfirmation } from "@/lib/auth/actions/resend";
import { type ActionState, initialActionState } from "@/lib/auth/action-state";
import { FormAlert, SubmitButton } from "@/components/auth/form-parts";

const COOLDOWN_MS = 60_000;

type ResendState = ActionState & { cooldownUntil?: number };

// After each send (or a server-side cooldown) the button waits 60 seconds.
async function resendWithCooldown(prev: ResendState, formData: FormData): Promise<ResendState> {
  const result = await resendConfirmation(prev, formData);
  const startsCooldown = result.status === "success" || result.code === "cooldown";
  return { ...result, cooldownUntil: startsCooldown ? Date.now() + COOLDOWN_MS : undefined };
}

// "Link erneut senden" on /signup/check-email (AC-5). The address comes from the pending_email
// cookie on the server.
export function ResendButton() {
  const [state, formAction] = useActionState<ResendState, FormData>(resendWithCooldown, initialActionState);
  const [now, setNow] = useState(() => Date.now());
  const until = state.cooldownUntil ?? 0;

  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);

  const secondsLeft = Math.min(60, Math.max(0, Math.ceil((until - now) / 1000)));

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>
      ) : null}
      <fieldset disabled={secondsLeft > 0} className="contents">
        <SubmitButton variant="outline" pendingLabel="Wird gesendet …">
          {secondsLeft > 0 ? (
            <span className="tabular-nums">Link erneut senden ({secondsLeft} s)</span>
          ) : (
            "Link erneut senden"
          )}
        </SubmitButton>
      </fieldset>
    </form>
  );
}
