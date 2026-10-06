import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PricePanel } from "@/components/prices/price-panel";
import { PriceSectionSkeleton } from "@/components/prices/price-section-skeleton";
import { getPrices } from "@/lib/prices/get-prices";
import { createClient } from "@/lib/supabase/server";

// Loads the first payload on the server (no HTTP round trip to /api/prices). It checks the session
// itself against the auth server first (AC-2): Next renders layout and page in parallel, so the
// dashboard layout's redirect alone does not keep the prices out of the response.
export async function PriceSectionContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  const initial = await getPrices();
  return <PricePanel initial={initial} />;
}

// Own Suspense boundary: header and page title render at once, the prices stream in behind a skeleton (AC-22),
// and a slow or failing Energy-Charts never blocks the rest of the dashboard (AC-23).
export function PriceSection() {
  return (
    <Suspense fallback={<PriceSectionSkeleton />}>
      <PriceSectionContent />
    </Suspense>
  );
}
