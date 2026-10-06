// Cross-check of recommendStartWindow against a naive brute-force reference (PRD: "Die Empfehlung
// ist nachweislich richtig"). Random but seeded, so a failure always reproduces with the same case.
import { berlinDaySlotStarts } from "@/lib/prices/berlin-time";
import type { PricesPayload } from "@/lib/prices/types";
import type { Recommendation } from "./types";
import { recommendStartWindow } from "./start-window";

const SLOT_MS = 15 * 60 * 1000;

/** mulberry32 — small deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Day = { starts: string[]; cents: (number | null)[] };

/**
 * Naive reference: tries every start slot one by one and sums the window from scratch.
 * Prices are generated as whole hundredths of EUR/MWh, so the integer sums here are exact
 * and do not depend on how the implementation rounds.
 */
function reference(
  today: Day | "error",
  tomorrow: Day | null,
  now: number,
  durationMinutes: number,
): Recommendation {
  if (today === "error") return { kind: "prices_unavailable" };
  const starts = [...today.starts, ...(tomorrow?.starts ?? [])];
  const cents = [...today.cents, ...(tomorrow?.cents ?? [])];

  let current = starts.length;
  for (let i = 0; i < starts.length; i++) {
    const s = Date.parse(starts[i]);
    if (s <= now && now < s + SLOT_MS) {
      current = i;
      break;
    }
    if (now < s) {
      current = i;
      break;
    }
  }

  const n = durationMinutes / 15;
  if (starts.length - current < n) return { kind: "not_enough_prices" };

  const windowSum = (from: number): number | null => {
    let sum = 0;
    for (let k = from; k < from + n; k++) {
      const c = cents[k];
      if (c === null) return null;
      sum += c;
    }
    return sum;
  };

  let best = -1;
  let bestSum = 0;
  for (let s = current; s + n <= starts.length; s++) {
    const sum = windowSum(s);
    if (sum === null) continue;
    if (best === -1 || sum < bestSum) {
      best = s;
      bestSum = sum;
    }
  }
  if (best === -1) return { kind: "price_gaps" };

  const immediate = windowSum(current);
  return {
    kind: "recommendation",
    best: {
      start: starts[best],
      end: new Date(Date.parse(starts[best]) + n * SLOT_MS).toISOString(),
      avgEurMwh: bestSum / 100 / n,
    },
    startsNow: best === current,
    immediateAvgEurMwh: immediate === null ? null : immediate / 100 / n,
    tomorrowMissing: tomorrow === null,
  };
}

function randomDay(date: string, next: () => number): Day {
  const starts = berlinDaySlotStarts(date);
  // Mix of price shapes: a narrow range forces many ties (AC-14), a wide one includes negatives (EC-3).
  const shape = next();
  const gapRate = next() < 0.3 ? next() * 0.15 : 0; // EC-14
  const cents = starts.map(() => {
    if (next() < gapRate) return null;
    if (shape < 0.35) return Math.floor(next() * 4) * 100; // 0, 1, 2, 3 EUR/MWh → many ties
    if (shape < 0.7) return Math.floor(next() * 35000) - 5000; // −50 … 300 EUR/MWh
    return Math.floor(next() * 2001) - 1000; // around zero
  });
  return { starts, cents };
}

function toPayload(today: Day | "error", tomorrow: Day | null, dates: [string, string]): PricesPayload {
  return {
    generatedAt: "2026-10-06T06:00:00.000Z",
    today:
      today === "error"
        ? { date: dates[0], status: "error" }
        : {
            date: dates[0],
            status: "ok",
            slots: today.starts.map((start, i) => ({
              start,
              priceEurMwh: today.cents[i] === null ? null : (today.cents[i] as number) / 100,
            })),
          },
    tomorrow:
      tomorrow === null
        ? { date: dates[1], status: "not_published" }
        : {
            date: dates[1],
            status: "ok",
            slots: tomorrow.starts.map((start, i) => ({
              start,
              priceEurMwh: tomorrow.cents[i] === null ? null : (tomorrow.cents[i] as number) / 100,
            })),
          },
  };
}

// Normal day, fall-back day (100 slots), spring-forward day (92 slots), and the days before both.
const DAY_PAIRS: Array<[string, string]> = [
  ["2026-10-06", "2026-10-07"],
  ["2026-10-25", "2026-10-26"],
  ["2026-03-29", "2026-03-30"],
  ["2026-10-24", "2026-10-25"],
  ["2026-03-28", "2026-03-29"],
];

describe("recommendStartWindow matches a brute-force reference", () => {
  for (const [index, dates] of DAY_PAIRS.entries()) {
    it(`agrees on 400 random cases for ${dates[0]} → ${dates[1]}`, () => {
      const next = rng(20261006 + index);
      const kinds = new Set<string>();
      for (let run = 0; run < 400; run++) {
        const today: Day | "error" = next() < 0.03 ? "error" : randomDay(dates[0], next);
        const tomorrow = next() < 0.5 ? randomDay(dates[1], next) : null;
        const todayStarts = berlinDaySlotStarts(dates[0]);
        const dayStart = Date.parse(todayStarts[0]);
        const dayLength = todayStarts.length * SLOT_MS;
        // Any millisecond of today, with extra weight on the last slot (EC-6).
        const now =
          next() < 0.1
            ? dayStart + dayLength - 1 - Math.floor(next() * SLOT_MS)
            : dayStart + Math.floor(next() * dayLength);
        const duration = (1 + Math.floor(next() * 48)) * 15; // 0:15 … 12:00 h

        const expected = reference(today, tomorrow, now, duration);
        const actual = recommendStartWindow(toPayload(today, tomorrow, dates), new Date(now), duration);
        kinds.add(expected.kind);
        expect(actual, `case ${run}: now=${new Date(now).toISOString()} duration=${duration}`).toEqual(
          expected,
        );
      }
      // The generator must actually reach the interesting outcomes, or the comparison proves little.
      expect(kinds).toContain("recommendation");
      expect(kinds).toContain("not_enough_prices");
    });
  }
});
