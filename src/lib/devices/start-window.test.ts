import {
  berlinDaySlotStarts,
  berlinDayStart,
  startTimeLabel,
} from "@/lib/prices/berlin-time";
import type { DayPrices, PricesPayload } from "@/lib/prices/types";
import { recommendStartWindow } from "./start-window";

const TODAY = "2026-10-06"; // CEST, 96 slots
const TOMORROW = "2026-10-07";
const SLOT_MS = 15 * 60 * 1000;

/** Slot index of a Berlin wall-clock time on a 96-slot day. */
function idx(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h * 60 + m) / 15;
}

/** Berlin wall-clock time on a 96-slot day as an instant. */
function at(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(berlinDayStart(date).getTime() + (h * 60 + m) * 60 * 1000);
}

/** A published day: every slot `base`, with single slots overridden by index. */
function day(
  date: string,
  overrides: Record<number, number | null> = {},
  base = 100,
): DayPrices {
  const slots = berlinDaySlotStarts(date).map((start, i) => ({
    start,
    priceEurMwh: i in overrides ? overrides[i] : base,
  }));
  return { date, status: "ok", slots };
}

function payload(today: DayPrices, tomorrow?: DayPrices): PricesPayload {
  return {
    generatedAt: "2026-10-06T06:00:00.000Z",
    today,
    tomorrow: tomorrow ?? { date: TOMORROW, status: "not_published" },
  };
}

function startOf(date: string, i: number): string {
  return berlinDaySlotStarts(date)[i];
}

function expectRecommendation(r: ReturnType<typeof recommendStartWindow>) {
  if (r.kind !== "recommendation")
    throw new Error(`expected recommendation, got ${r.kind}`);
  return r;
}

describe("recommendStartWindow", () => {
  describe("best window (AC-14, AC-17)", () => {
    const tie = payload(
      day(TODAY, {
        [idx("13:00")]: 10,
        [idx("13:15")]: 10,
        [idx("15:00")]: 10,
        [idx("15:15")]: 10,
      }),
    );

    it("picks the earliest of two equally cheap windows; best later than now", () => {
      const r = expectRecommendation(
        recommendStartWindow(tie, at(TODAY, "08:00"), 30),
      );
      expect(r.best).toEqual({
        start: startOf(TODAY, idx("13:00")),
        end: startOf(TODAY, idx("13:30")),
        avgEurMwh: 10,
      });
      expect(r.startsNow).toBe(false);
      expect(r.immediateAvgEurMwh).toBe(100);
    });

    it("startsNow when the best window starts in the current slot", () => {
      const r = expectRecommendation(
        recommendStartWindow(tie, at(TODAY, "13:00"), 30),
      );
      expect(r.best.start).toBe(startOf(TODAY, idx("13:00")));
      expect(r.startsNow).toBe(true);
      expect(r.immediateAvgEurMwh).toBe(10);
    });

    it('"now" in the middle of a slot uses that slot as the current slot (13:07 → 13:00)', () => {
      const now = new Date(at(TODAY, "13:00").getTime() + 7 * 60 * 1000);
      const r = expectRecommendation(
        recommendStartWindow(payload(day(TODAY)), now, 60),
      );
      expect(r.best.start).toBe(startOf(TODAY, idx("13:00")));
      expect(r.startsNow).toBe(true);
    });

    it("ignores windows that start before the current slot (AC-13)", () => {
      const r = expectRecommendation(
        recommendStartWindow(tie, at(TODAY, "14:00"), 30),
      );
      expect(r.best.start).toBe(startOf(TODAY, idx("15:00")));
    });

    it("handles negative prices", () => {
      const p = payload(
        day(TODAY, { [idx("13:00")]: -20.5, [idx("13:15")]: -10 }, 5),
      );
      const r = expectRecommendation(
        recommendStartWindow(p, at(TODAY, "08:00"), 30),
      );
      expect(r.best.start).toBe(startOf(TODAY, idx("13:00")));
      expect(r.best.avgEurMwh).toBe(-15.25);
      expect(r.immediateAvgEurMwh).toBe(5);
    });

    it("float noise does not break a tie: 0.01 + 0.14 equals 0.15 + 0 → earliest", () => {
      // In floats 0.01 + 0.14 > 0.15 (also ×100), so a float comparison would pick 15:00.
      expect(0.01 + 0.14).toBeGreaterThan(0.15);
      const p = payload(
        day(
          TODAY,
          {
            [idx("13:00")]: 0.01,
            [idx("13:15")]: 0.14,
            [idx("15:00")]: 0.15,
            [idx("15:15")]: 0,
          },
          0.3,
        ), // small base price: large values would absorb the noise of a float sum
      );
      const r = expectRecommendation(
        recommendStartWindow(p, at(TODAY, "08:00"), 30),
      );
      expect(r.best.start).toBe(startOf(TODAY, idx("13:00")));
      expect(r.best.avgEurMwh).toBeCloseTo(0.075, 10);
    });
  });

  describe("length of the known range (AC-18, EC-5, EC-6)", () => {
    it("duration equal to the remaining range → recommendation that starts now (EC-5)", () => {
      const r = expectRecommendation(
        recommendStartWindow(payload(day(TODAY)), at(TODAY, "22:00"), 120),
      );
      expect(r.startsNow).toBe(true);
      expect(r.best.end).toBe(berlinDayStart(TOMORROW).toISOString());
    });

    it("duration one slot longer than the remaining range → not_enough_prices", () => {
      expect(
        recommendStartWindow(payload(day(TODAY)), at(TODAY, "22:00"), 135),
      ).toEqual({
        kind: "not_enough_prices",
      });
    });

    it("last slot 23:45 without tomorrow: 15 min fits, 30 min does not (EC-6)", () => {
      const now = at(TODAY, "23:50");
      const r = expectRecommendation(
        recommendStartWindow(payload(day(TODAY)), now, 15),
      );
      expect(r.startsNow).toBe(true);
      expect(r.best.start).toBe(startOf(TODAY, idx("23:45")));
      expect(recommendStartWindow(payload(day(TODAY)), now, 30)).toEqual({
        kind: "not_enough_prices",
      });
    });

    it("after the end of today without tomorrow → not_enough_prices", () => {
      const now = berlinDayStart(TOMORROW);
      expect(recommendStartWindow(payload(day(TODAY)), now, 15)).toEqual({
        kind: "not_enough_prices",
      });
    });
  });

  describe("tomorrow (AC-13, AC-19)", () => {
    it("picks a window that crosses midnight into tomorrow", () => {
      const p = payload(
        day(TODAY, { [idx("23:45")]: 0 }),
        day(TOMORROW, { 0: 0 }),
      );
      const r = expectRecommendation(
        recommendStartWindow(p, at(TODAY, "20:00"), 30),
      );
      expect(r.best).toEqual({
        start: startOf(TODAY, idx("23:45")),
        end: startOf(TOMORROW, 1),
        avgEurMwh: 0,
      });
      expect(r.tomorrowMissing).toBe(false);
    });

    it("tomorrow not published → tomorrowMissing true", () => {
      const r = expectRecommendation(
        recommendStartWindow(payload(day(TODAY)), at(TODAY, "08:00"), 60),
      );
      expect(r.tomorrowMissing).toBe(true);
    });

    it("today error → prices_unavailable (AC-23)", () => {
      const p: PricesPayload = {
        generatedAt: "2026-10-06T06:00:00.000Z",
        today: { date: TODAY, status: "error" },
        tomorrow: day(TOMORROW),
      };
      expect(recommendStartWindow(p, at(TODAY, "08:00"), 60)).toEqual({
        kind: "prices_unavailable",
      });
    });
  });

  describe("DST days (EC-1, EC-2)", () => {
    it("spring-forward 2026-03-29: 150 min from 01:30 ends at 05:00 German time", () => {
      const date = "2026-03-29";
      const starts = berlinDaySlotStarts(date);
      expect(starts).toHaveLength(92);
      // 01:30 CET = 00:30Z = index 6; 10 slots of 15 min = 150 min.
      const cheap: Record<number, number> = {};
      for (let i = 6; i < 16; i++) cheap[i] = 0;
      const p = payload(day(date, cheap), {
        date: "2026-03-30",
        status: "not_published",
      });
      const r = expectRecommendation(
        recommendStartWindow(p, berlinDayStart(date), 150),
      );
      expect(r.best.start).toBe("2026-03-29T00:30:00.000Z");
      expect(startTimeLabel(r.best.start)).toBe("01:30 Uhr");
      expect(Date.parse(r.best.end) - Date.parse(r.best.start)).toBe(
        150 * 60 * 1000,
      );
      expect(startTimeLabel(r.best.end)).toBe("05:00 Uhr");
    });

    it("fall-back 2026-10-25 (100 slots): window at the end of the day", () => {
      const date = "2026-10-25";
      const starts = berlinDaySlotStarts(date);
      expect(starts).toHaveLength(100);
      const p = payload(day(date, { 96: 0, 97: 0, 98: 0, 99: 0 }), {
        date: "2026-10-26",
        status: "not_published",
      });
      const r = expectRecommendation(
        recommendStartWindow(p, berlinDayStart(date), 60),
      );
      expect(r.best.start).toBe(starts[96]);
      expect(r.best.end).toBe(berlinDayStart("2026-10-26").toISOString());
      expect(Date.parse(r.best.end) - Date.parse(r.best.start)).toBe(
        4 * SLOT_MS,
      );
    });
  });

  describe("slots without price (EC-14)", () => {
    it("skips every window that contains a null, even in the cheapest region", () => {
      const p = payload(
        day(TODAY, {
          [idx("13:00")]: 0,
          [idx("13:15")]: null,
          [idx("13:30")]: 0,
          [idx("15:00")]: 20,
          [idx("15:15")]: 20,
        }),
      );
      // Neighbours 12:45–13:00 and 13:30–13:45 average 50; both null-free windows lose to 20.
      const r = expectRecommendation(
        recommendStartWindow(p, at(TODAY, "08:00"), 30),
      );
      expect(r.best.start).toBe(startOf(TODAY, idx("15:00")));
      expect(r.best.avgEurMwh).toBe(20);
    });

    it("null in the current slot → no immediate average and not startsNow", () => {
      const p = payload(
        day(TODAY, { [idx("13:00")]: null, [idx("13:15")]: 0 }),
      );
      const r = expectRecommendation(
        recommendStartWindow(p, at(TODAY, "13:00"), 30),
      );
      expect(r.immediateAvgEurMwh).toBeNull();
      expect(r.startsNow).toBe(false);
      expect(r.best.start).toBe(startOf(TODAY, idx("13:15")));
      expect(r.best.avgEurMwh).toBe(50);
    });

    it("every window contains a null → price_gaps, not not_enough_prices", () => {
      const overrides: Record<number, null> = {};
      for (let i = 0; i < 96; i += 2) overrides[i] = null;
      const p = payload(day(TODAY, overrides));
      expect(recommendStartWindow(p, at(TODAY, "08:00"), 30)).toEqual({
        kind: "price_gaps",
      });
    });

    it("a single remaining slot without price → price_gaps", () => {
      const p = payload(day(TODAY, { [idx("23:45")]: null }));
      expect(recommendStartWindow(p, at(TODAY, "23:45"), 15)).toEqual({
        kind: "price_gaps",
      });
    });

    it("null at the very end of the range: the window touching it is skipped", () => {
      const p = payload(day(TODAY), day(TOMORROW, { 94: 0, 95: null }));
      const r = expectRecommendation(
        recommendStartWindow(p, at(TODAY, "08:00"), 30),
      );
      expect(r.best.start).toBe(startOf(TOMORROW, 93));
      expect(r.best.avgEurMwh).toBe(50);
    });
  });

  it("does not depend on the process time zone", () => {
    const p = payload(day(TODAY, { [idx("13:00")]: 10, [idx("13:15")]: 10 }));
    const now = at(TODAY, "08:00");
    const expected = recommendStartWindow(p, now, 30);
    const original = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(recommendStartWindow(p, now, 30)).toEqual(expected);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
