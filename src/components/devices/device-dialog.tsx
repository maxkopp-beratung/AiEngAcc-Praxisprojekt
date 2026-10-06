"use client";

import { useId, useRef, useState, type JSX, type RefObject } from "react";
import { useForm, type FieldErrors, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import type { z } from "zod";
import { deviceFormSchema, fromDurationMinutes, toDurationMinutes, type DeviceFormValues } from "@/lib/devices/schemas";
import type { DeviceFieldErrors } from "@/lib/devices/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DeviceDialogValues = { name: string; durationMinutes: number };

export type DeviceDialogOutcome = { ok: true } | { ok: false; fieldErrors?: DeviceFieldErrors; formError?: string };

type DeviceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  /** Prefill: a preset (create) or the existing device (edit); null = empty name, 1:00 h. */
  initialValues: DeviceDialogValues | null;
  /** Called with validated, normalized values; the parent calls the server action and closes the dialog on success. */
  onSubmit: (values: DeviceDialogValues) => Promise<DeviceDialogOutcome>;
};

type DeviceFormOutput = z.output<typeof deviceFormSchema>;

const HOURS = Array.from({ length: 13 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];
const DEFAULT_DURATION_MINUTES = 60;

// The schema reports every duration problem on path ['duration'] — not a form field of its own.
const DURATION_KEY = "duration" as FieldPath<DeviceFormValues>;

function toFormValues(initialValues: DeviceDialogValues | null): DeviceFormValues {
  const { hours, minutes } = fromDurationMinutes(initialValues?.durationMinutes ?? DEFAULT_DURATION_MINUTES);
  return { name: initialValues?.name ?? "", hours, minutes };
}

// "Gerät hinzufügen" / "Gerät bearbeiten" (AC-4–8, AC-11, AC-24, EC-7).
export function DeviceDialog({ open, onOpenChange, mode, initialValues, onSubmit }: DeviceDialogProps): JSX.Element {
  // A fresh form for every opening, so it always starts from initialValues.
  const [formKey, setFormKey] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFormKey((key) => key + 1);
  }

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameInputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Gerät hinzufügen" : "Gerät bearbeiten"}</DialogTitle>
          <DialogDescription>Name und Laufzeit des Geräts.</DialogDescription>
        </DialogHeader>
        <DeviceForm
          key={formKey}
          initialValues={initialValues}
          nameInputRef={nameInputRef}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

type DeviceFormProps = {
  initialValues: DeviceDialogValues | null;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onSubmit: (values: DeviceDialogValues) => Promise<DeviceDialogOutcome>;
};

function DeviceForm({ initialValues, nameInputRef, onCancel, onSubmit }: DeviceFormProps) {
  const form = useForm<DeviceFormValues, unknown, DeviceFormOutput>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: toFormValues(initialValues),
  });
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Guards against a second submit before the disabled button has rendered (EC-7).
  const submittingRef = useRef(false);

  const hoursId = useId();
  const minutesId = useId();
  const durationErrorId = useId();
  const durationError = (form.formState.errors as FieldErrors<DeviceFormValues> & { duration?: { message?: string } })
    .duration?.message;

  async function handleValid(values: DeviceFormOutput) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    try {
      const outcome = await onSubmit({
        name: values.name,
        durationMinutes: toDurationMinutes(values.hours, values.minutes),
      });
      if (outcome.ok) return;
      if (outcome.fieldErrors?.name) form.setError("name", { type: "server", message: outcome.fieldErrors.name });
      if (outcome.fieldErrors?.duration) {
        form.setError(DURATION_KEY, { type: "server", message: outcome.fieldErrors.duration });
      }
      if (outcome.formError) setFormError(outcome.formError);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          if (submittingRef.current) {
            event.preventDefault();
            return;
          }
          setFormError(null);
          void form.handleSubmit(handleValid)(event);
        }}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  ref={(element) => {
                    field.ref(element);
                    nameInputRef.current = element;
                  }}
                  autoComplete="off"
                  className="h-10"
                />
              </FormControl>
              <FormDescription>Höchstens 40 Zeichen</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none">Laufzeit</legend>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label htmlFor={hoursId} className="text-xs text-muted-foreground">
                    Stunden
                  </Label>
                  <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger
                      id={hoursId}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={!!durationError}
                      aria-describedby={durationError ? durationErrorId : undefined}
                      className="tabular-nums"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour} value={String(hour)} className="tabular-nums">
                          {String(hour)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            <FormField
              control={form.control}
              name="minutes"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label htmlFor={minutesId} className="text-xs text-muted-foreground">
                    Minuten
                  </Label>
                  <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger
                      id={minutesId}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={!!durationError}
                      aria-describedby={durationError ? durationErrorId : undefined}
                      className="tabular-nums"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINUTES.map((minute) => (
                        <SelectItem key={minute} value={String(minute)} className="tabular-nums">
                          {String(minute).padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          </div>
          {durationError ? (
            <p id={durationErrorId} className="text-sm font-medium text-destructive">
              {durationError}
            </p>
          ) : null}
        </fieldset>

        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="h-10" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button type="submit" className="h-10" disabled={pending} aria-busy={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Speichern
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
