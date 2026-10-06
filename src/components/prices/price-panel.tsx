"use client";

import { useEffect, useState } from "react";
import { KeyFigures } from "@/components/prices/key-figures";
import { PriceChart } from "@/components/prices/price-chart";
import { PriceFooter } from "@/components/prices/price-footer";
import { PricesErrorState, TomorrowEmptyState } from "@/components/prices/price-states";
import { PriceTable } from "@/components/prices/price-table";
import { useLivePricesContext } from "@/components/prices/live-prices-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PricesPayload, Slot } from "@/lib/prices/types";

type Mode = "today" | "day";

function DayView({ slots, mode, now }: { slots: Slot[]; mode: Mode; now: Date }) {
  return (
    <div className="space-y-6">
      <KeyFigures slots={slots} mode={mode} now={now} />
      <PriceChart slots={slots} mode={mode} now={now} />
      <PriceTable slots={slots} mode={mode} now={now} />
    </div>
  );
}

// The "Strompreise" section on the dashboard (PROJ-2). Hands its server-rendered payload to the page's
// LivePricesProvider (PROJ-3), which keeps it current in the browser; until that lands it shows `initial`
// directly, so nothing flickers. Both days are in the payload, so switching tabs never loads (EC-10).
export function PricePanel({ initial }: { initial: PricesPayload }) {
  const { payload: shared, now, retry, retrying, handover } = useLivePricesContext();
  // Only the first handover counts, so later renders or StrictMode's double effect change nothing.
  useEffect(() => handover(initial), [handover, initial]);
  const payload = shared ?? initial;
  // Controlled, so the chosen tab survives the automatic updates; not persisted, a reload starts on "Heute" (AC-1).
  const [tab, setTab] = useState("today");
  const { today, tomorrow } = payload;

  return (
    <section aria-labelledby="prices-heading" className="space-y-4">
      {today.status === "ok" ? (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="prices-heading" className="text-lg font-semibold">
              Strompreise
            </h2>
            <TabsList>
              <TabsTrigger value="today">Heute</TabsTrigger>
              <TabsTrigger value="tomorrow">Morgen</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="today" className="mt-0">
            <DayView slots={today.slots} mode="today" now={now} />
          </TabsContent>
          <TabsContent value="tomorrow" className="mt-0">
            {tomorrow.status === "ok" ? (
              <DayView slots={tomorrow.slots} mode="day" now={now} />
            ) : (
              <TomorrowEmptyState />
            )}
          </TabsContent>
          <PriceFooter />
        </Tabs>
      ) : (
        // Today could not be loaded and nothing is cached (AC-23, EC-5): the error replaces the tabs.
        <>
          <h2 id="prices-heading" className="text-lg font-semibold">
            Strompreise
          </h2>
          <PricesErrorState onRetry={() => void retry()} retrying={retrying} />
        </>
      )}
    </section>
  );
}
