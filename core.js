/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Shared constants, error reports and small helpers: DOM, icons, escaping, dates, Russian plurals.


const KEY = 'zhungli.v1';
// Opened inside Telegram's own browser: data there is separate from Safari/Chrome and can be lost.
const IN_TELEGRAM = /Telegram/i.test(navigator.userAgent) || typeof window.TelegramWebviewProxy !== 'undefined';
// iPhone or iPad (iPadOS Safari presents itself as a Mac, so touch points tell it apart).
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Opened as the Telegram mini app (/tg). Remembered for the session, so pages like /privacy keep it.
const MINI_APP_LINK = 'https://t.me/ZhungliPlantsBot?startapp';
const MINI_APP = (() => {
  try {
    if (location.pathname.startsWith('/tg')) sessionStorage.setItem('zhungli.mini', '1');
    return sessionStorage.getItem('zhungli.mini') === '1';
  } catch (e) { return location.pathname.startsWith('/tg'); }
})();
// Report script errors to stats (message and place only), at most 5 per page load.
const fileOf = (url) => String(url || '').split('/').pop().split('?')[0];
let errorsSent = 0;
function reportError(message, source, line) {
  // «Script error.» comes from scripts of other sites (e.g. extensions) and has no details.
  if (errorsSent >= 5 || /^Script error\.?$/.test(String(message))) return;
  errorsSent++;
  try { track('js_error', { message: String(message || '').slice(0, 150), source: fileOf(source), line: line || 0 }); } catch (e) { /* stats not ready yet */ }
}
// A refused save from a stale window (see save()) stops its action on purpose: not an error.
window.addEventListener('error', (e) => { if (e.error && e.error.stale) e.preventDefault(); else reportError(e.message, e.filename, e.lineno); });
window.addEventListener('unhandledrejection', (e) => { if (e.reason && e.reason.stale) e.preventDefault(); else reportError(e.reason && (e.reason.message || e.reason), 'promise', 0); });
// Version comes from ?v= in index.html and is compared with version.txt on the server.
const APP_VERSION = new URL(document.currentScript.src).searchParams.get('v') || '0';
// A flaky network on the first launch of a new version can leave a file missing or a script from
// another version: the app doesn't start, some buttons do nothing, or it has no styles. Then reload
// once, the files usually come then. Other startup errors are bugs, and a reload wouldn't help.
let appStarted = false; // set by app.js once the first screen is built
let broken = null; // { reason, file } of the first sign of broken files
addEventListener('error', (e) => {
  if (broken) return;
  // Our own scripts only: Telegram's may be blocked, and a reload doesn't fix that.
  if (e.target instanceof HTMLScriptElement && e.target.src.startsWith(location.origin)) broken = { reason: 'script_failed', file: fileOf(e.target.src) };
  else if (!appStarted && (e.error instanceof SyntaxError || e.error instanceof ReferenceError)) broken = { reason: e.error.name, file: fileOf(e.filename) };
}, true);
addEventListener('load', () => {
  // The stylesheet failed before this script ran, so only its empty or missing sheet tells.
  const css = document.querySelector('link[rel="stylesheet"]');
  try { if (!broken && css && !css.sheet?.cssRules.length) broken = { reason: 'style_failed', file: fileOf(css.href) }; } catch (e) { /* unreadable: leave it */ }
  try {
    // A retry by the previous load: report it with whether it helped.
    const last = JSON.parse(sessionStorage.getItem('zhungli.retry') || 'null');
    if (last) {
      sessionStorage.removeItem('zhungli.retry');
      try { track('start_retried', { ...last, ok: appStarted && !broken }); } catch (e) { /* stats didn't load */ }
    }
    if (!broken || sessionStorage.getItem('zhungli.retriedFor') === APP_VERSION) return;
    sessionStorage.setItem('zhungli.retriedFor', APP_VERSION);
    sessionStorage.setItem('zhungli.retry', JSON.stringify({ ...broken, started: appStarted }));
  } catch (e) { return; }
  location.reload();
});
const $ = (s, el = document) => el.querySelector(s);
// Icon from the Lucide sprite in index.html; takes the text color.
const I = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Escaped plant name with Latin runs marked lang="en": browsers have no Latin hyphenation on a lang="ru" page.
const nameHtml = (s) => String(s ?? '').split(/(\(?[A-Za-z](?:[A-Za-z'. -]*[A-Za-z])?\)?)/).map((t, i) => (i % 2 ? `<span lang="en">${esc(t)}</span>` : esc(t))).join('');

/* ---------- Dates ---------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
// «Недавно пересажено» holds the date it was ticked and lapses after 6 weeks.
const REPOT_DAYS = 42;
const repotted = (p) => !!p.repotted && diff(p.repotted, today()) < REPOT_DAYS;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return few;
  return many;
}
const days = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
const plantsN = (n) => `${n} ${plural(n, 'растение', 'растения', 'растений')}`;
function rel(d) {
  if (!d) return 'ещё не было';
  const n = diff(today(), d);
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === -1) return 'вчера';
  return n > 0 ? `через ${days(n)}` : `${days(-n)} назад`;
}
const LK = '<abbr title="люкс">лк</abbr>';
// No-break space: «20 тыс» never splits
const kLux = (n) => `${(n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}\u00a0тыс`;
const shortDate = (s) => parse(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

// Tap actions by data-act: each file adds its own, app.js calls them as (el, el.dataset.id, act).
const ACTS = Object.create(null);
