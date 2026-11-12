/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Saved state: growing media and watering ways, load, migrations and save, plant data, tasks and answers. Photos in IndexedDB.

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
// On Android and computers the browser and the installed app share storage, so another window can
// save newer data. `stored` is what this window last read or wrote: anything else came from there.
let stored = null;
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
  stored = readStored();
  let raw = null;
  try { raw = JSON.parse(stored); } catch (e) { /* empty */ }
  return prepare(raw);
}

function readStored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
function store() {
  const json = JSON.stringify(S);
  localStorage.setItem(KEY, json);
  stored = json;
}
// Takes the other window's data instead of saving over it.
function adoptStored(json, dropped) {
  stored = json;
  let raw = null;
  try { raw = JSON.parse(json); } catch (e) { /* empty */ }
  S = prepare(raw);
  if (dropped) track('tab_synced');
  // An undo here would bring back this window's old data over the new one.
  if (document.querySelector('.toast .undo')) document.querySelector('.toast').remove();
  if (sheet.open) closeSheet(); else render();
  if (dropped) toast('Жунгли открыты ещё в одном окне — показываю свежие данные. Повторите последнее действие.');
  loadPhotos(true);
}
// Thrown after a refused save, so the rest of that action doesn't run on the other window's data.
const STALE = Object.assign(new Error('stale window'), { stale: true });
// A hidden window catches up when it's shown, not on every save in the other one.
const catchUp = () => { if (!document.hidden && readStored() !== stored) adoptStored(readStored(), false); };
addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) catchUp(); });
document.addEventListener('visibilitychange', catchUp);

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
  const now = readStored();
  if (now !== stored) { // this window is stale
    adoptStored(now, true);
    if (booting) return;
    throw STALE;
  }
  try { store(); } catch (e) { toast('Не получилось сохранить 😢'); }
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
        hint: `Кого: ${who.map((p) => p.title).join(', ')}. Недавно пересаженных и больных не кормите.` });
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

/* ---------- Photos (IndexedDB) ---------- */
// Photos are JPEG data URLs made by resize(); anything else (e.g. from a crafted backup) is dropped.
const isPhoto = (u) => typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u);
// Pages show photos by short blob: links, made once per photo: putting ~100 KB data URLs into the HTML
// made every render of a photo-heavy list parse megabytes of text and decode each image again.
const photoUrls = {}; // id → { src (the data URL), url }
let oldPhotoUrls = []; // links of changed or removed photos, revoked once render() has redrawn the page
function photoOf(id) {
  const src = PHOTOS[id], c = photoUrls[id];
  if (c && c.src === src) { c.src = src; return c.url; } // same photo read again: keep one copy of its text
  if (c) { oldPhotoUrls.push(c.url); delete photoUrls[id]; }
  if (!isPhoto(src)) return null;
  try {
    const comma = src.indexOf(','), bin = atob(src.slice(comma + 1)), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    photoUrls[id] = { src, url: URL.createObjectURL(new Blob([bytes], { type: src.slice(5, src.indexOf(';')) })) };
    return photoUrls[id].url;
  } catch (e) { return src; }
}
// Called by render() after it replaced the page: images there use the current links.
// The plant card redraws its own picture when a photo changes (heroPhotoChanged).
function revokeOldPhotos() {
  oldPhotoUrls.forEach((u) => URL.revokeObjectURL(u));
  oldPhotoUrls = [];
}
// After PHOTOS is filled or replaced: retires the links of photos that are gone, and makes the missing
// ones one per task, so the first tap that shows them doesn't wait and no single task gets long.
// The next render() makes the ones it shows right away.
let prepTimer = 0;
function preparePhotos() {
  Object.keys(photoUrls).forEach((id) => { if (!PHOTOS[id]) photoOf(id); });
  const ids = Object.keys(PHOTOS);
  clearTimeout(prepTimer);
  const next = () => { if (ids.length) { photoOf(ids.shift()); prepTimer = setTimeout(next, 0); } };
  prepTimer = setTimeout(next, 0);
}
// Forgets a plant's photo on this device (memory and IndexedDB).
function dropPhoto(id) {
  delete PHOTOS[id];
  photoOf(id); // retires its blob: link
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
// `replace`: another window changed the data, so photos it removed go too. At launch, a photo that
// arrived meanwhile (Telegram sync) is newer than the stored one and stays.
async function loadPhotos(replace) {
  try {
    const [keys, vals] = await Promise.all([idbReq((s) => s.getAllKeys()), idbReq((s) => s.getAll())]);
    const fresh = {};
    keys.forEach((k, i) => { if (isPhoto(vals[i])) fresh[k] = vals[i]; });
    // Swapped in at once: a render in between still has every photo.
    PHOTOS = replace ? fresh : { ...fresh, ...PHOTOS };
    preparePhotos();
    render();
  } catch (e) { /* works without photos too */ }
}
