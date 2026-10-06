import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  DeviceDialog,
  type DeviceDialogOutcome,
  type DeviceDialogValues,
} from "@/components/devices/device-dialog";

// Radix Select uses pointer capture and scrollIntoView, which jsdom does not implement.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

const DURATION_MESSAGE = "Die Laufzeit muss zwischen 0:15 und 12:00 h liegen, in 15-Minuten-Schritten.";

type Props = Partial<React.ComponentProps<typeof DeviceDialog>>;

function renderDialog(props: Props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn(async (): Promise<DeviceDialogOutcome> => ({ ok: true }));
  const onOpenChange = props.onOpenChange ?? vi.fn();
  const view = render(
    <DeviceDialog
      open
      mode="create"
      initialValues={null}
      {...props}
      onSubmit={onSubmit}
      onOpenChange={onOpenChange}
    />,
  );
  return { ...view, onSubmit, onOpenChange };
}

const nameInput = () => screen.getByLabelText("Name") as HTMLInputElement;
const hoursTrigger = () => screen.getByLabelText("Stunden");
const minutesTrigger = () => screen.getByLabelText("Minuten");
const saveButton = () => screen.getByRole("button", { name: "Speichern" });

function choose(trigger: HTMLElement, optionLabel: string) {
  fireEvent.keyDown(trigger, { key: "Enter" });
  const listbox = screen.getByRole("listbox");
  fireEvent.click(within(listbox).getByRole("option", { name: optionLabel }));
}

function typeName(value: string) {
  fireEvent.change(nameInput(), { target: { value } });
}

describe("DeviceDialog — titles and prefill", () => {
  it("shows 'Gerät hinzufügen' in create mode", () => {
    renderDialog({ mode: "create" });
    expect(screen.getByRole("dialog", { name: "Gerät hinzufügen" })).toBeInTheDocument();
  });

  it("shows 'Gerät bearbeiten' in edit mode", () => {
    renderDialog({ mode: "edit", initialValues: { name: "Spülmaschine", durationMinutes: 90 } });
    expect(screen.getByRole("dialog", { name: "Gerät bearbeiten" })).toBeInTheDocument();
  });

  it("prefills name and duration from initialValues", () => {
    renderDialog({ initialValues: { name: "Waschmaschine", durationMinutes: 150 } });
    expect(nameInput()).toHaveValue("Waschmaschine");
    expect(hoursTrigger()).toHaveTextContent("2");
    expect(minutesTrigger()).toHaveTextContent("30");
  });

  it("starts with an empty name and 1 h 00 min without initialValues", () => {
    renderDialog({ initialValues: null });
    expect(nameInput()).toHaveValue("");
    expect(hoursTrigger()).toHaveTextContent("1");
    expect(minutesTrigger()).toHaveTextContent("00");
  });

  it("focuses the name field when it opens", () => {
    renderDialog({ initialValues: { name: "Trockner", durationMinutes: 60 } });
    expect(nameInput()).toHaveFocus();
  });

  it("resets to the new initialValues when reopened", () => {
    const onSubmit = vi.fn(async (): Promise<DeviceDialogOutcome> => ({ ok: true }));
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <DeviceDialog open mode="create" initialValues={null} onSubmit={onSubmit} onOpenChange={onOpenChange} />,
    );
    typeName("Getippt");
    rerender(
      <DeviceDialog open={false} mode="create" initialValues={null} onSubmit={onSubmit} onOpenChange={onOpenChange} />,
    );
    const next: DeviceDialogValues = { name: "E-Auto", durationMinutes: 240 };
    rerender(<DeviceDialog open mode="edit" initialValues={next} onSubmit={onSubmit} onOpenChange={onOpenChange} />);
    expect(nameInput()).toHaveValue("E-Auto");
    expect(hoursTrigger()).toHaveTextContent("4");
    expect(minutesTrigger()).toHaveTextContent("00");
  });

  it("gives every field an accessible name and shows the help text", () => {
    renderDialog();
    expect(nameInput().tagName).toBe("INPUT");
    expect(hoursTrigger()).toHaveAttribute("role", "combobox");
    expect(minutesTrigger()).toHaveAttribute("role", "combobox");
    expect(screen.getByRole("group", { name: "Laufzeit" })).toBeInTheDocument();
    expect(screen.getByText("Höchstens 40 Zeichen")).toBeInTheDocument();
    // No hard limit on the input, so the length message can appear.
    expect(nameInput()).not.toHaveAttribute("maxlength");
  });

  it("renders the name as text, never as HTML", () => {
    renderDialog({ initialValues: { name: "<b>fett</b>", durationMinutes: 60 } });
    expect(nameInput()).toHaveValue("<b>fett</b>");
    expect(document.querySelector("b")).toBeNull();
  });
});

describe("DeviceDialog — validation", () => {
  it("rejects an empty name and does not call onSubmit", async () => {
    const { onSubmit } = renderDialog();
    typeName("   ");
    fireEvent.click(saveButton());
    expect(await screen.findByText("Bitte gib einen Namen ein.")).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 40 characters", async () => {
    const { onSubmit } = renderDialog();
    typeName("a".repeat(41));
    fireEvent.click(saveButton());
    expect(await screen.findByText("Der Name darf höchstens 40 Zeichen lang sein.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects 0 h 00 min with the duration message", async () => {
    const { onSubmit } = renderDialog({ initialValues: { name: "Trockner", durationMinutes: 60 } });
    choose(hoursTrigger(), "0");
    choose(minutesTrigger(), "00");
    expect(hoursTrigger()).toHaveTextContent("0");
    fireEvent.click(saveButton());
    const message = await screen.findByText(DURATION_MESSAGE);
    expect(screen.getAllByText(DURATION_MESSAGE)).toHaveLength(1);
    expect(hoursTrigger()).toHaveAttribute("aria-describedby", message.id);
    expect(minutesTrigger()).toHaveAttribute("aria-describedby", message.id);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects 12 h 15 min with the duration message", async () => {
    const { onSubmit } = renderDialog({ initialValues: { name: "Trockner", durationMinutes: 60 } });
    choose(hoursTrigger(), "12");
    choose(minutesTrigger(), "15");
    fireEvent.click(saveButton());
    expect(await screen.findByText(DURATION_MESSAGE)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts 12 h 00 min", async () => {
    const { onSubmit } = renderDialog({ initialValues: { name: "Trockner", durationMinutes: 60 } });
    choose(hoursTrigger(), "12");
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Trockner", durationMinutes: 720 }));
  });
});

describe("DeviceDialog — submit", () => {
  it("calls onSubmit with the trimmed name and the duration in minutes", async () => {
    const { onSubmit } = renderDialog();
    typeName("  Waschmaschine  ");
    choose(hoursTrigger(), "2");
    choose(minutesTrigger(), "30");
    fireEvent.click(saveButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Waschmaschine", durationMinutes: 150 });
  });

  it("submits with Enter in the name field", async () => {
    const { onSubmit } = renderDialog({ initialValues: { name: "Spülmaschine", durationMinutes: 90 } });
    fireEvent.submit(nameInput().form!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Spülmaschine", durationMinutes: 90 }));
  });

  it("disables 'Speichern' with a spinner while pending and ignores a second click (EC-7)", async () => {
    let resolve!: (outcome: DeviceDialogOutcome) => void;
    const onSubmit = vi.fn(() => new Promise<DeviceDialogOutcome>((r) => (resolve = r)));
    renderDialog({ onSubmit, initialValues: { name: "Waschmaschine", durationMinutes: 150 } });

    fireEvent.click(saveButton());
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(saveButton().querySelector(".animate-spin")).not.toBeNull();
    fireEvent.click(saveButton());
    fireEvent.submit(nameInput().form!);
    await act(async () => {});
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ ok: true }));
    expect(saveButton()).toBeEnabled();
    expect(saveButton().querySelector(".animate-spin")).toBeNull();
  });

  it("shows a server field error under the name and keeps the inputs (AC-24)", async () => {
    const onSubmit = vi.fn(
      async (): Promise<DeviceDialogOutcome> => ({
        ok: false,
        fieldErrors: { name: "Du hast schon ein Gerät mit diesem Namen." },
      }),
    );
    renderDialog({ onSubmit });
    typeName("Waschmaschine");
    choose(hoursTrigger(), "2");
    choose(minutesTrigger(), "30");
    fireEvent.click(saveButton());

    const message = await screen.findByText("Du hast schon ein Gerät mit diesem Namen.");
    expect(nameInput()).toHaveAttribute("aria-describedby", expect.stringContaining(message.id));
    expect(nameInput()).toHaveValue("Waschmaschine");
    expect(hoursTrigger()).toHaveTextContent("2");
    expect(minutesTrigger()).toHaveTextContent("30");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a server duration error once below the selects", async () => {
    const onSubmit = vi.fn(
      async (): Promise<DeviceDialogOutcome> => ({ ok: false, fieldErrors: { duration: DURATION_MESSAGE } }),
    );
    renderDialog({ onSubmit, initialValues: { name: "Trockner", durationMinutes: 60 } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(DURATION_MESSAGE)).toBeInTheDocument();
    expect(screen.getAllByText(DURATION_MESSAGE)).toHaveLength(1);
  });

  it("shows a form error as an alert, keeps the inputs and clears it on the next submit", async () => {
    const onSubmit = vi
      .fn<(values: DeviceDialogValues) => Promise<DeviceDialogOutcome>>()
      .mockResolvedValueOnce({ ok: false, formError: "Das hat nicht geklappt. Bitte versuche es erneut." })
      .mockImplementationOnce(() => new Promise<DeviceDialogOutcome>(() => {}));
    renderDialog({ onSubmit });
    typeName("Waschmaschine");
    choose(hoursTrigger(), "2");
    choose(minutesTrigger(), "30");
    fireEvent.click(saveButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Das hat nicht geklappt. Bitte versuche es erneut.");
    expect(nameInput()).toHaveValue("Waschmaschine");
    expect(hoursTrigger()).toHaveTextContent("2");
    expect(minutesTrigger()).toHaveTextContent("30");

    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("closes via onOpenChange(false) on 'Abbrechen' without submitting", () => {
    const { onOpenChange, onSubmit } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("closes via onOpenChange(false) on Escape", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.keyDown(nameInput(), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
