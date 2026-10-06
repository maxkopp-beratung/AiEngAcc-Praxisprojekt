vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const getPrices = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/prices/get-prices", () => ({ getPrices: () => getPrices() }));

import type { PricesPayload } from "@/lib/prices/types";
import { GET } from "./route";

const okPayload: PricesPayload = {
  generatedAt: "2026-10-06T10:00:00.000Z",
  today: {
    date: "2026-10-06",
    status: "ok",
    slots: [
      { start: "2026-10-05T22:00:00.000Z", priceEurMwh: 91.5 },
      { start: "2026-10-05T22:15:00.000Z", priceEurMwh: null },
    ],
  },
  tomorrow: { date: "2026-10-07", status: "not_published" },
};

const errorPayload: PricesPayload = {
  generatedAt: "2026-10-06T10:00:00.000Z",
  today: { date: "2026-10-06", status: "error" },
  tomorrow: { date: "2026-10-07", status: "not_published" },
};

beforeEach(() => {
  getUser.mockReset();
  getPrices.mockReset();
});

describe("GET /api/prices", () => {
  it("answers 401 without prices when nobody is signed in (AC-2)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    getPrices.mockResolvedValue(okPayload); // so a missing auth check would leak real-looking prices
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getPrices).not.toHaveBeenCalled();
  });

  it("returns the price payload to a signed-in user (AC-2)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    getPrices.mockResolvedValue(okPayload);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(okPayload);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getPrices).toHaveBeenCalledTimes(1);
  });

  it("still answers 200 when today's prices could not be loaded (AC-23)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    getPrices.mockResolvedValue(errorPayload);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(errorPayload);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
