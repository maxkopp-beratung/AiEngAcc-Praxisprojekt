import { Suspense } from "react";
import { PricePanel } from "@/components/prices/price-panel";
import { PriceSectionSkeleton } from "@/components/prices/price-section-skeleton";
import { getPrices } from "@/lib/prices/get-prices";

// Loads the first payload on the server (no HTTP round trip to /api/prices). The dashboard layout of
// PROJ-1 has already checked the session.
async function PriceSectionContent() {
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
