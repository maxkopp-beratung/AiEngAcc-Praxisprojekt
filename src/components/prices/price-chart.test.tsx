import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { berlinDaySlotStarts } from "@/lib/prices/berlin-time";
import type { Slot } from "@/lib/prices/types";
import {
  CHART_LABEL,
  NOW_FILL,
  PAST_FILL,
  PAST_OPACITY,
  PriceChart,
  TIER_FILL,
  buildChartRows,
  placeMarkers,
  tooltipText,
  xTicks,
} from "./price-chart";

function daySlots(date: string, price: (i: number) => number | null): Slot[] {
  return berlinDaySlotStarts(date).map((start, i) => ({ start, priceEurMwh: price(i) }));
}

// 2026-10-07 is a normal day (96 slots); 2026-10-25 has 100 slots, 2026-03-29 has 92.
const NORMAL = "2026-10-07";
const minutesAfterSlot = (slots: Slot[], i: number, min: number) =>
  new Date(Date.parse(slots[i].start) + min * 60 * 1000);

describe("buildChartRows", () => {
  it("colours each bar by its tier and converts EUR/MWh to ct/kWh (AC-6, AC-7)", () => {
    const slots = daySlots(NORMAL, (i) => i * 10 - 100);
    const rows = buildChartRows(slots, "day", new Date(Date.parse(slots[0].start) - 86_400_000));
    expect(rows).toHaveLength(96);
    expect(rows[0]).toMatchObject({ value: -10, tier: "cheap", fill: TIER_FILL.cheap, fillOpacity: 1 });
    expect(rows[48]).toMatchObject({ tier: "mid", fill: TIER_FILL.mid });
    expect(rows[95]).toMatchObject({ value: 85, tier: "expensive", fill: TIER_FILL.expensive });
  });

  it("mode 'day' marks the whole day's extremes, without now or past (AC-12)", () => {
    const slots = daySlots(NORMAL, (i) => (i === 30 ? -50 : i === 70 ? 300 : 100));
    // "now" in the middle of that day must not matter in mode "day".
    const rows = buildChartRows(slots, "day", minutesAfterSlot(slots, 50, 5));
    expect(rows.filter((r) => r.isNow || r.isPast)).toHaveLength(0);
    expect(rows.findIndex((r) => r.isCheapest)).toBe(30);
    expect(rows.findIndex((r) => r.isMostExpensive)).toBe(70);
  });

  it("mode 'today' greys out past slots, marks the current one, extremes only from now on (AC-8, AC-11)", () => {
    const slots = daySlots(NORMAL, (i) => (i === 10 ? -50 : i === 20 ? 900 : i === 60 ? 5 : i === 80 ? 400 : 100));
    const now = minutesAfterSlot(slots, 40, 5);
    const rows = buildChartRows(slots, "today", now);

    expect(rows.slice(0, 40).every((r) => r.isPast && r.fill === PAST_FILL && r.fillOpacity === PAST_OPACITY)).toBe(true);
    expect(rows[40]).toMatchObject({ isNow: true, isPast: false, fill: NOW_FILL, fillOpacity: 1 });
    expect(rows.slice(41).some((r) => r.isPast || r.isNow)).toBe(false);
    expect(rows[41].fill).not.toBe(PAST_FILL);
    // Past slot 10 (cheapest of the day) and 20 (most expensive) are ignored.
    expect(rows.findIndex((r) => r.isCheapest)).toBe(60);
    expect(rows.findIndex((r) => r.isMostExpensive)).toBe(80);
  });

  it("a slot that ended exactly at now is past, the one starting at now is current", () => {
    const slots = daySlots(NORMAL, () => 100);
    const rows = buildChartRows(slots, "today", new Date(slots[12].start));
    expect(rows[11].isPast).toBe(true);
    expect(rows[12]).toMatchObject({ isNow: true, isPast: false });
  });

  it("all prices equal: cheapest and most expensive are the same slot (EC-3, EC-6)", () => {
    const slots = daySlots(NORMAL, () => 100);
    const rows = buildChartRows(slots, "today", minutesAfterSlot(slots, 5, 1));
    const marked = rows.filter((r) => r.isCheapest || r.isMostExpensive);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toMatchObject({ index: 5, isCheapest: true, isMostExpensive: true, isNow: true });
    expect(rows[6].fill).toBe(TIER_FILL.mid);
  });

  it("missing prices stay in the data without a value; markers skip them (EC-4)", () => {
    const slots = daySlots(NORMAL, (i) => (i === 3 ? null : i === 4 ? -1 : 50));
    const rows = buildChartRows(slots, "day", new Date(0));
    expect(rows).toHaveLength(96);
    expect(rows[3]).toMatchObject({ value: null, tier: null, priceEurMwh: null });
    expect(rows[3].isCheapest || rows[3].isMostExpensive).toBe(false);
    expect(rows.findIndex((r) => r.isCheapest)).toBe(4);
  });
});

describe("xTicks", () => {
  it("labels every 3 hours, every 6 on narrow screens (AC-3)", () => {
    const rows = buildChartRows(daySlots(NORMAL, () => 1), "day", new Date(0));
    const ticks = xTicks(rows, 3);
    expect(ticks).toEqual([0, 12, 24, 36, 48, 60, 72, 84]);
    expect(ticks.map((i) => rows[i].hour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
    expect(xTicks(rows, 6).map((i) => rows[i].hour)).toEqual([0, 6, 12, 18]);
  });

  it("uses German hours on the 100-slot day: 03:00 is slot 16, hour 2 only once (EC-2, AC-18)", () => {
    const rows = buildChartRows(daySlots("2026-10-25", () => 1), "day", new Date(0));
    expect(rows).toHaveLength(100);
    const ticks = xTicks(rows, 3);
    expect(ticks.map((i) => rows[i].hour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
    expect(ticks[1]).toBe(16);
    expect(rows.filter((r) => r.hour === 2)).toHaveLength(1);
  });

  it("uses German hours on the 92-slot day: 03:00 is slot 8 (EC-1)", () => {
    const rows = buildChartRows(daySlots("2026-03-29", () => 1), "day", new Date(0));
    expect(rows).toHaveLength(92);
    const ticks = xTicks(rows, 3);
    expect(ticks.map((i) => rows[i].hour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
    expect(ticks[1]).toBe(8);
  });
});

describe("tooltipText", () => {
  it("shows period and price, or 'keine Daten' (AC-5, EC-4)", () => {
    const slots = daySlots(NORMAL, (i) => (i === 53 ? 84.4 : i === 54 ? -5 : null));
    const rows = buildChartRows(slots, "day", new Date(0));
    expect(tooltipText(rows[53])).toBe("13:15–13:30 · 8,4 ct/kWh");
    expect(tooltipText(rows[54])).toBe("13:30–13:45 · −0,5 ct/kWh");
    expect(tooltipText(rows[55])).toBe("13:45–14:00 · keine Daten");
  });

  it("names MESZ/MEZ for the doubled hour on the 100-slot day (EC-2)", () => {
    const rows = buildChartRows(daySlots("2026-10-25", () => 100), "day", new Date(0));
    expect(tooltipText(rows[8])).toBe("02:00–02:15 MESZ · 10,0 ct/kWh");
    expect(tooltipText(rows[12])).toBe("02:00–02:15 MEZ · 10,0 ct/kWh");
  });
});

describe("placeMarkers", () => {
  it("stacks labels of the same slot above each other (EC-3)", () => {
    const placed = placeMarkers(
      [
        { kind: "cheapest", index: 5, cx: 100, top: 80 },
        { kind: "mostExpensive", index: 5, cx: 100, top: 80 },
      ],
      0,
      400,
    );
    expect(placed[0].y).toBe(76);
    expect(placed[1].y).toBe(76 - 14);
  });

  it("keeps labels apart on distant slots and inside the plot", () => {
    const placed = placeMarkers(
      [
        { kind: "cheapest", index: 0, cx: 2, top: 80 },
        { kind: "mostExpensive", index: 95, cx: 398, top: 40 },
      ],
      30,
      400,
    );
    expect(placed[0]).toMatchObject({ x: 30, y: 76 });
    expect(placed[1].y).toBe(36);
    expect(placed[1].x + placed[1].width).toBeLessThanOrEqual(400);
  });
});

describe("PriceChart", () => {
  // jsdom has no layout: give the chart container a size and a ResizeObserver so Recharts renders.
  const originalRect = Element.prototype.getBoundingClientRect;
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.getBoundingClientRect = () =>
      ({ width: 600, height: 256, top: 0, left: 0, right: 600, bottom: 256, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    Element.prototype.getBoundingClientRect = originalRect;
  });

  it("legend in words for 'Heute' incl. jetzt and vorbei (AC-7, AC-11)", () => {
    const slots = daySlots(NORMAL, (i) => i);
    render(<PriceChart slots={slots} mode="today" now={minutesAfterSlot(slots, 40, 1)} />);
    const legend = screen.getByRole("list");
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "günstig",
      "mittel",
      "teuer",
      "jetzt",
      "vorbei",
    ]);
  });

  it("legend for 'Morgen' has only the three tiers (AC-12)", () => {
    const slots = daySlots(NORMAL, (i) => i);
    render(<PriceChart slots={slots} mode="day" now={new Date(0)} />);
    const legend = screen.getByRole("list");
    expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "günstig",
      "mittel",
      "teuer",
    ]);
  });

  it("is one keyboard stop with an accessible name, and labels the markers (AC-5, AC-8)", () => {
    const slots = daySlots(NORMAL, (i) => (i === 60 ? -20 : i === 80 ? 500 : 100));
    const { container } = render(
      <PriceChart slots={slots} mode="today" now={minutesAfterSlot(slots, 40, 1)} />,
    );
    const surface = screen.getByLabelText(CHART_LABEL);
    expect(surface.tagName.toLowerCase()).toBe("svg");
    expect(surface).toHaveAttribute("tabindex", "0");
    expect(container.querySelectorAll("[tabindex='0']")).toHaveLength(1);
    const markers = container.querySelector(".price-chart-markers");
    expect(markers?.textContent).toContain("jetzt");
    expect(markers?.textContent).toContain("günstigst");
    expect(markers?.textContent).toContain("teuerst");
    expect(markers?.querySelectorAll("svg")).toHaveLength(2);
  });
});
