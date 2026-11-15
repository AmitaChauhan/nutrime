// NutriMe accounts + cloud sync (Supabase). Plain script, loaded before the app.
// Your data is stored in your own Supabase project, one row per setting/list, and
// row-level security means each account can only ever read or change its own rows.
(function () {
  const P = "nutrime.";
  // Never synced: secrets and things that only make sense on this device.
  const LOCAL = new Set(["passcode", "apikey", "ormodel", "site", "remFired", "nudgeAt", "__session", "__t", "__dirty", "__linked", "__synced", "__auth"]);
  const raw = { get(k, d) { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(P + k); } catch {} } };
  let cfg = raw.get("__auth", null); // {url, anon}, remembered so the app works offline
  let timer = null, syncing = null;

  const session = () => raw.get("__session", null);
  const syncable = k => !LOCAL.has(k) && !k.startsWith("__");
  function localKeys() { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P) && syncable(k.slice(P.length))) out.push(k.slice(P.length)); } return out; }

  async function api(path, opts = {}, token) {
    if (!cfg) throw { code: "no_auth" };
    const r = await fetch(cfg.url + path, { ...opts, headers: { apikey: cfg.anon, "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}), ...(opts.headers || {}) } });
    const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) throw { status: r.status, code: data?.error_code || data?.code || data?.error || "error", msg: data?.msg || data?.error_description || data?.message || "" };
    return data;
  }
  function keep(d) {
    if (!d || !d.access_token) return null;
    const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user: { id: d.user?.id, email: d.user?.email } };
    raw.set("__session", s); return s;
  }
  async function token() {
    const s = session(); if (!s) return null;
    if (s.expires_at - 60000 > Date.now()) return s.access_token;
    try { return keep(await api("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: s.refresh_token }) }))?.access_token || null; }
    catch (e) { if (e.status === 400 || e.status === 401) { raw.del("__session"); window.dispatchEvent(new Event("nutrime-signed-out")); } return null; }
  }

  // ---------- merging (used the first time a phone/browser joins an account) ----------
  const isIdList = v => Array.isArray(v) && v.length && v.every(x => x && typeof x === "object" && "id" in x);
  function merge(key, mine, theirs) {
    if (mine == null) return theirs; if (theirs == null) return mine;
    if (Array.isArray(mine) && Array.isArray(theirs)) {
      if (isIdList(mine) || isIdList(theirs)) { const m = new Map(); for (const x of theirs) if (x && x.id != null) m.set(x.id, x); for (const x of mine) if (x && x.id != null) m.set(x.id, x); return [...m.values()]; }
      if (key === "rows") return mine.length ? mine : theirs;
      if (mine.every(x => typeof x !== "object")) return [...new Set([...theirs, ...mine])];
      return mine;
    }
    if (typeof mine === "object" && typeof theirs === "object") {
      if (key === "checkins" || key === "health") { const o = { ...theirs }; for (const [d, v] of Object.entries(mine)) o[d] = { ...(theirs[d] || {}), ...v }; return o; }
      return { ...theirs, ...mine };
    }
    return mine;
  }

  // ---------- sync ----------
  function markDirty(k) {
    if (!syncable(k)) return;
    const t = raw.get("__t", {}); t[k] = Date.now(); raw.set("__t", t);
    const d = new Set(raw.get("__dirty", [])); d.add(k); raw.set("__dirty", [...d]);
    if (session()) { clearTimeout(timer); timer = setTimeout(() => sync().catch(() => {}), 2500); }
  }
  async function push(tok, keepalive) {
    const s = session(), dirty = raw.get("__dirty", []); if (!dirty.length || !s) return 0;
    const t = raw.get("__t", {});
    const rows = dirty.map(k => ({ user_id: s.user.id, key: k, value: raw.get(k, null), updated_at: t[k] || Date.now() }));
    await api("/rest/v1/user_data?on_conflict=user_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows), keepalive: !!keepalive }, tok);
    const left = raw.get("__dirty", []).filter(k => !dirty.includes(k) || (raw.get("__t", {})[k] || 0) > (t[k] || 0));
    raw.set("__dirty", left); return rows.length;
  }
  // Returns true when data from the cloud changed something on this device.
  async function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      const s = session(); if (!s || !navigator.onLine) return false;
      const tok = await token(); if (!tok) return false;
      const rows = await api("/rest/v1/user_data?select=key,value,updated_at", { method: "GET" }, tok) || [];
      const first = raw.get("__linked", null) !== s.user.id;
      const t = raw.get("__t", {}), dirty = new Set(raw.get("__dirty", []));
      let changed = false;
      const seen = new Set();
      for (const r of rows) {
        if (!syncable(r.key)) continue; seen.add(r.key);
        const mine = raw.get(r.key, null);
        if (first) {
          const m = merge(r.key, mine, r.value);
          if (JSON.stringify(m) !== JSON.stringify(mine)) { raw.set(r.key, m); changed = true; }
          if (JSON.stringify(m) !== JSON.stringify(r.value)) { dirty.add(r.key); t[r.key] = Date.now(); } else t[r.key] = r.updated_at;
        } else if (r.updated_at > (t[r.key] || 0) && !dirty.has(r.key)) {
          if (JSON.stringify(mine) !== JSON.stringify(r.value)) { raw.set(r.key, r.value); changed = true; }
          t[r.key] = r.updated_at;
        }
      }
      for (const k of localKeys()) if (!seen.has(k)) { dirty.add(k); t[k] = t[k] || Date.now(); }
      raw.set("__t", t); raw.set("__dirty", [...dirty]); raw.set("__linked", s.user.id);
      await push(tok);
      raw.set("__synced", Date.now());
      window.dispatchEvent(new CustomEvent("nutrime-synced", { detail: { changed } }));
      return changed;
    })();
    try { return await syncing; } finally { syncing = null; }
  }

  // ---------- account ----------
  async function signIn(email, password) { const s = keep(await api("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) })); if (!s) throw { code: "error" }; return s; }
  async function signUp(email, password) { const d = await api("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) }); return keep(d); }
  async function recover(email) { await api("/auth/v1/recover", { method: "POST", body: JSON.stringify({ email }) }); }
  async function signOut() {
    try { const tok = await token(); if (tok) { await push(tok); await api("/auth/v1/logout", { method: "POST" }, tok).catch(() => {}); } } catch {}
    // Your data is safe in your account, so clear this device.
    const keepKeys = new Set(["site", "__auth"]);
    const all = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P) && !keepKeys.has(k.slice(P.length))) all.push(k); }
    all.forEach(k => localStorage.removeItem(k));
  }

  // ---------- Google sign-in (Supabase OAuth, tokens come back in the URL) ----------
  const oauthUrl = (provider, redirect) => cfg ? `${cfg.url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirect)}` : null;
  async function finishOAuth(params) {
    if (params.error || params.error_description) throw { code: params.error || "oauth", msg: params.error_description || params.error };
    if (!params.access_token) return null;
    const user = await api("/auth/v1/user", { method: "GET" }, params.access_token);
    return keep({ access_token: params.access_token, refresh_token: params.refresh_token, expires_in: Number(params.expires_in) || 3600, user });
  }
  const parseFrag = href => { const i = href.indexOf("#"), q = href.indexOf("?"); const str = i >= 0 ? href.slice(i + 1) : q >= 0 ? href.slice(q + 1) : ""; return Object.fromEntries(new URLSearchParams(str)); };
  // On the website the sign-in lands back on /app/#access_token=…; take it out of the address
  // straight away so nothing else sees it.
  try {
    const f = parseFrag(location.hash ? "#" + location.hash.slice(1) : "");
    if (f.access_token || f.error_description) { sessionStorage.setItem("nutrime.oauth", JSON.stringify(f)); history.replaceState(null, "", location.pathname + "#kitchen"); }
  } catch {}

  document.addEventListener("visibilitychange", () => { if (!session()) return; if (document.hidden) token().then(tok => tok && push(tok, true)).catch(() => {}); else sync().catch(() => {}); });
  window.addEventListener("online", () => session() && sync().catch(() => {}));

  window.NMAccount = {
    configure(a) { cfg = a && a.url && a.anon ? { url: String(a.url).replace(/\/+$/, ""), anon: a.anon } : null; if (cfg) raw.set("__auth", cfg); else raw.del("__auth"); },
    get enabled() { return !!cfg; }, oauthUrl, finishOAuth, parseFrag,
    takePendingOAuth() { try { const v = sessionStorage.getItem("nutrime.oauth"); sessionStorage.removeItem("nutrime.oauth"); return v ? JSON.parse(v) : null; } catch { return null; } },
    session, token, signIn, signUp, recover, signOut, sync, markDirty,
    lastSynced: () => raw.get("__synced", 0), pending: () => raw.get("__dirty", []).length,
  };
})();
