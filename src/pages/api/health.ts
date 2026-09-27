import type { APIRoute } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

export const GET: APIRoute = async () => {
  // astro:env declares both as optional, so narrow on the values themselves —
  // a separate `configured` boolean does not narrow them for TypeScript.
  const url = SUPABASE_URL;
  const key = SUPABASE_KEY;
  const configured = Boolean(url && key);
  let reachable: boolean | null = null;

  if (url && key) {
    try {
      const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
      reachable = response.ok;
    } catch {
      reachable = false;
    }
  }

  const ok = configured && reachable !== false;

  return new Response(JSON.stringify({ ok, supabase: { configured, reachable } }), {
    status: ok ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};
