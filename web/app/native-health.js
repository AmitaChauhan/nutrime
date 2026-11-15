// Loaded only inside the Android (and later iPhone) app. Reads Health Connect / Apple Health
// through the @capgo/capacitor-health plugin and hands daily totals to the journal.
const Health = window.Capacitor?.Plugins?.Health;
const pad = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ASLEEP = new Set(["asleep", "rem", "deep", "light"]);

async function readAll(dataType, startDate, endDate) {
  const { samples } = await Health.readSamples({ dataType, startDate, endDate, limit: 1000, ascending: true });
  return samples || [];
}

if (Health) {
  window.NutriHealthSync = async (days = 30) => {
    const av = await Health.isAvailable();
    if (!av.available) throw new Error("Health Connect isn't available on this phone. Install \"Health Connect\" from the Play Store, then try again.");
    await Health.requestAuthorization({ read: ["steps", "sleep", "restingHeartRate", "weight"] });
    const end = new Date(), start = new Date();
    start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0);
    const s = start.toISOString(), e = end.toISOString();
    const out = {};
    const put = (d, k, v) => { (out[d] || (out[d] = {}))[k] = v; };
    let got = 0;

    try {
      const { samples } = await Health.queryAggregated({ dataType: "steps", startDate: s, endDate: e, bucket: "day", aggregation: "sum" });
      for (const x of samples || []) if (x.value > 0) { put(dayKey(new Date(x.startDate)), "steps", Math.round(x.value)); got++; }
    } catch {}

    try {
      // Sleep counts toward the day you woke up.
      const mins = {};
      for (const x of await readAll("sleep", s, e)) {
        let m = 0;
        if (Array.isArray(x.stages) && x.stages.length) {
          for (const st of x.stages) if (ASLEEP.has(st.state || st.sleepState)) m += (new Date(st.endDate) - new Date(st.startDate)) / 60000;
        } else if (!x.sleepState || ASLEEP.has(x.sleepState)) m = Number(x.value) || 0;
        const d = dayKey(new Date(x.endDate));
        mins[d] = (mins[d] || 0) + m;
      }
      for (const [d, m] of Object.entries(mins)) if (m > 0) { put(d, "sleepH", Math.round(m / 6) / 10); got++; }
    } catch {}

    try {
      const hr = {};
      for (const x of await readAll("restingHeartRate", s, e)) { const d = dayKey(new Date(x.startDate)); (hr[d] || (hr[d] = [])).push(Number(x.value)); }
      for (const [d, v] of Object.entries(hr)) { put(d, "restHR", Math.round(v.reduce((a, b) => a + b, 0) / v.length)); got++; }
    } catch {}

    try {
      for (const x of await readAll("weight", s, e)) { put(dayKey(new Date(x.startDate)), "weight", Math.round(Number(x.value) * 10) / 10); got++; }
    } catch {}

    if (!got) {
      const st = await Health.checkAuthorization({ read: ["steps", "sleep", "restingHeartRate", "weight"] }).catch(() => null);
      if (st && Array.isArray(st.readDenied) && st.readDenied.length) throw new Error("NutriMe doesn't have permission to read your health data yet. Allow it in Health Connect, then sync again.");
    }
    return out;
  };
  window.dispatchEvent(new Event("nutrihealth-ready"));
}
