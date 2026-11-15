// NutriMe journal: meal log, daily check-ins, health data and insights.
// Everything here is stored on this device only (localStorage), never on the server.
const NM = window.NM;
const { store, fmt, esc } = NM;
const $ = s => document.querySelector(s);

export const METRICS = [
  { k: "energy", label: "Energy", lo: "Drained", hi: "Full of energy", color: "var(--carb)" },
  { k: "mood", label: "Mood", lo: "Low", hi: "Great", color: "var(--protein)" },
  { k: "digestion", label: "Digestion", lo: "Bloated or upset", hi: "Comfortable", color: "var(--fiber)" },
  { k: "sleep", label: "Sleep last night", lo: "Poor", hi: "Great", color: "var(--fat)", prevDay: true },
  { k: "self", label: "How you feel about yourself", short: "Self-image", lo: "Hard on myself", hi: "Kind to myself", color: "var(--accent)" },
];
const SYMPTOMS = ["Headache", "Bloating", "Gas", "Acid reflux", "Cravings", "Brain fog", "Tiredness", "Skin flare-up", "Nausea"];
const HEALTH = [
  { k: "steps", label: "Steps", unit: "", d: 0 },
  { k: "sleepH", label: "Sleep", unit: " h", d: 1 },
  { k: "restHR", label: "Resting heart rate", unit: " bpm", d: 0 },
  { k: "weight", label: "Weight", unit: " kg", d: 1 },
];

// Feelings chosen in onboarding (all of them unless you picked some).
export const tracked = () => { const on = store.get("tracked", null); const t = Array.isArray(on) && on.length ? METRICS.filter(m => on.includes(m.k)) : METRICS; return t.length ? t : METRICS; };

// ---------- data ----------
const db = {
  meals: () => store.get("meals", []),
  checkins: () => store.get("checkins", {}),
  health: () => store.get("health", {}),
  saveMeals: m => store.set("meals", m),
  saveCheckins: c => store.set("checkins", c),
  saveHealth: h => store.set("health", h),
};
const pad = n => String(n).padStart(2, "0");
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return dayKey(new Date(y, m - 1, d + n)); };
const niceDay = key => { const [y, m, d] = key.split("-").map(Number); const dt = new Date(y, m - 1, d); const t = dayKey(new Date()); return key === t ? "Today" : key === addDays(t, -1) ? "Yesterday" : dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); };
const localInput = d => `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- "I ate this" on the cook view ----------
function renderAte() {
  const box = $("#ateBox"); if (!box) return;
  const plan = (NM.current.plan || []).filter(p => p.use.q > 0);
  box.hidden = !plan.length;
}
$("#ateAt").value = localInput(new Date());
$("#ateBtn").addEventListener("click", () => {
  const plan = (NM.current.plan || []).filter(p => p.use.q > 0);
  if (!plan.length) return;
  const n = NM.S.servings || 1;
  const at = $("#ateAt").value ? new Date($("#ateAt").value) : new Date();
  const items = plan.map(p => ({ name: p.f.name, cat: p.f.cat || "", g: Math.round(p.use.g / n) }));
  const t = NM.current.ptot;
  const meal = { id: uid(), at: at.toISOString(), day: dayKey(at), title: ($("#recipe h3")?.textContent || "Meal").trim(), items,
    k: t.k / n, p: t.p / n, c: t.c / n, f: t.f / n, fi: t.fi / n };
  const meals = db.meals(); meals.push(meal); db.saveMeals(meals);
  NM.setStatus($("#ateMsg"), `Saved to your log for ${niceDay(meal.day).toLowerCase()}. Check in later to see how it made you feel.`, false);
  renderLog();
});
setInterval(() => { if (document.activeElement !== $("#ateAt")) $("#ateAt").value = localInput(new Date()); }, 60000);

// ---------- check-in ----------
let ciDraft = null;
function loadDraft(day) { const c = db.checkins()[day]; ciDraft = c ? JSON.parse(JSON.stringify(c)) : { symptoms: [], note: "" }; }
function renderCheckin() {
  const day = $("#ciDay").value || dayKey(new Date());
  if (!ciDraft) loadDraft(day);
  $("#ciScales").innerHTML = tracked().map(m => `<fieldset class="scale"><legend>${esc(m.label)}</legend>
    <div class="dots" role="radiogroup" aria-label="${esc(m.label)}">${[1, 2, 3, 4, 5].map(v => `<button type="button" role="radio" aria-checked="${ciDraft[m.k] === v}" data-k="${m.k}" data-v="${v}" aria-label="${v} of 5">${v}</button>`).join("")}</div>
    <div class="ends"><span>${esc(m.lo)}</span><span>${esc(m.hi)}</span></div></fieldset>`).join("");
  $("#ciSymptoms").innerHTML = SYMPTOMS.map(s => `<button type="button" class="chip" aria-pressed="${ciDraft.symptoms.includes(s)}" data-s="${esc(s)}">${esc(s)}</button>`).join("");
  $("#ciNote").value = ciDraft.note || "";
  const saved = db.checkins()[day];
  $("#ciSave").textContent = saved ? "Update check-in" : "Save check-in";
}
$("#ciScales").addEventListener("click", e => { const b = e.target.closest("button[data-k]"); if (!b) return; const v = Number(b.dataset.v); ciDraft[b.dataset.k] = ciDraft[b.dataset.k] === v ? undefined : v; renderCheckin(); });
$("#ciSymptoms").addEventListener("click", e => { const b = e.target.closest("button[data-s]"); if (!b) return; const s = b.dataset.s; ciDraft.symptoms = ciDraft.symptoms.includes(s) ? ciDraft.symptoms.filter(x => x !== s) : [...ciDraft.symptoms, s]; renderCheckin(); });
$("#ciNote").addEventListener("input", e => { ciDraft.note = e.target.value; });
$("#ciDay").addEventListener("change", () => { loadDraft($("#ciDay").value); renderCheckin(); });
$("#ciSave").addEventListener("click", () => {
  const day = $("#ciDay").value || dayKey(new Date());
  if (!tracked().some(m => ciDraft[m.k])) { NM.setStatus($("#ciMsg"), "Tap at least one score first.", false, true); return; }
  const all = db.checkins(); all[day] = { ...ciDraft, at: new Date().toISOString() }; db.saveCheckins(all);
  NM.setStatus($("#ciMsg"), `Check-in saved for ${niceDay(day).toLowerCase()}.`, false);
  renderCheckin(); renderDiary();
});

// ---------- health data (filled by the Android/iPhone app) ----------
async function syncHealth() {
  const st = $("#hMsg");
  NM.setStatus(st, "Reading your health data…", true);
  try {
    const data = await window.NutriHealthSync(30);
    const h = db.health();
    for (const [d, v] of Object.entries(data || {})) h[d] = { ...(h[d] || {}), ...v };
    db.saveHealth(h);
    const n = Object.keys(data || {}).length;
    NM.setStatus(st, n ? `Updated ${n} day${n > 1 ? "s" : ""} of health data.` : "No health data found for the last 30 days.", false);
    renderDiary();
  } catch (e) {
    NM.setStatus(st, (e && e.message) || "Couldn't read health data. Check the app's permissions in Health Connect.", false, true);
  }
}
$("#hSync").addEventListener("click", syncHealth);

// ---------- diary ----------
function renderDiary() {
  const meals = db.meals(), cis = db.checkins(), hl = db.health(), acts = store.get("activities", []);
  const days = new Set([...meals.map(m => m.day), ...Object.keys(cis), ...Object.keys(hl), ...acts.map(a => a.day)]);
  const list = [...days].sort().reverse().slice(0, 21);
  if (!list.length) { $("#diary").innerHTML = `<p class="empty">Nothing logged yet. Tap "I ate this" under a recipe, and do a check-in each evening.</p>`; return; }
  $("#diary").innerHTML = list.map(d => {
    const dm = meals.filter(m => m.day === d).sort((a, b) => a.at.localeCompare(b.at));
    const c = cis[d], h = hl[d];
    const kcal = dm.reduce((s, m) => s + m.k, 0);
    return `<article class="day"><div class="day-h"><b>${esc(niceDay(d))}</b><span class="eyebrow">${dm.length ? fmt(kcal) + " kcal" : ""}</span></div>
      ${dm.map(m => `<div class="meal"><span class="t">${new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span class="n">${esc(m.title)}<small>${esc(m.items.map(i => i.name.split(/[,(/]/)[0].trim()).join(", "))}</small></span><span class="k">${fmt(m.k)} kcal · ${fmt(m.p)} g P</span><button class="ghost del" type="button" data-del="${m.id}" aria-label="Delete meal">✕</button></div>`).join("")}
      ${c ? `<div class="pills">${METRICS.filter(m => c[m.k]).map(m => `<span class="pill" style="--c:${m.color}">${esc(m.short || m.label.split(" ")[0])} ${c[m.k]}/5</span>`).join("")}${(c.symptoms || []).map(s => `<span class="pill warn">${esc(s)}</span>`).join("")}</div>${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}` : `<p class="empty small">No check-in.</p>`}
      ${acts.filter(a => a.day === d).length ? `<div class="hline">${acts.filter(a => a.day === d).map(a => `${esc(a.title)} ${a.minutes} min`).join(" · ")}</div>` : ""}
      ${h ? `<div class="hline">${HEALTH.filter(x => h[x.k] != null).map(x => `${esc(x.label)} ${fmt(h[x.k], x.d)}${x.unit}`).join(" · ")}</div>` : ""}
    </article>`;
  }).join("");
}
$("#diary").addEventListener("click", e => {
  const b = e.target.closest("button[data-del]"); if (!b) return;
  if (b.dataset.armed) { db.saveMeals(db.meals().filter(m => m.id !== b.dataset.del)); renderDiary(); return; }
  b.dataset.armed = "1"; b.textContent = "Delete?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "✕"; } }, 3000);
});

// ---------- backup ----------
$("#bkSave").addEventListener("click", () => {
  const data = { app: "nutrime", version: 1, exported: new Date().toISOString(), meals: db.meals(), checkins: db.checkins(), health: db.health(), activities: store.get("activities", []), mind: store.get("mind", []), myAffirmations: store.get("myAffirmations", []), favAffirmations: store.get("favAffirmations", []) };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nutrime-backup-${dayKey(new Date())}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$("#bkFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== "nutrime") throw new Error();
    const ids = new Set(db.meals().map(m => m.id));
    db.saveMeals([...db.meals(), ...(d.meals || []).filter(m => m && m.id && !ids.has(m.id))]);
    db.saveCheckins({ ...(d.checkins || {}), ...db.checkins() });
    db.saveHealth({ ...(d.health || {}), ...db.health() });
    for (const k of ["activities", "mind"]) { const have = store.get(k, []), seen = new Set(have.map(x => x.id)); store.set(k, [...have, ...(d[k] || []).filter(x => x && x.id && !seen.has(x.id))]); }
    for (const k of ["myAffirmations", "favAffirmations"]) store.set(k, [...new Set([...store.get(k, []), ...(d[k] || []).filter(x => typeof x === "string")])]);
    if (NM.renderMove) NM.renderMove(); if (NM.renderMind) NM.renderMind();
    NM.setStatus($("#bkMsg"), "Backup restored. Entries already on this phone were kept.", false); renderLog();
  } catch { NM.setStatus($("#bkMsg"), "That file isn't a NutriMe backup.", false, true); }
});

// ---------- insights ----------
function dailyRows() {
  const meals = db.meals(), cis = db.checkins(), hl = db.health();
  const food = {}; // day -> {nutrients, names:Set}
  for (const m of meals) {
    const d = food[m.day] || (food[m.day] = { k: 0, p: 0, c: 0, f: 0, fi: 0, names: new Set(), cats: new Set() });
    for (const key of ["k", "p", "c", "f", "fi"]) d[key] += m[key] || 0;
    m.items.forEach(i => { d.names.add(i.name); if (i.cat) d.cats.add(i.cat); });
  }
  return { food, cis, hl };
}
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
function pearson(xs, ys) {
  const n = xs.length; if (n < 5) return null;
  const mx = mean(xs), my = mean(ys); let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; }
  return b && c ? a / Math.sqrt(b * c) : null;
}
const short = n => n.split(/[,(/]/)[0].trim();
function exposure(food, name, day, m) {
  // A food "counts" for a check-in if eaten that day or the day before (sleep looks at the day before only).
  const days = m && m.prevDay ? [addDays(day, -1)] : [day, addDays(day, -1)];
  return days.some(d => food[d] && food[d].names.has(name));
}
export function analyse() {
  const { food, cis, hl } = dailyRows();
  const ciDays = Object.keys(cis).sort();
  const names = new Set(); Object.values(food).forEach(d => d.names.forEach(n => names.add(n)));
  const foodFx = [], sympFx = [], links = [];
  for (const name of names) {
    for (const m of METRICS) {
      const yes = [], no = [];
      for (const d of ciDays) { const v = cis[d][m.k]; if (!v) continue; (exposure(food, name, d, m) ? yes : no).push(v); }
      if (yes.length >= 3 && no.length >= 3) { const diff = mean(yes) - mean(no); if (Math.abs(diff) >= 0.4) foodFx.push({ name, m, diff, nYes: yes.length, nNo: no.length, a: mean(yes), b: mean(no) }); }
    }
    for (const s of SYMPTOMS) {
      let ey = 0, en = 0, ny = 0, nn = 0;
      for (const d of ciDays) { const has = (cis[d].symptoms || []).includes(s); if (exposure(food, name, d)) { en++; if (has) ey++; } else { nn++; if (has) ny++; } }
      if (en >= 3 && nn >= 3 && ey >= 2) { const gap = ey / en - ny / nn; if (gap >= 0.25) sympFx.push({ name, s, ey, en, ny, nn, gap }); }
    }
  }
  const factors = [
    { k: "k", label: "calories", src: "food" }, { k: "p", label: "protein", src: "food" }, { k: "c", label: "carbs", src: "food" },
    { k: "f", label: "fat", src: "food" }, { k: "fi", label: "fiber", src: "food" },
    { k: "steps", label: "steps", src: "health" }, { k: "sleepH", label: "hours of sleep", src: "health" }, { k: "restHR", label: "resting heart rate", src: "health" },
  ];
  for (const fct of factors) for (const m of METRICS) {
    const xs = [], ys = [];
    for (const d of ciDays) {
      const v = cis[d][m.k]; if (!v) continue;
      const src = fct.src === "food" ? food[m.prevDay ? addDays(d, -1) : d] : hl[fct.k === "sleepH" ? d : (m.prevDay ? addDays(d, -1) : d)];
      const x = src && src[fct.k]; if (x == null || (fct.src === "food" && !x)) continue;
      xs.push(x); ys.push(v);
    }
    const r = pearson(xs, ys);
    if (r != null && Math.abs(r) >= 0.3) links.push({ fct, m, r, n: xs.length });
  }
  // Activities: compare how you felt on days you did each kind of activity vs days you didn't.
  // Sleep looks at activity the day before (it's rated the next morning).
  const acts = store.get("activities", []);
  const actDays = {}; for (const a of acts) (actDays[a.type] || (actDays[a.type] = {}))[a.day] = ((actDays[a.type] || {})[a.day] || 0) + a.minutes;
  const anyDays = {}; for (const a of acts) anyDays[a.day] = (anyDays[a.day] || 0) + a.minutes;
  for (const e of store.get("mind", [])) (actDays.mind || (actDays.mind = {}))[e.day] = 1;
  const actFx = [];
  const ACT_LABEL = { meditation: "meditation", yoga: "yoga", workout: "a workout", walk: "a walk", other: "other activity", any: "any activity", mind: "a Mind practice (win, reframe or kind words)" };
  for (const [type, map] of [...Object.entries(actDays), ["any", anyDays]]) for (const m of METRICS) {
    if (type === "any" && !Object.keys(map).length) continue;
    const yes = [], no = [];
    for (const d of ciDays) { const v = cis[d][m.k]; if (!v) continue; (map[m.prevDay ? addDays(d, -1) : d] ? yes : no).push(v); }
    if (yes.length >= 3 && no.length >= 3) { const diff = mean(yes) - mean(no); if (Math.abs(diff) >= 0.4) actFx.push({ type, label: ACT_LABEL[type] || type, m, diff, nYes: yes.length, nNo: no.length, a: mean(yes), b: mean(no) }); }
  }
  actFx.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  foodFx.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  sympFx.sort((a, b) => b.gap - a.gap);
  links.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  // last 7 days vs the 7 before
  const today = dayKey(new Date());
  const win = (from, to, k) => { const v = []; for (let i = from; i < to; i++) { const c = cis[addDays(today, -i)]; if (c && c[k]) v.push(c[k]); } return v; };
  const weeks = tracked().map(m => ({ m, now: win(0, 7, m.k), before: win(7, 14, m.k) }));
  return { ciDays, foodFx, sympFx, links, actFx, weeks, food, cis, hl };
}

function chart(cis, food) {
  const today = dayKey(new Date());
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const W = 640, H = 220, L = 30, R = 10, T = 12, B = 46;
  const x = i => L + i * (W - L - R) / 29, y = v => T + (5 - v) * (H - T - B) / 4;
  const kmax = Math.max(2500, ...days.map(d => (food[d] ? food[d].k : 0)));
  const bars = days.map((d, i) => { const k = food[d] ? food[d].k : 0; if (!k) return ""; const h = k / kmax * 30; return `<rect x="${x(i) - 5}" y="${H - 14 - h}" width="10" height="${h}" rx="2" fill="var(--line)"><title>${niceDay(d)}: ${fmt(k)} kcal</title></rect>`; }).join("");
  const lines = tracked().map(m => {
    const pts = days.map((d, i) => cis[d] && cis[d][m.k] ? [x(i), y(cis[d][m.k])] : null);
    let path = "", pen = false;
    pts.forEach(p => { if (!p) { pen = false; return; } path += (pen ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); pen = true; });
    const dots = pts.filter(Boolean).map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${m.color}"/>`).join("");
    return `<path d="${path}" fill="none" stroke="${m.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join("");
  const grid = [1, 2, 3, 4, 5].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`).join("");
  const ticks = [0, 7, 14, 21, 29].map(i => `<text x="${x(i)}" y="${H - 2}" text-anchor="middle" font-size="11" fill="var(--muted)">${niceDay(days[i])}</text>`).join("");
  return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px" role="img" aria-label="How you felt over the last 30 days, scores 1 to 5, with daily calories as grey bars">${grid}${bars}${lines}${ticks}</svg></div>
    <div class="legend">${tracked().map(m => `<span style="--c:${m.color}">${esc(m.short || m.label)}</span>`).join("")}<span style="--c:var(--line)">Calories eaten</span></div>`;
}

let lastAnalysis = null;
function renderInsights() {
  const A = analyse(); lastAnalysis = A;
  const n = A.ciDays.length;
  const hasExample = db.meals().some(m => m.example);
  $("#exBtn").textContent = hasExample ? "Remove example data" : "Try with example data";
  if (n < 5) {
    $("#insBody").innerHTML = `<section class="panel"><h2>Patterns appear after a few days</h2>
      <p class="empty">You have ${n} check-in${n === 1 ? "" : "s"}. Insights start at 5, and get more reliable after two or three weeks. Each day, tap "I ate this" for your meals and do a quick check-in on the Log tab.</p>
      <div class="split" aria-hidden="true"><i style="width:${n / 5 * 100}%;background:var(--accent)"></i></div></section>`;
    return;
  }
  const tiles = A.weeks.map(w => {
    const a = w.now.length ? mean(w.now) : null, b = w.before.length ? mean(w.before) : null;
    const d = a != null && b != null ? a - b : null;
    const state = d == null ? "" : d > 0.25 ? "up" : d < -0.25 ? "down" : "flat";
    return `<div class="tile"><span class="eyebrow">${esc(w.m.label)}</span><b>${a != null ? fmt(a, 1) : "–"}<small>/5</small></b><span class="trend ${state}">${d == null ? "this week" : state === "up" ? "▲ " + fmt(d, 1) + " vs last week" : state === "down" ? "▼ " + fmt(-d, 1) + " vs last week" : "steady vs last week"}</span></div>`;
  }).join("");
  const fx = A.foodFx.slice(0, 8).map(f => `<li><span class="badge ${f.diff > 0 ? "good" : "bad"}">${f.diff > 0 ? "▲" : "▼"} ${fmt(Math.abs(f.diff), 1)}</span><span><b>${esc(short(f.name))}</b>: ${esc(f.m.label.toLowerCase())} averaged ${fmt(f.a, 1)} on ${f.m.prevDay ? "nights after" : "days with or after"} it, vs ${fmt(f.b, 1)} otherwise <small>(${f.nYes} vs ${f.nNo} days)</small></span></li>`).join("");
  const sx = A.sympFx.slice(0, 6).map(s => `<li><span class="badge bad">${esc(s.s)}</span><span>Reported on <b>${s.ey} of ${s.en}</b> days with or after <b>${esc(short(s.name))}</b>, vs ${s.ny} of ${s.nn} other days</span></li>`).join("");
  const ax = A.actFx.slice(0, 6).map(f => `<li><span class="badge ${f.diff > 0 ? "good" : "bad"}">${f.diff > 0 ? "▲" : "▼"} ${fmt(Math.abs(f.diff), 1)}</span><span>${f.m.prevDay ? "After days with" : "On days with"} <b>${esc(f.label)}</b>, ${esc(f.m.label.toLowerCase())} averaged ${fmt(f.a, 1)}, vs ${fmt(f.b, 1)} otherwise <small>(${f.nYes} vs ${f.nNo} days)</small></span></li>`).join("");
  const lk = A.links.slice(0, 6).map(l => `<li><span class="badge ${l.r > 0 ? "good" : "bad"}">r ${l.r > 0 ? "+" : "−"}${fmt(Math.abs(l.r), 2)}</span><span>More ${esc(l.fct.label)} went with ${l.r > 0 ? "better" : "worse"} ${esc(l.m.label.toLowerCase())} <small>(${l.n} days)</small></span></li>`).join("");
  $("#insBody").innerHTML = `
    <section class="panel"><div class="panel-head"><h2>This week</h2><span class="eyebrow">${n} days checked in</span></div><div class="tiles">${tiles}</div></section>
    <section class="panel"><h2>How you felt, last 30 days</h2>${chart(A.cis, A.food)}</section>
    <div class="grid">
      <section class="panel"><h2>Foods that may matter</h2>${fx || sx ? `<ul class="fx">${fx}${sx}</ul>` : `<p class="empty">No clear food patterns yet. Keep logging. Foods need at least 3 days with and 3 without to be compared.</p>`}</section>
      <section class="panel"><h2>Movement, sleep and nutrition</h2>${ax || lk ? `<ul class="fx">${ax}${lk}</ul>` : `<p class="empty">No strong links yet between your movement, nutrients or sleep and how you feel.</p>`}
        <p class="source" style="margin:0">r runs from −1 to +1. Around 0.3 is a weak hint and above 0.6 is a strong one.</p></section>
    </div>
    <section class="panel"><div class="panel-head"><h2>Summary in plain words</h2><button class="primary" type="button" id="aiSum"${NM.sample ? "" : " hidden"}>Ask AI for a summary</button></div>
      <p class="source" style="margin:0">${NM.sample ? "This sends the numbers above (not your notes) to your AI connection." : "Connect photo reading on the Cook tab to get an AI summary of these patterns."}</p>
      <div class="status" id="aiMsg" hidden></div><div id="aiOut"></div></section>
    <p class="source">These are patterns in your own log, not proof that a food causes how you feel. Foods you usually eat together (like rice with curry) show up together, so test one at a time. Sleep, stress, illness and your cycle all play a part. Talk to a doctor or dietitian before cutting out whole food groups.</p>`;
  const btn = $("#aiSum"); if (btn) btn.addEventListener("click", aiSummary);
}
async function aiSummary() {
  const A = lastAnalysis, btn = $("#aiSum"); if (!A || !NM.sample) return;
  btn.disabled = true; NM.setStatus($("#aiMsg"), "Writing your summary…", true);
  const facts = [
    ...A.weeks.map(w => `${w.m.label}: ${w.now.length ? fmt(mean(w.now), 1) : "n/a"} this week, ${w.before.length ? fmt(mean(w.before), 1) : "n/a"} last week`),
    ...A.foodFx.slice(0, 10).map(f => `${short(f.name)}: ${f.m.label} ${fmt(f.a, 1)} when eaten (${f.nYes} days) vs ${fmt(f.b, 1)} otherwise (${f.nNo} days)`),
    ...A.sympFx.slice(0, 8).map(s => `${s.s} on ${s.ey}/${s.en} days with ${short(s.name)} vs ${s.ny}/${s.nn} otherwise`),
    ...A.actFx.slice(0, 8).map(f => `${f.label}: ${f.m.label} ${fmt(f.a, 1)} on those days (${f.nYes}) vs ${fmt(f.b, 1)} otherwise (${f.nNo})`),
    ...A.links.slice(0, 8).map(l => `${l.fct.label} vs ${l.m.label}: r=${fmt(l.r, 2)} over ${l.n} days`),
  ];
  const prompt = `You are a careful, encouraging nutrition coach. Here are patterns from one person's own food and wellbeing log (scores are 1-5; ${A.ciDays.length} days logged). They are correlations from small samples, not proof.
${facts.map(f => "- " + f).join("\n")}
Write a short, plain-English summary for them. Point out the 2-3 most useful patterns, say how confident they can be given the number of days, and suggest 2-3 small experiments to try next week (for example swapping one food for 5 days). Don't diagnose anything or recommend cutting out whole food groups.
Reply with only JSON: {"summary": string (3-5 sentences), "experiments": [string]}`;
  try {
    const r = await NM.sample.json(prompt);
    $("#aiOut").innerHTML = `<p>${esc(r.summary || "")}</p>${Array.isArray(r.experiments) && r.experiments.length ? `<div class="eyebrow">Try next week</div><ul>${r.experiments.map(x => `<li>${esc(String(x))}</li>`).join("")}</ul>` : ""}`;
    $("#aiMsg").hidden = true;
  } catch (e) { NM.setStatus($("#aiMsg"), NM.errCopy(e), false, true); }
  finally { btn.disabled = false; }
}

// Example data so the insights can be previewed. Clearly marked and removable.
$("#exBtn").addEventListener("click", () => {
  if (db.meals().some(m => m.example)) {
    db.saveMeals(db.meals().filter(m => !m.example));
    const c = db.checkins(); for (const k in c) if (c[k].example) delete c[k]; db.saveCheckins(c);
    const h = db.health(); for (const k in h) if (h[k].example) delete h[k]; db.saveHealth(h);
    store.set("activities", store.get("activities", []).filter(a => !a.example));
    store.set("mind", store.get("mind", []).filter(a => !a.example));
  } else {
    const menu = [
      { title: "Chickpea curry with rice", items: [["Chickpeas, cooked or canned", "legume", 200], ["White rice, cooked", "grain", 180], ["Onion", "aromatic", 80], ["Tomato", "veg", 120]], k: 640, p: 22, c: 105, f: 14, fi: 16 },
      { title: "Chicken and broccoli bowl", items: [["Chicken breast, raw", "protein", 170], ["Brown rice, cooked", "grain", 160], ["Broccoli", "veg", 150]], k: 560, p: 48, c: 50, f: 9, fi: 7 },
      { title: "Paneer bhurji with roti", items: [["Paneer", "dairy", 120], ["Whole wheat flour (atta)", "grain", 60], ["Onion", "aromatic", 60], ["Spinach", "leafy", 60]], k: 650, p: 35, c: 50, f: 34, fi: 8 },
      { title: "Oats with banana and peanut butter", items: [["Rolled oats", "grain", 60], ["Banana", "fruit", 118], ["Peanut butter", "nut", 16]], k: 420, p: 13, c: 70, f: 12, fi: 9 },
      { title: "Egg and spinach scramble", items: [["Egg, whole", "protein", 150], ["Spinach", "leafy", 60], ["Bread, whole wheat", "grain", 64]], k: 430, p: 29, c: 30, f: 20, fi: 6 },
    ];
    const meals = db.meals(), cis = db.checkins(), hl = db.health(), acts = store.get("activities", []);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 20; i >= 0; i--) {
      const day = addDays(dayKey(new Date()), -i);
      const picks = [menu[3], menu[Math.floor(rnd() * 5)], menu[Math.floor(rnd() * 5)]];
      picks.forEach((mm, j) => { const at = new Date(day + "T" + ["08:30", "13:15", "19:45"][j]); meals.push({ id: uid(), example: true, at: at.toISOString(), day, title: mm.title, items: mm.items.map(([name, cat, g]) => ({ name, cat, g })), k: mm.k, p: mm.p, c: mm.c, f: mm.f, fi: mm.fi }); });
      const chick = picks.some(p => p === menu[0]) || meals.some(m => m.example && m.day === addDays(day, -1) && m.title === menu[0].title);
      const chicken = picks.some(p => p === menu[1]);
      const steps = Math.round(4000 + rnd() * 7000);
      const didYoga = rnd() > 0.55, didMed = rnd() > 0.5;
      if (didYoga) acts.push({ id: uid(), example: true, type: "yoga", title: "Gentle digestion flow", minutes: 10, day, at: new Date(day + "T18:30").toISOString(), completed: true });
      if (rnd() > 0.5) { const ms = store.get("mind", []); ms.push({ id: uid(), example: true, kind: "win", text: "Cooked at home", day, at: new Date(day + "T20:00").toISOString() }); store.set("mind", ms); cis[day] && (cis[day].self = cis[day].self); var didMind = true; } else var didMind = false;
      if (didMed) acts.push({ id: uid(), example: true, type: "meditation", title: "Calm breathing", minutes: 5, day, at: new Date(day + "T21:30").toISOString(), completed: true });
      if (!cis[day]) cis[day] = { example: true, energy: Math.max(1, Math.min(5, Math.round(2.6 + (chicken ? 1 : 0) + steps / 9000 + rnd() - 0.5))), mood: Math.max(1, Math.min(5, Math.round(2.8 + (didMed ? 0.9 : 0) + rnd() * 1.2 - 0.5))), digestion: Math.max(1, Math.min(5, Math.round((chick ? 2.2 : 3.9) + (didYoga ? 0.7 : 0) + rnd() - 0.5))), sleep: Math.max(1, Math.min(5, Math.round(3 + rnd() * 1.5 - 0.5))), self: Math.max(1, Math.min(5, Math.round(2.6 + (didMind ? 1 : 0) + (didMed ? 0.4 : 0) + rnd() - 0.5))), symptoms: chick && rnd() > 0.3 ? ["Bloating"] : [], note: "" };
      if (!hl[day]) hl[day] = { example: true, steps, sleepH: Math.round((6 + rnd() * 2.5) * 10) / 10, restHR: Math.round(60 + rnd() * 8) };
    }
    db.saveMeals(meals); db.saveCheckins(cis); db.saveHealth(hl); store.set("activities", acts);
  }
  renderLog(); renderInsights(); NM.renderMove?.(); NM.renderMind?.();
});

// ---------- views ----------
NM.syncHealth = syncHealth;
export function renderLog() { renderCheckin(); renderDiary(); $("#hBox").hidden = !window.NutriHealthSync; }
const ROUTES = {
  kitchen: { view: "cook", page: "kitchen", name: "Kitchen", tag: "Snap what you have. See the nutrition, get portions that fit your targets, and a recipe to cook them." },
  mind: { view: "mind", page: "mind", name: "Mind", tag: "Small daily practices for a kinder, steadier view of yourself." },
  move: { view: "move", page: "move", name: "Move", tag: "Breathe, stretch and move. Every session shows up in your Health insights." },
  health: { view: "log", page: "health", name: "Health", tag: "Log what you ate and how you feel, and see which foods suit you." },
  assistant: { view: "ask", page: "assistant", name: "Assistant", tag: "Just talk: it turns what you say into to-dos and reminders, plans meals and finds time to move." },
  insights: { view: "insights", page: "health", name: "Health", tag: "Log what you ate and how you feel, and see which foods suit you." },
};
const ALIASES = { cook: "kitchen", log: "health", ask: "assistant" };
function route() {
  let h = location.hash.slice(1); h = ALIASES[h] || h;
  const r = ROUTES[h] || ROUTES.kitchen;
  ["cook", "move", "mind", "log", "insights", "ask"].forEach(k => { $("#view-" + k).hidden = k !== r.view; });
  document.querySelectorAll(".bottomnav a").forEach(a => a.setAttribute("aria-current", a.dataset.page === r.page ? "page" : "false"));
  $("#pageName").textContent = r.name; $("#pageTag").textContent = r.tag;
  document.title = "NutriMe " + r.name;
  if (r.view === "log") renderLog();
  if (r.view === "move") NM.renderMove?.();
  if (r.view === "mind") NM.renderMind?.();
  if (r.view === "ask") NM.renderAsk?.();
  if (r.view === "insights") renderInsights();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
$("#ciDay").value = dayKey(new Date()); $("#ciDay").max = dayKey(new Date());
NM.onRecompute = renderAte;
renderAte(); route();
window.addEventListener("nutrihealth-ready", () => { if (!$("#view-log").hidden) renderLog(); });
