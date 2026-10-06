import { render, screen, within } from "@testing-library/react";
import { KeyFigures } from "@/components/prices/key-figures";
import type { Slot } from "@/lib/prices/types";

// Day 2026-10-06 in German time (CEST, UTC+2): 96 slots, slot i starts at 00:00 + i·15 min Berlin time.
const DAY_START_MS = Date.parse("2026-10-05T22:00:00Z");
const SLOT_MS = 15 * 60 * 1000;

/** 96 slots priced `base` EUR/MWh; `overrides` maps a slot index to its price (null = missing). */
function makeSlots(overrides: Record<number, number | null> = {}, base: number | null = 100): Slot[] {
  return Array.from({ length: 96 }, (_, i) => ({
    start: new Date(DAY_START_MS + i * SLOT_MS).toISOString(),
    priceEurMwh: i in overrides ? overrides[i] : base,
  }));
}

/** Berlin wall-clock time on 2026-10-06 as a Date (CEST = UTC+2). */
function berlin(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(DAY_START_MS + (h * 60 + m) * 60 * 1000);
}

/** The card whose heading (dt) is exactly `title`. */
function card(title: string): HTMLElement {
  const dt = screen.getByText(title, { selector: "dt" });
  return dt.parentElement as HTMLElement;
}

describe("KeyFigures – today (AC-10)", () => {
  // 12:05 → current slot 48 (12:00). Past slots: 02:30 cheapest (1,0) and 00:00 most expensive (50,0) of the day.
  // From now on: 13:15 is cheapest (8,4), 20:00 most expensive (31,2).
  const slots = makeSlots({ 0: 500, 10: 10, 48: 200, 53: 84, 80: 312 });
  const now = berlin("12:05");

  it("shows the three titles of the today view", () => {
    render(<KeyFigures slots={slots} mode="today" now={now} />);
    expect(screen.getByText("Jetzt", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Günstigster ab jetzt", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Teuerster ab jetzt", { selector: "dt" })).toBeInTheDocument();
    expect(screen.queryByText("Ø Tagesdurchschnitt")).not.toBeInTheDocument();
  });

  it("shows the current slot's price, time and tier in words (tiers over the whole day)", () => {
    render(<KeyFigures slots={slots} mode="today" now={now} />);
    const jetzt = card("Jetzt");
    expect(within(jetzt).getByText("20,0 ct/kWh")).toHaveClass("tabular-nums", "font-semibold");
    // min 10, max 500 → (200−10)/490 ≈ 0,39 → middle third.
    expect(jetzt).toHaveTextContent("12:00 Uhr");
    expect(within(jetzt).getByText("mittel")).toBeInTheDocument();
  });

  it("names the tier 'teuer' and 'günstig' in words", () => {
    const { unmount } = render(<KeyFigures slots={makeSlots({ 0: 10, 48: 500 })} mode="today" now={now} />);
    expect(within(card("Jetzt")).getByText("teuer")).toBeInTheDocument();
    unmount();
    render(<KeyFigures slots={makeSlots({ 0: 500, 48: 10 })} mode="today" now={now} />);
    expect(within(card("Jetzt")).getByText("günstig")).toBeInTheDocument();
  });

  it("picks cheapest and most expensive only from the current slot on, never from the past", () => {
    render(<KeyFigures slots={slots} mode="today" now={now} />);
    const cheapest = card("Günstigster ab jetzt");
    expect(cheapest).toHaveTextContent("13:15 Uhr");
    expect(cheapest).toHaveTextContent("8,4 ct/kWh");
    expect(cheapest).not.toHaveTextContent("02:30 Uhr");

    const expensive = card("Teuerster ab jetzt");
    expect(expensive).toHaveTextContent("20:00 Uhr");
    expect(expensive).toHaveTextContent("31,2 ct/kWh");
    expect(expensive).not.toHaveTextContent("00:00 Uhr");
  });

  it("shows 'Kein Preis verfügbar' when the current slot has no price (EC-4)", () => {
    render(<KeyFigures slots={makeSlots({ 48: null, 53: 84, 80: 312 })} mode="today" now={now} />);
    const jetzt = card("Jetzt");
    expect(jetzt).toHaveTextContent("Kein Preis verfügbar");
    expect(jetzt).not.toHaveTextContent("ct/kWh");
    expect(within(jetzt).queryByText(/^(günstig|mittel|teuer)$/)).not.toBeInTheDocument();
    // The other two still work and skip the missing slot.
    expect(card("Günstigster ab jetzt")).toHaveTextContent("8,4 ct/kWh");
    expect(card("Teuerster ab jetzt")).toHaveTextContent("31,2 ct/kWh");
  });

  it("shows 'Kein Preis verfügbar' on all three cards when no slot from now on has a price", () => {
    // Prices only in the past (before 12:00), everything from now on missing.
    const overrides: Record<number, number | null> = {};
    for (let i = 48; i < 96; i++) overrides[i] = null;
    render(<KeyFigures slots={makeSlots(overrides)} mode="today" now={now} />);
    for (const title of ["Jetzt", "Günstigster ab jetzt", "Teuerster ab jetzt"]) {
      expect(card(title)).toHaveTextContent("Kein Preis verfügbar");
      expect(card(title)).not.toHaveTextContent("ct/kWh");
    }
  });

  it("shows the same slot on all three cards in the last slot of the day (EC-3)", () => {
    // Earlier slots are both cheaper and more expensive — only 23:45 is left.
    render(<KeyFigures slots={makeSlots({ 0: 5, 1: 900, 95: 123 })} mode="today" now={berlin("23:50")} />);
    for (const title of ["Jetzt", "Günstigster ab jetzt", "Teuerster ab jetzt"]) {
      expect(card(title)).toHaveTextContent("23:45 Uhr");
      expect(card(title)).toHaveTextContent("12,3 ct/kWh");
    }
  });

  it("shows negative prices with a real minus sign", () => {
    render(<KeyFigures slots={makeSlots({ 48: -5, 60: -42 })} mode="today" now={now} />);
    expect(card("Jetzt")).toHaveTextContent("−0,5 ct/kWh");
    expect(card("Günstigster ab jetzt")).toHaveTextContent("−4,2 ct/kWh");
    expect(card("Günstigster ab jetzt")).toHaveTextContent("15:00 Uhr");
  });
});

describe("KeyFigures – whole day (AC-12)", () => {
  // Average (94·100 + 50 + 250) / 96 ≈ 101,04 EUR/MWh → 10,1 ct/kWh.
  const slots = makeSlots({ 2: 50, 90: 250 });
  const now = berlin("12:05");

  it("shows average, cheapest and most expensive over the whole day", () => {
    render(<KeyFigures slots={slots} mode="day" now={now} />);
    expect(screen.queryByText("Jetzt")).not.toBeInTheDocument();
    expect(screen.queryByText(/ab jetzt/)).not.toBeInTheDocument();

    const average = card("Ø Tagesdurchschnitt");
    expect(within(average).getByText("10,1 ct/kWh")).toHaveClass("tabular-nums");
    expect(average).toHaveTextContent("über den ganzen Tag");

    // 00:30 lies before "now" but counts in the day view.
    expect(card("Günstigster")).toHaveTextContent("00:30 Uhr");
    expect(card("Günstigster")).toHaveTextContent("5,0 ct/kWh");
    expect(card("Teuerster")).toHaveTextContent("22:30 Uhr");
    expect(card("Teuerster")).toHaveTextContent("25,0 ct/kWh");
  });

  it("averages only priced slots (EC-4)", () => {
    const overrides: Record<number, number | null> = {};
    for (let i = 0; i < 48; i++) overrides[i] = null;
    for (let i = 48; i < 96; i++) overrides[i] = i < 72 ? 100 : 200;
    render(<KeyFigures slots={makeSlots(overrides)} mode="day" now={now} />);
    expect(card("Ø Tagesdurchschnitt")).toHaveTextContent("15,0 ct/kWh");
  });

  it("shows 'Kein Preis verfügbar' on all three cards when the day has no price at all", () => {
    render(<KeyFigures slots={makeSlots({}, null)} mode="day" now={now} />);
    for (const title of ["Ø Tagesdurchschnitt", "Günstigster", "Teuerster"]) {
      expect(card(title)).toHaveTextContent("Kein Preis verfügbar");
      expect(card(title)).not.toHaveTextContent("ct/kWh");
    }
  });
});

describe("KeyFigures – layout and semantics", () => {
  it("is a description list of three cards, stacked below 640 px (AC-17)", () => {
    const { container } = render(<KeyFigures slots={makeSlots()} mode="today" now={berlin("12:05")} />);
    const dl = container.querySelector("dl");
    expect(dl).toHaveClass("grid", "gap-4", "sm:grid-cols-3");
    expect(dl?.querySelectorAll("dt")).toHaveLength(3);
  });
});
