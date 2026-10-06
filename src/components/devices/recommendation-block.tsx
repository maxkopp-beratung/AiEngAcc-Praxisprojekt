import { Clock } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { RecommendationText } from "@/lib/devices/recommendation-text";

type RecommendationBlockProps = {
  /** null while prices are not there yet → skeleton lines. */
  text: RecommendationText | null;
};

// The recommendation area of a device card (design.md → RecommendationBlock): exactly one state.
// Renders the ready-made texts from recommendation-text.ts; nothing is computed here.
// aria-live="polite" so a change at a slot switch is announced without interrupting.
export function RecommendationBlock({ text }: RecommendationBlockProps) {
  return (
    <div
      className="rounded-md bg-primary-subtle p-4 text-sm text-foreground"
      aria-live="polite"
      aria-busy={text === null ? true : undefined}
    >
      {text === null ? (
        <div data-testid="recommendation-skeleton" className="space-y-2">
          <span className="sr-only">Empfehlung wird berechnet</span>
          <Skeleton className="h-4 w-4/5 bg-background/70" />
          <Skeleton className="h-4 w-3/5 bg-background/70" />
        </div>
      ) : text.kind === "notice" ? (
        <p>{text.text}</p>
      ) : (
        <div className="space-y-1">
          <p className="flex items-start gap-2 font-semibold tabular-nums text-primary-subtle-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{text.headline}</span>
          </p>
          {text.detail !== null ? <p className="tabular-nums">{text.detail}</p> : null}
          {text.tomorrowHint !== null ? <p className="text-muted-foreground">{text.tomorrowHint}</p> : null}
        </div>
      )}
    </div>
  );
}
