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
const kLux = (n) => `${(n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс`;
const shortDate = (s) => parse(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

/* ---------- State ---------- */
const GENERIC_QUIPS = ['Я новенькая, приятно познакомиться!', 'Посмотрите на меня внимательно 👀', 'Я тут, я расту!'];
const TYPE_LABELS = {
  soil: ['Сухо, полито', 'Ещё влажно'],
  sphagnum: ['Сухо, полито', 'Ещё влажно'],
  dry: ['Сухо, полито', 'Ещё влажно'],
  bark: ['Да, полито', 'Ещё рано'],
  water: ['Вода сменена', 'Вода ещё чистая'],
};
const TYPE_NAMES = { soil: 'Грунт', sphagnum: 'Сфагнум', bark: 'Кора (орхидеи)', dry: 'Сушить почти полностью', water: 'Черенки в воде' };

let booting = true;
let S = load();
let tab = 'today';
let showAll = false;
let PHOTOS = {};

function blank() {
  return {
    v: 2, plants: {}, custom: {}, bonus: {}, snooze: {}, room: null, log: {},
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
  if (!raw) s.seen = APP_VERSION; // new users have nothing to catch up on
  s.v = 2;
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

function initBonus(s) {
  const t = today();
  Object.keys(s.plants).forEach((id, i) => {
    const d = defIn(s, id);
    if (!d) return;
    if (d.big && !s.bonus['dust:' + id]) s.bonus['dust:' + id] = addDays(t, -19 + 2 * (i % 8));
    if (d.rotate && !s.bonus['rotate:' + id]) s.bonus['rotate:' + id] = addDays(t, -10);
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
  return { ...d, ...(r.own || {}), ...r, id, species, title: r.name || species, luxRange: d.lux, lux: r.lux };
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

function quipOf(p) {
  const q = p.quips && p.quips.length ? p.quips : GENERIC_QUIPS;
  let h = 0;
  for (const c of p.id + today()) h = (h * 31 + c.charCodeAt(0)) | 0;
  return q[Math.abs(h) % q.length];
}

function lightStatus(p) {
  if (!p.lux) return null;
  if (p.lux < p.luxRange[0]) return 'low';
  if (p.lux > p.luxRange[1] * 1.25) return 'high';
  return 'ok';
}

// Light status words, the same in the plant card, the cards grid and the Light tab.
const LIGHT_WORDS = { low: 'темновато', high: 'ярковато', ok: 'света хватает' };
function mood(p) {
  const t = today();
  // Each status has its own color: watered blue, waiting amber, dark grey, too bright red, fine green.
  if (p.lastWater === t) return ['laugh', 'напоено', 'watered'];
  if (p.nextCheck <= t) return ['frown', 'проверить', 'need'];
  const ls = lightStatus(p);
  if (ls === 'low') return ['meh', LIGHT_WORDS.low, 'dim'];
  if (ls === 'high') return ['annoyed', LIGHT_WORDS.high, 'hot'];
  return ['smile', 'хорошо', 'fine'];
}

function tempRange(p) {
  const m = /(\d+)\s*–\s*(\d+)\s*°C/.exec(p.cond || '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const spotIdx = (s) => { const i = S.spots.indexOf(s); return i === -1 ? (s ? S.spots.length : 99) : i; };
const bySpot = (a, b) => spotIdx(a.spot) - spotIdx(b.spot) || a.title.localeCompare(b.title, 'ru');

/* ---------- Tasks ---------- */
function priority(p) {
  const overdue = diff(p.nextCheck, today());
  const thirsty = p.type === 'sphagnum' || p.type === 'water' || p.interval <= 3 ? 0.3 : 0;
  return overdue / Math.max(1, p.interval) + thirsty;
}

function dueChecks() {
  const t = today();
  return allPlants().filter((p) => p.nextCheck <= t).sort((a, b) => priority(b) - priority(a));
}

function ventDue() {
  return allPlants().filter((p) => p.greenhouse && p.ventLast !== today());
}

function bonusTasks() {
  const t = today();
  const out = [];
  const snoozed = (k) => S.snooze[k] && S.snooze[k] > t;
  allPlants().forEach((p) => {
    const dk = 'dust:' + p.id;
    if (p.big && S.bonus[dk] && diff(S.bonus[dk], t) >= 21 && !snoozed(dk)) {
      out.push({ key: dk, p, title: `Протрите листья: ${p.title}`, sub: 'Мягкой влажной салфеткой, сверху и снизу. Блестящие листья лучше «едят» свет.' });
    }
    const rk = 'rotate:' + p.id;
    if (p.rotate && S.bonus[rk] && diff(S.bonus[rk], t) >= 14 && !snoozed(rk)) {
      out.push({ key: rk, p, title: `Поверните на четверть оборота: ${p.title}`, sub: 'Чтобы росла ровно, а не тянулась в одну сторону. Постепенно, без резких разворотов.' });
    }
  });
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 9 && diff(S.bonus.feed, t) >= 14 && !snoozed('feed')) {
    const who = allPlants().filter((p) => !p.noFeed && !p.repotted && p.type !== 'dry' && p.type !== 'bark' && p.type !== 'water');
    if (who.length) out.push({ key: 'feed', icon: 'utensils', title: 'День подкормки', sub: `По инструкции к удобрению, в мокрый грунт: ${who.map((p) => p.title).join(', ')}. Не кормим недавно пересаженных и больных.` });
  }
  return out.slice(0, 2);
}

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
    r.interval = clamp(iv, Math.max(1, d.every * 0.4), d.every * 3);
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
const ghBadge = (p) => (p.greenhouse ? `<span class="gh" title="В тепличке">${I('warehouse')}<span class="sr-only">в тепличке</span></span>` : '');

function ava(p, cls = 'ava') {
  const inner = photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p, mood(p)[2]);
  return `<button class="${cls}" data-open="${esc(p.id)}" aria-label="Открыть ${esc(p.title)}">${inner}</button>`;
}

// Hint cards on «Сегодня»: same layout, at most one at a time.
// Priority: Telegram's browser, then the stats notice (opt-out), then «add to home screen».
const hintCard = (icon, title, text, buttons) => `<div class="task bonus"><b>${I(icon)}${title}</b>
  <p class="mt-6 small muted">${text}</p>
  <div class="btns hint-btns">${buttons}</div></div>`;
function currentHint() {
  // Telegram's in-app browser loses data: offer the mini app (its plants live in Telegram's cloud).
  if (IN_TELEGRAM && !MINI_APP && !S.hideTelegram) {
    const open = `<a class="btn ok" href="${MINI_APP_LINK}" data-act="open-mini-app">${I('sprout')}Открыть</a>`;
    if (!Object.keys(S.plants).length) {
      return hintCard('triangle-alert', 'Откройте Жунгли как приложение Телеграма',
        'Здесь, во встроенном браузере, растения могут потеряться. В приложении Телеграма они сохраняются в облаке и появятся на любом телефоне.',
        `${open}<button class="btn ghost" data-act="hide-telegram">Понятно</button>`);
    }
    return hintCard('triangle-alert', 'Растения здесь могут потеряться',
      'Это встроенный браузер Телеграма. Перенесите их в приложение Телеграма: «Настройки» → «Сохранить копию» здесь, затем «Восстановить» там.',
      `${open}<button class="btn ghost" data-act="hide-telegram">Понятно</button>`);
  }
  if (!S.statsNotice && S.settings.stats !== false) {
    return hintCard('lightbulb', 'Анонимная статистика',
      'Чтобы понять, что улучшить, Жунгли отправляют, какие кнопки нажимают, — без названий, заметок и фото. <a class="linkish" href="privacy">Подробнее</a>',
      '<button class="btn" data-act="stats-ok">Понятно</button><button class="btn ghost" data-act="stats-off">Выключить</button>');
  }
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

function viewToday() {
  const t = today();
  const { log, shown, vents, pending, doneMain, waiting, total } = todayPlan();
  const pct = total ? Math.round((doneMain / total) * 100) : 100;
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<header class="hello head-row"><div><h1>${greeting()}!</h1><div class="date">${esc(date)}</div></div>
    ${headButtons()}</header>`;

  html += currentHint();

  if (!allPlants().length) {
    return html + `<div class="celebrate"><div class="big">🌱</div><h2>Привет! Это Жунгли</h2>
      <p class="muted">Каждый день покажу пару растений, которые пора проверить, и запомню, как быстро сохнет каждое. Без долгов и красных просрочек.</p>
      <button class="mt-14 btn primary wide" data-act="add-plant">${I('plus')}Добавить растения</button>
      <p class="mt-12 small muted">Уже вели Жунгли на другом телефоне? <button class="linkish" data-act="import">Восстановить копию</button></p></div>`;
  }

  if (total > 0) {
    html += `<div class="progress"><div class="head-row"><b>${pending ? `Осталось ${pending} ${plural(pending, 'дело', 'дела', 'дел')}` : 'Всё на сегодня!'}</b>
      <span class="muted small">${doneMain} из ${total}</span></div><div class="bar"><i data-w="${pct}"></i></div></div>`;
  }

  vents.forEach((v) => {
    html += `<div class="task"><div class="task-top">${ava(v)}<div><div class="task-name">Проветрите тепличку: ${esc(v.title)}</div>
      <div class="task-sub">минут на 15–30</div></div></div>
      <p class="quip">${esc(`${v.name ? `Это ${v.name}. ` : ''}Приоткройте, дайте подышать. С каждым днём можно чуть дольше.`)}</p>
      <div class="mt-12 btns"><button class="btn ok" data-act="vent-done" data-id="${esc(v.id)}">${I('wind')}Проветрено</button>
      <button class="btn" data-act="vent-off" data-id="${esc(v.id)}">Без теплички</button></div></div>`;
  });

  shown.forEach((p) => {
    const [yes, no] = TYPE_LABELS[p.type] || TYPE_LABELS.soil;
    const q = p.check || CHECK_TEXT[p.type] || CHECK_TEXT.soil;
    const last = p.lastWater ? `полив ${rel(p.lastWater)}` : '';
    const sub = [p.name ? p.species : '', p.spot, last].filter(Boolean).join(' · ');
    html += `<div class="task"><div class="task-top">${ava(p)}<div><div class="task-name">${esc(p.title)}</div>
      <div class="task-sub">${esc(sub)}</div></div></div>
      <p class="quip">${esc(quipOf(p))}</p>
      <div class="question">${esc(q)}</div>
      <div class="btns"><button class="btn water" data-act="water" data-id="${esc(p.id)}">${I('droplet')}${yes}</button>
      <button class="btn ok" data-act="wet" data-id="${esc(p.id)}">${I('check')}${no}</button></div>
      <div class="hint">${esc(p.water || '')}</div>
      <button class="later" data-act="later" data-id="${esc(p.id)}">${I('skip-forward')}Не сейчас, завтра</button></div>`;
  });

  if (!pending) {
    if (doneMain) {
      html += `<div class="celebrate"><div class="big">🎉</div><h2>Джунгли довольны!</h2>
        <p class="muted">Вы сегодня молодец. Остальное — завтра.</p></div>`;
    } else {
      const tom = allPlants().filter((p) => p.nextCheck === addDays(t, 1)).length;
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
      html += `<div class="task bonus"><div class="task-top">${b.p ? ava(b.p) : `<div class="ava" aria-hidden="true">${I(b.icon)}</div>`}<div>
        <div class="task-name">${esc(b.title)}</div></div></div><p class="bonus-sub small muted">${esc(b.sub)}</p>
        <div class="btns"><button class="btn ok" data-act="bonus-done" data-key="${esc(b.key)}">${I('check')}Готово</button>
        <button class="btn ghost" data-act="bonus-skip" data-key="${esc(b.key)}">Не сегодня</button></div></div>`;
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
    <button class="btn primary wide" data-act="add-plant">${I('plus')}Добавить растения</button>`;
  if (!ps.length) html += `<p class="empty-note muted">Пока пусто. Добавьте первое растение — и джунгли начнутся 🌱</p>`;
  const groups = {};
  ps.sort(bySpot).forEach((p) => { (groups[p.spot || ''] ||= []).push(p); });
  Object.keys(groups).sort((a, b) => spotIdx(a) - spotIdx(b)).forEach((spot) => {
    html += `<div class="group-title">${esc(spot || 'Место не выбрано')}</div><div class="grid">`;
    groups[spot].forEach((p) => {
      const [mi, mt, mc] = mood(p);
      const ph = photoOf(p.id);
      const pic = ph ? `<img class="fill" src="${ph}" alt=""><img src="${ph}" alt="">` : plantSvg(p, mc);
      html += `<button class="pcard" data-open="${esc(p.id)}"><div class="pic">${pic}<span class="badges"><span class="mood ${mc}">${I(mi)}${esc(mt)}</span>${ghBadge(p)}</span></div>
        <b>${esc(p.title)}</b><small>${p.name ? esc(p.species) + '<br>' : ''}проверка ${esc(rel(p.nextCheck))}</small></button>`;
    });
    html += `</div>`;
  });
  return html;
}

// Cheat sheet: catalog tips (edits and removals go to r.own, '' = removed)
// plus the user's own notes in r.notes.
const NOTE_KEYS = [['water', 'Как поливать'], ['soil', 'Субстрат'], ['cond', 'Условия'], ['tip', 'Важно']];
const NOTE_ICONS = { water: 'droplet', soil: 'shovel', cond: 'thermometer', tip: 'lightbulb' };
let noteEdit = null; // key of the note being edited: 'water' … 'tip', 'n0' … or 'new'
const isCustom = (id) => !!S.custom[(S.plants[id] && S.plants[id].def) || id];

function cheatHtml(id) {
  const p = plant(id), r = S.plants[id], d = def(id);
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
  const cat = def(id)[key] || '';
  // '' hides a catalog tip; a personal tip with nothing behind it is simply dropped.
  if (text === cat || (!text && !cat)) delete r.own[key]; else r.own[key] = text;
  if (!Object.keys(r.own).length) delete r.own;
  return text ? 'edit' : 'remove';
}
const noteKind = (key) => (key === 'new' || key[0] === 'n' ? 'own' : key);

function openPlant(id) {
  const p = plant(id);
  if (!p) return;
  noteEdit = null;
  const [mi, mt, mc] = mood(p);
  const ls = lightStatus(p);
  const histHtml = p.hist.slice(0, 8).map((h) => `${shortDate(h.d)} — ${h.a === 'water' ? 'полив' : 'ещё влажно'}`).join('<br>');
  const spots = [...new Set([...S.spots, ...allPlants().map((x) => x.spot).filter(Boolean)])];
  const ph = photoOf(p.id);
  const pic = ph ? `<img class="fill" src="${ph}" alt=""><img src="${ph}" alt="">` : plantSvg(p, mc);
  const tr = tempRange(p);
  $('#sheet-body').innerHTML = `
    <div class="hero-bar"><button class="icon-btn hero-close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="hero"><div class="hero-pic">${pic}</div>
      <button class="hero-photo" data-act="photo" data-id="${esc(id)}">${I('camera')}${ph ? 'Другое фото' : 'Фото'}</button>
      <span class="hero-badges"><span class="mood hero-mood ${mc}">${I(mi)}${esc(mt)}</span>${ghBadge(p)}</span></div>
    <div class="sheet-main">
    <div class="hero-text"><h2 class="m-0" id="sh-title">${esc(p.title)}</h2><div class="muted small" id="sh-species">${esc(p.species)}</div></div>
    <p class="quip">${esc(quipOf(p))}</p>
    <div class="info water"><b>Полив</b>Последний: ${esc(rel(p.lastWater))} · следующая проверка: ${esc(rel(p.nextCheck))}</div>
    <button class="water-now btn water wide" data-act="water-now" data-id="${esc(id)}">${I('droplet')}Записать полив</button>

    <div class="field"><label for="f-name">Имя</label><input class="input" id="f-name" data-field="name" data-id="${esc(id)}" value="${esc(p.name)}" placeholder="Придумайте имя, например Коля" maxlength="40"></div>
    <div class="field"><label for="f-species">Название (вид, сорт)</label><input class="input" id="f-species" data-field="species" data-id="${esc(id)}" value="${esc(p.species)}" placeholder="${esc(def(id).species)}" maxlength="80">
      ${S.plants[id].species ? `<p class="mt-6 small muted">В каталоге: ${esc(def(id).species)}. Сотрите поле, чтобы вернуть.</p>` : ''}</div>

    <div class="field" role="group" aria-labelledby="lbl-spot"><label id="lbl-spot">Где стоит</label><div class="chips">
      ${spots.map((s) => `<button class="chip ${p.spot === s ? 'on' : ''}" data-act="spot" data-id="${esc(id)}" data-spot="${esc(s)}">${esc(s)}</button>`).join('')}
      <button class="chip" data-act="spot-new" data-id="${esc(id)}">${I('plus')}место</button></div></div>

    <div class="field"><label for="f-lux">Свет: нужно ${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} ${LK}${tr ? ` · ${tr[0]}–${tr[1]} °C` : ''}</label>
      <input class="input" type="number" inputmode="numeric" id="f-lux" placeholder="Замер люксметром, люкс" data-field="lux" data-id="${esc(id)}" value="${p.lux ?? ''}">
      ${ls ? `<p class="mt-6 small"><span class="tag ${ls}">${LIGHT_WORDS[ls]}</span></p>` : ''}</div>
    <div class="field" role="group" aria-labelledby="lbl-int"><label id="lbl-int">Проверять примерно каждые</label><div class="stepper">
      <button data-act="int-minus" data-id="${esc(id)}" aria-label="Чаще">${I('minus')}</button><b id="int-val">${days(Math.round(p.interval))}</b>
      <button data-act="int-plus" data-id="${esc(id)}" aria-label="Реже">${I('plus')}</button></div>
      <p class="mt-6 small muted">Подстраивается само по вашим ответам «сухо / влажно».</p></div>

    <div class="field"><label class="toggle"><input type="checkbox" data-field="repotted" data-id="${esc(id)}" ${p.repotted ? 'checked' : ''}> Недавно пересажено — без подкормки</label></div>
    <div class="field"><label class="toggle"><input type="checkbox" data-field="greenhouse" data-id="${esc(id)}" ${p.greenhouse ? 'checked' : ''}> В тепличке — напоминать проветривать</label></div>

    <h2>Шпаргалка</h2>
    <p class="mt-n4 small muted">Нажмите на совет, чтобы поправить или удалить.</p>
    <div id="cheat">${cheatHtml(id)}</div>
    ${histHtml ? `<h2>История</h2><p class="history">${histHtml}</p>` : ''}
    <button class="mt-20 btn danger wide" data-act="delete" data-id="${esc(id)}">Убрать из коллекции</button></div>`;
  openSheet();
}

// Catalog picker: several plants can be selected at once.
let picked = new Set();
function pickRow(d) {
  const meta = `${d.hint ? esc(d.hint) + ' · ' : ''}свет ${kLux(d.lux[0])}–${kLux(d.lux[1])} ${LK}`;
  return `<button class="pick" data-act="pick" data-key="${esc(d.id)}" data-q="${esc((d.species + ' ' + (d.hint || '') + ' ' + d.cat).toLowerCase())}">
    <span class="pe" aria-hidden="true">${plantSvg(d, 'fine')}</span><span class="pt"><b>${esc(d.species)}</b><small>${meta}</small></span><span class="pc" aria-hidden="true">${I('plus')}</span></button>`;
}
// What happens in the add flow, reported once when the sheet closes without adding.
let addFlow = null;
function startAddFlow(sheetName) {
  if (!addFlow) addFlow = { sheet: sheetName, searched: false, no_results: false, picked: 0, done: false };
  addFlow.sheet = sheetName;
}
function endAddFlow(leftApp = false) {
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
  const cats = Object.keys(groups).sort((a, b) => (a === 'Общие типы') - (b === 'Общие типы'));
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('sprout')}</div><h2 class="m-0">Добавить растения</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <button class="import-cta" data-act="add-import"><span class="pe" aria-hidden="true">${I('bot')}</span>
      <span class="pt"><b>Сразу много — из чата с ИИ</b><small>Спросите ChatGPT, Claude, Gemini или другого ИИ-помощника о своих растениях и перенесите ответ сюда — вместе с советами по уходу.</small></span>
      <span class="pc" aria-hidden="true">${I('chevron-right')}</span></button>
    <div class="or">или выберите из каталога</div>
    <input class="input" id="pick-q" type="search" aria-label="Поиск растений" placeholder="Поиск: монстера, кактус, фиалка…" autocomplete="off">
    <p class="pick-help small muted">Отметьте все свои растения. Если вашего нет — выберите похожий общий тип.</p>
    ${cats.map((c) => `<div class="pick-group"><div class="group-title">${c === 'Общие типы' ? 'Общие типы — если нет в списке' : esc(c)}</div>
      ${groups[c].map(pickRow).join('')}</div>`).join('')}
    <p id="pick-none" class="muted small" hidden>Ничего не нашлось. Выберите общий тип или создайте своё.</p>
    <button class="mt-12 btn ghost wide" data-act="add-custom">${I('pencil')}Своё растение с нуля</button>
    <div class="pick-bar"><button class="btn primary wide" data-act="pick-add" id="pick-add" disabled>Отметьте растения</button></div>`;
  $('#pick-q').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let any = false;
    document.querySelectorAll('.pick-group').forEach((g) => {
      let n = 0;
      g.querySelectorAll('.pick').forEach((b) => { const on = !q || b.dataset.q.includes(q); b.hidden = !on; if (on) n++; });
      g.hidden = !n; any ||= n > 0;
    });
    if (q) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (addFlow) { addFlow.searched = true; addFlow.no_results = !any; }
        track('catalog_searched', { found: any });
      }, 1200);
    }
    $('#pick-none').hidden = any;
  });
  openSheet();
}
// «Добавить N растений» at the bottom of the catalog and the import list.
function setAddButton(b, n, emptyText) {
  b.disabled = !n;
  b.innerHTML = n ? `${I('plus')}Добавить ${plantsN(n)}` : emptyText;
}
const updatePickBar = () => setAddButton($('#pick-add'), picked.size, 'Отметьте растения');

function openCustom() {
  startAddFlow('custom');
  track('custom_opened');
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('pencil')}</div><h2 class="m-0">Новое растение</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <form id="add-form">
      <div class="field"><label for="c-species">Что это за растение</label><input class="input" id="c-species" name="species" required placeholder="Например, Пеперомия"></div>
      <div class="field"><label for="c-name">Имя (если есть)</label><input class="input" id="c-name" name="name" placeholder="Например, Пепа"></div>
      <div class="field"><label for="c-type">В чём растёт</label><select class="input" id="c-type" name="type">
        ${Object.entries(TYPE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label id="lbl-lux">Сколько света нужно, ${LK}</label><div class="row2">
        <input class="input" name="lmin" aria-label="Света от, люкс" type="number" inputmode="numeric" value="6000" placeholder="от">
        <input class="input" name="lmax" aria-label="Света до, люкс" type="number" inputmode="numeric" value="15000" placeholder="до"></div></div>
      <div class="field"><label for="c-every">Проверять каждые … дней</label><input class="input" id="c-every" name="every" type="number" inputmode="numeric" value="6" min="1" max="60"></div>
      <div class="field"><label for="c-tip">Шпаргалка (по желанию)</label><textarea class="input" id="c-tip" name="tip" rows="3" placeholder="Что важно помнить"></textarea></div>
      <button class="btn primary wide" type="submit">${I('plus')}Добавить</button>
    </form>`;
  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (addFlow) addFlow.done = true;
    const f = new FormData(e.target);
    const id = newId('c');
    const every = clamp(Number(f.get('every')) || 6, 1, 60);
    const lmin = Number(f.get('lmin')) || 5000;
    const lmax = Math.max(lmin, Number(f.get('lmax')) || 15000);
    S.custom[id] = {
      id, species: String(f.get('species')).trim() || 'Растение', cat: 'Мои', emoji: '🪴',
      lux: [lmin, lmax], every, type: f.get('type'), tip: String(f.get('tip')).trim(), quips: GENERIC_QUIPS,
    };
    S.plants[id] = runtime(S.custom[id], today());
    S.plants[id].name = String(f.get('name')).trim();
    save();
    closeSheet();
    track('plants_added', { count: 1, generic_count: 0, source: 'custom', plant_type: S.custom[id].type });
    toast('Добро пожаловать в джунгли! 🌱');
  });
  openSheet();
}

/* ---------- Import from an AI chat ---------- */
// The user copies a prompt into ChatGPT/Claude, pastes the JSON answer back,
// and the plants become custom plants with their care tips.
const IMPORT_PROMPT = `Сделай список моих растений для приложения «Жунгли». Возьми растения, о которых мы говорили в этом чате (если непонятно, какие, — спроси меня).

Ответь только JSON-массивом, без пояснений: обычные двойные кавычки, числа без пробелов. Один объект на растение, поля:
- species — вид или сорт по-русски
- name — имя, если оно есть у растения, иначе ""
- type — в чём растёт: "soil" (грунт), "sphagnum" (сфагнум), "bark" (кора, орхидеи), "dry" (сушить почти полностью: суккуленты, кактусы), "water" (черенки в воде)
- lux — сколько света нужно, люксы: [от, до]
- every — через сколько дней обычно проверять почву
- check — вопрос при проверке, например "Верхние 2–3 см сухие?"
- water — как поливать
- soil — грунт и горшок
- cond — условия; начни с температуры так: "18–26 °C; ..."
- tip — самое важное в уходе
- toxic — true, если сок ядовит или раздражает кожу
- big — true, если крупные листья, которые надо протирать от пыли
- quips — 3 коротких смешных фразы от лица растения, на «вы» ко мне

Пример:
[{"species":"Пеперомия туполистная","name":"","type":"soil","lux":[8000,15000],"every":7,"check":"Верхние 2–3 см сухие?","water":"Когда верхний слой подсох, умеренно.","soil":"Лёгкий грунт с перлитом, горшок с дренажем.","cond":"18–26 °C; обычная влажность.","tip":"Мясистые листья запасают воду — перелив опаснее пересушки.","toxic":false,"big":false,"quips":["Я толстенькая, но это вода.","Не заливайте меня, я и так сочная.","Поверните меня к свету, пожалуйста."]}]`;

// Cleans formatting chat apps add, so JSON.parse can read the answer.
function repairJson(src) {
  return src
    .replace(/^\s*\/\/.*$/gm, '') // line comments
    .replace(/[“”„‟″]/g, '"').replace(/[‘’]/g, "'") // typographic quotes
    .replace(/(\d)[   ](?=\d{3}\b)/g, '$1') // 8 000 → 8000
    .replace(/,\s*([\]}])/g, '$1'); // trailing commas
}
// Finds the plant list in a pasted answer: code fences, text around it (even with brackets),
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
  if (/succ|cact|dry|сух|сукк|какт/.test(t)) return 'dry';
  if (/bark|orchid|кор|орхид/.test(t)) return 'bark';
  if (/sphag|moss|сфаг|мох/.test(t)) return 'sphagnum';
  if (/water|вод/.test(t)) return 'water';
  return 'soil';
}
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
  return {
    species, name: str(o.name, 40) === species ? '' : str(o.name, 40),
    emoji: [...str(o.emoji, 16)].slice(0, 2).join('') || '🪴',
    type: importType(o.type),
    lux, every: clamp(Math.round(num(o.every)) || 6, 1, 60),
    check: str(o.check, 100), water: str(o.water), soil: str(o.soil), cond: str(o.cond), tip: str(o.tip),
    toxic: yes(o.toxic), big: yes(o.big), quips: quips.length ? quips : GENERIC_QUIPS,
  };
}

let importItems = [];
let importRepaired = false;
let importPicked = new Set();
function openImport() {
  startAddFlow('import');
  track('import_opened');
  importItems = [];
  importPicked = new Set();
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('bot')}</div><h2 class="m-0">Импорт из чата с ИИ</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="info"><b>Шаг 1</b>Скопируйте запрос и отправьте в ChatGPT, Claude, Gemini или другой ИИ — в чат, где уже обсуждали растения, или вместе с их фото.
      <button class="mt-10 btn ok wide" data-act="import-copy">${I('copy')}Скопировать запрос</button>
      <textarea class="input" id="imp-prompt" rows="6" readonly hidden aria-label="Запрос для ИИ"></textarea></div>
    <div class="info"><b>Шаг 2</b>Вставьте сюда ответ целиком.
      <textarea class="mt-8 input" id="imp-text" rows="5" aria-label="Ответ ИИ" placeholder="Вставьте ответ ИИ"></textarea></div>
    <div id="imp-list"></div>
    <div class="pick-bar"><button class="btn primary wide" data-act="import-add" id="imp-add" disabled>Вставьте ответ</button></div>`;
  let timer;
  $('#imp-text').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(showImport, 300); });
  openSheet();
}
function showImport() {
  const text = $('#imp-text').value;
  const res = parseImport(text);
  const box = $('#imp-list');
  if (res.error) {
    importItems = [];
    importPicked = new Set();
    box.innerHTML = res.error === 'empty' ? '' : `<p class="error-note small">Не получилось найти здесь список растений. Скопируйте ответ ИИ целиком — вместе со скобками [ ].</p>
      <p class="small muted">Всё равно не выходит? Пришлите ответ ИИ в Телеграм <a class="linkish" href="https://t.me/zmoki" data-out="telegram" data-from="import" target="_blank" rel="noopener">@zmoki</a> — разберусь и починю.</p>`;
    if (res.error !== 'empty') track('import_failed', { length: text.length, reason: res.error, ...res.diag });
  } else {
    importItems = res.items;
    importRepaired = res.repaired;
    // Plants already in the collection start unticked.
    const have = new Set(allPlants().map((p) => p.species.toLowerCase()));
    importPicked = new Set(importItems.map((it, i) => i).filter((i) => !have.has(importItems[i].species.toLowerCase())));
    box.innerHTML = `<p class="found-note small muted">Найдено ${plantsN(importItems.length)}. Снимите галочку с лишних.</p>` +
      importItems.map((it, i) => {
        const dup = !importPicked.has(i);
        return `<button class="pick ${dup ? '' : 'on'}" data-act="import-pick" data-i="${i}">
        <span class="pe" aria-hidden="true">${plantSvg(it, 'fine')}</span><span class="pt"><b>${esc(it.name ? `${it.name} · ${it.species}` : it.species)}</b>
        <small>${dup ? 'уже есть в коллекции · ' : ''}${esc(TYPE_NAMES[it.type])} · свет ${kLux(it.lux[0])}–${kLux(it.lux[1])} ${LK} · раз в ${days(it.every)}</small></span>
        <span class="pc" aria-hidden="true">${I(dup ? 'plus' : 'check')}</span></button>`;
      }).join('');
  }
  updateImportBar();
}
const updateImportBar = () => setAddButton($('#imp-add'), importPicked.size, importItems.length ? 'Отметьте растения' : 'Вставьте ответ');
function addImported() {
  if (addFlow) addFlow.done = true;
  const list = [...importPicked].sort((a, b) => a - b).map((i) => importItems[i]).sort((a, b) => a.every - b.every);
  list.forEach((it, i) => {
    const id = newId('c', i);
    const { name, ...d } = it;
    S.custom[id] = { ...d, id, cat: 'Мои' };
    S.plants[id] = { ...runtime(S.custom[id], firstCheck(i, it.every)), name };
  });
  initBonus(S);
  save();
  track('plants_added', { count: list.length, generic_count: 0, source: 'import', repaired: importRepaired });
  tab = 'plants'; closeSheet(); window.scrollTo(0, 0);
  toast(`Добавлено ${plantsN(list.length)} 🌱 Откройте каждое, чтобы выбрать место`);
}

/* ---------- Light ---------- */
const LUX_SCALE = 40000;

function lightRow(p) {
  const ls = lightStatus(p);
  const [a, b] = p.luxRange;
  const left = (Math.min(a, LUX_SCALE) / LUX_SCALE) * 100;
  const width = ((Math.min(b, LUX_SCALE) - Math.min(a, LUX_SCALE)) / LUX_SCALE) * 100;
  const dot = p.lux ? `<i class="dot ${ls}" data-l="${clamp((p.lux / LUX_SCALE) * 100, 0, 100)}"></i>` : '';
  const tag = ls ? ` <span class="tag ${ls}">${LIGHT_WORDS[ls]}</span>` : '';
  return `<div class="lux-row" id="lux-${esc(p.id)}"><div class="nm"><span class="nm-pl">${photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p)}</span>${esc(p.title)}${tag}</div>
    <input class="input" type="number" inputmode="numeric" placeholder="лк" aria-label="Замер для ${esc(p.title)}, люкс" data-field="lux" data-id="${esc(p.id)}" value="${p.lux ?? ''}">
    <div class="need">нужно ${kLux(a)}–${kLux(b)}${p.spot ? ' · ' + esc(p.spot) : ''}</div>
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
      out.push(`${I('arrow-left-right')}<b>Поменяйте местами: ${esc(L.title)} ⇄ ${esc(H.title)}</b><br>
        ${esc(L.title)}: сейчас ${kLux(L.lux)} ${LK}, нужно от ${kLux(L.luxRange[0])}.<br>
        ${esc(H.title)}: сейчас ${kLux(H.lux)} ${LK}, хватит и ${kLux(L.lux)}.`);
    } else {
      out.push(`${I('sun-dim')}<b>${esc(L.title)}</b>: темновато — ${kLux(L.lux)} ${LK}, нужно от ${kLux(L.luxRange[0])}. Подвиньте ближе к окну или лампе или добавьте часов досветки.`);
    }
  });
  highs.forEach((H) => {
    if (!used.has(H.id)) out.push(`${I('sun')}<b>${esc(H.title)}</b>: очень ярко — ${kLux(H.lux)} ${LK}, нужно до ${kLux(H.luxRange[1])}. Отодвиньте от лампы или прямого солнца, чтобы не обжечь листья.`);
  });
  if (!out.length) return ps.length ? '<p class="muted">Света всем хватает 🌞</p>' : '';
  return out.map((t) => `<div class="idea">${t}</div>`).join('');
}

// Shown on tabs that need plants when there are none yet.
const emptyCard = (title, text) => `<div class="celebrate"><h2>${title}</h2><p class="muted">${text}</p>
  <button class="mt-14 btn primary wide" data-act="add-plant">${I('plus')}Добавить растения</button></div>`;

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

/* ---------- Room ---------- */
function viewRoom() {
  const r = S.room;
  const ps = allPlants();
  const ranges = ps.map((p) => [p, tempRange(p)]).filter(([, t]) => t);
  const lo = Math.max(...ranges.map(([, t]) => t[0]));
  const hi = Math.min(...ranges.map(([, t]) => t[1]));
  const humidOnes = ps.filter((p) => p.humid).map((p) => p.title);
  let status = '';
  if (r) {
    const notes = [];
    const cold = ranges.filter(([, t]) => r.t < t[0]).map(([p]) => p.title);
    const hot = ranges.filter(([, t]) => r.t > t[1]).map(([p]) => p.title);
    if (cold.length) notes.push(['snowflake', `Прохладно для: ${cold.join(', ')}. Уберите от холодного окна или включите обогреватель.`]);
    if (hot.length) notes.push(['flame', `Жарковато для: ${hot.join(', ')}. Проветрите или отодвиньте от батареи.`]);
    if (r.h < 50) {
      notes.push(['droplet-off', `Сухо (${r.h}%). Включите увлажнитель${humidOnes.length ? ` — особенно страдают ${humidOnes.join(', ')}` : ''}.`]);
    }
    if (r.h > 75) notes.push(['droplets', `Очень влажно (${r.h}%). Проветрите: сырость и застой воздуха — путь к грибкам, следите за сфагнумом.`]);
    status = notes.length
      ? notes.map(([i, n]) => `<div class="status warn">${I(i)}<span>${esc(n)}</span></div>`).join('')
      : `<div class="status ok">${I('smile')}<span>Всем комфортно. Так держать!</span></div>`;
  }
  const ago = r ? (r.d === today() ? 'сегодня' : rel(r.d)) : '';
  return `<header class="hello head-row"><div><h1>Комната</h1><div class="date">${r ? 'замер: ' + esc(ago) : 'замеров пока нет'}</div></div>${headButtons()}</header>
    ${ps.length ? '' : emptyCard('Температура и влажность', 'Добавьте растения — подскажу, какая температура и влажность удобны именно им.')}
    <p class="small muted">Впишите, что показывает датчик — скажу, кому некомфортно.</p>
    <div class="room-cards">
      <div class="metric"><div class="lbl">Температура</div><div class="val">${r ? esc(r.t) + '°' : '—'}</div>
        <input class="input" id="in-t" aria-label="Температура, °C" type="number" inputmode="decimal" step="0.5" placeholder="°C" value="${r ? r.t : ''}"></div>
      <div class="metric"><div class="lbl">Влажность</div><div class="val">${r ? esc(r.h) + '%' : '—'}</div>
        <input class="input" id="in-h" aria-label="Влажность, %" type="number" inputmode="numeric" placeholder="%" value="${r ? r.h : ''}"></div>
    </div>
    <button class="mt-10 btn primary wide" data-act="room-save">Записать</button>
    ${status}
    ${ranges.length ? `<h2>Чтобы было удобно всем</h2>
    <div class="info"><b>Температура</b>${lo <= hi ? `${lo}–${hi} °C — так комфортно всем вашим растениям.` : 'Общего диапазона нет — смотрите условия в карточках.'}</div>
    <div class="info"><b>Влажность</b>50–70%.${humidOnes.length ? ` Ниже — сохнут кончики листьев у: ${esc(humidOnes.join(', '))}.` : ''} Выше 75% без проветривания — риск грибков.</div>` : ''}

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
    PHOTOS = photos;
    // In the mini app, restored photos are the newest: they replace older ones in Telegram's cloud.
    if (window.photoChanged) Object.entries(photos).forEach(([id, url]) => window.photoChanged(id, url));
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
const kindOf = (id) => { const d = def(id); return { plant_kind: isCustom(id) ? 'custom' : d.id, plant_type: d.type, generic: !!d.generic }; };

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
  view.innerHTML = tab === 'today' ? viewToday() : tab === 'plants' ? viewPlants() : tab === 'light' ? viewLight() : viewRoom();
  applySizes(view);
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
      if (confirm('Тепличка больше не нужна? Больше не буду напоминать проветривать.')) {
        undo = snapshot(); S.plants[id].greenhouse = false; track('greenhouse_removed'); afterTask('Ура, без теплички! 🎉', undo);
      }
      break;
    case 'bonus-done': {
      undo = snapshot();
      const b = bonusTasks().find((x) => x.key === el.dataset.key);
      S.bonus[el.dataset.key] = today();
      track('bonus_done', { kind: el.dataset.key.split(':')[0] });
      logToday({ id: b?.p?.id, a: 'bonus:' + el.dataset.key, title: b?.title });
      afterTask('Бонус засчитан ✨', undo); break;
    }
    case 'bonus-skip':
      track('bonus_skipped', { kind: el.dataset.key.split(':')[0] });
      S.snooze[el.dataset.key] = addDays(today(), 3); save(); render(); toast('Ок, через пару дней 🙂'); break;
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
    case 'add-custom': openCustom(); break;
    case 'add-import': openImport(); break;
    case 'import-copy': {
      if (addFlow) addFlow.promptCopied = true;
      const done = () => { el.innerHTML = `${I('check')}Скопировано`; track('import_prompt_copied'); };
      const show = () => { const ta = $('#imp-prompt'); ta.value = IMPORT_PROMPT; ta.hidden = false; ta.select(); el.textContent = 'Выделите и скопируйте текст ниже'; };
      if (navigator.clipboard) navigator.clipboard.writeText(IMPORT_PROMPT).then(done, show); else show();
      break;
    }
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
      const ids = addPlants([...picked]);
      track('plants_added', { count: ids.length, generic_count: ids.filter((i) => def(i).generic).length, catalog_ids: ids.map((i) => def(i).id), source: 'catalog' });
      save();
      if (ids.length === 1) { openPlant(ids[0]); render(); toast('Добро пожаловать в джунгли! Дайте имя и выберите место 🌱'); break; }
      tab = 'plants'; closeSheet(); window.scrollTo(0, 0);
      toast(`Добавлено ${plantsN(ids.length)} 🌱 Откройте каждое, чтобы выбрать место`); break;
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
    case 'water-now':
      undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', from: 'card', ...kindOf(id) }); save(); closeSheet(); toast('Полив записан 💧', undo); break;
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
      if (act === 'note-del' && (key[0] === 'n' || !def(id)[key]) && !confirm('Удалить заметку?')) break;
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
        delete PHOTOS[id];
        for (const k of ['dust:' + id, 'rotate:' + id]) { delete S.bonus[k]; delete S.snooze[k]; }
        // A custom plant's card is no longer needed.
        if (S.custom[id]) delete S.custom[id];
        idbReq((st) => st.delete(id), 'readwrite').catch(() => {});
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
      const t = parseFloat(String($('#in-t').value).replace(',', '.'));
      const h = parseFloat(String($('#in-h').value).replace(',', '.'));
      if (Number.isNaN(t) || Number.isNaN(h)) { toast('Впишите обе цифры 🙂'); break; }
      S.room = { t, h, d: today() }; save(); render(); toast('Записано 🌡️');
      track('room_saved', { temp: Math.round(t), humidity: Math.round(h) }); break;
    }
    default: break;
  }
});

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
  if (f === 'repotted') r.repotted = el.checked;
  if (f === 'greenhouse') { r.greenhouse = el.checked; track('greenhouse_toggled', { on: el.checked }); }
  if (f === 'lux') {
    const v = parseInt(el.value, 10);
    r.lux = Number.isFinite(v) && v > 0 ? v : null;
    if (r.lux) track('lux_entered', { from: tab === 'light' ? 'light_tab' : 'card' });
  }
  save();
  // The status and greenhouse badge on the card photo follow the toggle and the light reading right away.
  const badges = sheet.open && (f === 'greenhouse' || f === 'lux') && $('.hero-badges');
  if (badges) {
    const p = plant(id);
    const [mi, mt, mc] = mood(p);
    badges.innerHTML = `<span class="mood hero-mood ${mc}">${I(mi)}${esc(mt)}</span>${ghBadge(p)}`;
  }
  if (f === 'lux' && tab === 'light' && !sheet.open) {
    // Update only the row and tips so focus isn't lost while typing.
    const row = document.getElementById('lux-' + id);
    if (row) {
      const tmp = document.createElement('div');
      tmp.innerHTML = lightRow(plant(id));
      const fresh = tmp.firstElementChild;
      row.querySelector('.nm').replaceWith(fresh.querySelector('.nm'));
      row.querySelector('.lux-bar').replaceWith(fresh.querySelector('.lux-bar'));
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
    // Leaving for the AI chat after copying the prompt is the expected path, not abandoning.
    const toAiChat = addFlow && addFlow.sheet === 'import' && addFlow.promptCopied;
    if (sheet.open && !toAiChat) endAddFlow(true);
    flushStats();
    return;
  }
  if (Date.now() - lastOpen > 30 * 60 * 1000) track('app_opened', { how: 'resume' });
  lastOpen = Date.now();
  checkUpdate();
  if (!sheet.open) render();
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

save();
booting = false;
render();
loadPhotos();
checkUpdate();
track('app_opened', { how: 'start' });
