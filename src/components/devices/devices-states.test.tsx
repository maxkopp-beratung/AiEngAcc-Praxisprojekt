import { act, fireEvent, render, screen } from "@testing-library/react";
import { DeleteDeviceDialog } from "@/components/devices/delete-device-dialog";
import { DevicesSkeleton } from "@/components/devices/devices-skeleton";
import {
  DEVICE_PRESETS,
  DeviceLimitNotice,
  DevicesEmptyState,
  DevicesLoadError,
} from "@/components/devices/devices-states";

describe("DevicesEmptyState (AC-3, AC-4)", () => {
  function setup() {
    const onAdd = vi.fn();
    const onPreset = vi.fn();
    render(<DevicesEmptyState onAdd={onAdd} onPreset={onPreset} />);
    return { onAdd, onPreset };
  }

  it("shows the heading and the AC-3 sentence verbatim", () => {
    setup();
    expect(screen.getByRole("heading", { level: 3, name: "Noch keine Geräte" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Noch keine Geräte. Lege dein erstes Gerät an, um zu sehen, wann es am günstigsten läuft.",
      ),
    ).toBeInTheDocument();
  });

  it("calls onAdd when „Gerät hinzufügen“ is clicked", () => {
    const { onAdd, onPreset } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Gerät hinzufügen" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onPreset).not.toHaveBeenCalled();
  });

  it("exports the three presets in order", () => {
    expect(DEVICE_PRESETS).toEqual([
      { name: "Waschmaschine", durationMinutes: 150 },
      { name: "Spülmaschine", durationMinutes: 180 },
      { name: "E-Auto", durationMinutes: 240 },
    ]);
  });

  it.each([
    ["Waschmaschine · 2:30 h", { name: "Waschmaschine", durationMinutes: 150 }],
    ["Spülmaschine · 3:00 h", { name: "Spülmaschine", durationMinutes: 180 }],
    ["E-Auto · 4:00 h", { name: "E-Auto", durationMinutes: 240 }],
  ])("preset „%s“ calls onPreset with its name and run time", (label, preset) => {
    const { onAdd, onPreset } = setup();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(onPreset).toHaveBeenCalledTimes(1);
    expect(onPreset).toHaveBeenCalledWith(preset);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("renders the preset buttons in the order Waschmaschine, Spülmaschine, E-Auto", () => {
    setup();
    const labels = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .filter((t) => t !== "Gerät hinzufügen");
    expect(labels).toEqual(["Waschmaschine · 2:30 h", "Spülmaschine · 3:00 h", "E-Auto · 4:00 h"]);
  });
});

describe("DeviceLimitNotice (AC-9)", () => {
  it("shows the limit text", () => {
    render(<DeviceLimitNotice />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Du hast die Höchstzahl von 20 Geräten erreicht. Lösche ein Gerät, um ein neues anzulegen.",
    );
  });
});

describe("DevicesLoadError", () => {
  it("shows the error text and retries", () => {
    const onRetry = vi.fn();
    render(<DevicesLoadError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Deine Geräte konnten gerade nicht geladen werden.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("DevicesSkeleton (AC-22)", () => {
  it("is marked busy with a screen-reader label and shows no real content", () => {
    const { container } = render(<DevicesSkeleton />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText("Geräte werden geladen")).toHaveClass("sr-only");
    expect(screen.queryByText("Gerät hinzufügen")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });
});

describe("DeleteDeviceDialog (AC-12)", () => {
  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  function setup(deviceName = "Waschmaschine", onConfirm = vi.fn(() => Promise.resolve())) {
    const onOpenChange = vi.fn();
    render(
      <DeleteDeviceDialog
        open
        onOpenChange={onOpenChange}
        deviceName={deviceName}
        onConfirm={onConfirm}
      />,
    );
    return { onOpenChange, onConfirm };
  }

  it("shows the title with the name in German quotes and the description", () => {
    setup();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("„Waschmaschine“ löschen?")).toBeInTheDocument();
    expect(screen.getByText("Das Gerät wird sofort und endgültig gelöscht.")).toBeInTheDocument();
  });

  it("renders the name as plain text, never as HTML", () => {
    setup("<b>x</b>");
    const title = screen.getByText("„<b>x</b>“ löschen?");
    expect(title.querySelector("b")).toBeNull();
  });

  it("„Abbrechen“ closes via onOpenChange(false) without deleting", () => {
    const { onOpenChange, onConfirm } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("„Löschen“ calls onConfirm once, stays open and disables both buttons while pending", async () => {
    const d = deferred();
    const onConfirm = vi.fn(() => d.promise);
    const { onOpenChange } = setup("Waschmaschine", onConfirm);

    const remove = screen.getByRole("button", { name: "Löschen" });
    fireEvent.click(remove);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // The action click itself does not close the dialog – the parent does that after deleting.
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Löschen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Löschen" }).querySelector(".animate-spin")).not.toBeNull();

    // A second click while pending does not delete again.
    fireEvent.click(screen.getByRole("button", { name: "Löschen" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      d.resolve();
      await d.promise;
    });
    expect(screen.getByRole("button", { name: "Löschen" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeEnabled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
