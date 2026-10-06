import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordChangedToast } from "@/components/account-dialogs";
import { LivePricesProvider } from "@/components/prices/live-prices-provider";
import { PriceSection } from "@/components/prices/price-section";

export const metadata: Metadata = { title: "Übersicht – WattWann" };

// Content area of the shell. PROJ-2 ("Strompreise") and PROJ-3 ("Meine Geräte") add their sections here.
// LivePricesProvider gives both sections one shared price state: same payload, same "now", one clock (PROJ-3).
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Übersicht</h1>
      <LivePricesProvider>
        <PriceSection />
        <p className="text-muted-foreground">Hier siehst du bald deine Geräte.</p>
      </LivePricesProvider>
      <Suspense fallback={null}>
        <PasswordChangedToast />
      </Suspense>
    </div>
  );
}
