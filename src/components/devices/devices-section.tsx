import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DevicesPanel } from "@/components/devices/devices-panel";
import { DevicesSkeleton } from "@/components/devices/devices-skeleton";
import { listDevices } from "@/lib/devices/queries";
import { createClient } from "@/lib/supabase/server";

// Loads the user's devices on the server. Checks the session itself before reading anything (AC-2):
// Next renders layout and page in parallel, so the dashboard layout's redirect alone does not keep
// data out of the response (same pattern as PriceSection, PROJ-2 BUG-2). RLS is the second check.
export async function DevicesSectionContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  // null = the read failed → the panel shows its load error state.
  const devices = await listDevices(supabase);
  return <DevicesPanel initialDevices={devices} />;
}

// Own Suspense boundary: the devices appear independently of the prices, with card skeletons
// while loading (AC-22), and a failing price source never hides them (AC-23).
export function DevicesSection() {
  return (
    <Suspense fallback={<DevicesSkeleton />}>
      <DevicesSectionContent />
    </Suspense>
  );
}
