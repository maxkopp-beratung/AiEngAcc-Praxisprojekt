// Shared shapes of PROJ-2 (design.md → Data Model). Used by the price service, /api/prices,
// the dashboard section and later PROJ-3.

/** One 15-minute slot. The end is always `start` + 15 minutes. */
export type Slot = {
  /** Start of the slot as a UTC instant (ISO 8601). */
  start: string;
  /** Price exactly as delivered by Energy-Charts (EUR/MWh, unrounded, may be negative); null when the source has no value (EC-4). */
  priceEurMwh: number | null;
};

/**
 * `ok` – prices are available.
 * `not_published` – not published yet (only ever for tomorrow, AC-13).
 * `error` – could not be loaded and is not cached (only ever for today, AC-23, EC-5).
 */
export type DayStatus = "ok" | "not_published" | "error";

export type DayPrices =
  | {
      /** Calendar day in German time, `YYYY-MM-DD`. */
      date: string;
      status: "ok";
      /** Every 15-minute slot of the day in German time, sorted: 96, or 92/100 on DST days (EC-1, EC-2). */
      slots: Slot[];
    }
  | { date: string; status: "not_published" | "error" };

export type PricesPayload = {
  /** UTC instant (ISO 8601) at which the payload was built. */
  generatedAt: string;
  today: DayPrices;
  tomorrow: DayPrices;
};

/** Price tier of a slot relative to its day (AC-7). */
export type PriceTier = "cheap" | "mid" | "expensive";
