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
let errorsSent = 0;
function reportError(message, source, line) {
  // «Script error.» comes from scripts of other sites (e.g. extensions) and has no details.
  if (errorsSent >= 5 || /^Script error\.?$/.test(String(message))) return;
  errorsSent++;
  try { track('js_error', { message: String(message || '').slice(0, 150), source: String(source || '').split('/').pop().split('?')[0], line: line || 0 }); } catch (e) { /* stats not ready yet */ }
}
window.addEventListener('error', (e) => reportError(e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason && (e.reason.message || e.reason), 'promise', 0));
// Version comes from ?v= in index.html and is compared with version.txt on the server.
const APP_VERSION = new URL(document.currentScript.src).searchParams.get('v') || '0';
const $ = (s, el = document) => el.querySelector(s);
// Icon from the Lucide sprite in index.html; takes the text color.
const I = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
const repotHint = (p) => (repotted(p)
  ? `Не позову на подкормку до ${parse(addDays(p.repotted, REPOT_DAYS)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, пока приживаются корни. Потом галочка снимется сама.`
  : '6 недель не буду звать на подкормку, пока приживаются корни. Потом галочка снимется сама.');
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
