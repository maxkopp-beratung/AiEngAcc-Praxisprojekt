vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const getPrices = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/prices/get-prices", () => ({ getPrices: () => getPrices() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import type { PricesPayload } from "@/lib/prices/types";
import { PriceSectionContent } from "./price-section";

const okPayload: PricesPayload = {
  generatedAt: "2026-10-06T10:00:00.000Z",
  today: { date: "2026-10-06", status: "ok", slots: [{ start: "2026-10-05T22:00:00.000Z", priceEurMwh: 91.5 }] },
  tomorrow: { date: "2026-10-07", status: "not_published" },
};

beforeEach(() => {
  getUser.mockReset();
  getPrices.mockReset();
  redirect.mockClear();
});

// BUG-2: Next renders layout and page in parallel, so the section checks the session itself
// before it loads any prices — the layout's redirect alone does not keep them out of the response.
describe("PriceSectionContent (AC-2)", () => {
  it("loads no prices and redirects to /login when the session is no longer valid", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    getPrices.mockResolvedValue(okPayload); // so a missing check would put real-looking prices into the page
    await expect(PriceSectionContent()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fdashboard");
    expect(getPrices).not.toHaveBeenCalled();
  });

  it("hands the price payload to the panel for a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    getPrices.mockResolvedValue(okPayload);
    const element = await PriceSectionContent();
    expect(element.props.initial).toEqual(okPayload);
    expect(getPrices).toHaveBeenCalledTimes(1);
  });
});
