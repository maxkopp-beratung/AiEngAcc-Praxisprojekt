import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholder while "Meine Geräte" loads (AC-22): skeletons in the shape of the later content
// (design system → Ladezustand) – title row plus two device cards (name, run time, two
// recommendation lines on a primary-subtle-like block). No spinner.
export function DevicesSkeleton() {
  return (
    <section aria-busy="true" className="space-y-4">
      <span className="sr-only">Geräte werden geladen</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="p-5 shadow-none">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="size-10" />
              </div>
              <div className="mt-4 space-y-2 rounded-md bg-primary-subtle/60 p-4">
                <Skeleton className="h-5 w-full max-w-xs" />
                <Skeleton className="h-4 w-full max-w-[14rem]" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
