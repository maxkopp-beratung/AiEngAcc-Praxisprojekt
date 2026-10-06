import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

type AuthCardProps = {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

// Shared card for every auth page. The "Datenschutz" link is always there (AC-26).
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-2">
        <p className="text-sm font-semibold text-primary">WattWann</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm text-muted-foreground">
        {footer}
        <Link
          href="/datenschutz"
          className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Datenschutz
        </Link>
      </CardFooter>
    </Card>
  );
}
