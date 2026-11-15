// NutriMe Move: guided breathing, meditation, yoga and workouts, with a shared session player.
// Finished sessions are saved on this device and feed NutriMe Health's diary and insights.
const NM = window.NM;
const { store, fmt, esc } = NM;
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Math.random().toString(36).slice(2, 10);

export const TYPES = {
  meditation: { label: "Meditation", color: "var(--protein)" },
  yoga: { label: "Yoga", color: "var(--fiber)" },
  workout: { label: "Workout", color: "var(--fat)" },
  walk: { label: "Walk", color: "var(--carb)" },
  other: { label: "Other activity", color: "var(--muted)" },
};

// ---------- content ----------
const BREATHS = [
  { id: "calm", name: "Calm breathing", why: "Settles stress fast", phases: [["Breathe in", 4], ["Breathe out", 6]] },
  { id: "box", name: "Box breathing", why: "Steady focus", phases: [["Breathe in", 4], ["Hold", 4], ["Breathe out", 4], ["Hold", 4]] },
  { id: "478", name: "4-7-8 for sleep", why: "Winds you down at night", phases: [["Breathe in", 4], ["Hold", 7], ["Breathe out", 8]] },
];
const P = (name, secs, cue) => ({ name, secs, cue });
const both = (name, secs, cue) => [P(name + ", right side", secs, cue), P(name + ", left side", secs, cue)];
const YOGA = [
  { id: "morning", name: "Morning wake-up", why: "Loosens stiffness and lifts energy", steps: [
    P("Easy seated breathing", 60, "Sit tall, cross-legged or on a chair. Breathe slowly through your nose."),
    P("Neck rolls", 45, "Drop one ear toward your shoulder, then roll slowly forward to the other side. Keep it gentle."),
    P("Cat-cow", 60, "On hands and knees. Breathe in and let your belly drop, lifting your gaze. Breathe out and round your back."),
    P("Child's pose", 45, "Knees wide, big toes together, sit back toward your heels and rest your forehead down."),
    P("Downward dog", 45, "From hands and knees, lift your hips up and back. Bend your knees as much as you need."),
    ...both("Low lunge", 40, "Step one foot forward between your hands, back knee down. Sink your hips gently forward."),
    P("Mountain pose, arms up", 30, "Stand tall, feet hip-width. Reach both arms overhead and lengthen through your sides."),
    P("Standing forward fold", 45, "Soft knees, fold from the hips and let your head hang heavy."),
    P("Chair pose", 30, "Feet together or hip-width, sit back as if into a chair, arms forward. Keep breathing."),
    ...both("Standing side stretch", 30, "Reach one arm overhead and lean gently to the opposite side."),
    ...both("Tree pose", 30, "Rest one foot on your ankle or calf, never on the knee. Use a wall for balance if you like."),
    P("Rest", 60, "Lie down or sit comfortably. Notice how your body feels now."),
  ] },
  { id: "digest", name: "Gentle digestion flow", why: "Eases bloating. Best 1 to 2 hours after eating", steps: [
    P("Belly breathing", 60, "Lie on your back, one hand on your belly. Let it rise as you breathe in and fall as you breathe out."),
    P("Knees to chest", 60, "Hug both knees in and rock gently from side to side."),
    ...both("Lying twist", 45, "Knees bent, let them fall to one side. Arms out wide, look the other way if it feels good."),
    P("Cat-cow", 60, "On hands and knees, move slowly with your breath."),
    P("Child's pose", 60, "Sit back toward your heels, arms long or by your sides. Breathe into your back."),
    P("Seated forward fold", 45, "Legs out in front, knees soft. Fold forward from the hips without forcing."),
    ...both("Seated twist", 40, "Sit tall, turn gently toward one side, using your hand behind you for support."),
    P("Legs up the wall", 90, "Lie with your legs resting up a wall or on a chair. Let your belly soften."),
  ] },
  { id: "bedtime", name: "Bedtime wind-down", why: "Calms the body before sleep", steps: [
    P("Slow breathing", 60, "Sit or lie comfortably. Make each breath out a little longer than the breath in."),
    P("Child's pose", 60, "Rest your forehead down and let your shoulders drop."),
    P("Seated forward fold", 60, "Fold gently over your legs. No need to touch your toes."),
    P("Butterfly", 60, "Soles of the feet together, knees out to the sides. Sit tall or lean slightly forward."),
    P("Reclined butterfly", 60, "Lie back with the soles of your feet together. Support your knees with pillows if you like."),
    ...both("Lying twist", 45, "Let both knees fall to one side and breathe slowly."),
    P("Happy baby", 45, "On your back, hold the outsides of your feet or your shins, knees toward your armpits. Rock gently."),
    P("Legs up the wall", 90, "Rest your legs up a wall. Close your eyes."),
    P("Body scan", 120, "Lie still. Move your attention slowly from your toes to the top of your head, relaxing each part."),
  ] },
];
function intervals(rounds, list, work = 40, rest = 20) {
  const out = [];
  for (let r = 1; r <= rounds; r++) list.forEach(([name, cue], i) => {
    out.push(P(`${name} (round ${r} of ${rounds})`, work, cue));
    if (!(r === rounds && i === list.length - 1)) out.push(P("Rest", rest, "Breathe and get ready for the next one."));
  });
  return out;
}
const WORKOUTS = [
  { id: "fullbody", name: "Beginner full body", why: "Strength for legs, arms and core, no equipment", steps: [
    P("Warm-up: march in place", 60, "Lift your knees and swing your arms. Easy pace."),
    ...intervals(2, [
      ["Squats to a chair", "Sit back until you touch the chair, then stand up. Keep your knees over your toes."],
      ["Wall push-ups", "Hands on a wall at shoulder height. Bend your elbows to bring your chest toward the wall, then push back."],
      ["Glute bridges", "Lie on your back, knees bent. Squeeze your bottom and lift your hips, then lower slowly."],
      ["Bird dog", "On hands and knees, reach one arm forward and the opposite leg back. Switch sides each time."],
      ["Standing knee raises", "Stand tall and lift one knee at a time toward your chest. Hold a chair if you need."],
      ["Plank on knees", "Forearms down, knees down, body in a straight line from head to knees. Keep breathing."],
    ]),
    P("Cool-down stretch", 60, "Reach up tall, then fold forward gently. Roll your shoulders."),
  ] },
  { id: "cardio", name: "Gentle cardio", why: "Raises your heart rate without jumping", steps: [
    P("Warm-up: march in place", 60, "Start easy and build up."),
    ...intervals(2, [
      ["Step jacks", "Step one foot out to the side as your arms go up, then back in. Alternate sides."],
      ["Arm circles while marching", "Small circles forward, then backward, while marching."],
      ["Step touches", "Step side to side, bringing your feet together each time. Add your arms."],
      ["Fast march", "Pick up the pace. Pump your arms."],
      ["Standing cross crunches", "Bring your right elbow toward your left knee, then switch."],
    ]),
    P("Cool-down walk", 60, "Slow down and let your breathing settle."),
  ] },
  { id: "core", name: "Core and posture", why: "Supports your back and helps you sit taller", steps: [
    ...intervals(2, [
      ["Dead bug", "On your back, arms up, knees bent over hips. Slowly lower the opposite arm and leg, then switch."],
      ["Bird dog", "On hands and knees, reach the opposite arm and leg out long. Keep your hips level."],
      ["Glute bridges", "Lift your hips, squeeze, and lower slowly."],
      ["Side plank on knees, right", "Lie on your side, knees bent, prop on your forearm and lift your hips."],
      ["Side plank on knees, left", "Same on the other side."],
      ["Superman lifts", "Lie on your front and gently lift your chest and legs a little, then lower."],
    ], 30, 15),
    P("Cat-cow to finish", 45, "Move slowly with your breath."),
  ] },
];
const totalMin = steps => Math.round(steps.reduce((s, x) => s + x.secs, 0) / 60);

// ---------- data ----------
const acts = () => store.get("activities", []);
function saveActivity(a) { const all = acts(); all.push(a); store.set("activities", all); renderMove(); }

// ---------- sound, voice, screen ----------
let audio = null;
function chime(high = false) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    [high ? 880 : 660, high ? 1320 : 990].forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12); g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 1.2);
      o.connect(g).connect(audio.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 1.3);
    });
  } catch {}
}
function say(text) {
  if (!store.get("voice", false) || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.speak(u); } catch {}
}
let wake = null;
async function keepAwake(on) {
  try { if (on && navigator.wakeLock) wake = await navigator.wakeLock.request("screen"); else if (wake) { await wake.release(); wake = null; } } catch {}
}

// ---------- player ----------
let run = null; // {type, title, steps, i, stepStart, pausedAt, elapsed, timer, breath}
function start(type, title, steps, breath = null) {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {}
  run = { type, title, steps, i: 0, stepStart: Date.now(), pausedAt: 0, done: 0, breath, began: Date.now() };
  $("#player").hidden = false; document.body.style.overflow = "hidden";
  $("#plTitle").textContent = title;
  keepAwake(true); chime(true); say(steps[0].name + ". " + (steps[0].cue || ""));
  showStep(); tick();
  run.timer = setInterval(tick, 200);
}
function showStep() {
  const s = run.steps[run.i], next = run.steps[run.i + 1];
  $("#plStep").textContent = s.name;
  $("#plCue").textContent = s.cue || "";
  $("#plNext").textContent = next ? "Next: " + next.name : "Last one";
  $("#plCount").textContent = `${run.i + 1} of ${run.steps.length}`;
  $("#plBreath").hidden = !run.breath;
}
function elapsedInStep() { return ((run.pausedAt || Date.now()) - run.stepStart) / 1000; }
function tick() {
  if (!run) return;
  const s = run.steps[run.i], el = elapsedInStep(), left = Math.max(0, s.secs - el);
  $("#plTime").textContent = `${Math.floor(Math.ceil(left) / 60)}:${pad(Math.ceil(left) % 60)}`;
  const doneSecs = run.steps.slice(0, run.i).reduce((a, x) => a + x.secs, 0) + Math.min(el, s.secs);
  const all = run.steps.reduce((a, x) => a + x.secs, 0);
  $("#plBar").style.width = (doneSecs / all * 100) + "%";
  if (run.breath) {
    const cyc = run.breath.phases.reduce((a, p) => a + p[1], 0);
    let t = el % cyc, k = 0;
    while (t >= run.breath.phases[k][1]) { t -= run.breath.phases[k][1]; k++; }
    const [label, len] = run.breath.phases[k];
    const prog = t / len;
    const scale = label === "Breathe in" ? 0.55 + 0.45 * prog : label === "Breathe out" ? 1 - 0.45 * prog : (k > 0 && run.breath.phases[k - 1][0] === "Breathe in" ? 1 : 0.55);
    $("#plCircle").style.transform = `scale(${scale.toFixed(3)})`;
    $("#plPhase").textContent = `${label} · ${Math.ceil(len - t)}`;
  }
  if (!run.pausedAt && el >= s.secs) next(true);
}
function next(auto) {
  if (!run) return;
  run.done += Math.min(elapsedInStep(), run.steps[run.i].secs);
  if (run.i >= run.steps.length - 1) return finish(true);
  run.i++; run.stepStart = Date.now(); if (run.pausedAt) run.pausedAt = Date.now();
  chime(false); say(run.steps[run.i].name + ". " + (run.steps[run.i].cue || ""));
  showStep(); tick();
}
function finish(completed) {
  if (!run) return;
  clearInterval(run.timer);
  if (!completed) run.done += Math.min(elapsedInStep(), run.steps[run.i].secs);
  const minutes = Math.round(run.done / 60);
  const r = run; run = null;
  keepAwake(false); try { speechSynthesis && speechSynthesis.cancel(); } catch {}
  $("#player").hidden = true; document.body.style.overflow = "";
  if (minutes >= 1) {
    const now = new Date();
    saveActivity({ id: uid(), type: r.type, title: r.title, minutes, at: now.toISOString(), day: dayKey(now), completed });
    if (completed) chime(true);
    NM.setStatus($("#moveMsg"), `${completed ? "Well done!" : "Stopped early."} ${minutes} min of ${r.title.toLowerCase()} saved to your Health log.`, false);
  } else NM.setStatus($("#moveMsg"), "Stopped before a minute, so nothing was saved.", false);
  $("#moveMsg").scrollIntoView({ block: "center" });
}
$("#plPause").addEventListener("click", () => {
  if (!run) return;
  if (run.pausedAt) { run.stepStart += Date.now() - run.pausedAt; run.pausedAt = 0; $("#plPause").textContent = "Pause"; }
  else { run.pausedAt = Date.now(); $("#plPause").textContent = "Resume"; }
});
$("#plSkip").addEventListener("click", () => next(false));
$("#plStop").addEventListener("click", () => finish(false));
document.addEventListener("visibilitychange", () => { if (run && document.visibilityState === "visible") keepAwake(true); });

// ---------- page ----------
let breathPick = "calm", breathMin = 5, quietMin = 10;
function chips(list, cur, attr) { return list.map(([v, label]) => `<button type="button" class="chip pick" data-${attr}="${v}" aria-pressed="${String(v) === String(cur)}">${esc(label)}</button>`).join(""); }
function routineCards(list, type) {
  return list.map(r => `<article class="routine"><div><b>${esc(r.name)}</b><small>${totalMin(r.steps)} min · ${esc(r.why)}</small></div><button type="button" class="primary" data-start="${type}:${r.id}">Start</button></article>`).join("");
}
function weekStats() {
  const a = acts(), today = dayKey(new Date());
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6); const from = dayKey(weekAgo);
  const wk = a.filter(x => x.day >= from && x.day <= today);
  const by = {}; wk.forEach(x => by[x.type] = (by[x.type] || 0) + x.minutes);
  const days = new Set(a.map(x => x.day)); let streak = 0; const d = new Date();
  if (!days.has(today)) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  return { total: wk.reduce((s, x) => s + x.minutes, 0), sessions: wk.length, by, streak };
}
function renderMove() {
  const w = weekStats();
  $("#mvWeek").innerHTML = `<div class="tiles">
    <div class="tile"><span class="eyebrow">Last 7 days</span><b>${w.total}<small> min</small></b><span class="trend">${w.sessions} session${w.sessions === 1 ? "" : "s"}</span></div>
    <div class="tile"><span class="eyebrow">Streak</span><b>${w.streak}<small> day${w.streak === 1 ? "" : "s"}</small></b><span class="trend">${w.streak ? "Keep it going" : "Start one today"}</span></div>
  </div>${w.total ? `<div class="split" aria-hidden="true">${Object.entries(w.by).map(([t, m]) => `<i style="width:${m / w.total * 100}%;background:${TYPES[t]?.color || "var(--muted)"}"></i>`).join("")}</div>
  <div class="legend">${Object.entries(w.by).map(([t, m]) => `<span style="--c:${TYPES[t]?.color || "var(--muted)"}">${esc(TYPES[t]?.label || t)} ${m} min</span>`).join("")}</div>` : ""}`;
  $("#mvBreath").innerHTML = chips(BREATHS.map(b => [b.id, b.name]), breathPick, "breath");
  $("#mvBreathWhy").textContent = BREATHS.find(b => b.id === breathPick).why + ".";
  $("#mvBreathMin").innerHTML = chips([[3, "3 min"], [5, "5 min"], [10, "10 min"]], breathMin, "bmin");
  $("#mvQuietMin").innerHTML = chips([[5, "5 min"], [10, "10 min"], [15, "15 min"], [20, "20 min"]], quietMin, "qmin");
  $("#mvYoga").innerHTML = routineCards(YOGA, "yoga");
  $("#mvWorkout").innerHTML = routineCards(WORKOUTS, "workout");
  $("#mvVoice").checked = !!store.get("voice", false);
  const recent = acts().slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  $("#mvRecent").innerHTML = recent.length ? recent.map(x => `<div class="meal"><span class="t">${esc(new Date(x.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }))}</span><span class="n">${esc(x.title)}<small>${esc(TYPES[x.type]?.label || x.type)}</small></span><span class="k">${x.minutes} min</span><button class="ghost del" type="button" data-adel="${x.id}" aria-label="Delete activity">✕</button></div>`).join("") : `<p class="empty">No sessions yet. Pick one above to start.</p>`;
}
$("#view-move").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.breath) { breathPick = b.dataset.breath; renderMove(); }
  else if (b.dataset.bmin) { breathMin = Number(b.dataset.bmin); renderMove(); }
  else if (b.dataset.qmin) { quietMin = Number(b.dataset.qmin); renderMove(); }
  else if (b.dataset.start) {
    const [type, id] = b.dataset.start.split(":");
    const r = (type === "yoga" ? YOGA : WORKOUTS).find(x => x.id === id);
    start(type, r.name, r.steps);
  } else if (b.dataset.adel) {
    if (b.dataset.armed) { store.set("activities", acts().filter(x => x.id !== b.dataset.adel)); renderMove(); return; }
    b.dataset.armed = "1"; b.textContent = "Delete?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = "✕"; } }, 3000);
  }
});
$("#mvBreathGo").addEventListener("click", () => {
  const b = BREATHS.find(x => x.id === breathPick);
  start("meditation", b.name, [P(b.name, breathMin * 60, "Follow the circle. In through your nose, out slowly.")], b);
});
$("#mvQuietGo").addEventListener("click", () => {
  const half = Math.round(quietMin * 30);
  start("meditation", "Quiet meditation", [
    P("Settle in", half, "Sit comfortably and close your eyes. Rest your attention on your breath. When your mind wanders, gently come back."),
    P("Keep sitting", quietMin * 60 - half, "Halfway. Notice sounds, then your body, then your breath again."),
  ]);
});
$("#mvVoice").addEventListener("change", e => store.set("voice", e.target.checked));
$("#mvLogDay").value = dayKey(new Date()); $("#mvLogDay").max = dayKey(new Date());
$("#mvLogSave").addEventListener("click", () => {
  const minutes = Math.round(Number($("#mvLogMin").value) || 0);
  if (minutes < 1) { NM.setStatus($("#mvLogMsg"), "Enter how many minutes.", false, true); return; }
  const type = $("#mvLogType").value, day = $("#mvLogDay").value || dayKey(new Date());
  const at = day === dayKey(new Date()) ? new Date() : new Date(day + "T12:00");
  saveActivity({ id: uid(), type, title: TYPES[type].label, minutes, at: at.toISOString(), day, completed: true, manual: true });
  NM.setStatus($("#mvLogMsg"), `Saved ${minutes} min of ${TYPES[type].label.toLowerCase()}.`, false);
});

NM.renderMove = renderMove;
renderMove();
