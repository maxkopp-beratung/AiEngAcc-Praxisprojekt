import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholder while the price section loads (AC-22): skeletons in the shape of the later content
// (design system → Ladezustand) – title + tabs, three key-figure cards, the chart and the footer.
export function PriceSectionSkeleton() {
  return (
    <section aria-busy="true" className="space-y-6">
      <span className="sr-only">Strompreise werden geladen</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-5 shadow-none">
              <div className="flex items-center gap-2">
                <Skeleton className="size-7" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="mt-3 h-8 w-28" />
              <Skeleton className="mt-2 h-4 w-20" />
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>
    </section>
  );
}
