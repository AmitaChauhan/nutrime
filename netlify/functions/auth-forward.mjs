// Safety net for sign-in: if anything sends the browser to nutrime.nl/auth/v1/... (for example a
// Google redirect URI pointing at this site instead of Supabase), pass it on to Supabase.
import { normSbUrl } from "./ai.mjs";
export default async (req) => {
  const base = normSbUrl(process.env.SUPABASE_URL);
  if (!base) return new Response("Accounts aren't set up on this site yet (SUPABASE_URL is missing).", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const u = new URL(req.url);
  return new Response(null, { status: 302, headers: { location: base + u.pathname + u.search, "cache-control": "no-store" } });
};
export const config = { path: "/auth/v1/*" };
