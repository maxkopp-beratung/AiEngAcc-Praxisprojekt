import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Clock, Sigma, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { startTimeLabel } from "@/lib/prices/berlin-time";
import {
  cheapestIndex,
  currentSlotIndex,
  dayAverage,
  formatCtKwh,
  mostExpensiveIndex,
  rangeStartIndex,
  tiers,
} from "@/lib/prices/price-math";
import type { PriceTier, Slot } from "@/lib/prices/types";
import { cn } from "@/lib/utils";

type KeyFiguresProps = { slots: Slot[]; mode: "today" | "day"; now: Date };

const NO_PRICE = "Kein Preis verfügbar";

const TIER_WORD: Record<PriceTier, string> = { cheap: "günstig", mid: "mittel", expensive: "teuer" };
const TIER_CLASS: Record<PriceTier, string> = {
  cheap: "text-primary",
  mid: "text-muted-foreground",
  expensive: "text-price-expensive",
};

type Accent = "neutral" | "cheap" | "expensive";
const ACCENT_CLASS: Record<Accent, string> = {
  neutral: "bg-muted text-muted-foreground",
  cheap: "bg-primary-subtle text-primary-subtle-foreground",
  expensive: "bg-price-expensive-subtle text-price-expensive",
};

type FigureProps = {
  title: string;
  icon: LucideIcon;
  accent: Accent;
  /** EUR/MWh; null → "Kein Preis verfügbar" (EC-4). */
  price: number | null;
  /** Line under the price (time of the slot, tier, …); omitted when nothing to say. */
  detail?: ReactNode;
};

// One card: heading (dt), big price and a detail line (dd). Color is never the only signal (design system):
// every card carries its title in words plus an icon.
function Figure({ title, icon: Icon, accent, price, detail }: FigureProps) {
  return (
    <Card className="p-5 shadow-none">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", ACCENT_CLASS[accent])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {title}
      </dt>
      {price === null ? (
        <dd className="mt-3 text-base font-medium text-muted-foreground">{NO_PRICE}</dd>
      ) : (
        <dd className="mt-3 text-2xl font-semibold tabular-nums">{formatCtKwh(price)}</dd>
      )}
      {detail ? <dd className="mt-1 text-sm text-muted-foreground tabular-nums">{detail}</dd> : null}
    </Card>
  );
}

function slotFigure(slots: Slot[], index: number | null) {
  if (index === null) return { price: null, detail: undefined };
  const slot = slots[index];
  return { price: slot.priceEurMwh, detail: startTimeLabel(slot.start) };
}

// The three key figures of the price section (design.md → KeyFigures).
// "today" (AC-10): current slot with its tier, cheapest and most expensive from the current slot on.
// "day" (AC-12): day average, cheapest and most expensive over the whole day.
export function KeyFigures({ slots, mode, now }: KeyFiguresProps) {
  const from = rangeStartIndex(slots, now, mode);
  const cheapest = slotFigure(slots, cheapestIndex(slots, from));
  const expensive = slotFigure(slots, mostExpensiveIndex(slots, from));
  const suffix = mode === "today" ? " ab jetzt" : "";

  let first: FigureProps;
  if (mode === "today") {
    const index = currentSlotIndex(slots, now);
    const slot = index === -1 ? null : slots[index];
    const tier = slot === null ? null : tiers(slots)[index];
    first = {
      title: "Jetzt",
      icon: Clock,
      accent: "neutral",
      price: slot?.priceEurMwh ?? null,
      detail: slot ? (
        <>
          {startTimeLabel(slot.start)}
          {tier ? (
            <>
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, Stufe </span>
              <span className={cn("font-medium", TIER_CLASS[tier])}>{TIER_WORD[tier]}</span>
            </>
          ) : null}
        </>
      ) : undefined,
    };
  } else {
    const average = dayAverage(slots);
    first = {
      title: "Ø Tagesdurchschnitt",
      icon: Sigma,
      accent: "neutral",
      price: average,
      detail: average === null ? undefined : "über den ganzen Tag",
    };
  }

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      <Figure {...first} />
      <Figure title={`Günstigster${suffix}`} icon={ArrowDown} accent="cheap" {...cheapest} />
      <Figure title={`Teuerster${suffix}`} icon={ArrowUp} accent="expensive" {...expensive} />
    </dl>
  );
}
