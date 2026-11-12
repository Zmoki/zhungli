/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// UI shell (sheet, toasts, render), tap handling, update check and startup.

// core.js didn't load, so its retry isn't there either: reload once here (core.js reports it).
try { void appStarted; } catch (e) {
  const v = new URL(document.currentScript.src).searchParams.get('v');
  try {
    if (sessionStorage.getItem('zhungli.retriedFor') !== v) {
      sessionStorage.setItem('zhungli.retriedFor', v);
      sessionStorage.setItem('zhungli.retry', JSON.stringify({ reason: 'script_failed', file: 'core.js', started: false }));
      location.reload();
    }
  } catch (e2) { /* stay */ }
}

/* ---------- UI ---------- */
const sheet = $('#sheet');
function openSheet() {
  const h = $('#sheet-body h2');
  if (h) sheet.setAttribute('aria-label', h.textContent); else sheet.removeAttribute('aria-label');
  closedByUs = false; // in case a browser never sent the close event
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
// Re-render here: the close event doesn't fire in every browser. Where it does, it comes a moment
// later and skips its own render, so the list isn't built twice.
let closedByUs = false;
function closeSheet() { endAddFlow(); if (sheet.open) { closedByUs = true; sheet.close(); } render(); }
ACTS.close = () => closeSheet();
sheet.addEventListener('close', () => { // closed by swipe, Esc or the close button
  if (closedByUs) { closedByUs = false; return; }
  endAddFlow(); render();
});
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

let toastTimer;
function toast(msg, undo) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = esc(msg) + (undo ? ' <button class="undo" id="undo">Отменить</button>' : '');
  document.body.append(el);
  $('#live').textContent = msg;
  clearTimeout(toastTimer);
  document.removeEventListener('pointerdown', toastAway, true);
  if (undo) {
    // No time limit while undo is offered: it stays until the next tap elsewhere.
    el.querySelector('.undo').onclick = () => { undo(); el.remove(); };
    setTimeout(() => document.addEventListener('pointerdown', toastAway, true), 0);
  } else {
    toastTimer = setTimeout(() => el.remove(), 4500);
  }
}
function toastAway(e) {
  const el = document.querySelector('.toast');
  if (el && el.contains(e.target)) return;
  document.removeEventListener('pointerdown', toastAway, true);
  el?.remove();
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const em = ['🌿', '🍃', '✨', '🌱', '💚', '🌸'];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    s.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.append(s);
    setTimeout(() => s.remove(), 4200);
  }
}

function afterTask(msg, undo) {
  if (window.haptic) window.haptic('success');
  save();
  const before = document.querySelectorAll('.task:not(.bonus):not(.done-row)').length;
  render();
  toast(msg, undo);
  if (before > 0 && pendingCount() === 0) { confetti(); track('day_completed', { done_today: (S.log[today()] || []).length }); }
}

// Sizes from data-l / data-w (percent), set through CSSOM: the CSP forbids inline style attributes.
function applySizes(root = document) {
  root.querySelectorAll('[data-l], [data-w]').forEach((el) => {
    if (el.dataset.l) el.style.left = el.dataset.l + '%';
    if (el.dataset.w) el.style.width = el.dataset.w + '%';
  });
}
function render() {
  const view = $('#view');
  // Tile ticks only matter while the collection is empty: once plants are in, by any way, they're done.
  if (Object.keys(S.plants).length) { qsPicked.clear(); qsReported = false; }
  view.innerHTML = tab === 'today' ? viewToday() : tab === 'plants' ? viewPlants() : tab === 'light' ? viewLight() : viewRoom();
  applySizes(view);
  revokeOldPhotos();
  if (tab === 'plants') filterPlants();
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

// Author links: send right away, the app may go to background.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-out]');
  if (a) { track('author_link_clicked', { target: a.dataset.out, from: a.closest('[data-from]')?.dataset.from || 'other' }); flushStats(); }
  const pv = e.target.closest('a[href="privacy"]');
  if (pv) {
    track('privacy_opened', { from: pv.closest('[data-from]')?.dataset.from || 'other' });
    flushStats();
    // The page opens in this window, so coming back reloads the app: that's not a new launch.
    try { sessionStorage.setItem('zhungli.privacyAt', Date.now()); } catch (err) { /* private mode */ }
  }
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act],[data-tab],[data-open]');
  if (!el) return;
  if (el.dataset.tab) {
    tab = el.dataset.tab;
    track('tab_viewed', { tab });
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (el.dataset.open) { if (plant(el.dataset.open)) track('plant_opened', kindOf(el.dataset.open)); openPlant(el.dataset.open); return; }
  const id = el.dataset.id;
  const act = el.dataset.act;
  if (ACTS[act]) ACTS[act](el, id, act);
});

// iPhone doesn't reload a home-screen app; it resumes the old page.
// So check for a new version every time the app is opened.
async function checkUpdate() {
  if (location.protocol === 'file:') return;
  try {
    const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
    const v = r.ok ? (await r.text()).trim() : '';
    if (!v || v === APP_VERSION || sheet.open) return;
    if (sessionStorage.getItem('zhungli.reloadedFor') === v) return; // avoid a reload loop
    sessionStorage.setItem('zhungli.reloadedFor', v);
    location.reload();
  } catch (e) { /* offline: run with what we have */ }
}

let lastOpen = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Leaving for the AI chat after copying the prompt, or opening the file picker, is the expected path, not abandoning.
    const expected = addFlow && addFlow.sheet === 'import' && (addFlow.promptCopied || addFlow.picking);
    if (sheet.open && !expected) endAddFlow(true);
    endQuick('left_app');
    reportVitals();
    flushStats();
    return;
  }
  if (addFlow) addFlow.picking = false;
  if (Date.now() - lastOpen > 30 * 60 * 1000) { newVisit(); track('app_opened', { how: 'resume' }); }
  lastOpen = Date.now();
  checkUpdate();
  if (!sheet.open) render();
});

// iOS 26, home-screen app or Telegram mini app: after the keyboard closes, the viewport can stay as
// short as it was with the keyboard up, so the tab bar floats mid-screen and sheets end early, until
// the app is restarted. When the height is stuck, hiding and showing the whole page for one reflow
// makes iOS measure it again. The tallest height seen per width tells "stuck" from a rotation.
// Not in Safari: its toolbars change the height on their own.
if (IOS && (navigator.standalone || MINI_APP)) {
  const tallest = {};
  const remember = () => { tallest[innerWidth] = Math.max(tallest[innerWidth] || 0, innerHeight); };
  remember();
  addEventListener('resize', remember);
  const isField = (el) => el && el.matches && el.matches('input, textarea, select, [contenteditable="true"]');
  let reported = 0;
  const remeasure = () => {
    if (isField(document.activeElement)) return; // the keyboard is still up
    // In Telegram a collapsed mini app is short on purpose.
    if (MINI_APP && window.Telegram?.WebApp && !window.Telegram.WebApp.isExpanded) return;
    const before = innerHeight, full = tallest[innerWidth] || 0;
    if (full - before <= 4) return; // not stuck
    const root = document.documentElement, y = scrollY, inSheet = sheet.scrollTop;
    root.style.display = 'none';
    void root.offsetHeight; // a synchronous reflow, nothing gets painted in between
    root.style.display = '';
    scrollTo(0, y);
    sheet.scrollTop = inSheet;
    // Whether it happens and whether this helps: at most 3 reports per launch.
    if (reported++ < 3) setTimeout(() => track('viewport_stuck', { before, full, after: innerHeight }), 300);
    remember();
  };
  // Check after the keyboard has had time to slide away, and again in case it was still moving.
  const soon = () => { setTimeout(remeasure, 150); setTimeout(remeasure, 600); };
  document.addEventListener('focusout', (e) => { if (isField(e.target)) soon(); });
  // The keyboard can also close without the field losing focus (scrolling, «Готово»).
  let vvTimer;
  window.visualViewport?.addEventListener('resize', () => { clearTimeout(vvTimer); vvTimer = setTimeout(remeasure, 250); });
}

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (!booting) render(); });
addEventListener('appinstalled', () => { installPrompt = null; track('app_installed'); render(); });

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

save();
booting = false;
render();
appStarted = true;
loadPhotos();
checkUpdate();
// ready_ms: from navigation start until the first screen is built (painted right after). Not sent when
// the app started in background, since that time includes waiting to be shown.
let openHow = 'start';
try {
  const at = Number(sessionStorage.getItem('zhungli.privacyAt'));
  sessionStorage.removeItem('zhungli.privacyAt');
  if (at && Date.now() - at < 30 * 60 * 1000) openHow = 'privacy_return';
  // core.js reloaded a page that had started (and sent app_opened): not a new launch either.
  if (JSON.parse(sessionStorage.getItem('zhungli.retry') || 'null')?.started) openHow = 'retry';
} catch (e) { /* private mode */ }
// Back from the back-forward cache: no reload, so the next real one is a launch again.
addEventListener('pageshow', (e) => { if (e.persisted) try { sessionStorage.removeItem('zhungli.privacyAt'); } catch (err) { /* private mode */ } });
// Where a launch came from, as a known source only: a company wiki or a webmail host could say who someone
// is, so any other site is just 'other'. No referrer, or our own site: $direct, as PostHog names it.
// Android apps send android-app://<package>, matched like hosts.
const REF_SOURCES = [
  // Google search on its country domains (google.de, google.co.uk, google.com.br); Sites, Docs and Gmail are 'other'.
  ['google.com', /^(www\.)?google\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$|^com\.google\.android\.googlequicksearchbox$/],
  ['yandex.ru', /(^|\.)(yandex\.(ru|com|by|kz|uz|com\.tr)|ya\.ru)$|^ru\.yandex\./],
  ['bing.com', /(^|\.)bing\.com$/], ['duckduckgo.com', /(^|\.)duckduckgo\.com$/],
  ['t.me', /(^|\.)(t\.me|telegram\.org|telegram\.me)$|^org\.telegram\./],
  ['vk.com', /(^|\.)(vk\.com|vk\.ru)$|^com\.vkontakte\./], ['ok.ru', /(^|\.)ok\.ru$/],
  ['instagram.com', /(^|\.)instagram\.com$|^com\.instagram\./], ['facebook.com', /(^|\.)facebook\.com$|^com\.facebook\./],
  ['threads.net', /(^|\.)threads\.(net|com)$/], ['x.com', /(^|\.)(x\.com|twitter\.com|t\.co)$/],
  ['reddit.com', /(^|\.)reddit\.com$/], ['youtube.com', /(^|\.)youtube\.com$/], ['pinterest.com', /(^|\.)pinterest\.(com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/],
  ['linkedin.com', /(^|\.)(linkedin\.com|lnkd\.in)$/], ['tiktok.com', /(^|\.)tiktok\.com$/], ['whatsapp.com', /(^|\.)whatsapp\.(com|net)$/],
  ['dzen.ru', /(^|\.)dzen\.ru$/], ['habr.com', /(^|\.)habr\.com$/], ['github.com', /(^|\.)github\.com$/],
  ['producthunt.com', /(^|\.)producthunt\.com$/], ['chatgpt.com', /(^|\.)(chatgpt\.com|openai\.com)$/],
  ['claude.ai', /(^|\.)claude\.ai$/], ['perplexity.ai', /(^|\.)perplexity\.ai$/], ['zmoki.xyz', /(^|\.)zmoki\.xyz$/],
];
function refSource(ref) {
  try {
    const h = ref && new URL(ref).hostname.toLowerCase();
    if (!h || h === location.hostname) return '$direct';
    const hit = REF_SOURCES.find(([, re]) => re.test(h));
    return hit ? hit[0] : 'other';
  } catch (e) { return '$direct'; }
}
// Sent once per arrival: an update or settings reload keeps the same document.referrer, so it isn't sent
// again; coming back in the same tab through another link changes it, and that counts.
function arrivalSource() {
  const ref = document.referrer || '';
  try {
    if (sessionStorage.getItem('zhungli.refSent') === ref) return undefined;
    sessionStorage.setItem('zhungli.refSent', ref);
  } catch (e) { /* private mode: send it */ }
  return refSource(ref);
}
track('app_opened', { how: openHow, ready_ms: firstHidden === Infinity ? Math.round(performance.now()) : undefined, $referring_domain: openHow === 'start' ? arrivalSource() : undefined });
// Closing the mini app or the tab may skip visibilitychange.
addEventListener('pagehide', () => { reportVitals(); flushStats(); });
