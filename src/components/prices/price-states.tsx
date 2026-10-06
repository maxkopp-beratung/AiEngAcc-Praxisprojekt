import { CalendarClock, Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Tab "Morgen" before tomorrow's prices are published (AC-13). A normal empty state, not an error
// (design system → Leerzustand: dashed card, icon, heading, one sentence).
export function TomorrowEmptyState() {
  return (
    <Card className="flex flex-col items-center border-dashed px-6 py-10 text-center shadow-none">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarClock className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold">Noch keine Preise für morgen</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Die Preise für morgen sind noch nicht veröffentlicht. Sie erscheinen meist ab ca. 13 Uhr.
      </p>
    </Card>
  );
}

type PricesErrorStateProps = { onRetry: () => void; retrying: boolean };

// Today's prices could not be loaded (AC-23). Design system → Fehlerzustand: destructive Alert,
// short text and a button "Erneut versuchen". role="alert" comes from the Alert.
export function PricesErrorState({ onRetry, retrying }: PricesErrorStateProps) {
  return (
    <Alert variant="destructive">
      <TriangleAlert className="size-4" aria-hidden="true" />
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>Die Strompreise konnten gerade nicht geladen werden.</p>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 text-foreground"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Wird geladen …
            </>
          ) : (
            "Erneut versuchen"
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
