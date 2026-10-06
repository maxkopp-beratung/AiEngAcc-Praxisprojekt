import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import type { PricesPayload } from "@/lib/prices/types";
import { LivePricesProvider, useLivePricesContext } from "./live-prices-provider";
import { PricePanel } from "./price-panel";

// The chart needs a real layout (ResizeObserver); its own tests cover it, here it only has to be there.
vi.mock("@/components/prices/price-chart", () => ({ PriceChart: () => <div data-testid="chart" /> }));

const MIN = 60 * 1000;

const ERROR_TODAY: PricesPayload = {
  generatedAt: "2026-10-06T10:00:00.000Z",
  today: { date: "2026-10-06", status: "error" },
  tomorrow: { date: "2026-10-07", status: "not_published" },
};
const TOMORROW_MISSING: PricesPayload = {
  generatedAt: "2026-10-06T10:01:00.000Z",
  today: { date: "2026-10-06", status: "ok", slots: [{ start: "2026-10-05T22:00:00.000Z", priceEurMwh: 91.5 }] },
  tomorrow: { date: "2026-10-07", status: "not_published" },
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// A second consumer of the shared state, standing in for "Meine Geräte".
function Probe({ id }: { id: string }) {
  const { payload, now } = useLivePricesContext();
  return (
    <p data-testid={id}>
      {payload?.generatedAt ?? "none"}|{now.toISOString()}
    </p>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-06T10:07:30Z"));
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useLivePricesContext", () => {
  it("throws a clear error outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useLivePricesContext())).toThrow(
      "useLivePricesContext must be used inside <LivePricesProvider>.",
    );
  });
});

describe("LivePricesProvider", () => {
  it("runs one clock for the whole page: two consumers see the same payload and the same now", async () => {
    render(
      <LivePricesProvider>
        <Probe id="a" />
        <Probe id="b" />
      </LivePricesProvider>,
    );
    expect(vi.getTimerCount()).toBe(1);
    expect(screen.getByTestId("a").textContent).toBe("none|2026-10-06T10:07:30.000Z");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(7.5 * MIN);
    });
    expect(screen.getByTestId("a").textContent).toBe("none|2026-10-06T10:15:00.000Z");
    expect(screen.getByTestId("b").textContent).toBe(screen.getByTestId("a").textContent);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("takes the price section's payload as the shared state, also under StrictMode", () => {
    render(
      <StrictMode>
        <LivePricesProvider>
          <PricePanel initial={TOMORROW_MISSING} />
          <Probe id="devices" />
        </LivePricesProvider>
      </StrictMode>,
    );
    expect(screen.getByTestId("devices").textContent).toBe(`${TOMORROW_MISSING.generatedAt}|2026-10-06T10:07:30.000Z`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes a single refetch for the page and hands its result to every consumer (AC-20)", async () => {
    const fresh: PricesPayload = { ...TOMORROW_MISSING, generatedAt: "2026-10-06T10:15:00.000Z" };
    fetchMock.mockResolvedValue(jsonResponse(fresh));
    render(
      <LivePricesProvider>
        <PricePanel initial={TOMORROW_MISSING} />
        <Probe id="a" />
        <Probe id="b" />
      </LivePricesProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7.5 * MIN);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("a").textContent).toBe("2026-10-06T10:15:00.000Z|2026-10-06T10:15:00.000Z");
    expect(screen.getByTestId("b").textContent).toBe(screen.getByTestId("a").textContent);
  });
});

describe("PricePanel inside the provider", () => {
  it("shows its server payload before the handover lands (no flicker)", () => {
    // Server rendering runs no effects, so the handover never happens here.
    const html = renderToString(
      <LivePricesProvider>
        <PricePanel initial={ERROR_TODAY} />
      </LivePricesProvider>,
    );
    expect(html).toContain("Strompreise");
    expect(html).toContain("Erneut versuchen");
  });

  it("renders the provider's state after the handover: retry replaces the error with the prices (AC-23)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(TOMORROW_MISSING));
    render(
      <LivePricesProvider>
        <PricePanel initial={ERROR_TODAY} />
        <Probe id="devices" />
      </LivePricesProvider>,
    );
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Erneut versuchen" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Heute" })).toBeInTheDocument();
    expect(screen.getByTestId("devices").textContent).toContain(TOMORROW_MISSING.generatedAt);
  });
});
