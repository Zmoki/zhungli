/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';

const KEY = 'zhungli.v1';
// Opened inside Telegram's own browser: data there is separate from Safari/Chrome and can be lost.
const IN_TELEGRAM = /Telegram/i.test(navigator.userAgent) || typeof window.TelegramWebviewProxy !== 'undefined';
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
  ? `Не зовём на подкормку до ${parse(addDays(p.repotted, REPOT_DAYS)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, пока приживаются корни. Потом галочка снимется сама.`
  : '6 недель не будем звать на подкормку, пока приживаются корни. Потом галочка снимется сама.');
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

/* ---------- State ---------- */
const GENERIC_QUIPS = ['Я новенькая, приятно познакомиться!', 'Посмотрите на меня внимательно 👀', 'Я тут, я расту!'];
// How a plant grows: what the roots are in (MEDIA) and, in a pot, how water gets to them (WATERING).
// A card's `type` is its usual medium and `watering` its usual watering (default 'top');
// the plant card can pick others (see mediumIn, wateringIn). Fields of both:
// - labels: check buttons; act: what a check records: 'pour' (watering, default), 'top' (a top-up), 'change' (fresh water);
// - need: the status word when a check is due (default «суховато»);
// - task: the check as a task, over the card's question; verb: the task's verb before «если…» (default «Полейте»);
// - start(base): the interval when picked, from the card's one; min, max: interval bounds (default 1…45);
// - hint: shown under the choice in the plant card; water, soil: tips for a card written for another way.
// Only MEDIA: pot (watered by a WATERING way); feed: 'day' (on «День подкормки»), 'each' (with every watering),
// 'none'; feedTip: added to a reservoir's watering tip; care: a recurring bonus task, careHint: its line in the hint;
// first: comes first among checks; noChecks: never checked;
// organic: roots in soil-like stuff (moving out of it counts as a transplant); wet: steadily wet (rots succulents);
// badge: [icon, words] shown on the plant's picture for a way that isn't an ordinary pot (also for WATERING);
// watering: the medium's usual watering when it isn't from above (clay pebbles stand on a reservoir).
const MEDIA = {
  soil: { name: 'Грунт', pot: true, feed: 'day', organic: true,
    hint: 'Позову, когда пора проверить, не подсох ли грунт.',
    water: 'Когда подсохнет верхний слой, обильно; лишнюю воду из поддона слить.',
    soil: 'Универсальный грунт, горшок с дренажным отверстием.' },
  dry: { name: 'Грунт для суккулентов', pot: true, feed: 'none', organic: true,
    hint: 'Позову, когда грунт должен почти совсем просохнуть.',
    water: 'Только когда грунт просох почти до дна, затем обильно; зимой совсем редко.',
    soil: 'Рыхлый грунт для суккулентов с песком или пемзой, горшок с дренажом.' },
  sphagnum: { name: 'Сфагнум', pot: true, feed: 'day', first: true, organic: true,
    hint: 'Позову проверить, подсох ли сфагнум внутри.',
    water: 'Когда сфагнум внутри подсох; не давать пересохнуть совсем.',
    soil: 'Живой или сухой сфагнум, не утрамбовывать.' },
  bark: { name: 'Кора', pot: true, feed: 'none', organic: true, labels: ['Полито', 'Ещё рано'],
    hint: 'Позову проверить, высохла ли кора и посеребрели ли корни.',
    water: 'Погружением на 15–20 минут, когда кора сухая и корни серебристые; воду из кашпо слить.',
    soil: 'Крупная кора, прозрачный горшок с отверстиями.' },
  coco: { name: 'Кокос', pot: true, feed: 'day', organic: true,
    hint: 'Позову проверить, подсох ли верхний слой.',
    water: 'Когда подсох верхний слой: пересыхать совсем кокос не любит. Своего питания в нём почти нет, подкармливать регулярно.',
    soil: 'Кокосовый субстрат или чипсы, часто с перлитом. Перед посадкой промыть от солей.' },
  mineral: { name: 'Минеральный: пон, пемза, цеолит', pot: true, feed: 'each', badge: ['mountain', 'на минералке'], start: (b) => Math.max(2, Math.round(b * 0.7)),
    care: { kind: 'leach', every: 30, task: 'Промойте субстрат', hint: 'Пролейте горшок обильно чистой водой, чтобы вымыть соли.' },
    hint: 'Позову проверить, подсох ли субстрат.', careHint: 'Раз в месяц напомню промыть субстрат от солей.',
    water: 'Когда подсох верхний слой: минеральный субстрат сохнет быстрее грунта. В каждый полив — удобрение в слабой дозе, своего питания в субстрате нет.',
    soil: 'Пемза, цеолит, лава, акадама или готовые смеси вроде пона.',
    feedTip: 'Удобрение в слабой дозе — в каждый долив.' },
  leca: { name: 'Керамзит', pot: true, feed: 'each', wet: true, badge: ['grip', 'в керамзите'], watering: 'reservoir',
    care: { kind: 'flush', every: 45, task: 'Промойте керамзит', hint: 'Слейте раствор, промойте горшок и керамзит тёплой водой, залейте свежий раствор.' },
    hint: 'Позову проверить, подсох ли керамзит внизу.', careHint: 'Раз в полтора месяца напомню промыть керамзит.',
    water: 'Поливать раствором, когда нижний слой подсох; лишнее сливать. Удобрение для гидропоники — в каждый полив.',
    soil: 'Керамзит или другой наполнитель. Раз в 1–2 месяца промыть и сменить раствор целиком.',
    feedTip: 'Удобрение для гидропоники — в каждый долив.' },
  water: { name: 'Вода', feed: 'none', first: true, wet: true, badge: ['glass-water', 'в воде'], labels: ['Вода сменена', 'Вода ещё чистая'], act: 'change', need: 'мутновато',
    verb: 'Смените воду', task: 'Смените воду в банке', start: () => 7,
    hint: 'Напомню сменить воду.',
    water: 'Доливать до уровня, воду менять раз в 1–2 недели: отстоянную, комнатной температуры. Раз в месяц можно удобрение в четверть дозы; черенкам до корней не нужно.',
    soil: 'Банка или ваза с водой, в воде только корни и низ стебля. Слизь или запах — промыть банку и корни.' },
  mount: { name: 'На блоке, корни на воздухе', feed: 'none', first: true, badge: ['tree-deciduous', 'на блоке'], labels: ['Полито', 'Ещё рано'],
    task: 'Замочите или сбрызните корни, если они посеребрели', verb: 'Замочите или сбрызните', start: () => 3, max: 14,
    hint: 'На блоке всё сохнет быстро — позову проверять часто.',
    water: 'Сбрызгивать или замачивать корни на 10–20 минут, когда они посеребрели; летом бывает каждый день. Раз в месяц — удобрение в четверть дозы в воду.',
    soil: 'Блок из коры, коряги или пробки, корни открыты воздуху. Нужна высокая влажность воздуха.' },
  terrarium: { name: 'Закрытый террариум', feed: 'none', organic: true, wet: true, badge: ['flask-round', 'в террариуме'], labels: ['Сбрызнуто', 'Ещё влажно'], verb: 'Сбрызните', start: () => 30, min: 7, max: 60,
    hint: 'Влага ходит по кругу, так что загляну раз в месяц.',
    water: 'Почти не поливать. Сбрызнуть, если стёкла сухие несколько дней подряд. Много капель на стёклах — приоткрыть на пару часов.',
    soil: 'Дренаж, сетка, грунт и мох в закрытой ёмкости. Протирать стёкла, подрезать разросшееся, убирать опавшие листья.' },
  aquarium: { name: 'Аквариум', feed: 'none', noChecks: true, wet: true, badge: ['fish', 'в аквариуме'],
    care: { kind: 'roots', every: 30, task: 'Осмотрите корни в аквариуме', hint: 'Тёмные мягкие корни обрежьте. Листья и стебель должны быть над водой.' },
    hint: 'Поливать не нужно. Раз в месяц напомню осмотреть корни.',
    water: 'Поливать не нужно: корни в воде аквариума. Не удобрять — удобрения вредны рыбам.',
    soil: 'В воде только корни, листья и стебель над водой: на держателе у стекла или в плавающей корзинке. Перед посадкой корни отмыть от грунта.' },
};
const WATERING = {
  top: { name: 'Сверху' },
  wick: { name: 'Фитиль', labels: ['Долито', 'Вода есть'], act: 'top', need: 'пустовато', verb: 'Долейте', wet: true, badge: ['cable', 'на фитиле'], start: () => 7, min: 2,
    task: 'Загляните в бак фитильного полива и долейте воды, если её мало',
    hint: 'Не буду звать поливать — напомню заглянуть в бак, есть ли вода.',
    water: 'Доливать бак, когда вода почти кончилась. Раз в месяц полить сверху, чтобы вымыть соли.' },
  reservoir: { name: 'Резервуар в горшке', labels: ['Долито', 'Вода есть'], act: 'top', need: 'пустовато', verb: 'Долейте', wet: true, badge: ['cylinder', 'с резервуаром'], start: () => 7, min: 2,
    task: 'Проверьте уровень в резервуаре и долейте, если он на минимуме',
    hint: 'Не буду звать поливать — напомню проверить уровень в резервуаре.',
    water: 'Доливать, когда уровень на минимуме, лучше через 2–3 дня: корням нужен воздух.' },
};
// Kinds of per-plant bonus tasks, for cleaning up after a plant is removed.
const BONUS_KINDS = ['dust', 'rotate', ...new Set(Object.values(MEDIA).map((m) => m.care && m.care.kind).filter(Boolean))];
const mediumIn = (r, d) => (MEDIA[r.medium] ? r.medium : MEDIA[d.type] ? d.type : 'soil');
// Watering of a potted plant (null when the medium isn't in a pot). Older plants keep wick watering in r.wick.
const cardWatering = (d) => (MEDIA[d.type] && MEDIA[d.type].pot ? (WATERING[d.watering] ? d.watering : 'top') : null);
function wateringIn(r, d) {
  if (!MEDIA[mediumIn(r, d)].pot) return null;
  return r.wick ? 'wick' : WATERING[r.watering] ? r.watering : WATERING[d.watering] ? d.watering : 'top';
}
const isCardWay = (r, d) => mediumIn(r, d) === d.type && wateringIn(r, d) === cardWatering(d);
// Everything about a way of growing at once: the watering's fields over the medium's. Built once per pair.
const WAYS = new Map();
function wayOf(p) {
  const m = MEDIA[p.type] ? p.type : 'soil';
  const w = MEDIA[m].pot && WATERING[p.watering] && p.watering !== 'top' ? p.watering : '';
  const key = `${m}|${w}`;
  if (!WAYS.has(key)) {
    const M = MEDIA[m], W = WATERING[w];
    WAYS.set(key, { ...M, ...(W || {}), task: (W || M).task, verb: (W || M).verb, labels: (W || M).labels || ['Полито', 'Ещё влажно'],
      hint: [(W || M).hint, M.careHint, M.feed === 'each' ? 'Удобрение — в каждый полив, на день подкормки звать не буду.' : ''].filter(Boolean).join(' '),
      name: W ? `${M.name}, ${W.name.toLowerCase()}` : M.name, wet: !!(M.wet || (W && W.wet)) });
  }
  return WAYS.get(key);
}
const labelsOf = (p) => wayOf(p).labels;
// The card's care for how the plant grows. Grown another way than the card says, the card's check
// question and its watering tip don't fit, nor its substrate tip with another medium: that way's own tips stand in.
function careOf(d, r) {
  const k = mediumIn(r, d), m = MEDIA[k], w = wateringIn(r, d);
  const own = isCardWay(r, d), sameMedium = k === d.type;
  const waterTip = w && w !== 'top' ? [WATERING[w].water, m.feedTip].filter(Boolean).join(' ') : m.water;
  return { ...d, check: own ? d.check : '', water: (own && d.water) || waterTip, soil: (sameMedium && d.soil) || m.soil };
}
// The check as a task: "Верхние 3–5 см сухие?" → "Полейте, если верхние 3–5 см сухие".
// Only the first question becomes the condition; what follows stays ("(палочкой)", "Проверьте пальцем.").
// A check written as an instruction (imported from an AI chat) is shown as is.
function waterTask(p) {
  const g = wayOf(p);
  const own = p.check && p.check !== CHECK_TEXT[p.type] ? p.check : '';
  if (!own && g.task) return g.task;
  const q = String(own || CHECK_TEXT[p.type] || CHECK_TEXT.soil).trim();
  const i = q.indexOf('?');
  if (i < 0) return q;
  const cond = q.slice(0, i).trim();
  const rest = q.slice(i + 1).trim();
  const tail = !rest ? '' : rest.startsWith('(') ? ` ${rest}` : `. ${rest}`;
  const task = `${g.verb || 'Полейте'}, если ${cond.charAt(0).toLowerCase()}${cond.slice(1)}${tail}`;
  // A word joiner after the dash keeps ranges like «2–3 см» on one line.
  return task.replace(/(\d)–(\d)/g, '$1–⁠$2');
}
const TYPE_NAMES = Object.fromEntries(Object.entries(MEDIA).map(([k, g]) => [k, g.name]));
// Words for what a check records: a watering, a top-up of a reservoir, or fresh water.
const ACT_WORDS = {
  pour: { title: 'Полив', last: 'Последний полив', none: 'Поливов ещё не было', due: 'Пора проверить сегодня', next: 'Следующая проверка', btn: 'Записать полив', done: 'Полив записан 💧', sub: 'полив' },
  top: { title: 'Долив', last: 'Последний долив', none: 'Доливов ещё не было', due: 'Пора проверить уровень сегодня', next: 'Проверить уровень', btn: 'Записать долив', done: 'Долив записан 💧', sub: 'долив' },
  change: { title: 'Вода', last: 'Последняя смена воды', none: 'Воду ещё не меняли', due: 'Пора проверить воду сегодня', next: 'Следующая проверка', btn: 'Записать смену воды', done: 'Смена воды записана 💧', sub: 'смена воды' },
};
const actWords = (p) => ACT_WORDS[wayOf(p).act || 'pour'];

let booting = true;
let S = load();
let tab = 'today';
let showAll = false;
let PHOTOS = {};

function blank() {
  return {
    v: 3, plants: {}, custom: {}, bonus: {}, snooze: {}, rooms: [newRoom('home', 'Комната')], log: {},
    spots: [...SPOTS], settings: { limit: 7 }, hideInstall: false, created: today(),
  };
}

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* empty */ }
  return prepare(raw);
}

// Brings saved data (or a backup) to the current format.
function prepare(raw) {
  const s = Object.assign(blank(), raw || {});
  if (raw && !raw.v) migrateV1(s);
  if (raw && (raw.v || 1) < 3) migrateV2(s, raw);
  if (!raw) s.seen = APP_VERSION; // new users have nothing to catch up on
  s.v = 3;
  initBonus(s);
  return s;
}

// v1: the collection was created automatically from the personal catalog.
// Personal notes move into plant data so the catalog can be generic.
function migrateV1(s) {
  s.spots = [...LEGACY_SPOTS];
  Object.entries(LEGACY_NOTES).forEach(([id, n]) => {
    const r = s.plants[id];
    if (!r) return;
    const { species, ...own } = n;
    if (species && !r.species) r.species = species;
    if (Object.keys(own).length) r.own = { ...own, ...(r.own || {}) };
  });
  const k = s.plants.kolya;
  if (k && !(s.vent && s.vent.off)) { k.greenhouse = true; k.ventLast = s.vent ? s.vent.last : null; }
  delete s.vent;
  delete s.deleted;
}

// v2: one reading for the whole home → a list of rooms, each with its own reading.
// Plants without `room` live in the first room.
function newRoom(id, name) { return { id, name, t: null, h: null, d: null }; }
// «Недавно пересажено» was a plain flag; it now holds the date and lapses after 6 weeks.
function migrateV2(s, raw) {
  const r = s.room;
  delete s.room;
  Object.values(s.plants).forEach((p) => { if (p.repotted === true) p.repotted = today(); });
  // An older app on another device (Telegram sync) may have saved over a state that already has rooms.
  if (Array.isArray(raw.rooms) && raw.rooms.length) return;
  s.rooms = [{ ...newRoom('home', 'Комната'), ...(r ? { t: r.t, h: r.h, d: r.d } : {}) }];
}

function initBonus(s) {
  const t = today();
  Object.keys(s.plants).forEach((id, i) => {
    const d = defIn(s, id);
    if (!d) return;
    if (d.big && !s.bonus['dust:' + id]) s.bonus['dust:' + id] = addDays(t, -19 + 2 * (i % 8));
    if (d.rotate && !s.bonus['rotate:' + id]) s.bonus['rotate:' + id] = addDays(t, -10);
    const care = MEDIA[mediumIn(s.plants[id], d)].care;
    if (care && !s.bonus[`${care.kind}:${id}`]) s.bonus[`${care.kind}:${id}`] = t;
  });
  if (!s.bonus.feed) s.bonus.feed = addDays(t, -14);
}

// New plant ids: p… for catalog plants, c… for own and imported ones.
const newId = (prefix, i = 0) => `${prefix}${Date.now().toString(36)}${i}`;
// First checks of a batch are spread over days so there aren't 20 tasks at once.
const firstCheck = (i, every) => addDays(today(), Math.min(Math.floor(i / 6), every - 1));
function runtime(p, nextCheck) {
  return { name: '', spot: '', lux: null, interval: p.every, nextCheck, lastWater: null, wet: 0, repotted: false, hist: [] };
}

// Adds plants from the catalog.
function addPlants(keys) {
  const ids = [];
  keys.map((k) => PLANTS.find((p) => p.id === k)).filter(Boolean)
    .sort((a, b) => a.every - b.every)
    .forEach((d, i) => {
      const id = newId('p', i);
      S.plants[id] = { ...runtime(d, firstCheck(i, d.every)), def: d.id };
      ids.push(id);
    });
  initBonus(S);
  return ids;
}

function save() {
  // Keep the log for one week only.
  const cutoff = addDays(today(), -7);
  Object.keys(S.log).forEach((d) => { if (d < cutoff) delete S.log[d]; });
  // When the data last changed: the newer copy wins when syncing with Telegram.
  // The save at startup only stores migrations, so it doesn't count as a change.
  if (!booting) S.savedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не получилось сохранить 😢'); }
  if (window.cloudSave) window.cloudSave();
}

// A plant points to its catalog card via def; for older plants the id is the card.
function defIn(s, id) {
  const r = s.plants[id];
  const k = (r && r.def) || id;
  return PLANTS.find((p) => p.id === k) || s.custom[k];
}
const def = (id) => defIn(S, id);
function plant(id) {
  const d = def(id), r = S.plants[id];
  if (!d || !r) return null;
  // luxRange: catalog range; lux: light meter reading.
  // species: custom name if set, else the catalog one. own: personal notes over the catalog.
  const species = r.species || d.species;
  // type, watering: how it grows now, which may differ from the card's (see mediumIn, wateringIn).
  // cardType: the card's medium, which picks the drawing (shapes.js), so it doesn't change with the medium.
  return { ...careOf(d, r), ...(r.own || {}), ...r, type: mediumIn(r, d), cardType: d.type, watering: wateringIn(r, d), id, species, title: r.name || species, luxRange: d.lux, lux: r.lux };
}
const allPlants = () => Object.keys(S.plants).map(plant).filter(Boolean);

function logToday(entry) {
  const t = today();
  (S.log[t] ||= []).push(entry);
}

function hist(p, a) {
  p.hist.unshift({ d: today(), a });
  p.hist.length = Math.min(p.hist.length, 20);
}

// The same pick all day for a plant, a new one tomorrow.
function pickDaily(id, list) {
  let h = 0;
  for (const c of id + today()) h = (h * 31 + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}
function quipOf(p) {
  return pickDaily(p.id, p.quips && p.quips.length ? p.quips : GENERIC_QUIPS);
}
const VENT_QUIPS = ['Душновато под крышкой — приоткройте, дайте подышать.', 'Немного свежего воздуха — и мне сразу легче.', 'Приоткройте теплицу, хочу подышать.'];

function lightStatus(p) {
  if (!p.lux) return null;
  if (p.lux < p.luxRange[0]) return 'low';
  if (p.lux > p.luxRange[1] * 1.25) return 'high';
  return 'ok';
}

// Light status words, the same in the plant card, the cards grid and the Light tab.
const LIGHT_WORDS = { low: 'темновато', high: 'ярковато', ok: 'света хватает' };
// Face and word per state, from most to least urgent (also the order of the filter chips).
// Each has its own color: check orange, too dark plum, too bright sun, watered blue, fine green.
const STATES = { need: ['frown', 'суховато'], dim: ['meh', LIGHT_WORDS.low], hot: ['annoyed', LIGHT_WORDS.high], watered: ['laugh', 'напоено'], fine: ['smile', 'хорошо'] };
// Every state a plant is in now: watering (need / watered) plus light (dim / hot); «fine» when none.
// A plant nobody has answered about yet isn't called dry on its first check day: we don't know yet.
function states(p) {
  const t = today(), out = [];
  const known = (p.hist && p.hist.length) || p.lastWater || p.nextCheck < t;
  if (p.lastWater === t) out.push('watered');
  else if (p.nextCheck <= t && known && !wayOf(p).noChecks) out.push('need');
  const ls = lightStatus(p);
  if (ls === 'low') out.push('dim');
  if (ls === 'high') out.push('hot');
  return out.length ? out : ['fine'];
}
// The one state for the face on the pot: a due check first, then wrong light, then the rest.
function mood(p, st = states(p)) {
  const k = st.includes('need') ? 'need' : st.find((x) => x === 'dim' || x === 'hot') || st[0];
  return [...STATES[k], k];
}
// The word for a state on one plant: a reservoir is «пустовато», a plant in water «мутновато».
const stateWord = (k, p) => (k === 'need' && wayOf(p).need) || STATES[k][1];
// Status chips: faces only on grid cards (the word for screen readers), face and word in the plant card.
const stateChips = (p, words, st = states(p)) => st.map((k) => (words
  ? `<span class="mood hero-mood ${k}">${I(STATES[k][0])}${stateWord(k, p)}</span>`
  : `<span class="mood ${k}">${I(STATES[k][0])}<span class="sr-only">${stateWord(k, p)}</span></span>`)).join('');

function tempRange(p) {
  const m = /(\d+)\s*–\s*(\d+)\s*°C/.exec(p.cond || '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const spotIdx = (s) => { const i = S.spots.indexOf(s); return i === -1 ? (s ? S.spots.length : 99) : i; };
const bySpot = (a, b) => spotIdx(a.spot) - spotIdx(b.spot) || a.title.localeCompare(b.title, 'ru');

/* ---------- Tasks ---------- */
function priority(p) {
  const overdue = diff(p.nextCheck, today());
  const thirsty = wayOf(p).first || p.interval <= 3 ? 0.3 : 0;
  return overdue / Math.max(1, p.interval) + thirsty;
}

function dueChecks() {
  const t = today();
  return allPlants().filter((p) => p.nextCheck <= t && !wayOf(p).noChecks).sort((a, b) => priority(b) - priority(a));
}

function ventDue() {
  return allPlants().filter((p) => p.greenhouse && p.ventLast !== today());
}

function bonusTasks() {
  const t = today();
  const out = [];
  const snoozed = (k) => S.snooze[k] && S.snooze[k] > t;
  const cares = {};
  allPlants().forEach((p) => {
    const dk = 'dust:' + p.id;
    if (p.big && S.bonus[dk] && diff(S.bonus[dk], t) >= 21 && !snoozed(dk)) {
      out.push({ key: dk, p, title: `Протрите листья: ${p.title}`, task: 'Протрите листья', hint: 'Мягкой влажной салфеткой, сверху и снизу. Блестящие листья лучше «едят» свет.' });
    }
    const rk = 'rotate:' + p.id;
    if (p.rotate && S.bonus[rk] && diff(S.bonus[rk], t) >= 14 && !snoozed(rk)) {
      out.push({ key: rk, p, title: `Поверните на четверть оборота: ${p.title}`, task: 'Поверните на четверть оборота', hint: 'Чтобы росла ровно, а не тянулась в одну сторону. Постепенно, без резких разворотов.' });
    }
    const care = wayOf(p).care, ck = care && `${care.kind}:${p.id}`;
    if (care && S.bonus[ck] && diff(S.bonus[ck], t) >= care.every && !snoozed(ck)) (cares[care.kind] ||= { care, ps: [] }).ps.push(p);
  });
  // One task per kind of care: all the aquarium's plants at once, not a card each.
  Object.values(cares).forEach(({ care, ps }) => {
    const key = `${care.kind}:${ps.map((p) => p.id).join(',')}`;
    out.push(ps.length === 1 ? { key, p: ps[0], title: `${care.task}: ${ps[0].title}`, task: care.task, hint: care.hint }
      : { key, icon: 'droplets', title: care.task, sub: plantsN(ps.length), task: care.task, hint: `Кого: ${ps.map((p) => p.title).join(', ')}. ${care.hint}` });
  });
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 9 && diff(S.bonus.feed, t) >= 14 && !snoozed('feed')) {
    // Fed on the day: soil-like media, plus flowering succulents (dry with `feed`). The rest get fertilizer with every watering, or none.
    const who = allPlants().filter((p) => !p.noFeed && !repotted(p) && (wayOf(p).feed === 'day' || (p.type === 'dry' && p.feed)));
    if (who.length) {
      out.push({ key: 'feed', icon: 'utensils', title: 'День подкормки', sub: plantsN(who.length), task: 'Подкормите по инструкции к удобрению, в мокрый грунт',
        hint: `Кого: ${who.map((p) => p.title).join(', ')}. Не кормим недавно пересаженных и больных.` });
    }
  }
  return out.slice(0, 2);
}

// A bonus task's key → the dates it stands for: «roots:a,b» is «roots:a» and «roots:b».
const bonusKeys = (key) => { const [kind, ids] = key.split(':'); return ids ? ids.split(',').map((id) => `${kind}:${id}`) : [key]; };

/* ---------- Actions ---------- */
function snapshot() {
  const copy = JSON.stringify(S);
  return () => { S = JSON.parse(copy); save(); render(); };
}

function actWater(id, silent) {
  const r = S.plants[id], d = def(id), t = today();
  if (r.lastWater && r.lastWater !== t) {
    const measured = diff(r.lastWater, t);
    // After "still wet" answers, the real interval is about the measured one.
    // If it was already dry, it dried out earlier, so the interval doesn't grow.
    const iv = r.wet > 0 ? (r.interval + measured) / 2 : Math.min(r.interval, (r.interval + measured) / 2) * 0.95;
    // Grown another way than the card says (a wick reservoir, water…), the card's interval doesn't apply: wider bounds.
    const way = wayOf({ type: mediumIn(r, d), watering: wateringIn(r, d) });
    // On the card's way: within the card's range, and never past the way's own limits (a terrarium: 60 days at most).
    r.interval = isCardWay(r, d)
      ? clamp(iv, Math.max(1, d.every * 0.4, way.min || 0), Math.min(d.every * 3, way.max || Infinity))
      : clamp(iv, way.min || 1, way.max || 45);
  }
  r.lastWater = t;
  r.wet = 0;
  r.nextCheck = addDays(t, Math.max(1, Math.round(r.interval)));
  hist(r, 'water');
  if (!silent) logToday({ id, a: 'water' });
}

function actWet(id) {
  const r = S.plants[id];
  r.wet += 1;
  r.nextCheck = addDays(today(), Math.max(1, Math.round(r.interval * 0.25)));
  hist(r, 'wet');
  logToday({ id, a: 'wet' });
}

function actLater(id) {
  S.plants[id].nextCheck = addDays(today(), 1);
  logToday({ id, a: 'later' });
}

// What «Сегодня» shows: checks within the daily limit, greenhouses to vent, progress.
function todayPlan() {
  const log = S.log[today()] || [];
  const doneChecks = log.filter((e) => e.a === 'water' || e.a === 'wet').length;
  const due = dueChecks();
  const room = showAll ? due.length : Math.max(0, S.settings.limit - doneChecks);
  const shown = due.slice(0, room).sort(bySpot);
  const vents = ventDue();
  const pending = shown.length + vents.length;
  const doneMain = log.filter((e) => e.a !== 'later' && !String(e.a).startsWith('bonus')).length;
  return { log, shown, vents, pending, doneMain, waiting: due.length - shown.length, total: pending + doneMain };
}
const pendingCount = () => todayPlan().pending;

/* ---------- Today ---------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

// Little greenhouse badge next to the status
// Greenhouse badge: a round icon on grid cards, a worded chip like the status ones in the plant card.
const ghBadge = (p, words) => (!p.greenhouse ? ''
  : words ? `<span class="mood hero-mood greenhouse">${I('house-heart')}в теплице</span>`
    : `<span class="gh" title="В теплице">${I('house-heart')}<span class="sr-only">в теплице</span></span>`);

// Badges for an unusual way of growing («в воде», «на фитиле»…), as the greenhouse one: worded chips in the
// plant card, and on grid cards one icon (the medium's first), so badges don't pile up over the picture.
// Keys go to the status filter too. Left out: a catalog card's own medium, which its name already says
// (lucky bamboo, cuttings in water), and a watering that is the medium's usual one (clay pebbles on a reservoir).
const growBadge = (k) => (MEDIA[k] || WATERING[k] || {}).badge;
function growKeys(p) {
  const keys = [];
  if (growBadge(p.type) && !(p.type === p.cardType && !isCustom(p.id))) keys.push(p.type);
  if (growBadge(p.watering) && p.watering !== MEDIA[p.type].watering) keys.push(p.watering);
  return keys;
}
const growBadges = (p, words) => growKeys(p).slice(0, words ? 2 : 1).map((k) => {
  const [icon, word] = growBadge(k);
  return words ? `<span class="mood hero-mood way">${I(icon)}${word}</span>`
    : `<span class="gh way" title="${cap(word)}">${I(icon)}<span class="sr-only">${word}</span></span>`;
}).join('');

function ava(p, cls = 'ava') {
  const inner = photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p, mood(p)[2]);
  return `<button class="${cls}" data-open="${esc(p.id)}" aria-label="Открыть ${esc(p.title)}">${inner}</button>`;
}

// Hint cards on «Сегодня»: same layout, at most one at a time.
// Priority: Telegram's browser, then the stats notice (opt-out), then «add to home screen».
// With no plants they show below the welcome, and «add to home screen» waits for the first plant.
const hintCard = (icon, title, text, buttons) => `<div class="task bonus"><b>${I(icon)}${title}</b>
  <p class="mt-6 small muted">${text}</p>
  <div class="btns hint-btns">${buttons}</div></div>`;
function currentHint() {
  // Telegram's in-app browser loses data: offer the mini app (its plants live in Telegram's cloud).
  if (IN_TELEGRAM && !MINI_APP && !S.hideTelegram) {
    const open = `<a class="btn ok" href="${MINI_APP_LINK}" data-act="open-mini-app">${I('sprout')}Открыть</a>`;
    // Nothing to lose yet: a friendly invite, not a warning.
    if (!Object.keys(S.plants).length) {
      return hintCard('sprout', 'Удобнее в приложении Телеграма',
        'Там растения хранятся в облаке Телеграма и появятся на любом телефоне.',
        `${open}<button class="btn ghost" data-act="hide-telegram">Понятно</button>`);
    }
    return hintCard('triangle-alert', 'Растения здесь могут потеряться',
      'Это встроенный браузер Телеграма. Перенесите их в приложение Телеграма: «Настройки» → «Сохранить копию» здесь, затем «Восстановить» там.',
      `${open}<button class="btn ghost" data-act="hide-telegram">Понятно</button>`);
  }
  // Stats run from the first screen, so their notice shows from the first screen too.
  if (!S.statsNotice && S.settings.stats !== false) {
    return hintCard('lightbulb', 'Анонимная статистика',
      'Чтобы понять, что улучшить, Жунгли отправляют, какие кнопки нажимают, — без названий, заметок и фото. <a class="linkish" href="privacy">Подробнее</a>',
      '<button class="btn" data-act="stats-ok">Понятно</button><button class="btn ghost" data-act="stats-off">Выключить</button>');
  }
  // «Add to home screen» waits for the first plant: before that there's nothing to keep.
  if (!Object.keys(S.plants).length) return '';
  // In the mini app: Telegram's own «add to home screen» (telegram.js sets tgHome when it's available).
  if (MINI_APP) {
    if (window.tgHome && !S.hideInstall) {
      return hintCard('smartphone', 'Добавьте Жунгли на экран «Домой»',
        'Иконка будет открывать приложение сразу, без поиска бота в Телеграме.',
        '<button class="btn" data-act="tg-home">Добавить</button><button class="btn ghost" data-act="hide-install">Не нужно</button>');
    }
    return '';
  }
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS && !navigator.standalone && !S.hideInstall) {
    return hintCard('smartphone', 'Добавьте меня на экран «Домой»',
      'Safari → кнопка «Поделиться» → «На экран Домой». Так iPhone не сотрёт ваши отметки, если пару недель не заходить.',
      '<button class="btn" data-act="hide-install">Уже на экране</button>');
  }
  return '';
}

// «Species · place» under a plant's name on task cards; `extra` adds e.g. the last watering.
const plantSub = (p, ...extra) => [p.name ? p.species : '', p.spot, ...extra].filter(Boolean).join(' · ');
// Every task card on «Сегодня» has one layout: picture and name, the plant's words, the task,
// the buttons, then how to do it. `p` is the plant (or `icon` and `name` for tasks without one).
function taskCard({ cls = '', p, icon, name, sub, quip, task, buttons, hint, after = '' }) {
  const pic = p ? ava(p) : `<div class="ava" aria-hidden="true">${I(icon)}</div>`;
  const line = p && sub === undefined ? plantSub(p) : sub;
  return `<div class="task${cls ? ' ' + cls : ''}"><div class="task-top">${pic}<div><div class="task-name">${esc(p ? p.title : name)}</div>
    ${line ? `<div class="task-sub">${esc(line)}</div>` : ''}</div></div>
    ${quip ? `<p class="quip">${esc(quip)}</p>` : ''}
    <div class="question">${esc(task)}</div>
    <div class="btns">${buttons}</div>
    ${hint ? `<div class="hint">${esc(hint)}</div>` : ''}${after}</div>`;
}

function viewToday() {
  const t = today();
  const { log, shown, vents, pending, doneMain, waiting, total } = todayPlan();
  const pct = total ? Math.round((doneMain / total) * 100) : 100;
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<header class="hello head-row"><div><h1>${greeting()}!</h1><div class="date">${esc(date)}</div></div>
    ${headButtons()}</header>`;

  if (!allPlants().length) {
    return html + `<div class="celebrate"><div class="big">🌱</div><h2>Привет! Это Жунгли</h2>
      <p class="muted">Каждый день покажу пару растений, которые пора проверить, и запомню, как быстро сохнет каждое. Без долгов и красных просрочек.</p>
      ${quickStart()}
      <p class="mt-12 small muted">Уже вели Жунгли на другом телефоне? <button class="linkish" data-act="import">Восстановить копию</button></p></div>
      ${currentHint()}`;
  }

  html += currentHint();

  if (total > 0) {
    html += `<div class="progress"><div class="head-row"><b>${pending ? `Осталось ${pending} ${plural(pending, 'дело', 'дела', 'дел')}` : 'Всё на сегодня!'}</b>
      <span class="muted small">${doneMain} из ${total}</span></div><div class="bar"><i data-w="${pct}"></i></div></div>`;
  }

  vents.forEach((v) => {
    html += taskCard({
      p: v, quip: pickDaily(v.id, VENT_QUIPS), task: 'Проветрите теплицу минут на\u00a015–\u206030', // no line break inside «на 15–30»
      buttons: `<button class="btn air" data-act="vent-done" data-id="${esc(v.id)}">${I('wind')}Проветрено</button>
        <button class="btn" data-act="vent-off" data-id="${esc(v.id)}">Без теплицы</button>`,
      hint: 'С каждым днём можно держать открытой чуть дольше.',
    });
  });

  shown.forEach((p) => {
    const [yes, no] = labelsOf(p);
    html += taskCard({
      p, sub: plantSub(p, p.lastWater ? `${actWords(p).sub} ${rel(p.lastWater)}` : ''), quip: quipOf(p), task: waterTask(p),
      buttons: `<button class="btn water" data-act="water" data-id="${esc(p.id)}">${I('droplet')}${yes}</button>
        <button class="btn" data-act="wet" data-id="${esc(p.id)}">${no}</button>`,
      hint: p.water,
      after: `<button class="later" data-act="later" data-id="${esc(p.id)}">${I('skip-forward')}Не сейчас, завтра</button>`,
    });
  });

  if (!pending) {
    if (doneMain) {
      html += `<div class="celebrate"><div class="big">🎉</div><h2>Джунгли довольны!</h2>
        <p class="muted">Вы сегодня молодец. Остальное — завтра.</p></div>`;
    } else {
      const tom = allPlants().filter((p) => p.nextCheck === addDays(t, 1) && !wayOf(p).noChecks).length;
      html += `<div class="celebrate"><div class="big">😴</div><h2>Сегодня отдыхаем</h2>
        <p class="muted">Все в порядке, никто не просит пить.${tom ? ` Завтра проверим ${plantsN(tom)}.` : ''}</p></div>`;
    }
  }

  if (waiting > 0) {
    html += `<button class="more" data-act="show-all">${I('moon')}Ещё ${waiting} ${plural(waiting, 'растение подождёт', 'растения подождут', 'растений подождут')} до завтра.<br>Есть силы? Показать</button>`;
  }

  const bonus = bonusTasks();
  if (bonus.length) {
    html += `<h2 class="h-ic">${I('sparkles')}Если есть силы</h2>`;
    bonus.forEach((b) => {
      html += taskCard({
        cls: 'bonus', p: b.p, icon: b.icon, name: b.title, sub: b.sub, task: b.task, hint: b.hint,
        buttons: `<button class="btn ok" data-act="bonus-done" data-key="${esc(b.key)}">${I('check')}Готово</button>
          <button class="btn ghost" data-act="bonus-skip" data-key="${esc(b.key)}">Не сегодня</button>`,
      });
    });
  }

  const doneRows = log.filter((e) => e.a !== 'later');
  if (doneRows.length) {
    const label = { water: 'полито', wet: 'ещё влажно', vent: 'проветрено', bonus: 'сделано' };
    html += `<details><summary class="group-title">Уже сделано сегодня · ${doneRows.length}</summary>`;
    doneRows.forEach((e) => {
      const p = e.id ? plant(e.id) : null;
      const what = e.title || (p ? p.title : '');
      html += `<div class="task done-row">${p ? ava(p) : `<div class="ava" aria-hidden="true">${I('check')}</div>`}<div class="grow">${esc(what)}</div>
        <span class="muted small">${label[String(e.a).split(':')[0]] || ''}</span></div>`;
    });
    html += `</details>`;
  }
  return html;
}

/* ---------- Plants ---------- */
function viewPlants() {
  const ps = allPlants();
  let html = `<header class="hello head-row"><div><h1>Мои джунгли</h1><div class="date">${plantsN(ps.length)}</div></div>
    ${headButtons()}</header>
    ${ps.length ? `<button class="btn primary wide" data-act="add-plant">${I('plus')}Добавить растения</button>` : ''}`;
  if (!ps.length) html += `<div class="celebrate"><h2>Пока пусто</h2><p class="muted">Добавьте первое растение — и джунгли начнутся 🌱</p>${quickStart()}</div>`;
  if (ps.length >= 6) html += `<div class="search mt-12"><input class="input" id="plants-q" type="search" aria-label="Найти растение" placeholder="${S.rooms.length > 1 ? 'Найти: имя, вид, место, комната' : 'Найти: имя, вид или место'}" autocomplete="off" value="${esc(plantQ)}">${I('search')}</div>` + stateFilter(ps);
  // With several rooms: groups go room by room, titled «Кухня · Белый стол».
  if (S.rooms.length > 1) S.rooms.forEach((rm) => { html += spotGroups(ps.filter((p) => roomOf(p) === rm), rm.name); });
  else html += spotGroups(ps);
  if (ps.length) html += `<p id="plants-none" class="empty-note muted" hidden>Таких растений нет. Попробуйте другое слово или «Все».</p>`;
  return html;
}

// Plant cards grouped by place, in the order of the places list; `room` prefixes the titles.
function spotGroups(ps, room) {
  let html = '';
  const groups = {};
  ps.sort(bySpot).forEach((p) => { (groups[p.spot || ''] ||= []).push(p); });
  Object.keys(groups).sort((a, b) => spotIdx(a) - spotIdx(b)).forEach((spot) => {
    html += `<section class="pgroup"><div class="group-title">${esc(room ? [room, spot].filter(Boolean).join(' · ') : spot || 'Место не выбрано')}</div><div class="grid">`;
    groups[spot].forEach((p) => {
      const ph = photoOf(p.id);
      const st = states(p);
      const pic = ph ? `<img class="fill" src="${ph}" alt=""><img src="${ph}" alt="">` : plantSvg(p, mood(p, st)[2]);
      html += `<button class="pcard" data-open="${esc(p.id)}" data-st="${filterKeys(p, st).join(' ')}" data-q="${esc(norm([p.title, p.species, p.spot, S.rooms.length > 1 ? roomOf(p).name : ''].join(' ')))}"><div class="pic">${pic}<span class="badges">${stateChips(p, false, st)}${ghBadge(p)}${growBadges(p)}</span></div>
        <b>${esc(p.title)}</b><small>${p.name ? esc(p.species) + '<br>' : ''}${wayOf(p).noChecks ? `<span class="next">${esc(wayOf(p).name)}</span>` : `<span class="next">${I('droplet')}<span class="sr-only">проверка полива</span> ${esc(rel(p.nextCheck))}</span>`}</small></button>`;
    });
    html += `</div></section>`;
  });
  return html;
}

// Status filter under the search: «Все» and one chip per state that has plants, with face, word and count.
// The chips also teach which face means what.
let plantSt = '';
// Filter keys of a plant: its states, «greenhouse» when it lives in the теплица, and its unusual way of growing.
const filterKeys = (p, st = states(p)) => [...st, ...(p.greenhouse ? ['greenhouse'] : []), ...growKeys(p)];
function stateFilter(ps) {
  const n = {};
  const due = [];
  ps.forEach((p) => filterKeys(p).forEach((k) => { n[k] = (n[k] || 0) + 1; if (k === 'need') due.push(p); }));
  // A chosen state with no plants left shows «Все»; filterPlants() then clears plantSt.
  const sel = n[plantSt] ? plantSt : '';
  // Same chips as in the plant card; the chosen one gets a ring in its own color.
  const chip = (k, label, cls = k || 'all') => `<button class="mood hero-mood st-chip ${cls} ${sel === k ? 'on' : ''}" data-act="st-filter" data-st="${k}" aria-pressed="${sel === k}">${label}</button>`;
  // The plants' own word when every plant due shares it («мутновато», «пустовато»), else «суховато».
  const word = (k) => (k === 'need' && new Set(due.map((p) => stateWord(k, p))).size === 1 ? stateWord(k, due[0]) : STATES[k][1]);
  return `<div class="st-filter mt-10" role="group" aria-label="Показать растения">${chip('', `Все <span class="n">${ps.length}</span>`)}
    ${Object.keys(STATES).filter((k) => n[k]).map((k) => chip(k, `${I(STATES[k][0])}${word(k)} <span class="n">${n[k]}</span>`)).join('')}
    ${n.greenhouse ? chip('greenhouse', `${I('house-heart')}в теплице <span class="n">${n.greenhouse}</span>`) : ''}
    ${[...Object.keys(MEDIA), ...Object.keys(WATERING)].filter((k) => n[k] && growBadge(k)).map((k) => chip(k, `${I(growBadge(k)[0])}${growBadge(k)[1]} <span class="n">${n[k]}</span>`, 'way')).join('')}</div>`;
}

// Search on the Plants tab: filters the cards in place, so the field keeps focus.
let plantQ = '';
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
function filterPlants() {
  if (!$('#plants-q')) { plantQ = ''; plantSt = ''; } // no search or filter (fewer than 6 plants): show everything
  if (plantSt && !document.querySelector(`.st-chip.on[data-st="${plantSt}"]`)) plantSt = ''; // no plants left in that state
  const q = norm(plantQ.trim());
  let any = false;
  document.querySelectorAll('.pgroup').forEach((g) => {
    let n = 0;
    g.querySelectorAll('.pcard').forEach((c) => {
      const on = (!q || c.dataset.q.includes(q)) && (!plantSt || c.dataset.st.split(' ').includes(plantSt));
      c.hidden = !on; if (on) n++;
    });
    g.hidden = !n; any ||= n > 0;
  });
  const none = $('#plants-none');
  if (none) none.hidden = any;
  return any;
}
let plantsSearchTimer;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'plants-q') return;
  plantQ = e.target.value;
  const found = filterPlants();
  clearTimeout(plantsSearchTimer);
  if (plantQ.trim()) plantsSearchTimer = setTimeout(() => track('plants_searched', { found }), 1200);
});

// Cheat sheet: catalog tips (edits and removals go to r.own, '' = removed)
// plus the user's own notes in r.notes.
const NOTE_KEYS = [['water', 'Как поливать'], ['soil', 'Субстрат'], ['cond', 'Условия'], ['tip', 'Важно']];
const NOTE_ICONS = { water: 'droplet', soil: 'shovel', cond: 'thermometer', tip: 'lightbulb' };
let noteEdit = null; // key of the note being edited: 'water' … 'tip', 'n0' … or 'new'
const isCustom = (id) => !!S.custom[(S.plants[id] && S.plants[id].def) || id];

function cheatHtml(id) {
  const p = plant(id), r = S.plants[id], d = careOf(def(id), S.plants[id]);
  const items = [
    ...NOTE_KEYS.filter(([k]) => p[k]).map(([k, label]) => ({ key: k, label, text: p[k] })),
    ...(r.notes || []).map((text, i) => ({ key: 'n' + i, label: 'Заметка', text })),
  ];
  if (noteEdit === 'new') items.push({ key: 'new', label: 'Новая заметка', text: '' });
  let html = items.map((it) => {
    if (noteEdit !== it.key) {
      return `<button class="info note" data-act="note-edit" data-id="${esc(id)}" data-key="${it.key}"><b>${I(NOTE_ICONS[it.key] || 'sticky-note')}${esc(it.label)}<span class="pen">${I('pencil')}</span></b>${esc(it.text)}</button>`;
    }
    const edited = NOTE_KEYS.some(([k]) => k === it.key) && !isCustom(id) && d[it.key] && r.own && r.own[it.key] !== undefined;
    return `<div class="info note-form"><b>${esc(it.label)}</b>
      <textarea class="input" id="note-text" rows="4" aria-label="${esc(it.label)}" placeholder="Что важно помнить">${esc(it.text)}</textarea>
      <div class="mt-8 btns"><button class="btn ok" data-act="note-save" data-id="${esc(id)}" data-key="${it.key}">Сохранить</button>
        <button class="btn ghost" data-act="note-cancel" data-id="${esc(id)}">Отмена</button></div>
      <p class="small note-links">${it.key !== 'new' ? `<button class="linkish danger-link" data-act="note-del" data-id="${esc(id)}" data-key="${it.key}">Удалить</button>` : ''}
        ${edited ? `<button class="linkish" data-act="note-reset" data-id="${esc(id)}" data-key="${it.key}">Вернуть как в каталоге</button>` : ''}</p></div>`;
  }).join('');
  if (noteEdit !== 'new') html += `<button class="chip" data-act="note-edit" data-id="${esc(id)}" data-key="new">${I('plus')}заметка</button>`;
  const removed = NOTE_KEYS.filter(([k]) => d[k] && r.own && r.own[k] === '').length;
  if (removed) html += `<p class="small"><button class="linkish" data-act="note-restore" data-id="${esc(id)}">Вернуть удалённые советы (${removed})</button></p>`;
  if (p.toxic) html += `<div class="info warn"><b>${I('triangle-alert')}Осторожно</b>Сок раздражает кожу и слизистые. Работайте в перчатках.</div>`;
  if (p.generic) html += `<p class="small muted">Это общий тип, советы примерные. Интервал полива подстроится по вашим ответам.</p>`;
  return html;
}
function refreshCheat(id) {
  const box = $('#cheat');
  if (!box) return;
  box.innerHTML = cheatHtml(id);
  const ta = $('#note-text');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
// Writes a note: text '' removes it. Returns the analytics action.
function setNote(id, key, text) {
  const r = S.plants[id];
  if (key === 'new') { if (!text) return null; r.notes = [...(r.notes || []), text]; return 'add'; }
  if (key[0] === 'n') {
    const i = Number(key.slice(1));
    r.notes = r.notes || [];
    if (text) r.notes[i] = text; else r.notes.splice(i, 1);
    if (!r.notes.length) delete r.notes;
    return text ? 'edit' : 'remove';
  }
  r.own = r.own || {};
  const cat = careOf(def(id), r)[key] || '';
  // '' hides a catalog tip; a personal tip with nothing behind it is simply dropped.
  if (text === cat || (!text && !cat)) delete r.own[key]; else r.own[key] = text;
  if (!Object.keys(r.own).length) delete r.own;
  return text ? 'edit' : 'remove';
}
const noteKind = (key) => (key === 'new' || key[0] === 'n' ? 'own' : key);

// Watering block in the plant card: last watering, next check and the button; for a reservoir, the top-ups.
function waterBox(p) {
  const g = wayOf(p), w = actWords(p);
  if (g.noChecks) return `<div class="info water"><b>${g.name}</b>Поливать не нужно, корни в воде аквариума.</div>`;
  return `<div class="info water"><b>${w.title || g.name}</b>${p.lastWater ? `${w.last} ${esc(rel(p.lastWater))}` : w.none}<br>${p.nextCheck <= today() ? w.due : `${w.next} ${esc(rel(p.nextCheck))}`}</div>
    <button class="water-now btn water wide" data-act="water-now" data-id="${esc(p.id)}">${I('droplet')}${w.btn}</button>`;
}
// «Как растёт» in the plant card: the medium, and for a pot how it's watered, with what that means.
function wayBox(p, d) {
  const sel = (field, label, list, value) => `<label for="f-${field}">${label}</label><select class="input" id="f-${field}" data-field="${field}" data-id="${esc(p.id)}" aria-describedby="way-hint">
    ${Object.entries(list).map(([k, x]) => `<option value="${k}"${value === k ? ' selected' : ''}>${x.name}</option>`).join('')}</select>`;
  return `<div class="field">${sel('medium', 'В чём растёт', MEDIA, p.type)}
    <div class="mt-20" id="watering-field"${MEDIA[p.type].pot ? '' : ' hidden'}>${sel('watering', 'Как поливаю', WATERING, p.watering || 'top')}</div>
    <div class="mt-6" id="way-note">${wayNote(p, d)}</div></div>`;
}
// What the chosen way means, and a warning for succulents and cacti, which rot in steady moisture.
// Redrawn alone on a change: replacing the selects would reopen the picker on iPhone.
const wayNote = (p, d) => `<p class="small muted m-0" id="way-hint">${esc(wayOf(p).hint)}</p>
  ${d.type === 'dry' && wayOf(p).wet ? `<div class="info warn mt-8"><b>${I('triangle-alert')}Осторожно</b>Суккуленты и кактусы не любят постоянную влагу: следите, чтобы корни не загнили.</div>` : ''}`;
const intHint = (p) => `Подстраивается само, когда на «Сегодня» вы отвечаете «${labelsOf(p)[0]}» или «${labelsOf(p)[1]}».`;

// The plant card's picture and its photo buttons; heroPhotoChanged() redraws them alone.
function heroPic(p, mc) {
  const ph = photoOf(p.id);
  return ph ? `<img class="fill" src="${ph}" alt=""><img src="${ph}" alt="">` : plantSvg(p, mc);
}
function heroActs(id) {
  const ph = photoOf(id);
  return `<button class="hero-photo" data-act="photo" data-id="${esc(id)}">${I('camera')}${ph ? 'Другое фото' : 'Фото'}</button>
    ${ph ? `<button class="icon-btn" data-act="photo-remove" data-id="${esc(id)}" aria-label="Убрать фото">${I('trash-2')}</button>` : ''}`;
}
// A photo changed elsewhere (Telegram sync) while this plant's card may be open:
// redraw only the picture, so fields being edited keep their text and focus.
function heroPhotoChanged(id) {
  const btn = sheet.open && $(`#sheet-body .hero-photo[data-id="${CSS.escape(id)}"]`);
  const p = btn && plant(id);
  if (!p) return;
  $('#sheet-body .hero-pic').innerHTML = heroPic(p, mood(p)[2]);
  btn.parentElement.innerHTML = heroActs(id);
}

function openPlant(id) {
  const p = plant(id);
  if (!p) return;
  noteEdit = null;
  const mc = mood(p)[2];
  const ls = lightStatus(p);
  const histHtml = p.hist.slice(0, 8).map((h) => `${shortDate(h.d)} — ${h.a === 'water' ? 'полив' : 'ещё влажно'}`).join('<br>');
  const spots = [...new Set([...S.spots, ...allPlants().map((x) => x.spot).filter(Boolean)])];
  const tr = tempRange(p);
  $('#sheet-body').innerHTML = `
    <div class="hero-bar"><button class="icon-btn hero-close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="hero"><div class="hero-pic">${heroPic(p, mc)}</div>
      <div class="hero-acts">${heroActs(id)}</div>
      <span class="hero-badges">${stateChips(p, true)}${ghBadge(p, true)}${growBadges(p, true)}</span></div>
    <div class="sheet-main">
    <div class="hero-text"><h2 class="m-0" id="sh-title">${esc(p.title)}</h2><div class="muted small" id="sh-species">${esc(p.species)}</div></div>
    <p class="quip">${esc(quipOf(p))}</p>
    <div id="water-box">${waterBox(p)}</div>

    <div class="field"><label for="f-name">Имя</label><input class="input" id="f-name" data-field="name" data-id="${esc(id)}" value="${esc(p.name)}" placeholder="Придумайте имя, например Коля" maxlength="40"></div>
    <div class="field"><label for="f-species">Название (вид, сорт)</label><input class="input" id="f-species" data-field="species" data-id="${esc(id)}" value="${esc(p.species)}" placeholder="${esc(def(id).species)}" maxlength="80">
      ${S.plants[id].species ? `<p class="mt-6 small muted">В каталоге: ${esc(def(id).species)}. Сотрите поле, чтобы вернуть.</p>` : ''}</div>

    ${S.rooms.length > 1 ? `<div class="field" role="group" aria-labelledby="lbl-room"><label id="lbl-room">Комната</label><div class="chips">
      ${S.rooms.map((rm) => `<button class="chip ${roomOf(p) === rm ? 'on' : ''}" data-act="room-pick" data-id="${esc(id)}" data-room="${esc(rm.id)}">${esc(rm.name)}</button>`).join('')}</div></div>` : ''}
    <div class="field" role="group" aria-labelledby="lbl-spot"><label id="lbl-spot">Где стоит</label><div class="chips">
      ${spots.map((s) => `<button class="chip ${p.spot === s ? 'on' : ''}" data-act="spot" data-id="${esc(id)}" data-spot="${esc(s)}">${esc(s)}</button>`).join('')}
      <button class="chip" data-act="spot-new" data-id="${esc(id)}">${I('plus')}место</button></div></div>

    <div class="field"><label for="f-lux">Свет: нужно ${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} ${LK}${tr ? ` · ${tr[0]}–${tr[1]} °C` : ''}</label>
      <input class="input" type="number" inputmode="numeric" id="f-lux" placeholder="Замер люксметром, люкс" data-field="lux" data-id="${esc(id)}" value="${p.lux ?? ''}">
      ${ls ? `<p class="mt-6 small"><span class="tag ${ls}">${LIGHT_WORDS[ls]}</span></p>` : ''}</div>
    <div id="way-box">${wayBox(p, def(id))}</div>
    <div class="field" role="group" aria-labelledby="lbl-int" id="int-field"${wayOf(p).noChecks ? ' hidden' : ''}><label id="lbl-int">Проверять примерно каждые</label><div class="stepper">
      <button data-act="int-minus" data-id="${esc(id)}" aria-label="Чаще">${I('minus')}</button><b id="int-val">${days(Math.round(p.interval))}</b>
      <button data-act="int-plus" data-id="${esc(id)}" aria-label="Реже">${I('plus')}</button></div>
      <p class="mt-6 small muted" id="int-hint">${intHint(p)}</p></div>

    <div class="field"><label class="toggle"><input type="checkbox" data-field="repotted" data-id="${esc(id)}" aria-describedby="repot-hint" ${repotted(p) ? 'checked' : ''}> Недавно пересажено</label>
      <p class="mt-6 small muted" id="repot-hint">${repotHint(p)}</p></div>
    <div class="field"><label class="toggle"><input type="checkbox" data-field="greenhouse" data-id="${esc(id)}" ${p.greenhouse ? 'checked' : ''}> В теплице — напоминать проветривать</label></div>

    <h2>Шпаргалка</h2>
    <p class="mt-n4 small muted">Нажмите на совет, чтобы поправить или удалить.</p>
    <div id="cheat">${cheatHtml(id)}</div>
    ${histHtml ? `<h2>История</h2><p class="history">${histHtml}</p>` : ''}
    <button class="mt-20 btn danger wide" data-act="delete" data-id="${esc(id)}">Убрать из коллекции</button></div>`;
  openSheet();
}

// Catalog picker: several plants can be selected at once.
let picked = new Set();
// Crude Russian stem for catalog search: longer words drop their ending, so «лиана» finds «лианы»,
// «трава» finds «травы», «черенок» finds «черенки».
const searchStem = (w) => (w.length >= 6 ? w.slice(0, -2) : w.length === 5 ? w.slice(0, -1) : w);
function pickRow(d) {
  const meta = `${d.hint ? esc(d.hint) + ' · ' : ''}свет ${kLux(d.lux[0])}–${kLux(d.lux[1])} ${LK}`;
  return `<button class="pick" data-act="pick" data-key="${esc(d.id)}" data-q="${esc(norm([d.species, d.hint, d.aka].join(' ')))}" data-name="${esc(norm(d.species))}" data-cat="${esc(norm(d.cat))}" data-generic="${d.generic ? 1 : 0}">
    <span class="pe" aria-hidden="true">${plantSvg(d, 'fine')}</span><span class="pt"><b>${esc(d.species)}</b><small>${meta}</small></span><span class="pc" aria-hidden="true">${I('plus')}</span></button>`;
}
// What happens in the add flow, reported once when the sheet closes without adding.
let addFlow = null;
function startAddFlow(sheetName) {
  if (!addFlow) addFlow = { sheet: sheetName, searched: false, no_results: false, picked: 0, done: false };
  addFlow.sheet = sheetName;
}
function endAddFlow(leftApp = false) {
  // What the catalog lacks: sent whether or not something was added in the end.
  if (addFlow && addFlow.missed) track('catalog_missed', { query: addFlow.missed, added: addFlow.done });
  if (addFlow && !addFlow.done) track('add_abandoned', { sheet: addFlow.sheet, searched: addFlow.searched, no_results: addFlow.no_results, picked: addFlow.picked, left_app: leftApp });
  addFlow = null;
}
let searchTimer;
function openAdd() {
  picked = new Set();
  if (!sheet.open) endAddFlow(); // the close event doesn't fire in every browser
  startAddFlow('catalog');
  track('add_opened', { from: tab });
  const groups = {};
  PLANTS.filter((d) => !d.hidden).forEach((d) => { (groups[d.cat] ||= []).push(d); });
  const cats = Object.keys(groups).sort((a, b) => catRank(a) - catRank(b));
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('sprout')}</div><h2 class="m-0">Добавить растения</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <button class="import-cta" data-act="add-import"><span class="pe" aria-hidden="true">${I('bot')}</span>
      <span class="pt"><b>Сразу много — из чата с ИИ</b><small>Спросите ChatGPT, Claude или другого ИИ-помощника о своих растениях — он пришлёт файл, который можно загрузить сюда вместе с советами по уходу.</small></span>
      <span class="pc" aria-hidden="true">${I('chevron-right')}</span></button>
    <button class="import-cta mt-8" data-act="add-custom"><span class="pe" aria-hidden="true">${I('pencil')}</span>
      <span class="pt"><b>Своё растение</b><small>Название и на что похоже — уход подставлю сам.</small></span>
      <span class="pc" aria-hidden="true">${I('chevron-right')}</span></button>
    <div class="or">или выберите из каталога</div>
    <div class="search"><input class="input" id="pick-q" type="search" aria-label="Поиск растений" placeholder="Поиск: монстера, кактус, фиалка…" autocomplete="off">${I('search')}</div>
    <p class="pick-help small muted">Отметьте все свои растения. Нет вашего — добавьте его как своё или выберите похожий общий тип.</p>
    <div id="pick-none" class="pick-none" hidden></div>
    ${cats.map((c) => `<div class="pick-group"${c === 'Общие типы' ? ' data-generic' : ''}><div class="group-title">${c === 'Общие типы' ? 'Общие типы — если нет в списке' : esc(c)}</div>
      ${groups[c].map(pickRow).join('')}</div>`).join('')}
    <button class="mt-12 btn ghost wide" data-act="add-custom">${I('pencil')}Своё растение</button>
    <div class="pick-bar" id="pick-bar" hidden><button class="btn primary wide" data-act="pick-add" id="pick-add" disabled>Отметьте растения</button></div>`;
  const pickGroups = [...document.querySelectorAll('.pick-group')];
  const pickEnd = pickGroups[pickGroups.length - 1].nextElementSibling; // the bottom «Своё растение»
  const genericTitle = document.querySelector('.pick-group[data-generic] .group-title');
  let shownOrder = pickGroups;
  $('#pick-q').addEventListener('input', (e) => {
    const raw = e.target.value.trim();
    // Every word must match somewhere: «фикус бенджамина» finds the generic type, not every ficus.
    const words = norm(raw).split(/\s+/).filter(Boolean).map(searchStem);
    const hits = (text) => words.every((w) => text.includes(w));
    // The group name counts only when nothing else matched: «лиана» finds the vines,
    // but «кактус» doesn't list every succulent.
    const byCat = words.length > 0 && !pickGroups.some((g) => [...g.querySelectorAll('.pick')].some((b) => hits(b.dataset.q)));
    let any = false;
    const score = new Map();
    pickGroups.forEach((g) => {
      let n = 0, best = 0;
      g.querySelectorAll('.pick').forEach((b) => {
        const on = hits(byCat ? `${b.dataset.q} ${b.dataset.cat}` : b.dataset.q);
        b.hidden = !on;
        if (!on) return;
        n++;
        // A plant matched by its own name ranks highest; a specific plant matched by a folk name ties
        // with a generic type matched by name, and ties keep the catalog order (specific first).
        const named = hits(b.dataset.name);
        best = Math.max(best, b.dataset.generic === '1' ? (named ? 2 : 1) : (named ? 3 : 2));
      });
      g.hidden = !n; any ||= n > 0;
      score.set(g, best);
    });
    // Best-matching groups first: «рассада» and «черенок» show their generic type on top,
    // «орхидея» shows «Фаленопсис» before «Орхидея на коре». Without a search, the usual order.
    const order = words.length ? [...pickGroups].sort((a, b) => score.get(b) - score.get(a) || pickGroups.indexOf(a) - pickGroups.indexOf(b)) : pickGroups;
    if (order.some((g, i) => g !== shownOrder[i])) { order.forEach((g) => pickEnd.before(g)); shownOrder = order; }
    // «— если нет в списке» only reads right at the end of the full list.
    genericTitle.textContent = words.length ? 'Общие типы' : 'Общие типы — если нет в списке';
    // Nothing found: never a dead end. Offer the typed name as an own plant, and show all generic types.
    const none = $('#pick-none');
    none.hidden = any;
    if (!any) {
      none.innerHTML = `<p class="small muted">«${esc(raw)}» нет в каталоге.</p>
        <button class="mt-8 btn primary wide" data-act="add-custom" data-q="${esc(raw)}">${I('plus')}Добавить «${esc(raw.length > 14 ? raw.slice(0, 13) + '…' : raw)}»</button>
        <p class="mt-12 small muted">Или выберите похожий общий тип — уход у них почти одинаковый:</p>`;
      const g = document.querySelector('.pick-group[data-generic]');
      g.hidden = false;
      g.querySelectorAll('.pick').forEach((b) => { b.hidden = false; });
    }
    // The last search that found nothing goes out once, when the sheet closes (catalog_missed):
    // a pause mid-word or a fixed typo isn't sent. Clearing the box keeps it.
    if (addFlow && raw) addFlow.missed = any ? '' : raw.slice(0, 40);
    if (raw) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (addFlow) { addFlow.searched = true; addFlow.no_results = !any; }
        track('catalog_searched', { found: any });
      }, 1200);
    }
  });
  openSheet();
}
// «Добавить N растений» at the bottom of the catalog and the import list.
function setAddButton(b, n, emptyText) {
  b.disabled = !n;
  b.innerHTML = n ? `${I('plus')}Добавить ${plantsN(n)}` : emptyText;
}
// The catalog's add bar appears only once something is ticked.
// The catalog's and the import list's add bars appear only once something is ticked.
const showAddBar = (bar, btn, n) => { setAddButton(btn, n, ''); bar.hidden = !n; };
const updatePickBar = () => showAddBar($('#pick-bar'), $('#pick-add'), picked.size);
// Picker groups go by care, from the most common plants; generic types close the list.
const CAT_ORDER = ['Лианы и ампельные', 'Декоративно-лиственные', 'Пальмы, драцены и деревья', 'Ароидные', 'Влаголюбивые',
  'Суккуленты и кактусы', 'Цветущие и орхидеи', 'Общие типы'];
// A category missing from CAT_ORDER (a typo in plants.js) still shows, just before the generic types, and warns.
const catRank = (c) => {
  const r = CAT_ORDER.indexOf(c);
  if (r < 0) console.warn('Catalog category missing from CAT_ORDER:', c);
  return r < 0 ? CAT_ORDER.length - 1.5 : r;
};

// Two fields are enough: what it is and what it's like. The care comes from that generic type;
// the numbers stay editable under «Тонкая настройка».
const GENERIC_TYPES = () => PLANTS.filter((d) => d.generic && !d.hidden);
function openCustom(species = '', from = 'button') {
  startAddFlow('custom');
  track('custom_opened', { from });
  const like = GENERIC_TYPES()[0];
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('pencil')}</div><h2 class="m-0">Новое растение</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <form id="add-form">
      <div class="field"><label for="c-species">Что это за растение</label><input class="input" id="c-species" name="species" required placeholder="Например, Пеперомия" value="${esc(species)}"></div>
      <div class="field"><label for="c-like">На что похоже</label><select class="input" id="c-like" name="like" aria-describedby="c-like-hint">
        ${GENERIC_TYPES().map((d) => `<option value="${esc(d.id)}">${esc(d.species)}</option>`).join('')}</select>
        <p class="mt-6 small muted" id="c-like-hint"></p></div>
      <details class="tune"><summary>Тонкая настройка${I('chevron-right')}</summary>
        <div class="field"><label for="c-name">Имя (если есть)</label><input class="input" id="c-name" name="name" placeholder="Например, Пепа"></div>
        <div class="field"><label for="c-type">В чём растёт</label><select class="input" id="c-type" name="type">
          ${Object.entries(TYPE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label id="lbl-lux">Сколько света нужно, ${LK}</label><div class="row2">
          <input class="input" name="lmin" aria-label="Света от, люкс" type="number" inputmode="numeric" placeholder="от">
          <input class="input" name="lmax" aria-label="Света до, люкс" type="number" inputmode="numeric" placeholder="до"></div></div>
        <div class="field"><label for="c-every">Проверять каждые … дней</label><input class="input" id="c-every" name="every" type="number" inputmode="numeric"></div>
        <div class="field"><label for="c-tip">Шпаргалка</label><textarea class="input" id="c-tip" name="tip" rows="3" placeholder="Что важно помнить"></textarea></div>
      </details>
      <button class="mt-14 btn primary wide" type="submit">${I('plus')}Добавить</button>
    </form>`;
  const form = $('#add-form');
  // Picking a type fills in its care: watering, light and how often to check.
  const fillFrom = (d) => {
    form.type.value = d.type;
    form.lmin.value = d.lux[0];
    form.lmax.value = d.lux[1];
    form.every.value = d.every;
    form.tip.value = d.tip || '';
    $('#c-like-hint').textContent = d.hint ? `Например: ${d.hint}.` : '';
  };
  fillFrom(like);
  form.like.addEventListener('change', () => fillFrom(def(form.like.value)));
  // Changing the care in «Тонкая настройка» by hand (not the values a type fills in, not the name)
  // tells whether two fields are enough.
  let tuned = false;
  form.querySelector('.tune').addEventListener('input', (e) => { if (e.target.name !== 'name') tuned = true; });
  if (!species) form.species.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (addFlow) addFlow.done = true;
    const f = new FormData(e.target);
    const base = def(String(f.get('like'))) || like;
    const id = newId('c');
    const every = clamp(Number(f.get('every')) || base.every, 1, 60);
    const lmin = Number(f.get('lmin')) || base.lux[0];
    const lmax = Math.max(lmin, Number(f.get('lmax')) || base.lux[1]);
    const type = String(f.get('type'));
    const { humid, big, quips } = base;
    // The type's check question and care tips fit only its own growing medium: changed by hand, they're left out.
    const care = type === base.type ? { check: base.check, water: base.water, soil: base.soil, cond: base.cond } : {};
    S.custom[id] = {
      id, species: String(f.get('species')).trim() || 'Растение', cat: 'Мои', emoji: base.emoji || '🪴',
      ...care, humid, big,
      lux: [lmin, lmax], every, type, tip: String(f.get('tip')).trim(), quips: quips || GENERIC_QUIPS,
    };
    S.custom[id].tone = toneOf(S.custom[id]);
    S.plants[id] = runtime(S.custom[id], today());
    S.plants[id].name = String(f.get('name') || '').trim();
    initBonus(S);
    save();
    closeSheet();
    track('plants_added', { count: 1, generic_count: 0, source: 'custom', plant_type: S.custom[id].type, like: base.id, tuned });
    toast('Добро пожаловать в джунгли! 🌱');
  });
  openSheet();
}

/* ---------- Import from an AI chat ---------- */
// The user copies a prompt into ChatGPT/Claude, picks the plants.json file it sends,
// and the plants become custom plants with their care tips.
const IMPORT_PROMPT = `Сделай файл plants.json со списком моих растений для приложения «Жунгли» и пришли его мне для скачивания — файлом, не текстом в чате. Возьми растения, о которых мы говорили в этом чате (если непонятно, какие, — спроси меня).

Если я говорила, как растёт растение (в воде, в керамзите, в поне, на блоке, в террариуме, в аквариуме, на фитиле, с резервуаром), пиши проверку и уход именно для этого способа.

В файле — только JSON-массив, без пояснений: обычные двойные кавычки, числа без пробелов. Один объект на растение, поля:
- species — вид или сорт по-русски
- name — имя, если оно есть у растения, иначе ""
- room — комната, где стоит, если я её называла (например "Кухня"), иначе ""
- spot — место в комнате: подоконник, полка, стол и т. п., если я его называла, иначе ""
- type — в чём растёт: "soil" (грунт), "dry" (грунт для суккулентов и кактусов, сушить почти полностью), "sphagnum" (сфагнум), "bark" (кора, орхидеи), "coco" (кокос), "mineral" (пон, пемза, цеолит), "leca" (керамзит), "water" (в воде: черенки, растения в банке), "mount" (на блоке, корни на воздухе), "terrarium" (закрытый террариум), "aquarium" (корни в аквариуме)
- watering — как поливать растение в горшке: "top" (сверху), "wick" (фитиль), "reservoir" (резервуар в горшке: кашпо с автополивом, керамзит с запасом раствора); для воды, блока, террариума и аквариума — "top"
- lux — сколько света нужно, люксы: [от, до]
- every — через сколько дней обычно проверять полив (для керамзита — уровень раствора, для воды — пора ли её менять)
- check — вопрос при проверке, например "Верхние 2–3 см сухие?" или "Уровень раствора на минимуме?"
- water — как поливать, доливать или менять воду и когда удобрять
- soil — в чём растёт и какой горшок
- cond — условия; начни с температуры так: "18–26 °C; ..."
- tip — самое важное в уходе
- toxic — true, если сок ядовит или раздражает кожу
- big — true, если крупные листья, которые надо протирать от пыли
- quips — 3 коротких смешных фразы от лица растения, на «вы» ко мне

Пример:
[{"species":"Пеперомия туполистная","name":"","room":"Кухня","spot":"Подоконник","type":"soil","watering":"top","lux":[8000,15000],"every":7,"check":"Верхние 2–3 см сухие?","water":"Когда верхний слой подсох, умеренно.","soil":"Лёгкий грунт с перлитом, горшок с дренажем.","cond":"18–26 °C; обычная влажность.","tip":"Мясистые листья запасают воду — перелив опаснее пересушки.","toxic":false,"big":false,"quips":["Я толстенькая, но это вода.","Не заливайте меня, я и так сочная.","Поверните меня к свету, пожалуйста."]}]`;

// Cleans formatting chat apps add, so JSON.parse can read the answer.
function repairJson(src) {
  return src
    .replace(/^\s*\/\/.*$/gm, '') // line comments
    .replace(/[“”„‟″]/g, '"').replace(/[‘’]/g, "'") // typographic quotes
    .replace(/(\d)[   ](?=\d{3}\b)/g, '$1') // 8 000 → 8000
    .replace(/,\s*([\]}])/g, '$1'); // trailing commas
}
// Finds the plant list in the AI's file: code fences, text around it (even with brackets),
// typographic quotes, spaced numbers, a single object or objects without [ ].
function parseImport(text) {
  const t = String(text || '').trim();
  if (!t) return { error: 'empty' };
  // What the text looked like, without any of its content.
  const diag = { has_code_fence: t.includes('```'), has_curly_quotes: /[“”„]/.test(t), has_spaced_numbers: /\d[   ]\d{3}\b/.test(t) };
  const tries = [];
  const end = t.lastIndexOf(']');
  for (let a = t.indexOf('['), n = 0; a !== -1 && a < end && n < 8; a = t.indexOf('[', a + 1), n++) tries.push(t.slice(a, end + 1));
  const c = t.indexOf('{'), d = t.lastIndexOf('}');
  if (c !== -1 && d > c) tries.push(t.slice(c, d + 1), `[${t.slice(c, d + 1)}]`);
  if (!tries.length) return { error: 'no_list', diag };
  let parsed = false;
  for (const raw of tries) {
    for (const [src, repaired] of [[raw, false], [repairJson(raw), true]]) {
      let v;
      try { v = JSON.parse(src); } catch (e) { continue; }
      parsed = true;
      if (v && !Array.isArray(v)) v = Array.isArray(v.plants) ? v.plants : Object.values(v).find(Array.isArray) || [v];
      const items = v.map(normImport).filter(Boolean);
      if (items.length) return { items, repaired };
    }
  }
  return { error: parsed ? 'no_plants' : 'bad_json', diag };
}
// Common off-format answers: 'succulent', 'orchid', 'грунт'…
function importType(x) {
  const t = String(x || '').toLowerCase();
  if (TYPE_NAMES[t]) return t;
  if (/aquar|аквар/.test(t)) return 'aquarium';
  if (/terrar|террар|флорар|бутыл/.test(t)) return 'terrarium';
  if (/mount|блок|коряг|epiphyt/.test(t)) return 'mount';
  // Specific substrates first: «пон, полугидропоника» is pon on a reservoir, not clay pebbles.
  if (/mineral|pumice|zeolit|\bpon\b|минерал|пемз|цеолит|(^|[^а-я])пон([^а-я]|$)/.test(t)) return 'mineral';
  if (/coco|кокос/.test(t)) return 'coco';
  if (/leca|clay|hydro|semi|керамз|гидро/.test(t)) return 'leca';
  if (/succ|cact|dry|сух|сукк|какт/.test(t)) return 'dry';
  if (/bark|orchid|кор|орхид/.test(t)) return 'bark';
  if (/sphag|moss|сфаг|мох/.test(t)) return 'sphagnum';
  if (/water|вод/.test(t)) return 'water';
  return 'soil';
}
// How a potted plant is watered; the old answer "type": "wick" means soil on a wick.
function importWatering(x, type) {
  const t = `${x || ''} ${type || ''}`.toLowerCase();
  if (/wick|фитил/.test(t)) return 'wick';
  if (/reserv|резерв|автопол|self.?water|semi|hydro|гидро/.test(t)) return 'reservoir';
  return 'top';
}
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
function normImport(o) {
  if (!o || typeof o !== 'object') return null;
  const str = (x, max = 500) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  const species = str(o.species, 80) || str(o.name, 80);
  if (!species) return null;
  // Numbers may come as strings: "7–10", "8 000", "8000–15000 лк".
  const nums = (x) => (String(x ?? '').replace(/(\d)[\s\u00a0\u202f](?=\d{3}\b)/g, '$1').match(/\d+(?:[.,]\d+)?/g) || []).map((m) => Number(m.replace(',', '.')));
  const num = (x) => nums(x)[0];
  const yes = (x) => x === true || /^(true|да|yes)$/i.test(String(x).trim());
  let lux = (Array.isArray(o.lux) ? o.lux.map(num) : nums(o.lux)).filter((x) => x > 0);
  lux = lux.length ? [Math.min(...lux), Math.max(...lux)].map((x) => clamp(Math.round(x), 300, 100000)) : [6000, 15000];
  const quips = Array.isArray(o.quips) ? o.quips.map((q) => str(q, 120)).filter(Boolean).slice(0, 5) : [];
  const type = importType(o.type);
  // Clay pebbles almost always stand in a pot with a reservoir.
  const watering = !MEDIA[type].pot ? 'top' : MEDIA[type].watering && !o.watering ? MEDIA[type].watering : importWatering(o.watering, o.type);
  return {
    species, name: str(o.name, 40) === species ? '' : str(o.name, 40),
    room: cap(str(o.room, 40)), spot: cap(str(o.spot ?? o.place, 40)),
    emoji: [...str(o.emoji, 16)].slice(0, 2).join('') || '🪴',
    type, ...(watering !== 'top' ? { watering } : {}),
    lux, every: clamp(Math.round(num(o.every)) || 6, 1, 60),
    check: str(o.check, 100), water: str(o.water), soil: str(o.soil), cond: str(o.cond), tip: str(o.tip),
    toxic: yes(o.toxic), big: yes(o.big), quips: quips.length ? quips : GENERIC_QUIPS,
  };
}

let importItems = [];
let importRepaired = false;
let importExt = '';
let importPicked = new Set();
// How to copy the shown prompt by hand: the gesture that opens the system menu differs by platform.
const PROMPT_HINT = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Нажмите на текст, затем ещё раз — в меню «Выбрать все», потом «Скопировать».'
  : /Android/.test(navigator.userAgent) ? 'Подержите палец на тексте — в меню «Выбрать все», потом «Копировать».'
    : 'Выделите весь текст (Ctrl+A или ⌘A) и скопируйте.';
function openImport() {
  startAddFlow('import');
  track('import_opened');
  importItems = [];
  importPicked = new Set();
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('bot')}</div><h2 class="m-0">Импорт из чата с ИИ</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="info"><b>Шаг 1</b>Скопируйте запрос и отправьте в ChatGPT, Claude или другой ИИ, который умеет присылать файлы, — в чат, где уже обсуждали растения, или вместе с их фото.
      <button class="mt-10 btn ok wide" data-act="import-copy">${I('copy')}Скопировать запрос</button>
      <div class="mt-12 small" id="imp-manual" hidden><p class="m-0 muted">Длинный запрос чат может вставить файлом-вложением — так и должно быть, просто отправьте.</p>
        <p class="m-0 copy-help"><button class="linkish" data-act="import-show">Не вставляется? Показать запрос</button></p></div>
      <div id="imp-prompt-box" hidden><p class="mt-8 small muted" id="imp-prompt-hint">${PROMPT_HINT}</p>
        <textarea class="mt-8 input" id="imp-prompt" rows="8" inputmode="none" aria-label="Запрос для ИИ" aria-describedby="imp-prompt-hint" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>
        <button class="mt-8 btn wide" data-act="import-copy-again">${I('copy')}Скопировать ещё раз</button></div>
      <p class="sr-only" id="imp-status" role="status"></p></div>
    <div class="info"><b>Шаг 2</b>ИИ пришлёт файл plants.json. Сохраните его на телефон и выберите здесь.
      <button class="mt-10 btn wide" data-act="import-file" id="imp-file">${I('file-up')}Выбрать файл</button></div>
    <div id="imp-list"></div>
    <div class="pick-bar" id="imp-bar" hidden><button class="btn primary wide" data-act="import-add" id="imp-add" disabled>Отметьте растения</button></div>`;
  openSheet();
}
// Selects all of a text field. iOS doesn't select text in a readonly field, so readonly is lifted for the
// moment of selecting (as clipboard.js does); it's back before the next paint, so no keyboard shows.
function selectAll(ta) {
  const ro = ta.readOnly;
  ta.readOnly = false;
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  ta.readOnly = ro;
}
// Copies text and resolves to how it went: 'exec', 'clipboard', 'failed' or 'none'.
// Select-and-copy goes first, inside the tap: on iPhone, a home-screen app's navigator.clipboard.writeText
// can report success without copying anything. The Clipboard API runs only when that fails: a second write
// right after the first can still be going when the person switches to the AI app on a slow iPhone,
// and the app is suspended mid-write, leaving the clipboard empty.
// The text goes into a hidden readonly field in the open sheet (a modal <dialog> makes the rest inert),
// so no keyboard shows.
function copyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.readOnly = true;
  ta.tabIndex = -1;
  ta.className = 'copy-buffer';
  ($('#sheet[open]') || document.body).appendChild(ta);
  selectAll(ta);
  // execCommand can report success with nothing selected (so nothing copied): trust it only for a full selection.
  const selected = ta.selectionEnd - ta.selectionStart === text.length;
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* not supported */ }
  ta.remove();
  if (ok && selected) return Promise.resolve('exec');
  if (!navigator.clipboard) return Promise.resolve('none');
  return navigator.clipboard.writeText(text).then(() => 'clipboard', () => 'failed');
}
// Copies the prompt with a visible «Копирую…» step: the result shows no sooner than a second after the tap,
// so nobody rushes off to the AI app before a slow phone has finished. Taps meanwhile are ignored.
// A copy that throws or hangs counts as 'failed'.
const COPY_PAUSE = 1000;
const COPY_TIMEOUT = 5000;
function copyPrompt(el, done) {
  if (el.dataset.busy) return;
  el.dataset.busy = '1';
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = `${I('copy')}Копирую…`;
  if ($('#imp-status')) $('#imp-status').textContent = 'Копирую запрос…';
  const t0 = Date.now();
  let copying;
  try { copying = copyText(IMPORT_PROMPT); } catch (e) { copying = Promise.resolve('failed'); }
  Promise.race([copying, new Promise((res) => setTimeout(res, COPY_TIMEOUT, 'failed'))])
    .then((how) => setTimeout(() => {
      delete el.dataset.busy;
      el.removeAttribute('aria-busy');
      done(how);
    }, Math.max(0, COPY_PAUSE - (Date.now() - t0))));
}
// The prompt as text to copy by hand, when copying didn't work. An ordinary (editable) field on purpose:
// iPhone offers «Выбрать все» only in fields you can type in, and a readonly one leaves only dragging
// across 2,500 characters. inputmode="none" keeps the on-screen keyboard down, even when it's tapped.
function showPrompt() {
  const ta = $('#imp-prompt');
  if (!ta) return;
  ta.value = IMPORT_PROMPT;
  $('#imp-prompt-box').hidden = false;
  $('#imp-manual').hidden = true;
  $('#imp-prompt-box').scrollIntoView({ block: 'nearest' });
  // Editable only so the system menu offers «Выбрать все»: typing is undone, so a stray key can't end up in the AI chat.
  if (!ta.dataset.locked) {
    ta.dataset.locked = '1';
    // Paste, Cut and AutoFill still show in the system menu; when one is tried, say what the field is for.
    ta.addEventListener('beforeinput', (e) => {
      e.preventDefault();
      $('#imp-prompt-hint').textContent = 'Текст менять не нужно — только «Выбрать все» и «Скопировать».';
    });
    ta.addEventListener('input', () => { if (ta.value !== IMPORT_PROMPT) ta.value = IMPORT_PROMPT; });
  }
}
// Plant lists are a few kilobytes; a much bigger file is something else (a photo, a document).
const IMPORT_MAX = 1e6;
// Reads the file the AI sent and shows its plants. For stats only the kind of file goes out
// (json / txt / other): what follows the dot can be part of a name («Растения.Коля»).
async function importFile(f) {
  const dot = f.name.lastIndexOf('.');
  const ext = { json: 'json', txt: 'txt' }[dot < 0 ? '' : f.name.slice(dot + 1).toLowerCase()] || 'other';
  if (f.size > IMPORT_MAX) { showImport(null, ext, 'too_big'); return; }
  let text = null;
  try { text = (await f.text()).replace(/^\uFEFF/, ''); } catch (e) { /* unreadable */ }
  showImport(text, ext);
}
// A backup picked here by mistake: it has no plant list for import, but can be restored in settings.
function isBackup(text) {
  try { const d = JSON.parse(text); return !!d && d.app === 'zhungli' && !!d.state; } catch (e) { return false; }
}
function showImport(text, ext, fail) {
  const res = fail ? { error: fail } : text === null ? { error: 'unreadable' } : isBackup(text) ? { error: 'backup' } : parseImport(text);
  const box = $('#imp-list');
  if (!box) return;
  $('#imp-file').innerHTML = `${I('file-up')}${res.error ? 'Выбрать файл' : 'Выбрать другой файл'}`;
  if (res.error) {
    importItems = [];
    importPicked = new Set();
    box.innerHTML = res.error === 'backup'
      ? '<p class="error-note small">Это резервная копия Жунглей, а не файл от ИИ. Её можно восстановить в настройках: «Восстановить копию».</p>'
      : `<p class="error-note small">${{ unreadable: 'Не получилось открыть этот файл.', too_big: 'Этот файл слишком большой для списка растений — похоже, выбран не тот.' }[res.error] || 'В этом файле не нашлось списка растений.'} Нужен файл plants.json, который ИИ пришлёт по запросу из шага 1.</p>
      <p class="small muted">Всё равно не выходит? Пришлите файл в Телеграм <a class="linkish" href="https://t.me/zmoki" data-out="telegram" data-from="import" target="_blank" rel="noopener">@zmoki</a> — разберусь и починю.</p>`;
    track('import_failed', { length: text ? text.length : 0, reason: res.error, file_ext: ext, ...(res.diag || {}) });
  } else {
    importItems = res.items;
    importRepaired = res.repaired;
    // Plants already in the collection start unticked.
    const have = new Set(allPlants().map((p) => p.species.toLowerCase()));
    importPicked = new Set(importItems.map((it, i) => i).filter((i) => !have.has(importItems[i].species.toLowerCase())));
    importExt = ext;
    // All of them already in the collection: nothing is ticked and the add bar stays hidden, so say how to add them anyway.
    const note = importPicked.size ? `Найдено ${plantsN(importItems.length)}. Снимите галочку с лишних.`
      : `${importItems.length === 1 ? 'Это растение уже' : `Все ${plantsN(importItems.length)} уже`} в коллекции. Отметьте, если нужны ещё раз.`;
    box.innerHTML = `<p class="found-note small muted">${note}</p>` +
      importItems.map((it, i) => {
        const dup = !importPicked.has(i);
        return `<button class="pick ${dup ? '' : 'on'}" data-act="import-pick" data-i="${i}">
        <span class="pe" aria-hidden="true">${plantSvg(it, 'fine')}</span><span class="pt"><b>${esc(it.name ? `${it.name} · ${it.species}` : it.species)}</b>
        <small>${dup ? 'уже есть в коллекции · ' : ''}${it.room || it.spot ? esc([it.room, it.spot].filter(Boolean).join(' · ')) + ' · ' : ''}${esc(TYPE_NAMES[it.type])}${it.watering ? `, ${esc(WATERING[it.watering].name.toLowerCase())}` : ''} · свет ${kLux(it.lux[0])}–${kLux(it.lux[1])} ${LK} · раз в ${days(it.every)}</small></span>
        <span class="pc" aria-hidden="true">${I(dup ? 'plus' : 'check')}</span></button>`;
      }).join('');
  }
  updateImportBar();
}
const updateImportBar = () => showAddBar($('#imp-bar'), $('#imp-add'), importPicked.size);
function addImported() {
  if (addFlow) addFlow.done = true;
  const picked = [...importPicked].sort((a, b) => a - b).map((i) => importItems[i]);
  const list = [...picked].sort((a, b) => a.every - b.every);
  // A new collection where every plant has a room keeps no empty default «Комната»: the first imported room takes its place.
  const first = S.rooms[0];
  let rename = !Object.keys(S.plants).length && S.rooms.length === 1 && first.t == null && first.name === 'Комната' && list.every((it) => it.room);
  const roomsBefore = S.rooms.length;
  // Rooms come in the order the AI listed them (plants below are sorted by how often to check them).
  picked.forEach((it) => { if (it.room) { importRoom(it.room, rename); rename = false; } });
  list.forEach((it, i) => {
    const id = newId('c', i);
    const { name, room, spot: rawSpot, ...d } = it;
    // Reuse a place that differs only in case («подоконник» → «Подоконник»).
    const spot = rawSpot && (S.spots.find((x) => norm(x) === norm(rawSpot)) || rawSpot);
    if (spot && !S.spots.includes(spot)) S.spots.push(spot);
    S.custom[id] = { ...d, id, cat: 'Мои', tone: toneOf(it) };
    S.plants[id] = { ...runtime(S.custom[id], firstCheck(i, it.every)), name, spot, room: importRoom(room, false) };
  });
  initBonus(S);
  save();
  const noSpot = list.filter((it) => !it.spot).length;
  track('plants_added', {
    count: list.length, generic_count: 0, source: 'import', repaired: importRepaired, file_ext: importExt,
    with_room: list.filter((it) => it.room).length, with_spot: list.length - noSpot, rooms_created: S.rooms.length - roomsBefore,
  });
  tab = 'plants'; closeSheet(); window.scrollTo(0, 0);
  toast(`Добавлено ${plantsN(list.length)} 🌱${noSpot ? ' Откройте каждое без места, чтобы его выбрать' : ''}`);
}
// The room id for an imported plant: an existing room with that name, or a new one
// (`renameFirst`: the empty default room takes this name instead).
// Without a room the plant lives in the first room (no `room` field needed).
function importRoom(name, renameFirst) {
  if (!name) return undefined;
  const found = S.rooms.find((r) => norm(r.name) === norm(name));
  if (found) return found.id;
  if (renameFirst) {
    S.rooms[0].name = name;
    return S.rooms[0].id;
  }
  const rm = newRoom('r' + Date.now().toString(36) + S.rooms.length, name);
  S.rooms.push(rm);
  return rm.id;
}

/* ---------- Light ---------- */
const LUX_SCALE = 40000;

function lightRow(p) {
  const ls = lightStatus(p);
  const [a, b] = p.luxRange;
  const left = (Math.min(a, LUX_SCALE) / LUX_SCALE) * 100;
  const width = ((Math.min(b, LUX_SCALE) - Math.min(a, LUX_SCALE)) / LUX_SCALE) * 100;
  const dot = p.lux ? `<i class="dot ${ls}" data-l="${clamp((p.lux / LUX_SCALE) * 100, 0, 100)}"></i>` : '';
  const state = ls ? `<span class="tag ${ls}">${LIGHT_WORDS[ls]}</span>` : '<span class="small muted">ещё не замерено</span>';
  return `<div class="lux-row" id="lux-${esc(p.id)}"><span class="nm-pl lux-pic">${photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p, mood(p)[2])}</span>
    <div class="nm">${esc(p.title)}</div><div class="lux-state">${state}</div>
    <input class="input" type="number" inputmode="numeric" placeholder="лк" aria-label="Замер для ${esc(p.title)}, люкс" data-field="lux" data-id="${esc(p.id)}" value="${p.lux ?? ''}">
    <div class="need">нужно ${kLux(a)}–\u2060${kLux(b)}${p.spot ? ' · ' + esc(p.spot) : ''}</div>
    <div class="lux-bar"><i class="range" data-l="${left}" data-w="${width}"></i>${dot}</div></div>`;
}

function lightIdeas() {
  const ps = allPlants().filter((p) => p.lux);
  const lows = ps.filter((p) => lightStatus(p) === 'low').sort((x, y) => (y.luxRange[0] - y.lux) - (x.luxRange[0] - x.lux));
  const highs = ps.filter((p) => lightStatus(p) === 'high');
  const used = new Set();
  const out = [];
  lows.forEach((L) => {
    const H = ps
      .filter((h) => h.id !== L.id && !used.has(h.id) && h.lux >= L.luxRange[0] && h.luxRange[0] <= L.lux)
      .sort((x, y) => (y.lux - y.luxRange[0]) - (x.lux - x.luxRange[0]))[0];
    if (H) {
      used.add(H.id); used.add(L.id);
      out.push(['swap', `${I('arrow-left-right')}<b>Поменяйте местами: ${esc(L.title)} ⇄ ${esc(H.title)}</b><br>
        ${esc(L.title)}: сейчас ${kLux(L.lux)} ${LK}, нужно от ${kLux(L.luxRange[0])}.<br>
        ${esc(H.title)}: сейчас ${kLux(H.lux)} ${LK}, хватит и ${kLux(L.lux)}.`]);
    } else {
      out.push(['low', `${I('sun-dim')}<b>${esc(L.title)}</b>: темновато — ${kLux(L.lux)} ${LK}, нужно от ${kLux(L.luxRange[0])}. Подвиньте ближе к окну или лампе или добавьте часов досветки.`]);
    }
  });
  highs.forEach((H) => {
    if (!used.has(H.id)) out.push(['high', `${I('sun')}<b>${esc(H.title)}</b>: очень ярко — ${kLux(H.lux)} ${LK}, нужно до ${kLux(H.luxRange[1])}. Отодвиньте от лампы или прямого солнца, чтобы не обжечь листья.`]);
  });
  if (!out.length) return ps.length ? '<p class="muted">Света всем хватает 🌞</p>' : '';
  return out.map(([kind, t]) => `<div class="idea ${kind}">${t}</div>`).join('');
}

// Empty screens: tap the plants you have and add them in one go. Anything else is one tap away.
const QUICK = [['mon-del', 'Монстера'], ['zz', 'Замиокулькас'], ['spath', 'Спатифиллум'], ['phal', 'Орхидея'],
  ['pothos', 'Потос'], ['ficus-benj', 'Фикус Бенджамина'], ['sansevieria', 'Сансевиерия'], ['violet', 'Фиалка']];
let qsPicked = new Set();
let qsReported = false;
// Tiles ticked but not added: reported once when the person turns to another way of adding or leaves the app.
// The ticks stay, so coming back to the same screen keeps them.
function endQuick(then) {
  if (!qsPicked.size || qsReported) return;
  track('quick_abandoned', { picked: qsPicked.size, then });
  qsReported = true;
}
function quickStart() {
  const tiles = QUICK.map(([k, label]) => {
    const on = qsPicked.has(k);
    return `<button class="qs${on ? ' on' : ''}" data-act="qs-pick" data-key="${k}" aria-pressed="${on}">
      <span class="qs-pic" aria-hidden="true">${plantSvg(PLANTS.find((p) => p.id === k), 'fine')}</span><span class="qs-name">${label}</span></button>`;
  }).join('');
  const n = qsPicked.size;
  return `<p class="mt-14 qs-title"><b>Что у вас растёт?</b> Отметьте — остальное найдём в каталоге.</p>
    <div class="qs-grid">${tiles}</div>
    <button class="mt-12 btn primary wide" data-act="qs-add" id="qs-add"${n ? '' : ' disabled'}>${n ? `${I('plus')}Добавить ${plantsN(n)}` : 'Отметьте, что есть'}</button>
    <button class="mt-8 btn ghost wide" data-act="add-plant">${I('search')}Другие растения</button>
    <p class="mt-12 small muted">Растений много? <button class="linkish" data-act="add-import">Перенесите из чата с ИИ</button></p>`;
}
// After adding from the catalog or the quick picks: one plant opens its card, several go to «Растения».
function addFromCatalog(keys, source) {
  const ids = addPlants(keys);
  if (!ids.length) return;
  track('plants_added', { count: ids.length, generic_count: ids.filter((i) => def(i).generic).length, catalog_ids: ids.map((i) => def(i).id), source });
  save();
  if (ids.length === 1) { openPlant(ids[0]); render(); toast('Добро пожаловать в джунгли! Дайте имя и выберите место 🌱'); return; }
  tab = 'plants'; closeSheet(); window.scrollTo(0, 0);
  toast(`Добавлено ${plantsN(ids.length)} 🌱 Откройте каждое, чтобы выбрать место`);
}

// Shown on tabs that need plants when there are none yet.
const emptyCard = (title, text) => `<div class="celebrate"><h2>${title}</h2><p class="muted">${text}</p>${quickStart()}</div>`;

function viewLight() {
  const ps = allPlants().sort((a, b) => b.luxRange[0] - a.luxRange[0] || b.luxRange[1] - a.luxRange[1]);
  const measured = ps.filter((p) => p.lux).length;
  if (!ps.length) {
    return `<header class="hello head-row"><div><h1>Свет</h1></div>${headButtons()}</header>
      ${emptyCard('Свет для каждого растения', 'Добавьте растения — покажу, кому сколько света нужно, а по замерам люксметром подскажу, кого переставить ближе к окну.')}`;
  }
  return `<header class="hello head-row"><div><h1>Свет</h1><div class="date">замерено ${measured} из ${ps.length}</div></div>${headButtons()}</header>
    <p class="small muted">Замеряйте люксметром у листьев днём, при обычном свете. Впишите цифру — подскажу, кому темно, а кого лучше переставить. Нет люксметра? Подойдёт приложение-люксметр для телефона, оно меряет примерно.</p>
    <div id="ideas">${lightIdeas()}</div>
    <h2>От самых светолюбивых</h2>
    ${ps.map(lightRow).join('')}`;
}

/* ---------- Rooms ---------- */
const roomOf = (p) => S.rooms.find((r) => r.id === p.room) || S.rooms[0];
const roomsN = (n) => `${n} ${plural(n, 'комната', 'комнаты', 'комнат')}`;

// One room: its reading, who is uncomfortable, and what suits everyone in it.
function roomCard(rm, ps, many) {
  const ranges = ps.map((p) => [p, tempRange(p)]).filter(([, t]) => t);
  const lo = Math.max(...ranges.map(([, t]) => t[0]));
  const hi = Math.min(...ranges.map(([, t]) => t[1]));
  const humidOnes = ps.filter((p) => p.humid).map((p) => p.title);
  const has = rm.t != null && rm.h != null;
  let status = '';
  if (has) {
    const notes = [];
    const cold = ranges.filter(([, t]) => rm.t < t[0]).map(([p]) => p.title);
    const hot = ranges.filter(([, t]) => rm.t > t[1]).map(([p]) => p.title);
    if (cold.length) notes.push(['snowflake', `Прохладно для: ${cold.join(', ')}. Уберите от холодного окна или включите обогреватель.`]);
    if (hot.length) notes.push(['flame', `Жарковато для: ${hot.join(', ')}. Проветрите или отодвиньте от батареи.`]);
    if (rm.h < 50) {
      notes.push(['droplet-off', `Сухо (${rm.h}%). Включите увлажнитель${humidOnes.length ? ` — особенно страдают ${humidOnes.join(', ')}` : ''}.`]);
    }
    if (rm.h > 75) notes.push(['droplets', `Очень влажно (${rm.h}%). Проветрите: сырость и застой воздуха — путь к грибкам, следите за сфагнумом.`]);
    status = notes.length
      ? notes.map(([i, n]) => `<div class="status warn">${I(i)}<span>${esc(n)}</span></div>`).join('')
      : ps.length ? `<div class="status ok">${I('smile')}<span>Всем комфортно. Так держать!</span></div>` : '';
  }
  const ago = has ? (rm.d === today() ? 'сегодня' : rel(rm.d)) : '';
  const name = esc(rm.name);
  const head = many ? `<div class="room-head"><div><h2>${name}</h2>
      <div class="small muted">${plantsN(ps.length)} · ${has ? 'замер: ' + esc(ago) : 'замеров пока нет'}</div></div>
      <button class="icon-btn" data-act="room-rename" data-room="${esc(rm.id)}" aria-label="Переименовать комнату ${name}">${I('pencil')}</button>
      <button class="icon-btn" data-act="room-del" data-room="${esc(rm.id)}" aria-label="Убрать комнату ${name}">${I('x')}</button></div>` : '';
  const comfort = !ranges.length ? '' : many
    ? `<p class="small muted mt-10">Удобно всем здесь: ${lo <= hi ? `${lo}–${hi} °C` : 'общего диапазона нет, смотрите карточки'}, влажность 50–70%.</p>`
    : `<h2>Чтобы было удобно всем</h2>
    <div class="info"><b>Температура</b>${lo <= hi ? `${lo}–${hi} °C — так комфортно всем вашим растениям.` : 'Общего диапазона нет — смотрите условия в карточках.'}</div>
    <div class="info"><b>Влажность</b>50–70%.${humidOnes.length ? ` Ниже — сохнут кончики листьев у: ${esc(humidOnes.join(', '))}.` : ''} Выше 75% без проветривания — риск грибков.</div>`;
  return `<section class="${many ? 'room' : ''}">${head}
    <div class="room-cards">
      <div class="metric"><div class="lbl">Температура</div><div class="val">${has ? esc(rm.t) + '°' : '—'}</div>
        <input class="input" id="in-t-${esc(rm.id)}" aria-label="Температура${many ? ', ' + name : ''}, °C" type="number" inputmode="decimal" step="0.5" placeholder="°C" value="${has ? rm.t : ''}"></div>
      <div class="metric"><div class="lbl">Влажность</div><div class="val">${has ? esc(rm.h) + '%' : '—'}</div>
        <input class="input" id="in-h-${esc(rm.id)}" aria-label="Влажность${many ? ', ' + name : ''}, %" type="number" inputmode="numeric" placeholder="%" value="${has ? rm.h : ''}"></div>
    </div>
    <button class="mt-10 btn primary wide" data-act="room-save" data-room="${esc(rm.id)}">Записать</button>
    ${status}
    ${many && !ps.length ? '<p class="small muted mt-10">Пока без растений. Выберите эту комнату в карточке растения.</p>' : ''}
    ${comfort}</section>`;
}

function viewRoom() {
  const ps = allPlants();
  const many = S.rooms.length > 1;
  const one = S.rooms[0];
  const date = many ? roomsN(S.rooms.length)
    : one.t != null ? 'замер: ' + (one.d === today() ? 'сегодня' : rel(one.d)) : 'замеров пока нет';
  return `<header class="hello head-row"><div><h1>${many ? 'Комнаты' : 'Комната'}</h1><div class="date">${esc(date)}</div></div>${headButtons()}</header>
    ${ps.length ? '' : emptyCard('Температура и влажность', 'Добавьте растения — подскажу, какая температура и влажность удобны именно им.')}
    <p class="small muted">Впишите, что показывает датчик — скажу, кому некомфортно.</p>
    ${S.rooms.map((rm) => roomCard(rm, ps.filter((p) => roomOf(p) === rm), many)).join('')}
    <button class="mt-12 btn ghost wide" data-act="room-add">Добавить комнату</button>
    ${many ? '' : '<p class="small muted mt-6">Растения в разных комнатах? Добавьте комнату — у каждой будет свой замер.</p>'}

    <h2>Если есть умный дом</h2>
    <p class="small muted">Например, в «Доме с Алисой» → Сценарии. Для условий по влажности и температуре датчик должен быть подключён к умному дому.</p>
    <div class="scenario"><span>${I('alarm-clock')}</span><div><b>Каждый день в 10:00</b> → Алиса говорит: «Пора заглянуть в Жунгли! Растения ждут»</div></div>
    <div class="scenario"><span>${I('droplets')}</span><div><b>Влажность ниже 50%</b> → включить увлажнитель</div></div>
    <div class="scenario"><span>${I('droplet-off')}</span><div><b>Влажность выше 70%</b> → выключить увлажнитель</div></div>
    <div class="scenario"><span>${I('flame')}</span><div><b>Температура ниже 21 °C</b> → включить обогреватель</div></div>
    <div class="scenario"><span>${I('snowflake')}</span><div><b>Температура выше 25 °C</b> → выключить обогреватель</div></div>
    <div class="scenario"><span>${I('lamp')}</span><div><b>Фитолампы через умную розетку, если есть:</b> включать в 8:00, выключать в 21:00 — 12–14 часов света в день, без ночного досвета.</div></div>`;
}

/* ---------- Settings and backup ---------- */
// Author line at the bottom of settings and «Что нового».
const AUTHOR = `Сделала Зарема · <a href="https://zmoki.xyz/" data-out="website" target="_blank" rel="noopener">zmoki.xyz</a> · <a href="privacy">Конфиденциальность</a><br>
      Идеи и баги — в Телеграм <a href="https://t.me/zmoki" data-out="telegram" target="_blank" rel="noopener">@zmoki</a>`;

// Header buttons: «Что нового» (with a dot when there are unseen changes) and settings.
const hasNews = () => CHANGELOG.some((e) => e.v > Number(S.seen || 0));
const headButtons = () => `<div class="head-btns">
  <button class="icon-btn ${hasNews() ? 'has-new' : ''}" data-act="news" aria-label="Что нового">${I('sparkles')}</button>
  <button class="icon-btn" data-act="settings" aria-label="Настройки">${I('settings')}</button></div>`;

function openNews() {
  const fresh = Number(APP_VERSION) >= CHANGELOG[0].v;
  const date = (d) => parse(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('sparkles')}</div><h2 class="m-0">Что нового</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="info"><b>Ваша версия</b>${esc(APP_VERSION)}${fresh ? ' — самая свежая' : ''}</div>
    ${CHANGELOG.map((e) => `<div class="news ${String(e.v) === APP_VERSION ? 'current' : ''}">
      <h3>Версия ${e.v}<span class="muted small"> · ${date(e.d)}</span></h3>
      <ul>${e.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}
    <p class="small muted credit" data-from="news">${AUTHOR}</p>`;
  track('news_opened', { had_new: hasNews() });
  S.seen = APP_VERSION;
  save();
  openSheet();
}

function openSettings() {
  const lim = S.settings.limit;
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('settings')}</div><h2 class="m-0">Настройки</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="field" role="group" aria-labelledby="lbl-limit"><label id="lbl-limit">Сколько растений проверять в день, максимум</label><div class="chips">
      ${[5, 7, 10, 15, 50].map((n) => `<button class="chip ${lim === n ? 'on' : ''}" data-act="limit" data-n="${n}">${n === 50 ? 'все' : n}</button>`).join('')}</div>
      <p class="mt-6 small muted">Остальные спокойно подождут до завтра — первыми покажу тех, кому нужнее.</p></div>
    <h2>Комнаты</h2>
    <p class="small muted">У каждой комнаты свой замер температуры и влажности. ${S.rooms.length > 1 ? 'Нажмите на комнату, чтобы убрать её — растения перейдут в первую.' : 'Нажмите, чтобы переименовать. Растения в разных комнатах? Добавьте ещё одну.'}</p>
    <div class="chips">${S.rooms.map((rm) => (S.rooms.length > 1
    ? `<button class="chip" data-act="room-del" data-room="${esc(rm.id)}" data-from="settings" aria-label="Убрать комнату ${esc(rm.name)}">${esc(rm.name)}${I('x')}</button>`
    : `<button class="chip" data-act="room-rename" data-room="${esc(rm.id)}" data-from="settings" aria-label="Переименовать комнату ${esc(rm.name)}">${esc(rm.name)}${I('pencil')}</button>`)).join('')}
      <button class="chip" data-act="room-add" data-from="settings">${I('plus')}комната</button></div>
    <h2>Места</h2>
    <p class="small muted">Где стоят растения. Нажмите на место, чтобы убрать его из списка.</p>
    <div class="chips">${S.spots.map((sp) => `<button class="chip" data-act="spot-del" data-spot="${esc(sp)}" aria-label="Убрать место ${esc(sp)}">${esc(sp)}${I('x')}</button>`).join('')}
      <button class="chip" data-act="spot-add">${I('plus')}место</button></div>
    <h2>Резервная копия</h2>
    <p class="small muted">Все отметки и фото живут только на этом телефоне. Раз в месяц сохраняйте копию в «Файлы» или отправляйте себе в Телеграм.</p>
    <div class="btns"><button class="btn ok" data-act="export">Сохранить копию</button><button class="btn" data-act="import">Восстановить</button></div>
    <h2>Статистика</h2>
    <div class="field"><label class="toggle"><input type="checkbox" id="stats-on" ${S.settings.stats === false ? '' : 'checked'}> Отправлять анонимную статистику</label>
      <p class="mt-6 small muted">Какие кнопки нажимают, версия приложения, тип телефона, страна и число растений — без названий, имён, заметок, фото и мест. Помогает понять, что улучшить. <a class="linkish" href="privacy">Подробнее</a></p>
      ${savedAnonId() ? `<p class="small muted">Номер устройства: <b>${esc(savedAnonId().slice(0, 8))}</b> — пригодится, если захотите удалить отправленную статистику.</p>` : ''}</div>
    <h2>Напоминание</h2>
    <p class="small muted">В iPhone: «Команды» → «Автоматизация» → «Время суток» → открыть приложение «Жунгли». Или попросите голосового помощника напоминать каждый день в 10 утра.</p>
    <button class="mt-24 btn danger wide" data-act="reset">Начать с чистого листа</button>
    <p class="small muted credit" data-from="settings">Версия ${esc(APP_VERSION)} · <button class="linkish" data-act="news">Что нового</button><br>${AUTHOR}</p>`;
  openSheet();
}

async function doExport() {
  const data = JSON.stringify({ app: 'zhungli', v: 1, at: new Date().toISOString(), state: S, photos: PHOTOS });
  const name = `zhungli-${today()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Жунгли — копия' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function doImport(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'zhungli' || !data.state) throw new Error('bad');
    if (!confirm('Заменить текущие данные копией от ' + new Date(data.at).toLocaleDateString('ru-RU') + '?')) return;
    S = prepare(data.state);
    save();
    await idbReq((st) => st.clear(), 'readwrite');
    const photos = Object.fromEntries(Object.entries(data.photos || {}).filter(([, url]) => isPhoto(url)));
    for (const [id, url] of Object.entries(photos)) await idbReq((st) => st.put(url, id), 'readwrite');
    const gone = Object.keys(PHOTOS).filter((id) => !photos[id]);
    PHOTOS = photos;
    // In the mini app, restored photos are the newest: they replace older ones in Telegram's cloud,
    // and photos the backup doesn't have are removed there too.
    if (window.photoChanged) Object.entries(photos).forEach(([id, url]) => window.photoChanged(id, url));
    if (window.photoRemoved) gone.forEach((id) => window.photoRemoved(id));
    closeSheet();
    track('backup_imported');
    toast('Готово, всё вернулось 🌿');
  } catch (e) {
    toast('Это не похоже на копию Жунглей 🤔');
  }
}

/* ---------- Photos (IndexedDB) ---------- */
// Photos are JPEG data URLs made by resize(); anything else (e.g. from a crafted backup) is dropped.
const isPhoto = (u) => typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u);
const photoOf = (id) => (isPhoto(PHOTOS[id]) ? PHOTOS[id] : null);
// Forgets a plant's photo on this device (memory and IndexedDB).
function dropPhoto(id) {
  delete PHOTOS[id];
  idbReq((st) => st.delete(id), 'readwrite').catch(() => {});
}
const dbp = new Promise((res, rej) => {
  if (!('indexedDB' in window)) return rej(new Error('no idb'));
  const r = indexedDB.open('zhungli', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('photos');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
function idbReq(fn, mode = 'readonly') {
  return dbp.then((d) => new Promise((res, rej) => {
    const req = fn(d.transaction('photos', mode).objectStore('photos'));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}
async function loadPhotos() {
  try {
    const [keys, vals] = await Promise.all([idbReq((s) => s.getAllKeys()), idbReq((s) => s.getAll())]);
    keys.forEach((k, i) => { if (isPhoto(vals[i])) PHOTOS[k] = vals[i]; });
    render();
  } catch (e) { /* works without photos too */ }
}
async function resize(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const k = Math.min(1, 640 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.82);
}
let photoFor = null;
$('#photo-input').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !photoFor) return;
  try {
    const url = await resize(f);
    PHOTOS[photoFor] = url;
    await idbReq((st) => st.put(url, photoFor), 'readwrite');
    if (window.photoChanged) window.photoChanged(photoFor, url);
    openPlant(photoFor);
    render();
    track('photo_added');
    toast('Красотка! 📸');
  } catch (err) { toast('Не получилось открыть фото'); }
});
$('#import-input').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) doImport(f);
});
$('#ai-file-input').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importFile(f);
});

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
// Catalog ids aren't personal (custom plants are sent as 'custom').
const kindOf = (id) => { const d = def(id), r = S.plants[id]; return { plant_kind: isCustom(id) ? 'custom' : d.id, plant_type: mediumIn(r, d), watering: wateringIn(r, d) || 'none', generic: !!d.generic }; };

/* ---------- UI ---------- */
const sheet = $('#sheet');
function openSheet() {
  const h = $('#sheet-body h2');
  if (h) sheet.setAttribute('aria-label', h.textContent); else sheet.removeAttribute('aria-label');
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
// Re-render here: the close event doesn't fire in every browser.
function closeSheet() { endAddFlow(); if (sheet.open) sheet.close(); render(); }
sheet.addEventListener('close', () => { endAddFlow(); render(); }); // closed by swipe, Esc or the close button
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

let toastTimer;
function toast(msg, undo) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = esc(msg) + (undo ? ' <button class="undo">Отменить</button>' : '');
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

const WATER_CHEERS = ['Напоено! 💧', 'Глоток счастья 💧', 'Кап-кап, спасибо! 💧'];
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
  if (tab === 'plants') filterPlants();
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

// Author links: send right away, the app may go to background.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-out]');
  if (a) { track('author_link_clicked', { target: a.dataset.out, from: a.closest('[data-from]')?.dataset.from || 'other' }); flushStats(); }
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
  if (el.dataset.open) { openPlant(el.dataset.open); return; }
  const id = el.dataset.id;
  const act = el.dataset.act;
  const otherWay = { 'add-plant': 'catalog', 'add-import': 'import', import: 'restore' }[act];
  if (otherWay) endQuick(otherWay);
  let undo;
  switch (act) {
    case 'water':
      undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', ...kindOf(id) });
      afterTask(WATER_CHEERS[Math.floor(Math.random() * WATER_CHEERS.length)], undo); break;
    case 'wet':
      undo = snapshot(); actWet(id); track('plant_checked', { answer: 'wet', ...kindOf(id) });
      afterTask(`Ок, загляну к ${plant(id).title} ${rel(S.plants[id].nextCheck)} 👌`, undo); break;
    case 'later':
      undo = snapshot(); actLater(id); track('plant_checked', { answer: 'later', ...kindOf(id) }); afterTask('Перенесено на завтра ⏭︎', undo); break;
    case 'vent-done':
      undo = snapshot(); S.plants[id].ventLast = today(); logToday({ id, a: 'vent' }); track('greenhouse_vented');
      afterTask('Свежий воздух! 🌬️', undo); break;
    case 'vent-off':
      if (confirm('Теплица больше не нужна? Больше не буду напоминать проветривать.')) {
        undo = snapshot(); S.plants[id].greenhouse = false; track('greenhouse_removed'); afterTask('Ура, без теплицы! 🎉', undo);
      }
      break;
    case 'bonus-done': {
      undo = snapshot();
      const b = bonusTasks().find((x) => x.key === el.dataset.key);
      bonusKeys(el.dataset.key).forEach((k) => { S.bonus[k] = today(); });
      track('bonus_done', { kind: el.dataset.key.split(':')[0] });
      logToday({ id: b?.p?.id, a: 'bonus:' + el.dataset.key, title: b?.title });
      afterTask('Бонус засчитан ✨', undo); break;
    }
    case 'bonus-skip':
      track('bonus_skipped', { kind: el.dataset.key.split(':')[0] });
      bonusKeys(el.dataset.key).forEach((k) => { S.snooze[k] = addDays(today(), 3); }); save(); render(); toast('Ок, через пару дней 🙂'); break;
    case 'show-all': showAll = true; track('show_all_clicked'); render(); break;
    case 'hide-install': S.hideInstall = true; track('install_hint_hidden'); save(); render(); break;
    case 'tg-home': if (window.tgHome) window.tgHome.add(); track('tg_home_screen_tapped'); break;
    case 'stats-ok': S.statsNotice = true; save(); render(); break;
    case 'stats-off':
      statsQueue = []; S.settings.stats = false; S.statsNotice = true; save(); render(); toast('Статистика выключена'); break;
    case 'open-mini-app': track('mini_app_link_clicked', { has_plants: Object.keys(S.plants).length > 0 }); flushStats(); break; // the link opens Telegram
    case 'hide-telegram': S.hideTelegram = true; track('telegram_hint_hidden'); save(); render(); break;
    case 'settings': openSettings(); break;
    case 'news': openNews(); break;
    case 'add-plant': openAdd(); break;
    case 'add-custom': openCustom(el.dataset.q || '', el.dataset.q ? 'search_miss' : 'button'); break;
    case 'add-import': openImport(); break;
    case 'import-file':
      // The file picker hides the app on phones: that's part of importing, not leaving (see visibilitychange).
      if (addFlow) addFlow.picking = true;
      $('#ai-file-input').click(); break;
    case 'import-copy': {
      if (addFlow) addFlow.promptCopied = true;
      copyPrompt(el, (how) => {
        track('import_prompt_copied', { how });
        if (!el.isConnected) return; // the sheet was closed (maybe reopened) meanwhile
        if (how === 'failed' || how === 'none') {
          showPrompt();
          el.textContent = 'Не скопировалось — текст ниже';
          $('#imp-status').textContent = 'Не скопировалось. Запрос показан ниже, скопируйте его вручную.';
          return;
        }
        el.innerHTML = `${I('check')}Скопировано`;
        $('#imp-status').textContent = 'Запрос скопирован';
        // Copying can still fail without a word (iPhone): the prompt itself is one tap away.
        $('#imp-manual').hidden = false;
      });
      el.focus();
      break;
    }
    case 'import-show': showPrompt(); track('import_prompt_shown'); break;
    case 'import-copy-again':
      copyPrompt(el, (how) => {
        track('import_prompt_copied', { how, from: 'again' });
        if (!el.isConnected) return;
        const ok = how === 'exec' || how === 'clipboard';
        el.innerHTML = ok ? `${I('check')}Скопировано` : 'Скопируйте из поля выше';
        $('#imp-status').textContent = ok ? 'Запрос скопирован' : 'Не скопировалось. Скопируйте текст из поля: «Выбрать все», затем «Скопировать».';
      });
      break;
    case 'import-pick': {
      const i = Number(el.dataset.i);
      if (importPicked.has(i)) importPicked.delete(i); else importPicked.add(i);
      if (addFlow) addFlow.picked = importPicked.size;
      el.classList.toggle('on', importPicked.has(i));
      el.querySelector('.pc').innerHTML = I(importPicked.has(i) ? 'check' : 'plus');
      updateImportBar(); break;
    }
    case 'import-add': addImported(); break;
    case 'pick': {
      const k = el.dataset.key;
      if (picked.has(k)) picked.delete(k); else picked.add(k);
      if (addFlow) addFlow.picked = picked.size;
      el.classList.toggle('on', picked.has(k));
      el.querySelector('.pc').innerHTML = I(picked.has(k) ? 'check' : 'plus');
      updatePickBar(); break;
    }
    case 'pick-add': {
      if (addFlow) addFlow.done = true;
      addFromCatalog([...picked], 'catalog'); break;
    }
    case 'qs-pick': {
      const k = el.dataset.key;
      if (qsPicked.has(k)) qsPicked.delete(k); else qsPicked.add(k);
      qsReported = false;
      el.classList.toggle('on', qsPicked.has(k));
      el.setAttribute('aria-pressed', qsPicked.has(k));
      setAddButton($('#qs-add'), qsPicked.size, 'Отметьте, что есть'); break;
    }
    case 'qs-add': {
      const keys = [...qsPicked];
      qsPicked = new Set();
      addFromCatalog(keys, 'quick'); break;
    }
    case 'spot-del': {
      const sp = el.dataset.spot;
      const there = Object.values(S.plants).filter((r) => r.spot === sp);
      if (there.length && !confirm(`Здесь ${plantsN(there.length)}. Убрать место «${sp}»? Растения останутся без места.`)) break;
      there.forEach((r) => { r.spot = ''; });
      S.spots = S.spots.filter((x) => x !== sp); save(); openSettings(); break;
    }
    case 'spot-add': {
      const sp = prompt('Как называется место?');
      if (sp && sp.trim() && !S.spots.includes(sp.trim())) { S.spots.push(sp.trim()); save(); openSettings(); }
      break;
    }
    case 'close': closeSheet(); break;
    case 'photo': photoFor = id; $('#photo-input').click(); break;
    case 'photo-remove':
      if (confirm('Убрать фото? Вместо него будет рисунок.')) {
        dropPhoto(id);
        if (window.photoRemoved) window.photoRemoved(id);
        openPlant(id);
        render();
        track('photo_removed');
        toast('Фото убрано');
      }
      break;
    case 'water-now':
      undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', from: 'card', ...kindOf(id) }); save(); closeSheet(); toast(actWords(plant(id)).done, undo); break;
    case 'spot':
      S.plants[id].spot = el.dataset.spot; save();
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    case 'spot-new': {
      const s = prompt('Как называется место?');
      if (s && s.trim()) { S.plants[id].spot = s.trim(); if (!S.spots.includes(s.trim())) S.spots.push(s.trim()); save(); openPlant(id); }
      break;
    }
    case 'note-edit': noteEdit = el.dataset.key; refreshCheat(id); break;
    case 'note-cancel': noteEdit = null; refreshCheat(id); break;
    case 'note-save':
    case 'note-del': {
      const key = el.dataset.key;
      const text = act === 'note-del' ? '' : $('#note-text').value.trim();
      if (act === 'note-del' && (key[0] === 'n' || !careOf(def(id), S.plants[id])[key]) && !confirm('Удалить заметку?')) break;
      const action = setNote(id, key, text);
      if (action) track('note_changed', { action, note: noteKind(key) });
      noteEdit = null; save(); refreshCheat(id); break;
    }
    case 'note-reset': {
      const r = S.plants[id];
      delete r.own[el.dataset.key];
      if (!Object.keys(r.own).length) delete r.own;
      track('note_changed', { action: 'reset', note: el.dataset.key });
      noteEdit = null; save(); refreshCheat(id); break;
    }
    case 'note-restore': {
      const r = S.plants[id];
      NOTE_KEYS.forEach(([k]) => { if (r.own && r.own[k] === '') delete r.own[k]; });
      if (r.own && !Object.keys(r.own).length) delete r.own;
      track('note_changed', { action: 'restore', note: 'catalog' });
      save(); refreshCheat(id); break;
    }
    case 'int-minus':
    case 'int-plus': {
      const r = S.plants[id];
      r.interval = clamp(Math.round(r.interval) + (act === 'int-plus' ? 1 : -1), 1, 60);
      if (r.lastWater) {
        const next = addDays(r.lastWater, r.interval);
        r.nextCheck = next < today() ? today() : next;
      }
      save();
      $('#int-val').textContent = days(r.interval); break;
    }
    case 'delete':
      if (confirm(`Убрать «${plant(id).title}» из коллекции?`)) {
        delete S.plants[id];
        dropPhoto(id);
        for (const k of BONUS_KINDS.map((x) => `${x}:${id}`)) { delete S.bonus[k]; delete S.snooze[k]; }
        // A custom plant's card is no longer needed.
        if (S.custom[id]) delete S.custom[id];
        track('plant_deleted');
        save(); closeSheet(); toast('Убрано 🍂');
      }
      break;
    case 'limit':
      S.settings.limit = Number(el.dataset.n); showAll = false; save(); track('limit_changed', { limit: S.settings.limit });
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    case 'export': doExport(); track('backup_exported'); break;
    case 'import': $('#import-input').click(); break;
    case 'reset':
      if (confirm('Точно стереть все отметки и начать заново? Фото тоже удалятся.')) {
        localStorage.removeItem(KEY);
        (window.cloudClear ? window.cloudClear() : Promise.resolve())
          .then(() => idbReq((st) => st.clear(), 'readwrite'))
          .finally(() => location.reload());
      }
      break;
    case 'room-save': {
      const rm = S.rooms.find((x) => x.id === el.dataset.room);
      if (!rm) break;
      const t = parseFloat(String($(`#in-t-${rm.id}`).value).replace(',', '.'));
      const h = parseFloat(String($(`#in-h-${rm.id}`).value).replace(',', '.'));
      if (Number.isNaN(t) || Number.isNaN(h)) { toast('Впишите обе цифры 🙂'); break; }
      Object.assign(rm, { t, h, d: today() }); save(); render(); toast('Записано 🌡️');
      track('room_saved', { temp: Math.round(t), humidity: Math.round(h), rooms: S.rooms.length }); break;
    }
    case 'room-add': {
      const name = (prompt('Как называется комната? Например, «Спальня» или «Кухня»') || '').trim();
      if (!name) break;
      S.rooms.push(newRoom('r' + Date.now().toString(36), name)); save(); render();
      if (el.dataset.from === 'settings') openSettings();
      toast('Комната добавлена. Выберите её в карточках растений 🪴');
      track('room_added', { rooms: S.rooms.length }); break;
    }
    case 'room-rename': {
      const rm = S.rooms.find((x) => x.id === el.dataset.room);
      const name = rm && (prompt('Новое название комнаты', rm.name) || '').trim();
      if (name) { rm.name = name; save(); render(); if (el.dataset.from === 'settings') openSettings(); }
      break;
    }
    case 'room-del': {
      const rm = S.rooms.find((x) => x.id === el.dataset.room);
      if (!rm || S.rooms.length < 2) break;
      const rest = S.rooms.filter((x) => x !== rm);
      if (!confirm(`Убрать комнату «${rm.name}»? Её растения перейдут в «${rest[0].name}».`)) break;
      Object.values(S.plants).forEach((r) => { if (roomOf(r) === rm) r.room = rest[0].id; });
      S.rooms = rest; save(); render();
      if (el.dataset.from === 'settings') openSettings();
      track('room_removed', { rooms: S.rooms.length }); break;
    }
    case 'st-filter':
      plantSt = el.dataset.st;
      el.parentElement.querySelectorAll('.st-chip').forEach((c) => { c.classList.toggle('on', c === el); c.setAttribute('aria-pressed', c === el); });
      filterPlants();
      track('plants_filtered', { status: plantSt || 'all' }); break;
    case 'room-pick':
      S.plants[id].room = el.dataset.room; save();
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    default: break;
  }
});

// Changes how a plant grows; returns what it was and whether that counts as a transplant, or null if nothing changed.
function setWay(id, medium, watering) {
  const r = S.plants[id], d = def(id);
  if (!MEDIA[medium]) return null;
  watering = !MEDIA[medium].pot ? null : WATERING[watering] ? watering : 'top';
  const from = { medium: mediumIn(r, d), watering: wateringIn(r, d) };
  if (from.medium === medium && from.watering === watering) return null;
  // The card's interval is kept while the plant grows another way, to come back to.
  if (isCardWay(r, d)) r.soilInterval = r.interval;
  // The old medium's recurring task (rinsing clay pebbles, a look at aquarium roots) goes with it.
  const oldCare = MEDIA[from.medium].care;
  if (oldCare && oldCare !== MEDIA[medium].care) { delete S.bonus[`${oldCare.kind}:${id}`]; delete S.snooze[`${oldCare.kind}:${id}`]; }
  // Own edits of tips written for the old way would hide the new way's: they become notes, so nothing typed is lost.
  const stale = medium !== from.medium ? ['water', 'soil'] : ['water'];
  if (r.own) stale.forEach((k) => { if (r.own[k] !== undefined) { if (r.own[k]) r.notes = [...(r.notes || []), r.own[k]]; delete r.own[k]; } });
  if (r.own && !Object.keys(r.own).length) delete r.own;
  delete r.medium; delete r.watering; delete r.wick;
  if (medium !== d.type) r.medium = medium;
  if (watering && watering !== (WATERING[d.watering] ? d.watering : 'top')) { if (watering === 'wick') r.wick = true; else r.watering = watering; }
  const base = r.soilInterval || d.every;
  if (isCardWay(r, d)) { r.interval = base; delete r.soilInterval; } else r.interval = (wayOf({ type: medium, watering }).start || ((b) => b))(base);
  r.wet = 0;
  r.nextCheck = addDays(today(), Math.round(r.interval));
  // Roots moved out of soil into a mineral medium, water or air need time: like after repotting, no feeding meanwhile.
  const settle = !!MEDIA[from.medium].organic && !MEDIA[medium].organic;
  if (settle) r.repotted = today();
  initBonus(S);
  return { from, settle };
}

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'stats-on') {
    if (!el.checked) statsQueue = [];
    S.settings.stats = el.checked;
    save();
    if (el.checked) track('stats_enabled');
    return;
  }
  const f = el.dataset && el.dataset.field;
  if (!f) return;
  const id = el.dataset.id;
  const r = S.plants[id];
  if (!r) return;
  if (f === 'name') { r.name = el.value.trim(); if (r.name) track('plant_named'); }
  if (f === 'species') {
    const v = el.value.trim();
    if (!v || v === def(id).species) delete r.species; else r.species = v;
    if (!v) el.value = def(id).species;
  }
  if (f === 'name' || f === 'species') {
    const p = plant(id);
    $('#sh-title').textContent = p.title;
    $('#sh-species').textContent = p.species;
  }
  if (f === 'repotted') { r.repotted = el.checked ? today() : false; $('#repot-hint').textContent = repotHint(r); }
  if (f === 'greenhouse') { r.greenhouse = el.checked; track('greenhouse_toggled', { on: el.checked }); }
  if (f === 'medium' || f === 'watering') {
    const d = def(id);
    const medium = f === 'medium' ? el.value : mediumIn(r, d);
    let watering = f === 'watering' ? el.value : wateringIn(r, d);
    // A medium with its own usual watering (clay pebbles on a reservoir) brings it along.
    // A medium with no watering (water, an aquarium) counts as from above here.
    if (f === 'medium' && MEDIA[medium].watering && (!watering || watering === 'top')) watering = MEDIA[medium].watering;
    const res = setWay(id, medium, watering);
    if (!res) return;
    const p = plant(id);
    // The selects stay in place (a new one would reopen its picker on iPhone); only what's around them changes.
    $('#watering-field').hidden = !MEDIA[p.type].pot;
    if (p.watering) $('#f-watering').value = p.watering;
    $('#way-note').innerHTML = wayNote(p, d);
    $('#water-box').innerHTML = waterBox(p);
    $('#int-field').hidden = !!wayOf(p).noChecks;
    $('#int-val').textContent = days(Math.round(r.interval));
    $('#int-hint').textContent = intHint(p);
    if (res.settle) {
      const box = $('[data-field="repotted"]');
      if (box) box.checked = true;
      $('#repot-hint').textContent = repotHint(r);
      toast('Это как пересадка: 6 недель без подкормки, пока корни привыкают');
    }
    noteEdit = null;
    refreshCheat(id);
    track('grow_changed', { medium: p.type, watering: p.watering || 'none', from_medium: res.from.medium, from_watering: res.from.watering || 'none', settle: res.settle });
  }
  if (f === 'lux') {
    const v = parseInt(el.value, 10);
    r.lux = Number.isFinite(v) && v > 0 ? v : null;
    if (r.lux) track('lux_entered', { from: tab === 'light' ? 'light_tab' : 'card' });
  }
  save();
  // The status and greenhouse badge on the card photo follow the toggle and the light reading right away.
  const badges = sheet.open && (f === 'greenhouse' || f === 'lux' || f === 'medium' || f === 'watering') && $('.hero-badges');
  if (badges) {
    const p = plant(id);
    badges.innerHTML = `${stateChips(p, true)}${ghBadge(p, true)}${growBadges(p, true)}`;
    const pic = $('.hero-pic');
    if (pic && !photoOf(id)) pic.innerHTML = plantSvg(p, mood(p)[2]);
  }
  if (f === 'lux' && tab === 'light' && !sheet.open) {
    // Update only the row and tips so focus isn't lost while typing.
    const row = document.getElementById('lux-' + id);
    if (row) {
      const tmp = document.createElement('div');
      tmp.innerHTML = lightRow(plant(id));
      const fresh = tmp.firstElementChild;
      for (const sel of ['.lux-pic', '.lux-state', '.lux-bar']) row.querySelector(sel).replaceWith(fresh.querySelector(sel));
      applySizes(row);
    }
    $('#ideas').innerHTML = lightIdeas();
    document.querySelector('.hello .date').textContent = `замерено ${allPlants().filter((p) => p.lux).length} из ${allPlants().length}`;
  }
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
    flushStats();
    return;
  }
  if (addFlow) addFlow.picking = false;
  if (Date.now() - lastOpen > 30 * 60 * 1000) track('app_opened', { how: 'resume' });
  lastOpen = Date.now();
  checkUpdate();
  if (!sheet.open) render();
});

// iOS 26, home-screen app or Telegram mini app: after the keyboard closes, the viewport can stay as
// short as it was with the keyboard up, so the tab bar floats mid-screen and sheets end early, until
// the app is restarted. When the height is stuck, hiding and showing the whole page for one reflow
// makes iOS measure it again. The tallest height seen per width tells "stuck" from a rotation.
// Not in Safari: its toolbars change the height on their own.
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

save();
booting = false;
render();
loadPhotos();
checkUpdate();
track('app_opened', { how: 'start' });
