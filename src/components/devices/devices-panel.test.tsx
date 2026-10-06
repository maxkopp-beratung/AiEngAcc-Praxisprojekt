import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { LivePrices } from "@/hooks/use-live-prices";
import type { Device, DeviceActionResult } from "@/lib/devices/types";
import { berlinDaySlotStarts } from "@/lib/prices/berlin-time";
import type { PricesPayload } from "@/lib/prices/types";

const actions = vi.hoisted(() => ({
  createDevice: vi.fn<(input: unknown) => Promise<DeviceActionResult>>(),
  updateDevice: vi.fn<(input: unknown) => Promise<DeviceActionResult>>(),
  deleteDevice: vi.fn<(input: unknown) => Promise<DeviceActionResult>>(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const prices = vi.hoisted(() => ({ value: null as LivePrices | null }));

vi.mock("@/lib/devices/actions", () => actions);
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/prices/live-prices-provider", () => ({
  useLivePricesContext: () => prices.value,
}));

import { DevicesPanel } from "@/components/devices/devices-panel";

// Radix Select / DropdownMenu use pointer capture and scrollIntoView, which jsdom does not implement.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

// 2026-10-06, 13:07 German time (UTC+2). Cheap stretch 13:15–15:45 at 84 EUR/MWh, otherwise 100.
const NOW = new Date("2026-10-06T11:07:00Z");
function payload(today: "ok" | "error" = "ok"): PricesPayload {
  const slots = berlinDaySlotStarts("2026-10-06").map((start) => {
    const t = Date.parse(start);
    const cheap = t >= Date.parse("2026-10-06T11:15:00Z") && t < Date.parse("2026-10-06T13:45:00Z");
    return { start, priceEurMwh: cheap ? 84 : 100 };
  });
  return {
    generatedAt: NOW.toISOString(),
    today: today === "ok" ? { date: "2026-10-06", status: "ok", slots } : { date: "2026-10-06", status: "error" },
    tomorrow: { date: "2026-10-07", status: "not_published" },
  };
}
function setPrices(p: PricesPayload | null) {
  prices.value = { payload: p, now: NOW, retry: async () => {}, retrying: false, handover: () => {} };
}

const device = (id: string, name: string, durationMinutes = 150): Device => ({
  id,
  name,
  durationMinutes,
  createdAt: "2026-10-06T08:00:00Z",
});
const WASCH = device("00000000-0000-4000-8000-000000000001", "Waschmaschine");
const SPUEL = device("00000000-0000-4000-8000-000000000002", "Spülmaschine", 180);

const headline = "Starte um 13:15 Uhr · fertig um 15:45 Uhr · Ø 8,4 ct/kWh";

function openMenu(name: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: `Aktionen für ${name}` }), { key: "Enter" });
  return screen.getByRole("menu");
}

beforeEach(() => {
  vi.clearAllMocks();
  setPrices(payload());
});

describe("DevicesPanel — list and recommendations", () => {
  it("shows the section title, the add button and one card per device in the given order (AC-1, AC-10)", () => {
    render(<DevicesPanel initialDevices={[WASCH, SPUEL]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Meine Geräte" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerät hinzufügen" })).toBeEnabled();
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["Waschmaschine", "Spülmaschine"]);
  });

  it("computes each card's recommendation from the shared prices (AC-15, AC-19, AC-20)", () => {
    render(<DevicesPanel initialDevices={[WASCH]} />);
    const card = screen.getByRole("article", { name: "Waschmaschine" });
    expect(within(card).getByText(headline)).toBeInTheDocument();
    expect(
      within(card).getByText("Die Preise für morgen fehlen noch – die Empfehlung kann sich ab ca. 13 Uhr ändern."),
    ).toBeInTheDocument();
  });

  it("shows a skeleton line while the prices are not there yet", () => {
    setPrices(null);
    render(<DevicesPanel initialDevices={[WASCH]} />);
    expect(screen.getByTestId("recommendation-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(headline)).not.toBeInTheDocument();
  });

  it("keeps devices usable when the prices failed and recomputes once they are back (AC-23)", () => {
    setPrices(payload("error"));
    const view = render(<DevicesPanel initialDevices={[WASCH]} />);
    expect(
      screen.getByText("Empfehlung gerade nicht verfügbar – die Strompreise konnten nicht geladen werden."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerät hinzufügen" })).toBeEnabled();

    setPrices(payload());
    view.rerender(<DevicesPanel initialDevices={[WASCH]} />);
    expect(screen.getByText(headline)).toBeInTheDocument();
  });

  it("shows the empty state with presets instead of the header button (AC-3, AC-4)", () => {
    render(<DevicesPanel initialDevices={[]} />);
    expect(
      screen.getByText("Noch keine Geräte. Lege dein erstes Gerät an, um zu sehen, wann es am günstigsten läuft."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Gerät hinzufügen" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Waschmaschine · 2:30 h" }));
    const dialog = screen.getByRole("dialog", { name: "Gerät hinzufügen" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Waschmaschine");
    expect(actions.createDevice).not.toHaveBeenCalled();
  });

  it("disables adding and shows the notice at 20 devices (AC-9)", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      device(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `Gerät ${i + 1}`),
    );
    render(<DevicesPanel initialDevices={many} />);
    expect(screen.getByRole("button", { name: "Gerät hinzufügen" })).toBeDisabled();
    expect(
      screen.getByText("Du hast die Höchstzahl von 20 Geräten erreicht. Lösche ein Gerät, um ein neues anzulegen."),
    ).toBeInTheDocument();
  });

  it("shows the load error when the devices could not be read", () => {
    render(<DevicesPanel initialDevices={null} />);
    expect(screen.getByText("Deine Geräte konnten gerade nicht geladen werden.")).toBeInTheDocument();
  });
});

describe("DevicesPanel — saving", () => {
  async function submitPreset() {
    fireEvent.click(screen.getByRole("button", { name: "Waschmaschine · 2:30 h" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    });
  }

  it("adds the new card without a reload and confirms (AC-5)", async () => {
    actions.createDevice.mockResolvedValue({ status: "ok", devices: [WASCH] });
    render(<DevicesPanel initialDevices={[]} />);
    await submitPreset();

    expect(actions.createDevice).toHaveBeenCalledWith({ name: "Waschmaschine", durationMinutes: 150 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("article", { name: "Waschmaschine" })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Gerät gespeichert");
  });

  it("keeps the dialog open with the message when saving fails or the connection drops (AC-24)", async () => {
    actions.createDevice.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<DevicesPanel initialDevices={[]} />);
    await submitPreset();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Das hat nicht geklappt. Bitte versuche es erneut.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Waschmaschine");
  });

  it("shows the duplicate message at the name field (AC-8)", async () => {
    actions.createDevice.mockResolvedValue({ status: "duplicate_name", devices: [] });
    render(<DevicesPanel initialDevices={[]} />);
    await submitPreset();
    expect(screen.getByText("Du hast schon ein Gerät mit diesem Namen.")).toBeInTheDocument();
  });

  it("closes the edit dialog and refreshes the list when the device is gone (EC-10)", async () => {
    actions.updateDevice.mockResolvedValue({ status: "not_found", devices: [SPUEL] });
    render(<DevicesPanel initialDevices={[WASCH, SPUEL]} />);
    fireEvent.click(within(openMenu("Waschmaschine")).getByRole("menuitem", { name: "Bearbeiten" }));
    expect(screen.getByRole("dialog", { name: "Gerät bearbeiten" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    });
    expect(actions.updateDevice).toHaveBeenCalledWith({ id: WASCH.id, name: "Waschmaschine", durationMinutes: 150 });
    expect(toast.error).toHaveBeenCalledWith("Dieses Gerät gibt es nicht mehr.");
    await waitFor(() => expect(screen.queryByRole("article", { name: "Waschmaschine" })).not.toBeInTheDocument());
  });

  it("reloads the page when the session is gone", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    try {
      actions.createDevice.mockResolvedValue({ status: "unauthorized" });
      render(<DevicesPanel initialDevices={[]} />);
      await submitPreset();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("DevicesPanel — deleting", () => {
  async function deleteWasch() {
    fireEvent.click(within(openMenu("Waschmaschine")).getByRole("menuitem", { name: "Löschen" }));
    expect(screen.getByRole("alertdialog", { name: "„Waschmaschine“ löschen?" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
    });
  }

  it("removes the card and confirms (AC-12)", async () => {
    actions.deleteDevice.mockResolvedValue({ status: "ok", devices: [SPUEL] });
    render(<DevicesPanel initialDevices={[WASCH, SPUEL]} />);
    await deleteWasch();

    expect(actions.deleteDevice).toHaveBeenCalledWith({ id: WASCH.id });
    expect(toast.success).toHaveBeenCalledWith("Gerät gelöscht");
    await waitFor(() => expect(screen.queryByRole("article", { name: "Waschmaschine" })).not.toBeInTheDocument());
  });

  it("keeps the device and reports the failure (AC-24)", async () => {
    actions.deleteDevice.mockResolvedValue({ status: "error" });
    render(<DevicesPanel initialDevices={[WASCH]} />);
    await deleteWasch();

    expect(toast.error).toHaveBeenCalledWith("Das hat nicht geklappt. Bitte versuche es erneut.");
    expect(screen.getByRole("article", { name: "Waschmaschine" })).toBeInTheDocument();
  });

  it("reports a device deleted elsewhere and refreshes the list (EC-10)", async () => {
    actions.deleteDevice.mockResolvedValue({ status: "not_found", devices: [] });
    render(<DevicesPanel initialDevices={[WASCH]} />);
    await deleteWasch();

    expect(toast.error).toHaveBeenCalledWith("Dieses Gerät gibt es nicht mehr.");
    await waitFor(() => expect(screen.queryByRole("article", { name: "Waschmaschine" })).not.toBeInTheDocument());
  });
});
