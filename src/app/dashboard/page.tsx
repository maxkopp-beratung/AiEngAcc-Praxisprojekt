import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordChangedToast } from "@/components/account-dialogs";
import { PriceSection } from "@/components/prices/price-section";

export const metadata: Metadata = { title: "Übersicht – WattWann" };

// Content area of the shell. PROJ-2 ("Strompreise") and PROJ-3 ("Meine Geräte") add their sections here.
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Übersicht</h1>
      <PriceSection />
      <p className="text-muted-foreground">Hier siehst du bald deine Geräte.</p>
      <Suspense fallback={null}>
        <PasswordChangedToast />
      </Suspense>
    </div>
  );
}
