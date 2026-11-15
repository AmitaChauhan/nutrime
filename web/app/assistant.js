// NutriMe Assistant: short answers, meals from your fridge, reminders and to-dos.
// To-dos, reminders and chat history stay on this phone. Only when you send a message
// do your words plus a short summary of your recent log go to the AI.
import { analyse, dayKey } from "./journal.js";
const NM = window.NM;
const { store, esc, fmt } = NM;
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = n => String(n).padStart(2, "0");
const today = () => dayKey(new Date());
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const short = n => String(n).split(/[,(/]/)[0].trim();
const LN = window.Capacitor?.isNativePlatform?.() ? window.Capacitor?.Plugins?.LocalNotifications : null;
const PAGES = { kitchen: "Kitchen", move: "Move", mind: "Mind", health: "Check-in", insights: "Insights" };

// ---------- data ----------
const todos = () => store.get("todos", []);
const saveTodos = t => { store.set("todos", t); scheduleNative(); };
const chat = () => store.get("chat", []);
const rem = () => ({ ci: { on: false, t: "20:30" }, mv: { on: false, t: "18:00" }, ...store.get("reminders", {}) });
function say(role, text, acts) { const c = chat(); c.push({ role, text, acts: acts || [], at: Date.now() }); store.set("chat", c.slice(-30)); renderChat(); }

function addTodo(text, day, time) {
  text = String(text || "").trim().slice(0, 200); if (!text) return null;
  const t = { id: uid(), text, day: /^\d{4}-\d{2}-\d{2}$/.test(day || "") ? day : (time ? today() : ""), time: /^\d{2}:\d{2}$/.test(time || "") ? time : "", done: false, at: Date.now() };
  saveTodos([...todos(), t]); renderTodos(); renderToday(); return t;
}
const checkedIn = () => !!store.get("checkins", {})[today()];
const movedToday = () => store.get("activities", []).filter(a => a.day === today()).reduce((s, a) => s + (a.minutes || 0), 0);
const dueTodos = () => todos().filter(t => !t.done && t.day && t.day <= today());
const niceDue = t => !t.day ? "" : (t.day === today() ? "Today" : t.day < today() ? "Overdue" : new Date(t.day + "T12:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })) + (t.time ? " " + t.time : "");
function gcalUrl(t) {
  const d = (t.day || today()).replace(/-/g, "");
  let dates;
  if (t.time) { const [h, m] = t.time.split(":").map(Number); const e = h * 60 + m + 30; dates = `${d}T${t.time.replace(":", "")}00/${d}T${pad(Math.floor(e / 60) % 24)}${pad(e % 60)}00`; }
  else { const n = new Date(t.day ? t.day + "T12:00" : Date.now()); n.setDate(n.getDate() + 1); dates = `${d}/${dayKey(n).replace(/-/g, "")}`; }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t.text)}&dates=${dates}`;
}

// ---------- rendering ----------
function renderToday() {
  const bits = [];
  bits.push(checkedIn() ? `<span class="ok">✓ Checked in</span>` : `<a href="#health" class="${rem().ci.on && nowHM() >= rem().ci.t ? "due" : ""}">Check in today</a>`);
  const mv = movedToday();
  bits.push(mv ? `<span class="ok">✓ Moved ${mv} min</span>` : `<a href="#move" class="${rem().mv.on && nowHM() >= rem().mv.t ? "due" : ""}">Move today</a>`);
  const due = dueTodos(); if (due.length) bits.push(`<span class="due">${due.length} to-do${due.length > 1 ? "s" : ""} due</span>`);
  $("#asToday").innerHTML = bits.join("");
}
function renderChat() {
  const c = chat();
  $("#asChat").innerHTML = c.map(m => `<div class="bub ${m.role === "me" ? "me" : "ai"}">${esc(m.text)}${m.acts?.length ? `<div class="acts">${m.acts.map(a => a.href ? `<a href="${esc(a.href)}">${esc(a.label)} →</a>` : `<span>${esc(a.label)}</span>`).join("")}</div>` : ""}</div>`).join("");
  $("#asChat").scrollTop = 1e9;
  $("#asQuick").hidden = c.length > 2;
}
function renderTodos() {
  const all = todos().slice().sort((a, b) => (a.done - b.done) || ((a.day || "9") + a.time).localeCompare((b.day || "9") + b.time) || a.at - b.at);
  $("#asTodos").innerHTML = all.length ? all.map(t => `<li class="${t.done ? "done" : ""}"><input type="checkbox" data-tdone="${t.id}" ${t.done ? "checked" : ""} aria-label="Done: ${esc(t.text)}">
    <span>${esc(t.text)}${t.day ? `<small>${esc(niceDue(t))}</small>` : ""}</span>
    ${!t.done ? `<a class="ghost" href="${esc(gcalUrl(t))}" target="_blank" rel="noopener" aria-label="Add to Google Calendar" title="Add to Google Calendar">📅</a>` : ""}
    <button type="button" class="ghost" data-tdel="${t.id}" aria-label="Delete">✕</button></li>`).join("") : `<li><span class="empty">Nothing yet. Type one above, or tell the assistant, e.g. "remind me to buy oats tomorrow".</span></li>`;
  $("#asClearDone").hidden = !all.some(t => t.done);
}
function renderRem() {
  const r = rem();
  $("#remCi").checked = r.ci.on; $("#remCiT").value = r.ci.t; $("#remMv").checked = r.mv.on; $("#remMvT").value = r.mv.t;
  const perm = LN ? "native" : ("Notification" in window ? Notification.permission : "none");
  $("#remAllow").hidden = !(r.ci.on || r.mv.on) || perm !== "default";
  $("#remNote").textContent = LN ? "Reminders arrive as phone notifications, even when NutriMe is closed."
    : perm === "none" ? "This browser can't show notifications, so reminders show at the top of this page."
    : "On the website, reminders pop up while NutriMe is open (or still in the background). The Android app sends them even when it's closed.";
}
function renderAsk() { renderToday(); renderChat(); renderTodos(); renderRem(); }

// ---------- context for the AI (kept short) ----------
function context() {
  const t = today(), from = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return dayKey(d); })();
  const cis = store.get("checkins", {}), meals = store.get("meals", []), acts = store.get("activities", []);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d);
    const c = cis[k], ms = meals.filter(m => m.day === k), as = acts.filter(a => a.day === k);
    if (!c && !ms.length && !as.length) continue;
    days.push(`${k}: ${c ? ["energy", "mood", "digestion", "sleep", "self"].filter(x => c[x]).map(x => `${x} ${c[x]}/5`).join(", ") + ((c.symptoms || []).length ? `; ${c.symptoms.join(", ")}` : "") : "no check-in"}${ms.length ? `; ate ${ms.map(m => short(m.title || m.items.map(i => short(i.name)).join("+"))).join(", ")} (${fmt(ms.reduce((s, m) => s + (m.k || 0), 0))} kcal)` : ""}${as.length ? `; ${as.map(a => `${a.type} ${a.minutes}m`).join(", ")}` : ""}`);
  }
  let insights = [];
  try {
    const A = analyse();
    if (A.ciDays.length >= 5) insights = [
      ...A.foodFx.slice(0, 4).map(f => `${short(f.name)}: ${f.m.label.toLowerCase()} ${fmt(f.a, 1)} vs ${fmt(f.b, 1)} otherwise`),
      ...A.sympFx.slice(0, 3).map(s => `${s.s} on ${s.ey}/${s.en} days with ${short(s.name)} vs ${s.ny}/${s.nn}`),
      ...A.actFx.slice(0, 3).map(f => `${f.label}: ${f.m.label.toLowerCase()} ${fmt(f.a, 1)} vs ${fmt(f.b, 1)}`),
      ...A.links.slice(0, 2).map(l => `more ${l.fct.label} ~ ${l.r > 0 ? "better" : "worse"} ${l.m.label.toLowerCase()}`),
    ];
  } catch {}
  const k = NM.S || {}, rows = (k.rows || []).filter(r => r.name && Number(r.qty) > 0);
  const open = todos().filter(x => !x.done).slice(0, 15);
  const prof = store.get("profile", {});
  return `${prof.name ? `Name: ${prof.name}. ` : ""}${prof.goals?.length ? `Goals: ${prof.goals.join(", ")}. ` : ""}${prof.rules?.length || prof.extra ? `Food rules: ${[...(prof.rules || []), prof.extra].filter(Boolean).join(", ")}.\n` : "\n"}Now: ${new Date().toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} (date ${t}).
Targets: ${k.t ? `${k.t.kcal} kcal/day, ${k.t.meals} meals` : "not set"}. Today: ${checkedIn() ? "checked in" : "not checked in"}, moved ${movedToday()} min.
Last 7 days (scores 1-5, higher is better):
${days.join("\n") || "nothing logged"}
Patterns from their log (correlations, not proof): ${insights.join("; ") || "not enough data yet"}
Ingredients in Kitchen now: ${rows.map(r => `${short(r.name)} ${r.qty}${r.unit}`).join(", ") || "none"}
Open to-dos: ${open.map(x => `[${x.id}] ${x.text}${x.day ? ` (${x.day}${x.time ? " " + x.time : ""})` : ""}`).join("; ") || "none"}
Reminders: check-in ${rem().ci.on ? rem().ci.t : "off"}, move ${rem().mv.on ? rem().mv.t : "off"}.`;
}

// ---------- local answers (work without AI, and keep things fast) ----------
function kitchenSummary() {
  const c = NM.current, plan = (c.plan || []).filter(p => p.use.q > 0), n = NM.S.servings || 1;
  if (!plan.length) return null;
  const title = ($("#recipe h3")?.textContent || "").trim();
  const list = plan.slice(0, 6).map(p => `${fmt(p.use.g / n)} g ${short(p.f.name).toLowerCase()}`).join(", ");
  return `${title ? title + ": " : ""}${list}. About ${fmt(c.ptot.k / n)} kcal and ${fmt(c.ptot.p / n)} g protein per serving.`;
}
function localAnswer(q) {
  const s = q.toLowerCase();
  let m = s.match(/^(?:todo|to-do|add)\s*:?\s+(.+)/i);
  if (m) { const t = addTodo(q.slice(q.length - m[1].length)); return t && { text: `Added: ${t.text}.`, acts: [] }; }
  if (!NM.sample) {
    if (/cook|eat|meal|recipe|fridge/.test(s)) { const k = kitchenSummary(); return { text: k || "Snap your fridge with the camera button, or add ingredients in Kitchen.", acts: [{ label: "Open Kitchen", href: "#kitchen" }] }; }
    return { text: "I need the AI connection for that. Enter your passcode under Photo reading setup in Kitchen. To-dos work without it: start with \"add\".", acts: [{ label: "Open Kitchen", href: "#kitchen" }] };
  }
  return null;
}

// ---------- talking to the AI ----------
let busy = false;
async function ask(q) {
  q = q.trim(); if (!q || busy) return;
  say("me", q);
  const local = localAnswer(q); if (local) { say("ai", local.text, local.acts); return; }
  busy = true; $("#asForm button[type=submit]").disabled = true;
  const thinking = document.createElement("div"); thinking.className = "bub ai"; thinking.innerHTML = '<span class="spin"></span>'; $("#asChat").append(thinking); $("#asChat").scrollTop = 1e9;
  const history = chat().slice(-7, -1).map(m => `${m.role === "me" ? "Them" : "You"}: ${m.text}`).join("\n");
  const prompt = `You are NutriMe Assistant, a warm, very succinct personal assistant inside someone's food, movement and wellbeing app.
Rules: reply in at most 2 short sentences (lists: at most 4 items, a few words each). Plain words, no filler, no emojis. Encourage, never shame; no diet-culture talk about weight loss or "good/bad" food; don't diagnose. If something sounds medical or like they're struggling a lot, gently suggest their GP (huisarts).
You can act by adding actions:
- {"type":"add_todo","text":string,"day":"YYYY-MM-DD" or "","time":"HH:MM" or ""} for to-dos, plans and calendar items (resolve "tomorrow", weekdays etc. from Now)
- {"type":"done_todo","id":string}
- {"type":"kitchen","items":[{"name":string,"qty":number,"unit":"g"|"ml"|"pc"|"cup"|"tbsp"}]} when they list ingredients they have; NutriMe Kitchen then balances portions to their targets. Prefer these names when they fit: ${NM.FOOD_NAMES}
- {"type":"remind","kind":"checkin"|"move","time":"HH:MM"} to set a daily reminder, or "time":"off"
- {"type":"open","page":"kitchen"|"move"|"mind"|"health"|"insights"} to point them to the right page
For "what can I cook": use the Kitchen ingredients and suggest one simple meal, plus open kitchen.
Their data:
${context()}
${history ? `Conversation so far:\n${history}\n` : ""}Them: ${q.slice(0, 1500)}
Reply with only JSON: {"reply": string, "actions": [ ... ]}`;
  try {
    const r = await NM.sample.json(prompt);
    const acts = runActions(Array.isArray(r?.actions) ? r.actions.slice(0, 6) : []);
    say("ai", String(r?.reply || "Done.").slice(0, 600), acts);
  } catch (e) { say("ai", NM.errCopy(e)); }
  finally { thinking.remove(); busy = false; $("#asForm button[type=submit]").disabled = false; }
}
function runActions(list) {
  const out = [];
  for (const a of list) {
    if (!a || typeof a !== "object") continue;
    if (a.type === "add_todo") { const t = addTodo(a.text, a.day, a.time); if (t) out.push({ label: `✓ To-do: ${t.text}${t.day ? ` (${niceDue(t)})` : ""}` }); }
    else if (a.type === "done_todo") { const all = todos(), t = all.find(x => x.id === a.id); if (t) { t.done = true; saveTodos(all); renderTodos(); out.push({ label: `✓ Done: ${t.text}` }); } }
    else if (a.type === "kitchen" && Array.isArray(a.items) && a.items.length) { const rows = NM.mergeItems(a.items.slice(0, 20)); if (rows.length) out.push({ label: `Balanced ${rows.length} ingredient${rows.length > 1 ? "s" : ""} in Kitchen`, href: "#kitchen" }); }
    else if (a.type === "remind" && (a.kind === "checkin" || a.kind === "move")) {
      const r = rem(), k = a.kind === "checkin" ? "ci" : "mv";
      if (a.time === "off") r[k].on = false; else if (/^\d{2}:\d{2}$/.test(a.time || "")) { r[k] = { on: true, t: a.time }; }
      saveRem(r); out.push({ label: r[k].on ? `✓ ${a.kind === "checkin" ? "Check-in" : "Move"} reminder ${r[k].t}` : "✓ Reminder off" });
    }
    else if (a.type === "open" && PAGES[a.page]) out.push({ label: `Open ${PAGES[a.page]}`, href: "#" + a.page });
  }
  renderToday();
  return out;
}

// ---------- fridge photo ----------
async function fridgePhoto(files) {
  if (!files.length) return;
  if (!NM.sample) { say("ai", "Enter your passcode under Photo reading setup in Kitchen first, then try again.", [{ label: "Open Kitchen", href: "#kitchen" }]); return; }
  say("me", "📷 Photo of my fridge");
  const thinking = document.createElement("div"); thinking.className = "bub ai"; thinking.innerHTML = '<span class="spin"></span>'; $("#asChat").append(thinking); $("#asChat").scrollTop = 1e9;
  const before = JSON.stringify(NM.S.rows.map(r => [r.name, r.qty]));
  await NM.readPhotos(files);
  thinking.remove();
  const changed = JSON.stringify(NM.S.rows.map(r => [r.name, r.qty])) !== before;
  const k = changed && kitchenSummary();
  say("ai", k ? `Here's a balanced plate: ${k}` : ($("#snapStatus")?.innerText.trim() || "I couldn't read that photo. Try a closer, brighter one."), [{ label: "Recipe in Kitchen", href: "#kitchen" }]);
}

// ---------- reminders ----------
function saveRem(r) { store.set("reminders", r); renderRem(); scheduleNative(); }
async function askPermission() {
  if (LN) { try { await LN.requestPermissions(); } catch {} return; }
  if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch {} }
  renderRem();
}
async function notify(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.showNotification(title, { body, tag, icon: "icon-192.png", badge: "icon-192.png" }); return; } } catch {}
  try { new Notification(title, { body, tag, icon: "icon-192.png" }); } catch {}
}
// Website: check every 30 s while open. Each reminder fires once a day, and only if still needed.
function tick() {
  if (LN) return;
  const r = rem(), t = today(), hm = nowHM(), fired = store.get("remFired", {});
  const fire = (key, title, body) => { if (fired[key] === t) return; fired[key] = t; store.set("remFired", fired); notify(title, body, key); };
  if (r.ci.on && hm >= r.ci.t && !checkedIn()) fire("ci", "NutriMe check-in", "How did today feel? It takes 20 seconds.");
  if (r.mv.on && hm >= r.mv.t && !movedToday()) fire("mv", "NutriMe Move", "A 5-minute stretch or breathing session counts.");
  for (const x of todos()) if (!x.done && x.day === t && x.time && hm >= x.time) fire("todo-" + x.id, "NutriMe to-do", x.text);
  if (!$("#view-ask").hidden) renderToday();
}
// Android app: real scheduled notifications, even when NutriMe is closed.
async function scheduleNative() {
  if (!LN) return;
  try {
    const pending = await LN.getPending();
    if (pending.notifications?.length) await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    const r = rem(), list = [];
    const daily = (id, t, title, body) => { const [hour, minute] = t.split(":").map(Number); list.push({ id, title, body, schedule: { on: { hour, minute }, allowWhileIdle: true } }); };
    if (r.ci.on) daily(101, r.ci.t, "NutriMe check-in", "How did today feel? It takes 20 seconds.");
    if (r.mv.on) daily(102, r.mv.t, "NutriMe Move", "A 5-minute stretch or breathing session counts.");
    let i = 0;
    for (const x of todos()) {
      if (x.done || !x.day || !x.time) continue;
      const at = new Date(`${x.day}T${x.time}`); if (at <= new Date() || i > 40) continue;
      list.push({ id: 1000 + i++, title: "NutriMe to-do", body: x.text, schedule: { at, allowWhileIdle: true } });
    }
    if (list.length) { const p = await LN.checkPermissions(); if (p.display !== "granted") await LN.requestPermissions(); await LN.schedule({ notifications: list }); }
  } catch (e) { console.warn("Reminders could not be scheduled", e); }
}

// ---------- events ----------
$("#asForm").addEventListener("submit", e => { e.preventDefault(); const q = $("#asIn").value; $("#asIn").value = ""; ask(q); });
$("#asQuick").addEventListener("click", e => { const b = e.target.closest("button[data-q]"); if (b) ask(b.dataset.q); });
$("#asCam").addEventListener("click", () => $("#asPhoto").click());
$("#asPhoto").addEventListener("change", e => { const f = [...e.target.files]; e.target.value = ""; fridgePhoto(f); });
$("#asTodoForm").addEventListener("submit", e => { e.preventDefault(); if (addTodo($("#asTodo").value, $("#asTodoDay").value, $("#asTodoTime").value)) { $("#asTodo").value = $("#asTodoDay").value = $("#asTodoTime").value = ""; } });
$("#asTodos").addEventListener("change", e => { const id = e.target.dataset.tdone; if (!id) return; const all = todos(), t = all.find(x => x.id === id); if (t) { t.done = e.target.checked; saveTodos(all); renderTodos(); renderToday(); } });
$("#asTodos").addEventListener("click", e => { const b = e.target.closest("button[data-tdel]"); if (!b) return; saveTodos(todos().filter(x => x.id !== b.dataset.tdel)); renderTodos(); renderToday(); });
$("#asClearDone").addEventListener("click", () => { saveTodos(todos().filter(x => !x.done)); renderTodos(); });
const remChange = () => { const r = { ci: { on: $("#remCi").checked, t: $("#remCiT").value || "20:30" }, mv: { on: $("#remMv").checked, t: $("#remMvT").value || "18:00" } }; saveRem(r); if (r.ci.on || r.mv.on) askPermission(); };
["#remCi", "#remCiT", "#remMv", "#remMvT"].forEach(s => $(s).addEventListener("change", remChange));
$("#remAllow").addEventListener("click", askPermission);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
setInterval(tick, 30000);

NM.renderAsk = renderAsk; NM.rescheduleReminders = scheduleNative; NM.askNotifyPermission = askPermission;
renderAsk(); tick(); scheduleNative();
