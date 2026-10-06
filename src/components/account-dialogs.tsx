"use client";

import { useActionState, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { deleteAccount, updateDisplayName } from "@/lib/auth/actions/account";
import { initialActionState } from "@/lib/auth/action-state";
import { FormAlert, FormField, SubmitButton } from "@/components/auth/form-parts";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

// "Anzeigename ändern" (AC-18): empty field removes the name.
export function DisplayNameDialog({ open, onOpenChange, currentName }: DialogProps & { currentName: string | null }) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anzeigename ändern</DialogTitle>
          <DialogDescription>So spricht dich WattWann an. Lass das Feld leer, um den Namen zu entfernen.</DialogDescription>
        </DialogHeader>
        {/* Remount per opening, so the form starts from the saved name. */}
        {open ? <DisplayNameForm currentName={currentName} onDone={close} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DisplayNameForm({ currentName, onDone }: { currentName: string | null; onDone: () => void }) {
  const [state, formAction] = useActionState(updateDisplayName, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormField
        name="displayName"
        label="Anzeigename"
        autoComplete="nickname"
        hint="Höchstens 50 Zeichen."
        defaultValue={state.values?.displayName ?? currentName ?? ""}
        error={state.fieldErrors?.displayName}
      />
      {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      <DialogFooter>
        <SubmitButton pendingLabel="Wird gespeichert …" className="w-full sm:w-auto">
          Speichern
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

// "Konto löschen" (AC-25, EC-13): nothing happens until the user confirms here.
export function DeleteAccountDialog({ open, onOpenChange }: DialogProps) {
  const [state, formAction] = useActionState(deleteAccount, initialActionState);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Konto wirklich löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dein Konto und alle zugehörigen Daten werden sofort und endgültig gelöscht. Das lässt sich nicht
            rückgängig machen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                Abbrechen
              </Button>
            </AlertDialogCancel>
            <SubmitButton variant="destructive" pendingLabel="Wird gelöscht …" className="w-full sm:w-auto">
              Konto endgültig löschen
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// After a password reset the dashboard opens with ?hinweis=passwort-geaendert (AC-20).
export function PasswordChangedToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const changed = searchParams.get("hinweis") === "passwort-geaendert";

  useEffect(() => {
    if (!changed) return;
    toast.success("Dein Passwort wurde geändert.");
    router.replace(pathname);
  }, [changed, pathname, router]);

  return null;
}
