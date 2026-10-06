import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// "/" has no page of its own (AC-14). src/proxy.ts redirects first; this is the fallback.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  redirect(data?.claims?.sub ? "/dashboard" : "/login");
}
