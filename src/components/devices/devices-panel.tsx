"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DeleteDeviceDialog } from "@/components/devices/delete-device-dialog";
import { DeviceCard } from "@/components/devices/device-card";
import {
  DeviceDialog,
  type DeviceDialogOutcome,
  type DeviceDialogValues,
} from "@/components/devices/device-dialog";
import { DeviceLimitNotice, DevicesEmptyState, DevicesLoadError } from "@/components/devices/devices-states";
import { useLivePricesContext } from "@/components/prices/live-prices-provider";
import { Button } from "@/components/ui/button";
import { createDevice, deleteDevice, updateDevice } from "@/lib/devices/actions";
import { recommendationText, type RecommendationText } from "@/lib/devices/recommendation-text";
import { recommendStartWindow } from "@/lib/devices/start-window";
import { DEVICE_MESSAGES, MAX_DEVICES, type Device, type DeviceActionResult } from "@/lib/devices/types";

type DialogState = { open: boolean; mode: "create" | "edit"; initial: DeviceDialogValues | null; id: string | null };

const CLOSED: DialogState = { open: false, mode: "create", initial: null, id: null };

// Session expired or account deleted: reload, and PROJ-1's protection sends the user to /login.
function reloadForLogin() {
  window.location.reload();
}

// Calls a server action; a request that never answers (no connection) counts as an error (AC-24).
async function run(action: () => Promise<DeviceActionResult>): Promise<DeviceActionResult> {
  try {
    return await action();
  } catch {
    return { status: "error" };
  }
}

// The "Meine Geräte" section (PROJ-3). Holds the device list, computes each card's recommendation in the
// browser from the shared price state (AC-20, AC-21) and calls the server actions, taking over the list they
// return so the cards update without a reload (AC-5, AC-11, EC-10).
export function DevicesPanel({ initialDevices }: { initialDevices: Device[] | null }) {
  const [devices, setDevices] = useState<Device[]>(initialDevices ?? []);
  const [dialog, setDialog] = useState<DialogState>(CLOSED);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { payload, now } = useLivePricesContext();

  // Recomputed whenever the prices, "now" (each slot change) or the list change — never stored.
  const texts = useMemo(() => {
    const map = new Map<string, RecommendationText | null>();
    for (const device of devices) {
      map.set(
        device.id,
        payload
          ? recommendationText(recommendStartWindow(payload, now, device.durationMinutes), now, device.durationMinutes)
          : null,
      );
    }
    return map;
  }, [devices, payload, now]);

  if (initialDevices === null) {
    return (
      <section aria-labelledby="devices-heading" className="space-y-4">
        <h2 id="devices-heading" className="text-lg font-semibold">
          Meine Geräte
        </h2>
        <DevicesLoadError onRetry={() => window.location.reload()} />
      </section>
    );
  }

  const atLimit = devices.length >= MAX_DEVICES;

  const openCreate = (initial: DeviceDialogValues | null) => setDialog({ open: true, mode: "create", initial, id: null });
  const openEdit = (device: Device) =>
    setDialog({
      open: true,
      mode: "edit",
      initial: { name: device.name, durationMinutes: device.durationMinutes },
      id: device.id,
    });
  const closeDialog = () => setDialog((current) => ({ ...current, open: false }));

  async function save(values: DeviceDialogValues): Promise<DeviceDialogOutcome> {
    const id = dialog.id;
    const result = await run(() => (id ? updateDevice({ id, ...values }) : createDevice(values)));
    if ("devices" in result) setDevices(result.devices);

    switch (result.status) {
      case "ok":
        closeDialog();
        toast.success(DEVICE_MESSAGES.saved);
        return { ok: true };
      case "invalid":
        return { ok: false, fieldErrors: result.fieldErrors };
      case "duplicate_name":
        return { ok: false, fieldErrors: { name: DEVICE_MESSAGES.duplicateName } };
      case "limit_reached":
        return { ok: false, formError: DEVICE_MESSAGES.limitReached };
      case "not_found":
        closeDialog();
        toast.error(DEVICE_MESSAGES.notFound);
        return { ok: true };
      case "unauthorized":
        reloadForLogin();
        return { ok: false, formError: DEVICE_MESSAGES.failed };
      case "error":
        return { ok: false, formError: DEVICE_MESSAGES.failed };
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const result = await run(() => deleteDevice({ id: deleteTarget.id }));
    if ("devices" in result) setDevices(result.devices);
    if (result.status === "unauthorized") return reloadForLogin();

    setDeleteOpen(false);
    if (result.status === "ok") toast.success(DEVICE_MESSAGES.deleted);
    else if (result.status === "not_found") toast.error(DEVICE_MESSAGES.notFound);
    else toast.error(DEVICE_MESSAGES.failed);
  }

  return (
    <section aria-labelledby="devices-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="devices-heading" className="text-lg font-semibold">
          Meine Geräte
        </h2>
        {devices.length > 0 && (
          <Button onClick={() => openCreate(null)} disabled={atLimit}>
            <Plus aria-hidden="true" />
            Gerät hinzufügen
          </Button>
        )}
      </div>

      {atLimit && <DeviceLimitNotice />}

      {devices.length === 0 ? (
        <DevicesEmptyState onAdd={() => openCreate(null)} onPreset={(preset) => openCreate(preset)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              recommendation={texts.get(device.id) ?? null}
              onEdit={() => openEdit(device)}
              onDelete={() => {
                setDeleteTarget(device);
                setDeleteOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <DeviceDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        mode={dialog.mode}
        initialValues={dialog.initial}
        onSubmit={save}
      />
      <DeleteDeviceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        deviceName={deleteTarget?.name ?? ""}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
