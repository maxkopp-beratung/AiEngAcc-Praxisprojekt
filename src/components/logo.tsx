import { cn } from "@/lib/utils";

// WattWann logo (design B "Preis-Tal"): the day's price curve with a dot at the cheapest moment.
// Colors come from the design tokens, so the mark follows light and dark mode.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("h-8 w-8 shrink-0", className)}>
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <path
        d="M10 20c10 0 13 25 22 25s12-25 22-25"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <circle cx="32" cy="45" r="6.5" className="fill-primary-foreground" />
      <circle cx="32" cy="45" r="2.5" className="fill-primary" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <LogoMark className={markClassName} />
      <span>
        Watt<span className="text-primary">Wann</span>
      </span>
    </span>
  );
}
