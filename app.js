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
function closeSheet() { endAddFlow(); sheetClosed(); if (sheet.open) { closedByUs = true; sheet.close(); } render(); }
ACTS.close = () => closeSheet();
sheet.addEventListener('close', () => { // closed by swipe, Esc or the close button
  if (closedByUs) { closedByUs = false; return; }
  if (sheet.open) return; // opened again before this event came
  sheetClosed(); endAddFlow(); render();
});
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

// In-app confirm and prompt (#ask), instead of the browser's: the app's look, text size and theme,
// above the sheet. Resolves to true or the typed text; false or null when cancelled (button, Esc, a tap outside).
// The «yes» button submits the form, so Enter in the field means yes.
const askBox = $('#ask');
function ask({ title, text = '', ok, cancel = 'Отмена', danger = false, input = null }) {
  // One question at a time: a second one while the first is open counts as cancelled.
  if (askBox.open) return Promise.resolve(input ? null : false);
  return new Promise((resolve) => {
    askBox.setAttribute('role', input ? 'dialog' : 'alertdialog');
    if (text) askBox.setAttribute('aria-describedby', 'ask-text'); else askBox.removeAttribute('aria-describedby');
    askBox.innerHTML = `<form method="dialog">
      <h2 id="ask-title">${esc(title)}</h2>${text ? `<p id="ask-text" class="mt-8">${esc(text)}</p>` : ''}
      ${input ? `<input id="ask-input" class="input mt-14" type="text" maxlength="40" autocomplete="off" enterkeyhint="done" aria-labelledby="ask-title" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}">` : ''}
      <div class="btns mt-20"><button type="button" class="btn" id="ask-no">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'ok'}" value="yes">${esc(ok)}</button></div></form>`;
    const field = $('#ask-input');
    $('#ask-no').onclick = () => askBox.close('no');
    askBox.addEventListener('close', () => {
      const yes = askBox.returnValue === 'yes';
      resolve(input ? (yes ? field.value.trim() : null) : yes);
    }, { once: true });
    askBox.returnValue = '';
    askBox.showModal();
    // A choice to undo something starts on «Отмена»; a name starts in the field.
    if (field) { field.focus(); field.select(); } else $('#ask-no').focus();
  });
}
askBox.addEventListener('click', (e) => { if (e.target === askBox) askBox.close('no'); });

let toastTimer;
function toast(msg, undo) {
  document.querySelector('.toast')?.remove();
  document.querySelector('.toast-dock')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = esc(msg) + (undo ? ' <button class="undo" id="undo">Отменить</button>' : '');
  // An open sheet is a modal <dialog>: it covers the page and makes the rest of it inert, so a toast in
  // the page can't be seen or tapped. There the toast goes into the sheet and shows above it as a popover,
  // placed right after the focused control so «Отменить» is the next Tab stop. Without popovers (iOS 16)
  // it sits in a zero-height dock stuck to the sheet's bottom edge, so the sheet's layout doesn't move.
  if (sheet.open && el.showPopover) {
    const at = document.activeElement;
    // Not inside a label: a tap on the toast would toggle its checkbox.
    if (at && at !== sheet && $('#sheet-body').contains(at)) (at.closest('label') || at).after(el); else sheet.append(el);
    el.popover = 'manual';
    el.showPopover();
  } else if (sheet.open) {
    const dock = document.createElement('div');
    dock.className = 'toast-dock';
    dock.append(el);
    sheet.append(dock);
  } else document.body.append(el);
  announce(msg);
  clearTimeout(toastTimer);
  TOAST_AWAY.forEach((t) => document.removeEventListener(t, toastAway, true));
  if (undo) {
    // No time limit while undo is offered: it stays until anything else is tapped or changed,
    // so undo never takes back more than the action it was offered for.
    el.querySelector('.undo').onclick = () => { undo(); el.remove(); };
    setTimeout(() => TOAST_AWAY.forEach((t) => document.addEventListener(t, toastAway, true)), 0);
  } else {
    toastTimer = setTimeout(() => el.remove(), 4500);
  }
}
// Taps (also from the keyboard: click) and field changes elsewhere close an undo toast.
const TOAST_AWAY = ['pointerdown', 'click', 'change'];
function toastAway(e) {
  const el = document.querySelector('.toast');
  if (el && el.contains(e.target)) return;
  TOAST_AWAY.forEach((t) => document.removeEventListener(t, toastAway, true));
  el?.remove();
}
// When the sheet closes, a toast shown over it moves back to the page, so it's still there to read,
// and the sheet's live region is emptied, so the next sheet doesn't carry an old message.
function sheetClosed() {
  $('#sheet-live').textContent = '';
  const el = sheet.querySelector('.toast');
  if (el) {
    try { el.removeAttribute('popover'); } catch (e) { /* hides it, if it was shown */ }
    document.body.append(el);
  }
  sheet.querySelector('.toast-dock')?.remove();
}
// Screen readers: the page's live region is inert under an open sheet, which has its own.
// The same message again is set after a pause: an unchanged text isn't announced.
function announce(msg) {
  const r = $(sheet.open ? '#sheet-live' : '#live');
  if (r.textContent !== msg) { r.textContent = msg; return; }
  r.textContent = '';
  const open = sheet.open;
  setTimeout(() => { if (sheet.open === open) r.textContent = msg; }, 100); // not into a sheet closed meanwhile
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
  if (before > 0 && pendingCount() === 0) { confetti(); track('today_finished', { done_today: (S.log[today()] || []).length }); }
}

// Sizes from data-l / data-w (percent), set through CSSOM: the CSP forbids inline style attributes.
function applySizes(root = document) {
  root.querySelectorAll('[data-l], [data-w]').forEach((el) => {
    if (el.dataset.l) el.style.left = el.dataset.l + '%';
    if (el.dataset.w) el.style.width = el.dataset.w + '%';
  });
}
// Plant cards off screen are skipped (content-visibility in style.css) and stand in at their last drawn height.
// A redraw makes new cards that don't know it, so carry it over for drawn cards, and for skipped ones above
// the screen so nothing in view moves (Safari doesn't keep the scroll on what's in view). Other cards stand in
// at --pcard-h, taken from a drawn card in view, so it follows the current width and text size.
function cardSizes(view) {
  const cards = [...view.querySelectorAll('.pcard:not([hidden])')];
  if (!cards.length) return null;
  const cs = getComputedStyle(cards[0]);
  const pad = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, k) => n + parseFloat(cs[k]), 0);
  const sizes = new Map();
  let seen = 0;
  cards.forEach((c) => {
    const r = c.getBoundingClientRect(), h = r.height - pad;
    const drawn = c.querySelector('.pic').checkVisibility?.({ contentVisibilityAuto: true }) ?? true;
    if (drawn && !seen && r.bottom > 0) seen = h;
    if (drawn || r.bottom <= 0) sizes.set(c.dataset.open, h);
  });
  if (seen) view.style.setProperty('--pcard-h', `${seen}px`);
  return sizes;
}
function keepCardSizes(view, sizes) {
  if (sizes) view.querySelectorAll('.pcard').forEach((c) => { const h = sizes.get(c.dataset.open); if (h) c.style.containIntrinsicSize = `auto ${h}px`; });
}
function render() {
  const view = $('#view');
  // Tile ticks only matter while the collection is empty: once plants are in, by any way, they're done.
  if (Object.keys(S.plants).length) { qsPicked.clear(); qsReported = false; }
  const sizes = tab === 'plants' && cardSizes(view);
  view.innerHTML = tab === 'today' ? viewToday() : tab === 'plants' ? viewPlants() : tab === 'light' ? viewLight() : viewRoom();
  applySizes(view);
  revokeOldPhotos();
  if (tab === 'plants') { keepCardSizes(view, sizes); filterPlants(); }
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

// Author links: send right away, the app may go to background.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-out]');
  if (a) { track('app_author_link_clicked', { target: a.dataset.out, from: a.closest('[data-from]')?.dataset.from || 'other' }); flushStats(); }
  const pv = e.target.closest('a[href="privacy"]');
  if (pv) {
    track('app_privacy_opened', { from: pv.closest('[data-from]')?.dataset.from || 'other' });
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
    track('app_tab_opened', { tab });
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (el.dataset.open) {
    const id = el.dataset.open;
    openPlant(id);
    if (plant(id)) track('plant_opened', { ...kindOf(id), tab: cardTab });
    return;
  }
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
    if (!v || v === APP_VERSION || sheet.open || storiesDlg.open) return; // not mid-sheet or mid-story
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
    todayLeft();
    sendIntRun();
    reportVitals();
    flushStats();
    return;
  }
  if (addFlow) addFlow.picking = false;
  if (Date.now() - lastOpen > 30 * 60 * 1000) { newVisit(); track('app_opened', { how: 'resume', tasks_due: pendingCount() }); }
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
    if (reported++ < 3) setTimeout(() => track('app_health_viewport_stuck', { before, full, after: innerHeight }), 300);
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
autoStories();
quickShownNow();
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
track('app_opened', { how: openHow, tasks_due: pendingCount(), ready_ms: firstHidden === Infinity ? Math.round(performance.now()) : undefined, $referring_domain: openHow === 'start' ? arrivalSource() : undefined });
// Closing the mini app or the tab may skip visibilitychange.
addEventListener('pagehide', () => { reportVitals(); flushStats(); });
