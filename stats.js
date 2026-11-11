/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Anonymous stats (PostHog via /ingest) and speed: web vitals and slow taps.

/* ---------- Anonymous stats ---------- */
// Only which buttons are tapped and how many plants: no plant names, nicknames, photos or spots.
// Sent to PostHog via /ingest (a Cloudflare function). Can be turned off in settings.
const PH_KEY = 'phc_wbQKWDjgettNukrqC7etDr8NZjucbJ9mKz7cfB3ziEAz';
const STATS_LOCAL = location.protocol === 'file:' || /^(localhost|127\.|\[::1\])/.test(location.hostname);
let statsQueue = [];
let statsTimer;
let anonId = null;
// Reads the device number without creating one (settings show it only if stats were ever sent).
function savedAnonId() {
  try { return anonId || localStorage.getItem('zhungli.anon'); } catch (e) { return null; }
}
function getAnonId() {
  if (anonId) return anonId;
  try {
    anonId = localStorage.getItem('zhungli.anon');
    if (!anonId) { anonId = crypto.randomUUID(); localStorage.setItem('zhungli.anon', anonId); }
  } catch (e) { anonId = 'anon-' + Math.random().toString(36).slice(2); }
  return anonId;
}
function deviceProps() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac OS X' : /Win/.test(ua) ? 'Windows' : 'Other';
  return {
    $os: os,
    $device_type: /iPhone|iPod|Android.*Mobile/.test(ua) ? 'Mobile' : /iPad|Android/.test(ua) ? 'Tablet' : 'Desktop',
    $current_url: location.origin + location.pathname,
    $host: location.host,
    standalone: !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches),
    in_telegram: IN_TELEGRAM,
    mini_app: MINI_APP,
    ...(window.tgInfo || {}),
  };
}
function track(event, props = {}) {
  if (S.settings.stats === false) return;
  statsQueue.push({
    event, distinct_id: getAnonId(), timestamp: new Date().toISOString(),
    properties: { ...deviceProps(), ...props, app_version: APP_VERSION, plants_total: Object.keys(S.plants).length, $lib: 'zhungli', $process_person_profile: false },
  });
  clearTimeout(statsTimer);
  statsTimer = setTimeout(flushStats, 2000);
}
function flushStats() {
  if (!statsQueue.length) return;
  const batch = statsQueue;
  statsQueue = [];
  if (STATS_LOCAL) { console.debug('[stats]', JSON.stringify(batch.map((e) => [e.event, e.properties]))); return; }
  fetch('/ingest/batch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ api_key: PH_KEY, batch }),
  }).catch(() => {});
}
/* ---------- Speed (web vitals) ---------- */
// Load and tap timings from the browser itself, no extra script. Sent as PostHog's $web_vitals when the
// app goes to background or closes. FCP everywhere; LCP, INP and CLS where the browser supports them.
// Slow taps also go out one by one with the button's data-act.
const SLOW_TAP = 200; // ms: INP above this "needs improvement"
const vitals = {}, vitalsSent = {};
// A visit: from launch, or from a return after 30+ minutes away (app_opened resume). INP and the
// slow tap cap count per visit, since a home-screen app or mini app can stay open for days.
let visit = { id: Math.random().toString(36).slice(2, 10), base: performance.interactionCount || 0, slow: new Set() };
let worstTaps = []; // the slowest interactions of this visit, for INP
const taps = new Map(); // interactionId → timings merged from all its events, until settled
let tapTimer = 0;
// Which control an input hit, noted at input time: a re-render often removes the node before the timing arrives.
const tapTargets = [];
function tapTarget(el) {
  const t = el && el.closest ? el.closest('[data-act],[data-tab],[data-open],[id]') : null;
  if (!t) return el && el.tagName ? el.tagName.toLowerCase() : 'none';
  if (t.dataset.act) return t.dataset.act;
  if (t.dataset.tab) return 'tab-' + t.dataset.tab;
  if (t.dataset.open) return 'open-plant'; // the id is a plant id, not sent
  return t.id;
}
// Every event of a tap: on a phone the pointerdown is often fast and not reported, only the click.
['pointerdown', 'pointerup', 'click', 'keydown', 'keyup'].forEach((type) => addEventListener(type, (e) => {
  tapTargets.push({ t: e.timeStamp, name: tapTarget(e.target) });
  if (tapTargets.length > 30) tapTargets.shift();
}, { capture: true, passive: true }));
// Every tap on a control and every changed field, by name only: never what's typed or chosen.
document.addEventListener('click', (e) => {
  if (!e.isTrusted || e.target.closest('label,input,select,textarea')) return; // fields: see field_changed
  const el = e.target.closest('button,a[href],[data-act],[data-tab],[data-open]');
  if (!el) return;
  const target = el.tagName === 'A' && !el.dataset.act ? 'link-' + (el.dataset.out || el.getAttribute('href')) : tapTarget(el);
  track('ui_clicked', { target });
}, true);
document.addEventListener('change', (e) => {
  const f = e.target;
  if (!e.isTrusted || !f.matches || !f.matches('input,select,textarea')) return;
  const props = { field: f.id || f.name || tapTarget(f), type: f.type };
  if (f.type === 'checkbox') props.checked = f.checked;
  track('field_changed', props);
}, true);
function watchTimings(type, cb, opts) {
  if (!window.PerformanceObserver || !(PerformanceObserver.supportedEntryTypes || []).includes(type)) return false;
  try { new PerformanceObserver((list) => cb(list.getEntries())).observe({ type, buffered: true, ...opts }); return true; } catch (e) { return false; }
}
function onInteractions(entries) {
  // One tap fires several events (pointerdown, pointerup, click), sometimes in separate batches. A tap's
  // delay is its slowest frame; the breakdown comes from the events painted in that frame (end within 8 ms).
  entries.forEach((e) => {
    if (!e.interactionId) return;
    const m = taps.get(e.interactionId), end = e.startTime + e.duration, proc = e.processingEnd - e.processingStart;
    const hit = tapTargets.find((x) => Math.abs(x.t - e.startTime) < 1);
    const name = hit ? hit.name : e.target && tapTarget(e.target);
    const own = { start: e.startTime, end, procStart: e.processingStart, procEnd: e.processingEnd, duration: e.duration, event: e.name, longest: proc };
    if (!m) { taps.set(e.interactionId, { ...own, name }); return; }
    m.name = m.name || name;
    if (Math.abs(end - m.end) <= 8) {
      m.start = Math.min(m.start, e.startTime);
      m.procStart = Math.min(m.procStart, e.processingStart);
      m.procEnd = Math.max(m.procEnd, e.processingEnd);
      m.duration = Math.max(m.duration, e.duration);
      if (proc > m.longest) { m.longest = proc; m.event = e.name; } // name the event whose handlers ran longest
    } else if (e.duration > m.duration) Object.assign(m, own);
  });
  clearTimeout(tapTimer);
  tapTimer = setTimeout(settleTaps, 1000);
}
// Once a tap's events have all arrived: update INP and report it if slow.
function settleTaps() {
  clearTimeout(tapTimer);
  taps.forEach((e, id) => {
    const known = worstTaps.find((w) => w.id === id);
    if (known) known.duration = Math.max(known.duration, e.duration);
    else worstTaps.push({ id, duration: e.duration });
    // Once per tap, even if it crossed the line with an entry that came late.
    if (e.duration < SLOW_TAP || visit.slow.has(id) || visit.slow.size >= 10) return;
    visit.slow.add(id);
    track('slow_tap', {
      target: e.name || 'none', event: e.event, duration: Math.round(e.duration),
      input_delay: Math.round(e.procStart - e.start),
      processing: Math.round(e.procEnd - e.procStart),
      presentation: Math.round(Math.max(0, e.end - e.procEnd)),
    });
  });
  taps.clear();
  if (!worstTaps.length) return;
  // INP: the slowest interaction, skipping one for every 50 (the 98th percentile). Keep just enough to find it.
  const count = performance.interactionCount != null ? performance.interactionCount - visit.base : worstTaps.length;
  const skip = Math.floor(count / 50);
  worstTaps.sort((a, b) => b.duration - a.duration);
  worstTaps.length = Math.min(worstTaps.length, Math.max(10, skip + 1));
  vitals.INP = worstTaps[Math.min(worstTaps.length - 1, skip)].duration;
}
// Paints after the page was first hidden (opened in background, app switched) don't count as load time.
let firstHidden = document.visibilityState === 'hidden' ? 0 : Infinity;
addEventListener('visibilitychange', () => { if (document.hidden) firstHidden = Math.min(firstHidden, performance.now()); }, true);
watchTimings('paint', (es) => es.forEach((e) => { if (e.name === 'first-contentful-paint' && e.startTime < firstHidden) vitals.FCP = e.startTime; }));
watchTimings('largest-contentful-paint', (es) => es.forEach((e) => { if (e.startTime < firstHidden) vitals.LCP = e.startTime; }));
watchTimings('event', onInteractions, { durationThreshold: 40 });
watchTimings('first-input', onInteractions); // fast first taps, so INP isn't reported only when slow
let clsWindow = 0, clsFirst = 0, clsLast = 0;
if (watchTimings('layout-shift', (es) => es.forEach((e) => {
  if (e.hadRecentInput) return;
  // CLS: the largest burst of shifts, each under 1 s apart and 5 s at most.
  if (clsWindow && e.startTime - clsLast < 1000 && e.startTime - clsFirst < 5000) clsWindow += e.value;
  else { clsWindow = e.value; clsFirst = e.startTime; }
  clsLast = e.startTime;
  vitals.CLS = Math.max(vitals.CLS || 0, clsWindow);
}))) vitals.CLS = vitals.CLS || 0;
// Called when the app goes to background or closes: sends only values that changed since the last report.
// A visit can report several times; `visit` lets the dashboard keep its last values.
function reportVitals() {
  settleTaps();
  const props = {};
  Object.keys(vitals).forEach((k) => {
    const v = k === 'CLS' ? Math.round(vitals[k] * 1e4) / 1e4 : Math.round(vitals[k]);
    if (vitalsSent[k] !== v) props[`$web_vitals_${k}_value`] = vitalsSent[k] = v;
  });
  if (Object.keys(props).length) track('$web_vitals', { ...props, $pathname: location.pathname, visit: visit.id });
}
// A new visit: INP and the slow tap cap start over. Load metrics belong to the launch and aren't sent again.
function newVisit() {
  settleTaps();
  visit = { id: Math.random().toString(36).slice(2, 10), base: performance.interactionCount || 0, slow: new Set() };
  worstTaps = [];
  delete vitals.INP;
  delete vitalsSent.INP;
}

// Catalog ids aren't personal (custom plants are sent as 'custom').
const kindOf = (id) => { const d = def(id), r = S.plants[id]; return { plant_kind: isCustom(id) ? 'custom' : d.id, plant_type: mediumIn(r, d), watering: wateringIn(r, d) || 'none', generic: !!d.generic }; };
