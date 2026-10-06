"use client";

import * as React from "react";
import { type LivePrices, useLivePrices } from "@/hooks/use-live-prices";

const LivePricesContext = React.createContext<LivePrices | null>(null);

// Shared price state of the dashboard (PROJ-3 design.md → "Gemeinsamer Preis-Zustand im Browser"):
// one clock and one refetch loop per page, so "Strompreise" and "Meine Geräte" compute with the same
// payload and the same "now" (AC-20, AC-21). Starts empty; the price section hands over its server payload.
export function LivePricesProvider({ children }: { children: React.ReactNode }) {
  const { payload, now, retry, retrying, handover } = useLivePrices(null);
  const value = React.useMemo<LivePrices>(
    () => ({ payload, now, retry, retrying, handover }),
    [payload, now, retry, retrying, handover],
  );
  return <LivePricesContext.Provider value={value}>{children}</LivePricesContext.Provider>;
}

export function useLivePricesContext(): LivePrices {
  const context = React.useContext(LivePricesContext);
  if (!context) {
    throw new Error("useLivePricesContext must be used inside <LivePricesProvider>.");
  }
  return context;
}
