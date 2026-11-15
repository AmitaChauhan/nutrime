// NutriMe AI proxy. Holds the OpenRouter key on the server so it never reaches the phone.
// Set these in Netlify: Site configuration > Environment variables
//   OPENROUTER_API_KEY  your OpenRouter key (required)
//   APP_PASSCODE        a passcode you type into the app once (required)
//   OPENROUTER_MODEL    optional, an OpenRouter model id that accepts images
//   SUPABASE_URL        optional, turns on accounts + cloud sync (Supabase project URL)
//   SUPABASE_ANON_KEY   optional, the project's public "anon" key (safe to share; data is protected per user)
//   ALLOWED_EMAILS      optional, comma-separated emails allowed to use the AI (recommended with accounts)
import { timingSafeEqual, createHash } from "node:crypto";

const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
const MAX_IMAGES = 4;
const MAX_PROMPT = 20000;
const MAX_IMAGE_B64 = 1_500_000; // about 1.1 MB per resized photo

// The Android/iPhone app runs from https://localhost or capacitor://localhost, so allow those origins.
const APP_ORIGINS = new Set(["https://localhost", "capacitor://localhost", "http://localhost"]);
let corsOrigin = "";
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...(corsOrigin ? { "access-control-allow-origin": corsOrigin, "vary": "Origin" } : {}) } });
const sameText = (a, b) => timingSafeEqual(createHash("sha256").update(String(a)).digest(), createHash("sha256").update(String(b)).digest());

// Accounts: check a Supabase sign-in token. Results are cached for a few minutes.
const tokenCache = new Map();
async function userFromToken(token) {
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || typeof token !== "string" || token.length < 20) return null;
  const hit = tokenCache.get(token); if (hit && hit.until > Date.now()) return hit.user;
  try {
    const r = await fetch(url.replace(/\/+$/, "") + "/auth/v1/user", { headers: { apikey: anon, authorization: "Bearer " + token } });
    const user = r.ok ? await r.json() : null;
    if (tokenCache.size > 200) tokenCache.clear();
    tokenCache.set(token, { user, until: Date.now() + 5 * 60000 });
    return user;
  } catch { return null; }
}
const emailAllowed = email => { const list = (process.env.ALLOWED_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean); return !list.length || list.includes(String(email || "").toLowerCase()); };

export default async (req) => {
  const key = process.env.OPENROUTER_API_KEY;
  const pass = process.env.APP_PASSCODE;
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const origin = req.headers.get("origin") || "";
  corsOrigin = APP_ORIGINS.has(origin) ? origin : "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsOrigin ? { "access-control-allow-origin": corsOrigin, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", "vary": "Origin" } : {} });
  const sbUrl = process.env.SUPABASE_URL, sbAnon = process.env.SUPABASE_ANON_KEY;
  const auth = sbUrl && sbAnon ? { url: sbUrl.replace(/\/+$/, ""), anon: sbAnon } : null;
  if (req.method === "GET") return json(200, { server: true, ready: Boolean(key && (pass || auth)), model, auth });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!key || !(pass || auth)) return json(500, { error: "not_configured" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  let ok = false;
  if (body && body.token && auth) { const u = await userFromToken(body.token); if (u && u.id) { if (!emailAllowed(u.email)) return json(403, { error: "not_allowed" }); ok = true; } }
  if (!ok && body && pass && typeof body.passcode === "string" && sameText(body.passcode, pass)) ok = true;
  if (!ok) {
    await new Promise(r => setTimeout(r, 800)); // slow down guessing
    return json(401, { error: "passcode" });
  }
  if (body.check === true) return json(200, { ok: true }); // sign-in screen checks the passcode
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, MAX_PROMPT) : "";
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!prompt) return json(400, { error: "bad_request" });
  if (images.some(i => typeof i !== "string" || i.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(i))) return json(400, { error: "bad_image" });

  const content = images.map(b64 => ({ type: "image_url", image_url: { url: "data:image/jpeg;base64," + b64 } }));
  content.push({ type: "text", text: prompt });

  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json", "HTTP-Referer": new URL(req.url).origin, "X-Title": "NutriMe Kitchen" },
      body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: "user", content }] }),
    });
  } catch {
    return json(502, { error: "upstream_error" });
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) return json(502, { error: "server_key" });
  if (res.status === 402) return json(402, { error: "credits" });
  if (res.status === 429) return json(429, { error: "rate_limited" });
  if (!res.ok || !data || data.error) {
    const msg = String(data?.error?.message || "");
    return json(502, { error: /image|vision|modalit/i.test(msg) ? "no_vision" : "upstream_error" });
  }
  const msg = data.choices?.[0]?.message?.content;
  const text = Array.isArray(msg) ? msg.map(p => p.text || "").join("") : String(msg || "");
  if (!text.trim()) return json(502, { error: "empty_completion" });
  return json(200, { text, model });
};

export const config = { path: "/api/ai" };
