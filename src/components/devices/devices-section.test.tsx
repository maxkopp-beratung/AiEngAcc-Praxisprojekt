vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const listDevices = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/devices/queries", () => ({ listDevices: () => listDevices() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import type { Device } from "@/lib/devices/types";
import { DevicesSectionContent } from "./devices-section";

const devices: Device[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Waschmaschine", durationMinutes: 150, createdAt: "2026-10-06T08:00:00Z" },
];

beforeEach(() => {
  getUser.mockReset();
  listDevices.mockReset();
  redirect.mockClear();
});

// Same rule as PriceSection (PROJ-2 BUG-2): the section checks the session itself before reading devices.
describe("DevicesSectionContent (AC-2)", () => {
  it("reads no devices and redirects to /login when the session is no longer valid", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    listDevices.mockResolvedValue(devices);
    await expect(DevicesSectionContent()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fdashboard");
    expect(listDevices).not.toHaveBeenCalled();
  });

  it("hands the devices to the panel for a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    listDevices.mockResolvedValue(devices);
    const element = await DevicesSectionContent();
    expect(element.props.initialDevices).toEqual(devices);
  });

  it("passes null to the panel when the read fails, so it shows its error state", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    listDevices.mockResolvedValue(null);
    const element = await DevicesSectionContent();
    expect(element.props.initialDevices).toBeNull();
  });
});
