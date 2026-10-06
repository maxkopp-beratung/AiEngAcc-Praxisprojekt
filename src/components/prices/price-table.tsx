"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { slotLabel } from "@/lib/prices/berlin-time";
import {
  cheapestIndex,
  currentSlotIndex,
  formatCtKwh,
  mostExpensiveIndex,
  rangeStartIndex,
} from "@/lib/prices/price-math";
import type { Slot } from "@/lib/prices/types";

type PriceTableProps = { slots: Slot[]; mode: "today" | "day"; now: Date };

// Accessible table view of a day's prices (AC-16): collapsed by default, one row per 15-minute slot.
// Cheapest / most expensive are marked in words, never by colour alone (design system rule).
// In the today view they are computed from the current slot on, like the key figures.
export function PriceTable({ slots, mode, now }: PriceTableProps) {
  const [open, setOpen] = useState(false);

  const from = rangeStartIndex(slots, now, mode);
  const cheapest = cheapestIndex(slots, from);
  const expensive = mostExpensiveIndex(slots, from);
  const current = mode === "today" ? currentSlotIndex(slots, now) : -1;

  function hints(i: number): string[] {
    const list: string[] = [];
    if (i === current) list.push("jetzt");
    if (i === cheapest) list.push("günstigster Zeitpunkt");
    if (i === expensive) list.push("teuerster Zeitpunkt");
    return list;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost">
          {open ? "Tabelle ausblenden" : "Als Tabelle anzeigen"}
          <ChevronDown
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table className="mt-2">
          <TableCaption className="sr-only">Strompreise je 15 Minuten in ct/kWh</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="h-10 px-2">Zeitraum</TableHead>
              <TableHead className="h-10 px-2 text-right">Preis</TableHead>
              <TableHead className="h-10 px-2">Hinweis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.map((slot, i) => (
              <TableRow key={slot.start}>
                <TableCell className="whitespace-nowrap px-2 py-2 tabular-nums">{slotLabel(slot.start)}</TableCell>
                <TableCell className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                  {slot.priceEurMwh === null ? (
                    <span className="text-muted-foreground">keine Daten</span>
                  ) : (
                    formatCtKwh(slot.priceEurMwh)
                  )}
                </TableCell>
                <TableCell className="px-2 py-2">{hints(i).join(", ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
}
