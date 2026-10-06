import { fireEvent, render, screen, within } from "@testing-library/react";
import { PriceTable } from "@/components/prices/price-table";
import type { Slot } from "@/lib/prices/types";

const SLOT_MS = 15 * 60 * 1000;
// Day 2026-10-06 in German time (CEST, UTC+2): 96 slots, slot i starts at 00:00 + i·15 min Berlin time.
const DAY_START_MS = Date.parse("2026-10-05T22:00:00Z");
// Day 2026-10-25 (fall-back DST day): 100 slots, 02:00–03:00 occurs twice (EC-2).
const DST_DAY_START_MS = Date.parse("2026-10-24T22:00:00Z");

/** `count` slots from `startMs`, priced `base` EUR/MWh; `overrides` maps a slot index to its price (null = missing). */
function makeSlots(
  overrides: Record<number, number | null> = {},
  base: number | null = 100,
  startMs = DAY_START_MS,
  count = 96,
): Slot[] {
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(startMs + i * SLOT_MS).toISOString(),
    priceEurMwh: i in overrides ? overrides[i] : base,
  }));
}

/** Berlin wall-clock time on 2026-10-06 as a Date (CEST = UTC+2). */
function berlin(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(DAY_START_MS + (h * 60 + m) * 60 * 1000);
}

function openTable() {
  fireEvent.click(screen.getByRole("button", { name: "Als Tabelle anzeigen" }));
}

/** Body rows only (the header row is excluded). */
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

/** The body row whose Zeitraum cell is exactly `label`. */
function row(label: string): HTMLElement {
  return screen.getByRole("cell", { name: label }).closest("tr") as HTMLElement;
}

/** Text of the Hinweis cell (third column) of a row. */
function hint(r: HTMLElement): string {
  return within(r).getAllByRole("cell")[2].textContent ?? "";
}

// 12:05 → current slot 48 (12:00). Past: 02:30 cheapest of the day (1,0), 00:00 most expensive (50,0).
// From now on: 13:15 cheapest (8,4), 20:00 most expensive (31,2).
const slots = makeSlots({ 0: 500, 10: 10, 48: 200, 53: 84, 80: 312 });
const now = berlin("12:05");

describe("PriceTable – toggle (AC-16)", () => {
  it("is collapsed by default: no table rows rendered", () => {
    render(<PriceTable slots={slots} mode="today" now={now} />);
    expect(screen.getByRole("button", { name: "Als Tabelle anzeigen" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("row")).toHaveLength(0);
  });

  it("opens on click, switches the button text and closes again", () => {
    render(<PriceTable slots={slots} mode="today" now={now} />);
    openTable();
    const toggle = screen.getByRole("button", { name: "Tabelle ausblenden" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("table")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Als Tabelle anzeigen" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the columns, a caption and one row per slot in order (96)", () => {
    render(<PriceTable slots={slots} mode="day" now={now} />);
    openTable();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Zeitraum", "Preis", "Hinweis"]);
    expect(screen.getByText("Strompreise je 15 Minuten in ct/kWh")).toBeInTheDocument();
    const rows = bodyRows();
    expect(rows).toHaveLength(96);
    expect(within(rows[0]).getAllByRole("cell")[0]).toHaveTextContent("00:00–00:15");
    expect(within(rows[53]).getAllByRole("cell")[0]).toHaveTextContent("13:15–13:30");
    expect(within(rows[95]).getAllByRole("cell")[0]).toHaveTextContent("23:45–24:00");
  });

  it("formats the price in ct/kWh, right-aligned with tabular-nums", () => {
    render(<PriceTable slots={slots} mode="day" now={now} />);
    openTable();
    const price = within(row("13:15–13:30")).getAllByRole("cell")[1];
    expect(price).toHaveTextContent("8,4 ct/kWh");
    expect(price).toHaveClass("text-right", "tabular-nums");
  });
});

describe("PriceTable – markers", () => {
  it("day mode: marks cheapest and most expensive of the whole day in words", () => {
    render(<PriceTable slots={slots} mode="day" now={now} />);
    openTable();
    expect(hint(row("02:30–02:45"))).toBe("günstigster Zeitpunkt");
    expect(hint(row("00:00–00:15"))).toBe("teuerster Zeitpunkt");
    expect(screen.getAllByText("günstigster Zeitpunkt")).toHaveLength(1);
    expect(screen.getAllByText("teuerster Zeitpunkt")).toHaveLength(1);
    // No "jetzt" in the day view.
    expect(hint(row("12:00–12:15"))).toBe("");
  });

  it("today mode: marks from now on only, a cheaper past slot is not marked", () => {
    render(<PriceTable slots={slots} mode="today" now={now} />);
    openTable();
    expect(hint(row("13:15–13:30"))).toContain("günstigster Zeitpunkt");
    expect(hint(row("20:00–20:15"))).toContain("teuerster Zeitpunkt");
    expect(hint(row("02:30–02:45"))).toBe("");
    expect(hint(row("00:00–00:15"))).toBe("");
    expect(hint(row("12:00–12:15"))).toBe("jetzt");
  });

  it("shows both texts when cheapest and most expensive are the same slot", () => {
    // All prices equal → tie goes to the earliest slot for both.
    render(<PriceTable slots={makeSlots()} mode="day" now={now} />);
    openTable();
    const text = hint(row("00:00–00:15"));
    expect(text).toContain("günstigster Zeitpunkt");
    expect(text).toContain("teuerster Zeitpunkt");
  });
});

describe("PriceTable – missing values and DST", () => {
  it("shows 'keine Daten' for a slot without a price (EC-4)", () => {
    render(<PriceTable slots={makeSlots({ 5: null })} mode="day" now={now} />);
    openTable();
    const price = within(row("01:15–01:30")).getAllByRole("cell")[1];
    expect(price).toHaveTextContent("keine Daten");
    expect(price).not.toHaveTextContent("0,0");
    expect(screen.getAllByText("keine Daten")).toHaveLength(1);
  });

  it("shows 100 rows with MESZ/MEZ labels on the fall-back day (EC-2)", () => {
    const dst = makeSlots({}, 100, DST_DAY_START_MS, 100);
    render(<PriceTable slots={dst} mode="day" now={new Date(DST_DAY_START_MS)} />);
    openTable();
    expect(bodyRows()).toHaveLength(100);
    expect(screen.getByRole("cell", { name: "02:00–02:15 MESZ" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "02:00–02:15 MEZ" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "23:45–24:00" })).toBeInTheDocument();
  });
});
