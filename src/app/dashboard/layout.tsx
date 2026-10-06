import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

// Protected frame of the dashboard (AC-16). The user is verified against the auth server here —
// not only from the token — so a deleted account is shut out on the next request (EC-6).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdashboard");

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <div className="min-h-screen">
      <AppHeader displayName={profile?.display_name ?? null} email={user.email ?? ""} />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
