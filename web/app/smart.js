// NutriMe smart nudges: finds free moments in today's calendar and suggests a walk
// (to reach your steps goal) or a short breathing session. Calendar and steps are read
// on this phone (Android app); nothing here is sent anywhere.
import { dayKey } from "./journal.js";
const NM = window.NM;
const { store, esc, fmt } = NM;
const $ = s => document.querySelector(s);
const native = !!window.Capacitor?.isNativePlatform?.();
const Cal = native ? window.Capacitor?.Plugins?.CapacitorCalendar : null;
const LN = native ? window.Capacitor?.Plugins?.LocalNotifications : null;
const pad = n => String(n).padStart(2, "0");
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const DAY_START = 8, DAY_END = 21, MIN_GAP = 15, SPACING = 120; // minutes
const cfg = () => ({ on: false, goal: 10000, cal: false, ...store.get("smart", {}) });
const saveCfg = c => store.set("smart", c);

let events = []; // today's timed events [{title, start, end}]

// ---------- data ----------
async function loadCalendar() {
  events = [];
  if (!Cal || !cfg().cal) { NM.calText = ""; return; }
  try {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    const { result } = await Cal.listEventsInRange({ from: from.getTime(), to: to.getTime() });
    events = (result || []).filter(e => !e.isAllDay && e.availability !== "free")
      .map(e => ({ title: e.title || "Busy", start: new Date(e.startDate), end: new Date(e.endDate) }))
      .sort((a, b) => a.start - b.start);
    NM.calText = events.map(e => `${hm(e.start)}-${hm(e.end)} ${e.title.slice(0, 40)}`).join("; ") || "nothing scheduled";
  } catch (e) { console.warn("Calendar read failed", e); NM.calText = ""; }
}
async function loadSteps() {
  if (native && window.NutriHealthSync) {
    try {
      const data = await window.NutriHealthSync(1);
      const h = store.get("health", {});
      for (const [d, v] of Object.entries(data || {})) h[d] = { ...(h[d] || {}), ...v };
      store.set("health", h);
    } catch {}
  }
  const s = store.get("health", {})[dayKey(new Date())]?.steps;
  NM.stepsText = s != null ? `Steps today: ${s} of ${cfg().goal} goal.` : "";
  return s;
}
const movedToday = () => store.get("activities", []).filter(a => a.day === dayKey(new Date()));

// Free gaps between now and the end of the day, at least 15 minutes long.
function gaps(now = new Date()) {
  const start = new Date(now), end = new Date(now); end.setHours(DAY_END, 0, 0, 0);
  const dayStart = new Date(now); dayStart.setHours(DAY_START, 0, 0, 0);
  if (start < dayStart) start.setTime(dayStart.getTime());
  const out = []; let cur = start;
  for (const e of events) {
    if (e.end <= cur) continue;
    if (e.start > cur) out.push({ from: new Date(cur), to: new Date(Math.min(e.start, end)) });
    if (e.end > cur) cur = new Date(e.end);
    if (cur >= end) break;
  }
  if (cur < end) out.push({ from: new Date(cur), to: end });
  return out.map(g => ({ ...g, min: Math.floor((g.to - g.from) / 60000) })).filter(g => g.min >= MIN_GAP);
}

// What to suggest for a gap of a given length.
function idea(min, steps) {
  const c = cfg(), short = steps != null ? Math.max(0, c.goal - steps) : null;
  const walkMin = Math.min(30, min - 5 >= 15 ? Math.min(30, Math.round((min - 5) / 5) * 5) : 10);
  const mindful = movedToday().some(a => a.type === "meditation" || a.type === "yoga");
  if (short && short > 300 && min >= 15) return { kind: "walk", title: `Walk for ${walkMin} minutes?`, body: `About ${fmt(walkMin * 100)} steps. You're ${fmt(short)} short of ${fmt(c.goal)} today.`, href: "#move" };
  if (!mindful) return { kind: "breathe", title: "5 minutes of calm breathing?", body: "You have a free moment. A short breathing session resets the afternoon.", href: "#move" };
  if (steps == null && min >= 20) return { kind: "walk", title: `A ${walkMin}-minute walk?`, body: "You have a free moment. A short walk lifts energy and helps digestion.", href: "#move" };
  return null;
}

// ---------- nudges ----------
function nowNudge(steps) {
  const c = cfg(); if (!c.on) return null;
  const now = new Date(), g = gaps(now)[0];
  if (!g || g.from > now) return null; // only when you're free right now
  const left = Math.floor((g.to - now) / 60000); if (left < MIN_GAP) return null;
  const i = idea(left, steps); if (!i) return null;
  return { ...i, until: g.to, left };
}
function renderNow(n) {
  const box = $("#smartNow"); if (!box) return;
  box.innerHTML = n ? `<div class="panel" style="gap:6px;background:var(--sunk);border:0"><b>${esc(n.title)}</b><span class="source" style="margin:0">${esc(n.body)} You're free until ${hm(n.until)}.</span><div><a class="btn" href="${n.href}">Start</a></div></div>` : "";
  // Also show it at the top of the Assistant.
  const had = !!NM.nudge; NM.nudge = n;
  const t = $("#asToday"); if (t && (had || n)) { t.querySelector(".nudge")?.remove(); if (n) t.insertAdjacentHTML("afterbegin", `<a class="due nudge" href="${n.href}">${esc(n.title)}</a>`); }
}
// Website: notify while the app is open. Android: schedule the day's nudges as notifications.
function maybeNotify(n) {
  if (!n || native) return;
  const last = store.get("nudgeAt", 0); if (Date.now() - last < SPACING * 60000) return;
  store.set("nudgeAt", Date.now()); NM.notify?.(n.title, n.body, "nudge");
}
async function scheduleDay(steps) {
  if (!LN) return;
  try {
    const pending = (await LN.getPending()).notifications || [];
    const old = pending.filter(p => p.id >= 3000 && p.id < 3100);
    if (old.length) await LN.cancel({ notifications: old.map(p => ({ id: p.id })) });
    const c = cfg(); if (!c.on) return;
    const list = []; let lastAt = 0, est = steps;
    for (const g of gaps(new Date(Date.now() + 15 * 60000))) { // the free moment right now is shown in the app instead
      const at = new Date(g.from.getTime() + 2 * 60000);
      if (at - lastAt < SPACING * 60000 || list.length >= 4) continue;
      const i = idea(g.min, est); if (!i) continue;
      list.push({ id: 3000 + list.length, title: i.title, body: `${i.body} Free until ${hm(g.to)}.`, schedule: { at, allowWhileIdle: true } });
      lastAt = at; if (i.kind === "walk" && est != null) est += 1500;
    }
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { console.warn("Nudges could not be scheduled", e); }
}

// ---------- settings ----------
function renderSettings() {
  const c = cfg();
  $("#remSmart").checked = c.on; $("#stepGoal").value = c.goal;
  $("#calConnect").hidden = !Cal || c.cal;
  $("#calState").textContent = !native ? "Calendar and steps come from your phone in the Android app. On the website, nudges use your Move sessions."
    : c.cal ? `Calendar connected: ${events.length ? `${events.length} event${events.length > 1 ? "s" : ""} today` : "nothing scheduled today"}.` : "Connect your phone's calendar (Google included) so nudges fit around your plans.";
}
async function connectCalendar() {
  try {
    const { result } = await Cal.requestReadOnlyCalendarAccess();
    if (result !== "granted") { $("#calState").textContent = "Calendar access was not allowed. You can allow it in your phone's settings."; return; }
    const c = cfg(); c.cal = true; c.on = true; saveCfg(c);
    await refresh();
  } catch { $("#calState").textContent = "Couldn't open your calendar on this phone."; }
}
let running = false;
async function refresh() {
  if (running) return; running = true;
  try {
    await loadCalendar();
    const steps = await loadSteps();
    const n = nowNudge(steps);
    renderSettings(); renderNow(n); maybeNotify(n);
    await scheduleDay(steps);
  } finally { running = false; }
}
$("#remSmart").addEventListener("change", e => { const c = cfg(); c.on = e.target.checked; saveCfg(c); if (c.on) NM.askNotifyPermission?.(); refresh(); });
$("#stepGoal").addEventListener("change", e => { const v = Math.round(Number(e.target.value)); if (v >= 1000 && v <= 40000) { const c = cfg(); c.goal = v; saveCfg(c); refresh(); } });
$("#calConnect").addEventListener("click", connectCalendar);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
setInterval(refresh, 5 * 60000);
const _renderAsk = NM.renderAsk; NM.renderAsk = () => { _renderAsk?.(); refresh(); };
NM.smartGaps = gaps; NM.smartRefresh = refresh;
refresh();
