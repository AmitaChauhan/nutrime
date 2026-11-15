// NutriMe Mind: small daily practices for a kinder self-image.
// Everything written here stays on this phone unless you tap "Help me reframe".
const NM = window.NM;
const { store, esc } = NM;
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Math.random().toString(36).slice(2, 10);

const AFFIRMATIONS = [
  "My body is not a project to fix. It's the place I live, and it deserves care.",
  "I can feed myself well without being perfect.",
  "One meal doesn't define my day, and one day doesn't define me.",
  "I'm allowed to take up space.",
  "Progress counts even when nobody can see it.",
  "I speak to myself the way I'd speak to a good friend.",
  "My worth was never measured in kilos.",
  "Rest is part of getting stronger.",
  "I notice what my body can do today.",
  "I can have a hard moment without it being a hard life.",
  "Choosing what helps me feel good is an act of respect, not punishment.",
  "I'm learning, and learning is allowed to be messy.",
  "I deserve the same patience I give other people.",
  "Small steps, repeated, become who I am.",
  "I don't have to earn my food or my rest.",
  "My feelings are information, not instructions.",
  "I'm proud of myself for showing up today.",
  "Comparison steals joy. My path is my own.",
  "Strong, calm, and kind is a good way to be.",
  "I can be a work in progress and enough at the same time.",
];
const WIN_IDEAS = ["Slept better", "Cooked at home", "Drank more water", "Took a walk", "Felt more energy", "Clothes felt comfortable", "Stood taller", "Ate without guilt", "Stopped when full", "Said no to something", "Moved because it felt good", "Was kind to myself"];
const FRIEND_PROMPTS = [
  "What would you say to a friend who had this thought?",
  "What's the evidence for it, and what's the evidence against it?",
  "Is this a fact, or a feeling dressed up as a fact?",
  "Will this matter in a year? What matters more?",
];

const entries = () => store.get("mind", []);
function addEntry(e) { const all = entries(); all.push({ id: uid(), at: new Date().toISOString(), day: dayKey(new Date()), ...e }); store.set("mind", all); renderMind(); }

function todaysAffirmation() {
  const own = store.get("myAffirmations", []);
  const pool = [...own, ...AFFIRMATIONS];
  const offset = store.get("affOffset", 0);
  const n = Math.floor(Date.now() / 86400000) + offset;
  return pool[((n % pool.length) + pool.length) % pool.length];
}

let friendIdx = 0;
function renderMind() {
  const aff = todaysAffirmation();
  const favs = store.get("favAffirmations", []);
  $("#mdAff").textContent = aff;
  $("#mdFav").textContent = favs.includes(aff) ? "★ Saved" : "☆ Save";
  $("#mdFav").setAttribute("aria-pressed", String(favs.includes(aff)));
  $("#mdFavs").innerHTML = favs.length ? `<div class="eyebrow">Your saved words</div><ul class="plain">${favs.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : "";
  $("#mdFriendQ").textContent = FRIEND_PROMPTS[friendIdx % FRIEND_PROMPTS.length];
  $("#mdWinIdeas").innerHTML = WIN_IDEAS.map(w => `<button type="button" class="chip" data-win="${esc(w)}">${esc(w)}</button>`).join("");
  const today = dayKey(new Date());
  const all = entries();
  const week = new Date(); week.setDate(week.getDate() - 6); const from = dayKey(week);
  const wk = all.filter(e => e.day >= from);
  $("#mdWeek").innerHTML = `<div class="tiles">
    <div class="tile"><span class="eyebrow">Wins this week</span><b>${wk.filter(e => e.kind === "win").length}</b></div>
    <div class="tile"><span class="eyebrow">Thoughts reframed</span><b>${wk.filter(e => e.kind === "reframe").length}</b></div>
    <div class="tile"><span class="eyebrow">Kind words</span><b>${wk.filter(e => e.kind === "kind").length}</b></div></div>`;
  const recent = all.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const label = { win: "Win", reframe: "Reframe", kind: "Kind words" };
  $("#mdRecent").innerHTML = recent.length ? recent.map(e => `<article class="mentry"><div class="day-h"><span class="pill">${label[e.kind]}</span><span class="eyebrow">${e.day === today ? "Today" : esc(new Date(e.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}</span></div>
    ${e.kind === "reframe" ? `<p class="was">${esc(e.thought)}</p><p><b>${esc(e.kinder)}</b></p>` : `<p>${esc(e.text)}</p>`}
    <button class="ghost del" type="button" data-mdel="${e.id}" aria-label="Delete">✕</button></article>`).join("") : `<p class="empty">Your wins, reframes and kind words will collect here. Read them back on a hard day.</p>`;
}

// Affirmation controls
$("#mdNext").addEventListener("click", () => { store.set("affOffset", store.get("affOffset", 0) + 1); renderMind(); });
$("#mdFav").addEventListener("click", () => {
  const a = todaysAffirmation(); let favs = store.get("favAffirmations", []);
  favs = favs.includes(a) ? favs.filter(f => f !== a) : [...favs, a]; store.set("favAffirmations", favs); renderMind();
});
$("#mdOwnSave").addEventListener("click", () => {
  const v = $("#mdOwn").value.trim(); if (!v) return;
  store.set("myAffirmations", [v, ...store.get("myAffirmations", [])]); store.set("affOffset", 0);
  // make the new one show today
  const own = store.get("myAffirmations", []), pool = own.length + AFFIRMATIONS.length;
  const n = Math.floor(Date.now() / 86400000); store.set("affOffset", ((-n % pool) + pool) % pool);
  $("#mdOwn").value = ""; renderMind();
});

// Reframe
$("#mdFriendNext").addEventListener("click", () => { friendIdx++; renderMind(); });
$("#mdReframeSave").addEventListener("click", () => {
  const thought = $("#mdThought").value.trim(), friend = $("#mdFriend").value.trim(), kinder = $("#mdKinder").value.trim();
  if (!thought || !kinder) { NM.setStatus($("#mdReMsg"), "Write the thought and a kinder version to save it.", false, true); return; }
  addEntry({ kind: "reframe", thought, friend, kinder });
  $("#mdThought").value = $("#mdFriend").value = $("#mdKinder").value = "";
  NM.setStatus($("#mdReMsg"), "Saved. That took courage.", false);
});
$("#mdAiHelp").addEventListener("click", async () => {
  const thought = $("#mdThought").value.trim();
  if (!thought) { NM.setStatus($("#mdReMsg"), "Write the thought first.", false, true); return; }
  if (!NM.sample) { NM.setStatus($("#mdReMsg"), "Connect photo reading on the Kitchen page first to use AI help.", false, true); return; }
  const btn = $("#mdAiHelp"); btn.disabled = true; NM.setStatus($("#mdReMsg"), "Thinking of a kinder way to see it…", true);
  const prompt = `Someone working on a kinder self-image wrote this harsh thought about themselves: "${thought.slice(0, 600)}"
Act like a warm, sensible friend trained in CBT. Don't diagnose, don't mention weight loss or dieting, and don't dismiss the feeling.
Reply with only JSON: {"friend": string (1-2 sentences a caring friend might say back), "kinder": string (one balanced, believable alternative thought in first person, under 25 words)}`;
  try {
    const r = await NM.sample.json(prompt);
    if (r.friend && !$("#mdFriend").value.trim()) $("#mdFriend").value = String(r.friend);
    if (r.kinder) $("#mdKinder").value = String(r.kinder);
    NM.setStatus($("#mdReMsg"), "Here's a suggestion. Change it until it feels true to you, then save.", false);
  } catch (e) { NM.setStatus($("#mdReMsg"), NM.errCopy(e), false, true); }
  finally { btn.disabled = false; }
});

// Wins
$("#mdWinIdeas").addEventListener("click", e => { const b = e.target.closest("button[data-win]"); if (b) $("#mdWin").value = b.dataset.win; });
$("#mdWinSave").addEventListener("click", () => {
  const v = $("#mdWin").value.trim(); if (!v) return;
  addEntry({ kind: "win", text: v }); $("#mdWin").value = "";
  NM.setStatus($("#mdWinMsg"), "Win saved. Nice one.", false);
});
// Kind words
$("#mdKindSave").addEventListener("click", () => {
  const v = $("#mdKind").value.trim(); if (!v) return;
  addEntry({ kind: "kind", text: v }); $("#mdKind").value = "";
  NM.setStatus($("#mdKindMsg"), "Saved. Come back and read it when you need it.", false);
});
// Delete
$("#mdRecent").addEventListener("click", e => {
  const b = e.target.closest("button[data-mdel]"); if (!b) return;
  if (b.dataset.armed) { store.set("mind", entries().filter(x => x.id !== b.dataset.mdel)); renderMind(); return; }
  b.dataset.armed = "1"; b.textContent = "Delete?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "✕"; } }, 3000);
});

NM.renderMind = renderMind;
renderMind();
