"use client";

import { useMemo, useSyncExternalStore } from "react";
import { TZDate } from "@date-fns/tz";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Customized, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BERLIN_TZ, slotLabel } from "@/lib/prices/berlin-time";
import {
  cheapestIndex,
  currentSlotIndex,
  formatCtKwh,
  mostExpensiveIndex,
  rangeStartIndex,
  tiers,
} from "@/lib/prices/price-math";
import type { PriceTier, Slot } from "@/lib/prices/types";

// PROJ-2 price chart: one bar per 15-minute slot (AC-3), tier colors (AC-7), zero line (AC-6),
// markers for cheapest / most expensive (AC-8), "jetzt" and greyed past slots on "Heute" (AC-11).

export type PriceChartMode = "today" | "day";

const SLOT_MS = 15 * 60 * 1000;

export const TIER_FILL: Record<PriceTier, string> = {
  cheap: "hsl(var(--chart-1))",
  mid: "hsl(var(--chart-2))",
  expensive: "hsl(var(--chart-3))",
};
export const NOW_FILL = "hsl(var(--chart-4))";
export const PAST_FILL = "hsl(var(--muted-foreground))";
export const PAST_OPACITY = 0.3;

/** One row of chart data per slot; built from slots + mode + now, no clock inside. */
export type ChartRow = {
  /** Position in the day (x-axis category). */
  index: number;
  start: string;
  /** "13:15–13:30" in German time (incl. MESZ/MEZ on the 100-slot day). */
  label: string;
  priceEurMwh: number | null;
  /** ct/kWh for plotting; null → no bar, the space stays empty (EC-4). */
  value: number | null;
  tier: PriceTier | null;
  fill: string;
  fillOpacity: number;
  isNow: boolean;
  isPast: boolean;
  isCheapest: boolean;
  isMostExpensive: boolean;
  /** German hour if this slot opens a full hour (first occurrence only), else null — used for x ticks (AC-18). */
  hour: number | null;
};

/** Builds the chart rows. mode "today": past greyed, current slot marked, extremes from now on; "day": whole day. */
export function buildChartRows(slots: Slot[], mode: PriceChartMode, now: Date): ChartRow[] {
  const slotTiers = tiers(slots);
  const today = mode === "today";
  const nowIndex = today ? currentSlotIndex(slots, now) : -1;
  const from = today ? rangeStartIndex(slots, now, "today") : 0;
  const cheapest = cheapestIndex(slots, from);
  const mostExpensive = mostExpensiveIndex(slots, from);
  const nowMs = now.getTime();
  const seenHours = new Set<number>();

  return slots.map((slot, index) => {
    const tier = slotTiers[index];
    const isNow = index === nowIndex;
    const isPast = today && Date.parse(slot.start) + SLOT_MS <= nowMs;

    const berlin = new TZDate(Date.parse(slot.start), BERLIN_TZ);
    let hour: number | null = null;
    if (berlin.getMinutes() === 0 && !seenHours.has(berlin.getHours())) {
      hour = berlin.getHours();
      seenHours.add(hour);
    }

    let fill = tier ? TIER_FILL[tier] : TIER_FILL.mid;
    let fillOpacity = 1;
    if (isNow) {
      fill = NOW_FILL;
    } else if (isPast) {
      fill = PAST_FILL;
      fillOpacity = PAST_OPACITY;
    }

    return {
      index,
      start: slot.start,
      label: slotLabel(slot.start),
      priceEurMwh: slot.priceEurMwh,
      value: slot.priceEurMwh === null ? null : slot.priceEurMwh / 10,
      tier,
      fill,
      fillOpacity,
      isNow,
      isPast,
      isCheapest: index === cheapest,
      isMostExpensive: index === mostExpensive,
      hour,
    };
  });
}

/** x-axis tick positions: slots that open an hour divisible by `stepHours` (3, or 6 on narrow screens). */
export function xTicks(rows: ChartRow[], stepHours: number): number[] {
  return rows.filter((r) => r.hour !== null && r.hour % stepHours === 0).map((r) => r.index);
}

/** Tooltip text, e.g. "13:15–13:30 · 8,4 ct/kWh" (AC-5); missing price → "… · keine Daten" (EC-4). */
export function tooltipText(row: Pick<ChartRow, "label" | "priceEurMwh">): string {
  return `${row.label} · ${row.priceEurMwh === null ? "keine Daten" : formatCtKwh(row.priceEurMwh)}`;
}

function formatAxisCt(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 1 }).replace("-", "−");
}

// ---------- Marker labels ("jetzt", "günstigst", "teuerst") ----------

const LINE_H = 14;
const FONT_SIZE = 11;
const ICON_SIZE = 11;
const ICON_GAP = 2;
const CHAR_W = 6.2;

export type MarkerKind = "now" | "cheapest" | "mostExpensive";

const MARKER_TEXT: Record<MarkerKind, string> = {
  now: "jetzt",
  cheapest: "günstigst",
  mostExpensive: "teuerst",
};

export type PlacedMarker = { kind: MarkerKind; index: number; x: number; y: number; width: number };

type MarkerRequest = { kind: MarkerKind; index: number; cx: number; top: number };

/**
 * Places marker labels above their bars. Labels whose boxes would overlap (same slot, or neighbouring
 * slots) are stacked upwards, so "günstigst" and "teuerst" on the same slot sit one above the other
 * (EC-3, EC-6). x is clamped into [minX, maxX] so edge labels never leave the plot.
 */
export function placeMarkers(requests: MarkerRequest[], minX: number, maxX: number): PlacedMarker[] {
  const placed: PlacedMarker[] = [];
  for (const req of requests) {
    const width = (req.kind === "now" ? 0 : ICON_SIZE + ICON_GAP) + MARKER_TEXT[req.kind].length * CHAR_W;
    const x = Math.max(minX, Math.min(req.cx - width / 2, maxX - width));
    let y = req.top - 4;
    let moved = true;
    while (moved) {
      moved = false;
      for (const p of placed) {
        const overlapX = x < p.x + p.width + 2 && p.x < x + width + 2;
        const overlapY = Math.abs(p.y - y) < LINE_H;
        if (overlapX && overlapY) {
          y = p.y - LINE_H;
          moved = true;
        }
      }
    }
    placed.push({ kind: req.kind, index: req.index, x, y, width });
  }
  return placed;
}

type BandScale = ((value: number) => number | undefined) & { bandwidth?: () => number };
type ChartInternals = {
  xAxisMap?: Record<string, { scale: BandScale }>;
  yAxisMap?: Record<string, { scale: (value: number) => number }>;
  offset?: { left: number; top: number; width: number; height: number };
};

function MarkerLayer({ rows, xAxisMap, yAxisMap, offset }: { rows: ChartRow[] } & ChartInternals) {
  const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : undefined;
  const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : undefined;
  if (!xAxis || !yAxis || !offset) return null;

  const band = xAxis.scale.bandwidth?.() ?? 0;
  const requests: MarkerRequest[] = [];
  for (const kind of ["now", "cheapest", "mostExpensive"] as const) {
    const row = rows.find((r) =>
      kind === "now" ? r.isNow : kind === "cheapest" ? r.isCheapest : r.isMostExpensive,
    );
    if (!row) continue;
    const bandStart = xAxis.scale(row.index);
    if (bandStart === undefined) continue;
    // Negative bars hang below zero, so their label sits above the zero line.
    const top = yAxis.scale(Math.max(row.value ?? 0, 0));
    requests.push({ kind, index: row.index, cx: bandStart + band / 2, top });
  }

  const placed = placeMarkers(requests, offset.left, offset.left + offset.width);
  return (
    <g className="price-chart-markers" aria-hidden="true">
      {placed.map((m) => {
        const Icon = m.kind === "cheapest" ? ArrowDown : m.kind === "mostExpensive" ? ArrowUp : null;
        const iconColor = m.kind === "cheapest" ? TIER_FILL.cheap : TIER_FILL.expensive;
        return (
          <g key={m.kind}>
            {Icon ? (
              <Icon
                x={m.x}
                y={m.y - ICON_SIZE + 1}
                width={ICON_SIZE}
                height={ICON_SIZE}
                strokeWidth={3}
                style={{ color: iconColor }}
              />
            ) : null}
            <text
              x={Icon ? m.x + ICON_SIZE + ICON_GAP : m.x}
              y={m.y}
              fontSize={FONT_SIZE}
              fontWeight={600}
              fill="hsl(var(--foreground))"
              stroke="hsl(var(--card))"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {MARKER_TEXT[m.kind]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ---------- Narrow-screen detection (x ticks every 6 h below 640 px) ----------

const NARROW_QUERY = "(max-width: 639px)";

function subscribeNarrow(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(NARROW_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function useIsNarrow() {
  return useSyncExternalStore(
    subscribeNarrow,
    () => typeof window.matchMedia === "function" && window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}

// ---------- Component ----------

const chartConfig = {
  value: { label: "Preis" },
} satisfies ChartConfig;

export const CHART_LABEL = "Strompreise im Tagesverlauf, Pfeiltasten wechseln den Zeitpunkt";

type LegendItem = { label: string; color: string; opacity?: number };

export function legendItems(mode: PriceChartMode): LegendItem[] {
  const items: LegendItem[] = [
    { label: "günstig", color: TIER_FILL.cheap },
    { label: "mittel", color: TIER_FILL.mid },
    { label: "teuer", color: TIER_FILL.expensive },
  ];
  if (mode === "today") {
    items.push({ label: "jetzt", color: NOW_FILL }, { label: "vorbei", color: PAST_FILL, opacity: PAST_OPACITY });
  }
  return items;
}

export function PriceChart({ slots, mode, now }: { slots: Slot[]; mode: PriceChartMode; now: Date }) {
  const rows = useMemo(() => buildChartRows(slots, mode, now), [slots, mode, now]);
  const narrow = useIsNarrow();
  const ticks = useMemo(() => xTicks(rows, narrow ? 6 : 3), [rows, narrow]);

  return (
    <div className="w-full min-w-0">
      <p className="mb-1 text-xs text-muted-foreground">ct/kWh</p>
      {/* Pointer/tap must not focus the chart: recharts' keyboard layer jumps the tooltip to the first slot on
          focus, so a tap would show 00:00 instead of the tapped bar (AC-5, AC-17). Tab still focuses it. */}
      <div
        data-testid="price-chart-frame"
        onMouseDown={(e) => e.preventDefault()}
        className="rounded-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background"
      >
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <BarChart
            data={rows}
            margin={{ top: 48, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="12%"
            accessibilityLayer
            aria-label={CHART_LABEL}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="index"
              ticks={ticks}
              interval={0}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tickFormatter={(i: number) => String(rows[i]?.hour ?? "")}
              className="tabular-nums"
            />
            <YAxis
              width={36}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatAxisCt}
              className="tabular-nums"
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} ifOverflow="extendDomain" />
            <ChartTooltip
              filterNull={false}
              isAnimationActive={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  hideIndicator
                  formatter={(_value, _name, item) => (
                    <span className="font-medium tabular-nums text-foreground" aria-live="polite">
                      {tooltipText(item.payload as ChartRow)}
                    </span>
                  )}
                />
              }
            />
            <Bar dataKey="value" name="Preis" isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.start} fill={row.fill} fillOpacity={row.fillOpacity} />
              ))}
            </Bar>
            <Customized component={<MarkerLayer rows={rows} />} />
          </BarChart>
        </ChartContainer>
      </div>
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {legendItems(mode).map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color, opacity: item.opacity ?? 1 }}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
