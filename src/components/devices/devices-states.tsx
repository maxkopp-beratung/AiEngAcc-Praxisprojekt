import { Info, Plug, Plus, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/devices/schemas";
import { DEVICE_MESSAGES } from "@/lib/devices/types";

export type DevicePreset = { name: string; durationMinutes: number };

// The three suggestions of the empty state (AC-3, AC-4), in this order.
export const DEVICE_PRESETS: DevicePreset[] = [
  { name: "Waschmaschine", durationMinutes: 150 },
  { name: "Spülmaschine", durationMinutes: 180 },
  { name: "E-Auto", durationMinutes: 240 },
];

type DevicesEmptyStateProps = {
  onAdd: () => void;
  onPreset: (preset: DevicePreset) => void;
};

// No devices yet (AC-3). Design system → Leerzustand: dashed card, icon, heading, one sentence,
// primary action. The presets open the add dialog pre-filled (AC-4) – the parent does that.
export function DevicesEmptyState({ onAdd, onPreset }: DevicesEmptyStateProps) {
  return (
    <Card className="flex flex-col items-center border-dashed px-6 py-10 text-center shadow-none">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Plug className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold">Noch keine Geräte</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Noch keine Geräte. Lege dein erstes Gerät an, um zu sehen, wann es am günstigsten läuft.
      </p>
      <Button type="button" className="mt-6" onClick={onAdd}>
        <Plus aria-hidden="true" />
        Gerät hinzufügen
      </Button>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {DEVICE_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            type="button"
            variant="outline"
            onClick={() => onPreset(preset)}
          >
            {`${preset.name} · ${formatDuration(preset.durationMinutes)} h`}
          </Button>
        ))}
      </div>
    </Card>
  );
}

// 20 devices reached (AC-9): neutral notice, the parent disables "Gerät hinzufügen".
export function DeviceLimitNotice() {
  return (
    <Alert>
      <Info className="size-4" aria-hidden="true" />
      <AlertDescription>{DEVICE_MESSAGES.limitReached}</AlertDescription>
    </Alert>
  );
}

type DevicesLoadErrorProps = { onRetry: () => void };

// Devices could not be loaded. Design system → Fehlerzustand: destructive Alert, short text and
// a button "Erneut versuchen". role="alert" comes from the Alert.
export function DevicesLoadError({ onRetry }: DevicesLoadErrorProps) {
  return (
    <Alert variant="destructive">
      <TriangleAlert className="size-4" aria-hidden="true" />
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>Deine Geräte konnten gerade nicht geladen werden.</p>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 text-foreground"
          onClick={onRetry}
        >
          Erneut versuchen
        </Button>
      </AlertDescription>
    </Alert>
  );
}
