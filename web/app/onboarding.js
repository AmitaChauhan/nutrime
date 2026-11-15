// NutriMe onboarding: a short first-run setup. Everything chosen here stays on this phone.
// Re-open any time from "Change your setup" (link #setup).
import { METRICS } from "./journal.js";
const NM = window.NM;
const { store, esc } = NM;
const $ = s => document.querySelector(s);

const GOALS = ["Eat more balanced", "More energy", "Better digestion", "Sleep better", "Manage my weight gently", "Get stronger", "Feel calmer", "Be kinder to myself"];
const RULES = ["Vegetarian", "Vegan", "Pescatarian", "Eggless", "Halal", "No beef", "No pork", "Gluten-free", "Lactose-free", "Nut allergy", "Low spice"];
const SPLITS = [{ p: 30, c: 40, f: 30, label: "Balanced" }, { p: 40, c: 30, f: 30, label: "More protein" }, { p: 35, c: 25, f: 40, label: "Lower carb" }];
const KCAL = [1500, 1800, 2000, 2200];

let step = 0, d = null;
function draft() {
  const p = store.get("profile", {}), t = NM.S.t, r = store.get("reminders", {});
  const notes = store.get("notes", "");
  const rules = p.rules || RULES.filter(x => notes.toLowerCase().includes(x.toLowerCase()));
  return {
    name: p.name || "", goals: p.goals || [], rules, extra: p.extra != null ? p.extra : notes.split(/,\s*/).filter(x => x && !rules.some(r => r.toLowerCase() === x.toLowerCase())).join(", "),
    kcal: t.kcal, p: t.p, c: t.c, f: t.f, meals: t.meals,
    tracked: store.get("tracked", null) || METRICS.map(m => m.k),
    ci: { on: false, t: "20:30", ...(r.ci || {}) }, mv: { on: false, t: "18:00", ...(r.mv || {}) },
  };
}
const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
const chips = (list, sel, key) => `<div class="chips">${list.map(v => `<button type="button" class="chip" data-${key}="${esc(v)}" aria-pressed="${sel.includes(v)}">${esc(v)}</button>`).join("")}</div>`;

const STEPS = [
  { // 1. hello
    html: () => `<h2 id="onbH">Welcome to NutriMe</h2>
      <p class="lead">A few quick questions so the app fits you. It takes about a minute, and you can change everything later.</p>
      <label class="eyebrow" for="obName">What should we call you?</label>
      <input id="obName" class="big" type="text" autocomplete="given-name" placeholder="Your first name" value="${esc(d.name)}">`,
    read: () => { d.name = $("#obName").value.trim().slice(0, 40); },
  },
  { // 2. goals
    html: () => `<h2 id="onbH">${d.name ? `What matters most, ${esc(d.name)}?` : "What matters most to you?"}</h2>
      <p class="lead">Pick any. The assistant keeps these in mind.</p>${chips(GOALS, d.goals, "goal")}`,
    click: e => { const b = e.target.closest("[data-goal]"); if (b) { d.goals = toggle(d.goals, b.dataset.goal); render(); } },
  },
  { // 3. targets
    html: () => `<h2 id="onbH">Your daily target</h2>
      <p class="lead">A starting point for balancing your meals. Not sure? 1,800 kcal suits many adults; your GP or a dietitian can give you a personal number.</p>
      <div class="kcal"><input id="obKcal" type="number" inputmode="numeric" min="1000" max="4500" step="50" value="${d.kcal}" aria-label="Calories per day"><span>kcal a day</span></div>
      <div class="opt">${KCAL.map(k => `<button type="button" data-kcal="${k}" aria-pressed="${d.kcal === k}">${k.toLocaleString()}</button>`).join("")}</div>
      <div class="eyebrow">Protein / carbs / fat</div>
      <div class="opt">${SPLITS.map(s => `<button type="button" data-split="${s.p},${s.c},${s.f}" aria-pressed="${d.p === s.p && d.c === s.c && d.f === s.f}">${s.label} ${s.p}/${s.c}/${s.f}</button>`).join("")}</div>
      <div class="eyebrow">Meals a day</div>
      <div class="opt">${[2, 3, 4, 5].map(n => `<button type="button" data-meals="${n}" aria-pressed="${d.meals === n}">${n}</button>`).join("")}</div>`,
    read: () => { const k = Math.round(Number($("#obKcal").value)); if (k >= 1000 && k <= 4500) d.kcal = k; },
    click: e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.kcal) d.kcal = Number(b.dataset.kcal);
      else if (b.dataset.split) [d.p, d.c, d.f] = b.dataset.split.split(",").map(Number);
      else if (b.dataset.meals) d.meals = Number(b.dataset.meals);
      else return;
      render();
    },
  },
  { // 4. food rules
    html: () => `<h2 id="onbH">Any food rules?</h2>
      <p class="lead">Recipes and suggestions will follow these.</p>${chips(RULES, d.rules, "rule")}
      <label class="eyebrow" for="obExtra">Anything else? (optional)</label>
      <input id="obExtra" type="text" placeholder="For example: Indian flavours, ready in 20 minutes, no oven" value="${esc(d.extra)}">`,
    read: () => { d.extra = $("#obExtra").value.trim().slice(0, 200); },
    click: e => { const b = e.target.closest("[data-rule]"); if (b) { NM_keep(); d.rules = toggle(d.rules, b.dataset.rule); render(); } },
  },
  { // 5. feelings
    html: () => `<h2 id="onbH">What would you like to track?</h2>
      <p class="lead">Your daily check-in asks about these, and Insights shows which foods and habits go with them.</p>
      <div class="chips">${METRICS.map(m => `<button type="button" class="chip" data-metric="${m.k}" aria-pressed="${d.tracked.includes(m.k)}">${esc(m.label)}</button>`).join("")}</div>`,
    click: e => { const b = e.target.closest("[data-metric]"); if (!b) return; const next = toggle(d.tracked, b.dataset.metric); if (next.length) { d.tracked = next; render(); } },
  },
  { // 6. health + reminders
    html: () => `<h2 id="onbH">Stay on track</h2>
      ${NM.isNative && window.NutriHealthSync ? `<div class="panel" style="gap:8px"><b>Health Connect</b><span class="source" style="margin:0">Bring in steps, sleep, resting heart rate and weight. It stays on this phone.</span><div><button type="button" id="obHealth">Connect Health Connect</button></div><div class="status" id="obHMsg" hidden></div></div>` : ""}
      <p class="lead">Gentle nudges, at most once a day each. Skipped automatically when you've already done it (on the website).</p>
      <label class="rem"><input type="checkbox" id="obCi" ${d.ci.on ? "checked" : ""}> Check in at <input type="time" id="obCiT" value="${d.ci.t}" aria-label="Check-in reminder time"></label>
      <label class="rem"><input type="checkbox" id="obMv" ${d.mv.on ? "checked" : ""}> Move at <input type="time" id="obMvT" value="${d.mv.t}" aria-label="Move reminder time"></label>`,
    read: () => { d.ci = { on: $("#obCi").checked, t: $("#obCiT").value || "20:30" }; d.mv = { on: $("#obMv").checked, t: $("#obMvT").value || "18:00" }; },
    click: async e => {
      if (!e.target.closest("#obHealth")) return;
      const btn = $("#obHealth"); btn.disabled = true; NM.setStatus($("#obHMsg"), "Connecting…", true);
      try { await NM.syncHealth(); NM.setStatus($("#obHMsg"), ($("#hMsg")?.innerText || "Connected.").trim(), false); }
      catch { NM.setStatus($("#obHMsg"), "Couldn't connect. You can try again later under Health.", false, true); }
      finally { btn.disabled = false; }
    },
  },
  { // 7. done
    html: () => `<h2 id="onbH">You're all set${d.name ? `, ${esc(d.name)}` : ""}</h2>
      <p class="lead">Here's a good first step:</p>
      <div class="opt" style="flex-direction:column;align-items:stretch">
        <button type="button" data-go="kitchen">📷 Snap what's in your kitchen</button>
        <button type="button" data-go="assistant">💬 Ask your assistant anything</button>
        <button type="button" data-go="health">🙂 Do your first check-in</button>
      </div>`,
    click: e => { const b = e.target.closest("[data-go]"); if (b) finish(b.dataset.go); },
  },
];
function NM_keep() { const s = STEPS[step]; if (s.read) s.read(); }

function render() {
  const s = STEPS[step];
  $("#onbBody").innerHTML = s.html();
  $("#onbDots").innerHTML = STEPS.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("");
  $("#onbBack").style.visibility = step ? "visible" : "hidden";
  $("#onbNext").textContent = step === STEPS.length - 1 ? "Done" : step === STEPS.length - 2 ? "Finish" : "Next";
  const f = $("#onbBody input[type=text]"); if (f && step === 0) setTimeout(() => f.focus(), 50);
}
function save() {
  store.set("profile", { name: d.name, goals: d.goals, rules: d.rules, extra: d.extra, done: true, at: new Date().toISOString() });
  NM.applySetup({ t: { kcal: d.kcal, p: d.p, c: d.c, f: d.f, meals: d.meals }, notes: [...d.rules, d.extra].filter(Boolean).join(", ") });
  store.set("tracked", d.tracked);
  store.set("reminders", { ci: d.ci, mv: d.mv });
  NM.renderAsk?.(); NM.rescheduleReminders?.();
  if ((d.ci.on || d.mv.on)) NM.askNotifyPermission?.();
}
function finish(go) {
  $("#onb").hidden = true; document.body.style.overflow = "";
  location.hash = "#" + (go || "kitchen");
}
function open() {
  d = draft(); step = 0; render();
  $("#onb").hidden = false; document.body.style.overflow = "hidden";
}
$("#onbNext").addEventListener("click", () => {
  NM_keep();
  if (step === STEPS.length - 2) save();
  if (step === STEPS.length - 1) return finish("kitchen");
  step++; render(); $("#onb").scrollTop = 0;
});
$("#onbBack").addEventListener("click", () => { NM_keep(); if (step) { step--; render(); } });
$("#onbBody").addEventListener("click", e => STEPS[step].click?.(e));
$("#onbBody").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("input[type=text],input[type=number]")) { e.preventDefault(); $("#onbNext").click(); } });

function checkHash() { if (location.hash === "#setup") { history.replaceState(null, "", location.pathname + "#kitchen"); open(); } }
window.addEventListener("hashchange", checkHash);
NM.openSetup = open;
if (!store.get("profile", null)?.done) open(); else checkHash();
