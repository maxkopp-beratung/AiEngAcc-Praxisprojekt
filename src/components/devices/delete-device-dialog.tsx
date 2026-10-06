"use client";

import { useState, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

type DeleteDeviceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceName: string;
  /** Parent runs the delete action and closes the dialog itself; the dialog shows a pending state meanwhile. */
  onConfirm: () => Promise<void>;
};

// Confirmation before deleting a device (AC-12; design system: destructive actions only with
// confirmation). "Löschen" does not close the dialog on its own: it runs onConfirm and stays
// open, both buttons disabled, until the parent closes it – so a double click deletes once.
export function DeleteDeviceDialog({
  open,
  onOpenChange,
  deviceName,
  onConfirm,
}: DeleteDeviceDialogProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  function handleOpenChange(next: boolean) {
    // While the delete runs, Escape must not close the dialog either.
    if (pending) return;
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">{`„${deviceName}“ löschen?`}</AlertDialogTitle>
          <AlertDialogDescription>
            Das Gerät wird sofort und endgültig gelöscht.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
