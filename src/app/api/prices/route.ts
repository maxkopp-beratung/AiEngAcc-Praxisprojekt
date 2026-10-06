// GET /api/prices — today's and tomorrow's day-ahead prices for signed-in users only (AC-2).
// The proxy does not guard /api/*, so the handler checks the session itself against the auth server.
// A failed load is a data state (`today.status = "error"`), not a server error: still 200 (AC-23).
// Reading the session cookies makes this route dynamic; nothing here is cached.
import { getPrices } from "@/lib/prices/get-prices";
import { createClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });

  const payload = await getPrices();
  return Response.json(payload, { status: 200, headers: NO_STORE });
}
