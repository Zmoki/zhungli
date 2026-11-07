'use strict';

const KEY = 'zhungli.v1';
// Версия берётся из ?v= в index.html и сверяется с version.txt на сервере.
const APP_VERSION = new URL(document.currentScript.src).searchParams.get('v') || '0';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Даты ---------- */
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
function rel(d) {
  if (!d) return 'ещё не было';
  const n = diff(today(), d);
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === -1) return 'вчера';
  return n > 0 ? `через ${days(n)}` : `${days(-n)} назад`;
}
const kLux = (n) => `${(n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс`;
const shortDate = (s) => parse(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

/* ---------- Состояние ---------- */
const GENERIC_QUIPS = ['Я новенькая, приятно познакомиться!', 'Посмотри на меня внимательно 👀', 'Я тут, я расту!'];
const TYPE_LABELS = {
  soil: ['Сухо — полила 💧', 'Ещё влажно 👌'],
  sphagnum: ['Сухо — полила 💧', 'Ещё влажно 👌'],
  dry: ['Сухо — полила 💧', 'Ещё влажно 👌'],
  bark: ['Да — полила 💧', 'Ещё рано 👌'],
  water: ['Сменила воду 💧', 'Вода ещё чистая 👌'],
};
const TYPE_NAMES = { soil: 'Грунт', sphagnum: 'Сфагнум', bark: 'Кора (орхидеи)', dry: 'Сушить почти полностью', water: 'Черенки в воде' };

let S = load();
let tab = 'today';
let showAll = false;
let PHOTOS = {};

function blank() {
  return {
    plants: {}, custom: {}, deleted: [], bonus: {}, snooze: {},
    vent: { off: false, last: null }, room: null, log: {},
    settings: { limit: 7 }, hideInstall: false, created: today(),
  };
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* пусто */ }
  s = Object.assign(blank(), s || {});
  seed(s);
  return s;
}

function seed(s) {
  const t = today();
  const fresh = PLANTS.filter((p) => !s.plants[p.id] && !s.deleted.includes(p.id)).sort((a, b) => a.every - b.every);
  // Разносим первые проверки по дням, чтобы в первый день не было 30 дел сразу.
  fresh.forEach((p, i) => {
    s.plants[p.id] = runtime(p, addDays(t, Math.min(Math.floor(i / 6), p.every - 1)));
  });
  let bigIdx = 0;
  PLANTS.forEach((p) => {
    if (p.big && !s.bonus['dust:' + p.id]) s.bonus['dust:' + p.id] = addDays(t, -19 + 2 * bigIdx++);
    if (p.rotate && !s.bonus['rotate:' + p.id]) s.bonus['rotate:' + p.id] = addDays(t, -10);
  });
  if (!s.bonus.feed) s.bonus.feed = addDays(t, -14);
}

function runtime(p, nextCheck) {
  return { name: p.name || '', spot: p.spot || '', lux: null, interval: p.every, nextCheck, lastWater: null, wet: 0, repotted: !!p.repotted, hist: [] };
}

function save() {
  // Лог храним только за неделю.
  const cutoff = addDays(today(), -7);
  Object.keys(S.log).forEach((d) => { if (d < cutoff) delete S.log[d]; });
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не получилось сохранить 😢'); }
}

const def = (id) => PLANTS.find((p) => p.id === id) || S.custom[id];
function plant(id) {
  const d = def(id), r = S.plants[id];
  if (!d || !r) return null;
  // luxRange — норма из каталога, lux — замер люксметром.
  // species — своё название, если задано, иначе из каталога.
  const species = r.species || d.species;
  return { ...d, ...r, id, species, title: r.name || species, luxRange: d.lux, lux: r.lux };
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
  if (p.lux == null || !p.lux) return null;
  if (p.lux < p.luxRange[0]) return 'low';
  if (p.lux > p.luxRange[1] * 1.25) return 'high';
  return 'ok';
}

function mood(p) {
  const t = today();
  if (p.lastWater === t) return ['😌', 'напоили сегодня'];
  if (p.nextCheck <= t) return ['🥺', 'ждёт проверки'];
  const ls = lightStatus(p);
  if (ls === 'low') return ['😑', 'темновато'];
  if (ls === 'high') return ['😎', 'слишком ярко'];
  return ['🙂', 'всё хорошо'];
}

function tempRange(p) {
  const m = /(\d+)\s*–\s*(\d+)\s*°C/.exec(p.cond || '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

const spotIdx = (s) => { const i = SPOTS.indexOf(s); return i === -1 ? (s ? SPOTS.length : 99) : i; };
const bySpot = (a, b) => spotIdx(a.spot) - spotIdx(b.spot) || a.title.localeCompare(b.title, 'ru');

/* ---------- Задачи ---------- */
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
  if (S.vent.off || S.vent.last === today()) return null;
  return allPlants().find((p) => p.ventilate) || null;
}

function bonusTasks() {
  const t = today();
  const out = [];
  const snoozed = (k) => S.snooze[k] && S.snooze[k] > t;
  allPlants().forEach((p) => {
    const dk = 'dust:' + p.id;
    if (p.big && S.bonus[dk] && diff(S.bonus[dk], t) >= 21 && !snoozed(dk)) {
      out.push({ key: dk, p, title: `Протри листья: ${p.title}`, sub: 'Мягкой влажной салфеткой, сверху и снизу. Блестящие листья лучше «едят» свет.' });
    }
    const rk = 'rotate:' + p.id;
    if (p.rotate && S.bonus[rk] && diff(S.bonus[rk], t) >= 14 && !snoozed(rk)) {
      out.push({ key: rk, p, title: `Поверни на четверть оборота: ${p.title}`, sub: 'Чтобы росла ровно, а не тянулась в одну сторону. Постепенно, без резких разворотов.' });
    }
  });
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 9 && diff(S.bonus.feed, t) >= 14 && !snoozed('feed')) {
    const who = allPlants().filter((p) => !p.noFeed && !p.repotted && p.type !== 'dry' && p.type !== 'bark' && p.type !== 'water');
    out.push({ key: 'feed', emoji: '🍽️', title: 'День подкормки', sub: `По инструкции к удобрению, в мокрый грунт: ${who.map((p) => p.title).join(', ')}. Не кормим недавно пересаженных и больных.` });
  }
  return out.slice(0, 2);
}

/* ---------- Действия ---------- */
function snapshot() {
  const copy = JSON.stringify(S);
  return () => { S = JSON.parse(copy); save(); render(); };
}

function actWater(id, silent) {
  const r = S.plants[id], d = def(id), t = today();
  if (r.lastWater && r.lastWater !== t) {
    const measured = diff(r.lastWater, t);
    // Если до этого были ответы «ещё влажно», реальный интервал ≈ measured.
    // Если сразу оказалось сухо, растение высохло раньше — интервал не растёт.
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

function pendingCount() {
  const due = dueChecks();
  const done = (S.log[today()] || []).filter((e) => e.a === 'water' || e.a === 'wet').length;
  const room = showAll ? due.length : Math.max(0, Math.min(due.length, S.settings.limit - done));
  return room + (ventDue() ? 1 : 0);
}

/* ---------- Сегодня ---------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function ava(p, cls = 'ava') {
  const inner = PHOTOS[p.id] ? `<img src="${PHOTOS[p.id]}" alt="">` : esc(p.emoji || '🪴');
  return `<button class="${cls}" data-open="${esc(p.id)}" aria-label="Открыть ${esc(p.title)}">${inner}</button>`;
}

function viewToday() {
  const t = today();
  const log = S.log[t] || [];
  const doneChecks = log.filter((e) => e.a === 'water' || e.a === 'wet').length;
  const due = dueChecks();
  const room = showAll ? due.length : Math.max(0, S.settings.limit - doneChecks);
  const shown = due.slice(0, room).sort(bySpot);
  const waiting = due.length - shown.length;
  const vent = ventDue();
  const pending = shown.length + (vent ? 1 : 0);
  const doneMain = log.filter((e) => e.a !== 'later' && !String(e.a).startsWith('bonus')).length;
  const total = pending + doneMain;
  const pct = total ? Math.round((doneMain / total) * 100) : 100;
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<header class="hello head-row"><div><h1>${greeting()}! 🌿</h1><div class="date">${esc(date)}</div></div>
    <button class="icon-btn" data-act="settings" aria-label="Настройки">⚙️</button></header>`;

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS && !navigator.standalone && !S.hideInstall) {
    html += `<div class="task bonus"><b>📲 Добавь меня на экран «Домой»</b>
      <p class="small muted" style="margin-top:6px">Safari → кнопка «Поделиться» → «На экран Домой». Так iPhone не сотрёт твои отметки, если пару недель не заходить.</p>
      <button class="btn ghost" data-act="hide-install">Уже добавила</button></div>`;
  }

  if (total > 0) {
    html += `<div class="progress"><div class="head-row"><b>${pending ? `Осталось ${pending} ${plural(pending, 'дело', 'дела', 'дел')}` : 'Всё на сегодня!'}</b>
      <span class="muted small">${doneMain} из ${total}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }

  if (vent) {
    html += `<div class="task"><div class="task-top">${ava(vent)}<div><div class="task-name">Проветри тепличку: ${esc(vent.title)}</div>
      <div class="task-sub">минут на 15–30</div></div></div>
      <p class="quip">${esc(vent.title === 'Коля' ? 'Это Коля. Приоткрой, дай подышать. С каждым днём можно чуть дольше.' : 'Приоткрой тепличку, дай подышать.')}</p>
      <div class="btns" style="margin-top:12px"><button class="btn ok" data-act="vent-done">Проветрила ✅</button>
      <button class="btn" data-act="vent-off">Теплички больше нет 🎉</button></div></div>`;
  }

  shown.forEach((p) => {
    const [yes, no] = TYPE_LABELS[p.type] || TYPE_LABELS.soil;
    const q = p.check || CHECK_TEXT[p.type] || CHECK_TEXT.soil;
    const last = p.lastWater ? `полив ${rel(p.lastWater)}` : '';
    const sub = [p.name ? p.species : '', p.spot, last].filter(Boolean).join(' · ');
    html += `<div class="task"><div class="task-top">${ava(p)}<div><div class="task-name">${esc(p.title)}</div>
      <div class="task-sub">${esc(sub)}</div></div></div>
      <p class="quip">${esc(quipOf(p))}</p>
      <div class="question">${esc(q)}</div>
      <div class="btns"><button class="btn water" data-act="water" data-id="${esc(p.id)}">${yes}</button>
      <button class="btn ok" data-act="wet" data-id="${esc(p.id)}">${no}</button></div>
      <div class="hint">${esc(p.water || '')}</div>
      <button class="later" data-act="later" data-id="${esc(p.id)}">⏭ Не сейчас, завтра</button></div>`;
  });

  if (!pending) {
    if (doneMain) {
      html += `<div class="celebrate"><div class="big">🎉</div><h2 style="margin:0 0 6px">Джунгли довольны!</h2>
        <p class="muted">Ты сегодня молодец. Остальное — завтра.</p></div>`;
    } else {
      const tom = allPlants().filter((p) => p.nextCheck === addDays(t, 1)).length;
      html += `<div class="celebrate"><div class="big">😴</div><h2 style="margin:0 0 6px">Сегодня отдыхаем</h2>
        <p class="muted">Все в порядке, никто не просит пить.${tom ? ` Завтра проверим ${tom} ${plural(tom, 'растение', 'растения', 'растений')}.` : ''}</p></div>`;
    }
  }

  if (waiting > 0) {
    html += `<button class="more" data-act="show-all">💤 Ещё ${waiting} ${plural(waiting, 'растение подождёт', 'растения подождут', 'растений подождут')} до завтра.<br>Есть силы? Показать</button>`;
  }

  const bonus = bonusTasks();
  if (bonus.length) {
    html += `<h2>✨ Если есть силы</h2>`;
    bonus.forEach((b) => {
      html += `<div class="task bonus"><div class="task-top">${b.p ? ava(b.p) : `<div class="ava">${b.emoji}</div>`}<div>
        <div class="task-name">${esc(b.title)}</div></div></div><p class="small muted" style="margin:8px 0 10px">${esc(b.sub)}</p>
        <div class="btns"><button class="btn ok" data-act="bonus-done" data-key="${esc(b.key)}">Готово ✅</button>
        <button class="btn ghost" data-act="bonus-skip" data-key="${esc(b.key)}">Не сегодня</button></div></div>`;
    });
  }

  const doneRows = log.filter((e) => e.a !== 'later');
  if (doneRows.length) {
    const label = { water: 'полила 💧', wet: 'ещё влажно 👌', vent: 'проветрила 🌬️', bonus: 'сделано ✨' };
    html += `<details><summary class="group-title" style="cursor:pointer">Уже сделано сегодня · ${doneRows.length}</summary>`;
    doneRows.forEach((e) => {
      const p = e.id ? plant(e.id) : null;
      const what = e.title || (p ? p.title : '');
      html += `<div class="task done-row">${p ? ava(p) : '<div class="ava">✨</div>'}<div style="flex:1">${esc(what)}</div>
        <span class="muted small">${label[String(e.a).split(':')[0]] || ''}</span></div>`;
    });
    html += `</details>`;
  }
  return html;
}

/* ---------- Растения ---------- */
function viewPlants() {
  const ps = allPlants();
  let html = `<header class="hello head-row"><div><h1>Мои джунгли</h1><div class="date">${ps.length} ${plural(ps.length, 'растение', 'растения', 'растений')}</div></div>
    <button class="icon-btn" data-act="settings" aria-label="Настройки">⚙️</button></header>
    <button class="btn primary wide" data-act="add-plant">➕ Добавить растение</button>`;
  const groups = {};
  ps.sort(bySpot).forEach((p) => { (groups[p.spot || ''] ||= []).push(p); });
  Object.keys(groups).sort((a, b) => spotIdx(a) - spotIdx(b)).forEach((spot) => {
    html += `<div class="group-title">${esc(spot || 'Место не выбрано')}</div><div class="grid">`;
    groups[spot].forEach((p) => {
      const [m, mt] = mood(p);
      const pic = PHOTOS[p.id] ? `<img src="${PHOTOS[p.id]}" alt="">` : esc(p.emoji || '🪴');
      html += `<button class="pcard" data-open="${esc(p.id)}"><div class="pic">${pic}<span class="mood" title="${esc(mt)}">${m}</span></div>
        <b>${esc(p.title)}</b><small>${p.name ? esc(p.species) + '<br>' : ''}проверка ${esc(rel(p.nextCheck))}</small></button>`;
    });
    html += `</div>`;
  });
  return html;
}

function openPlant(id) {
  const p = plant(id);
  if (!p) return;
  const [m, mt] = mood(p);
  const ls = lightStatus(p);
  const hist = p.hist.slice(0, 8).map((h) => `${shortDate(h.d)} — ${h.a === 'water' ? 'полила 💧' : 'ещё влажно 👌'}`).join('<br>');
  const spots = [...new Set([...SPOTS, ...allPlants().map((x) => x.spot).filter(Boolean)])];
  const pic = PHOTOS[p.id] ? `<img src="${PHOTOS[p.id]}" alt="">` : esc(p.emoji || '🪴');
  const tr = tempRange(p);
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><button class="ava" data-act="photo" data-id="${esc(id)}" aria-label="Сменить фото">${pic}</button>
      <div><h2 style="margin:0" id="sh-title">${esc(p.title)}</h2><div class="muted small" id="sh-species">${esc(p.species)}</div><div class="small">${m} ${esc(mt)}</div></div>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">✕</button></div>
    <p class="quip" style="margin-top:0">${esc(quipOf(p))}</p>
    <div class="info"><b>Полив</b>Последний: ${esc(rel(p.lastWater))} · следующая проверка: ${esc(rel(p.nextCheck))}</div>
    <button class="btn water wide" data-act="water-now" data-id="${esc(id)}" style="margin:4px 0 18px">💧 Полила сейчас</button>

    <div class="field"><label>Имя</label><input class="input" data-field="name" data-id="${esc(id)}" value="${esc(p.name)}" placeholder="Придумай имя, например Коля" maxlength="40"></div>
    <div class="field"><label>Название (вид, сорт)</label><input class="input" data-field="species" data-id="${esc(id)}" value="${esc(p.species)}" placeholder="${esc(def(id).species)}" maxlength="80">
      ${S.plants[id].species ? `<p class="small muted" style="margin-top:6px">В каталоге: ${esc(def(id).species)}. Сотри поле, чтобы вернуть.</p>` : ''}</div>

    <div class="field"><label>Где стоит</label><div class="chips">
      ${spots.map((s) => `<button class="chip ${p.spot === s ? 'on' : ''}" data-act="spot" data-id="${esc(id)}" data-spot="${esc(s)}">${esc(s)}</button>`).join('')}
      <button class="chip" data-act="spot-new" data-id="${esc(id)}">＋ своё место</button></div></div>

    <div class="field"><label>Свет: нужно ${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} лк${tr ? ` · ${tr[0]}–${tr[1]} °C` : ''}</label>
      <input class="input" type="number" inputmode="numeric" placeholder="Замер люксметром, лк" data-field="lux" data-id="${esc(id)}" value="${p.lux ?? ''}">
      ${ls ? `<p class="small" style="margin-top:6px"><span class="tag ${ls}">${ls === 'low' ? 'темновато' : ls === 'high' ? 'слишком ярко' : 'света хватает'}</span></p>` : ''}</div>
    <div class="field"><label>Проверять примерно каждые</label><div class="stepper">
      <button data-act="int-minus" data-id="${esc(id)}">−</button><b id="int-val">${days(Math.round(p.interval))}</b>
      <button data-act="int-plus" data-id="${esc(id)}">＋</button></div>
      <p class="small muted" style="margin-top:6px">Подстраивается само по твоим ответам «сухо / влажно».</p></div>

    <div class="field"><label class="toggle"><input type="checkbox" data-field="repotted" data-id="${esc(id)}" ${p.repotted ? 'checked' : ''}> Недавно пересажена — без подкормки</label></div>

    <h2>Шпаргалка</h2>
    ${p.water ? `<div class="info"><b>Как поливать</b>${esc(p.water)}</div>` : ''}
    ${p.soil ? `<div class="info"><b>Субстрат</b>${esc(p.soil)}</div>` : ''}
    ${p.cond ? `<div class="info"><b>Условия</b>${esc(p.cond)}</div>` : ''}
    ${p.tip ? `<div class="info"><b>Важно</b>${esc(p.tip)}</div>` : ''}
    ${p.toxic ? `<div class="info"><b>⚠️ Осторожно</b>Сок раздражает кожу и слизистые. Работай в перчатках.</div>` : ''}
    ${p.extra ? `<p class="small muted">Этой карточки нет в каталоге — данные примерные, поправь, если знаешь лучше.</p>` : ''}
    ${hist ? `<h2>История</h2><p class="history">${hist}</p>` : ''}
    <button class="btn danger wide" data-act="delete" data-id="${esc(id)}" style="margin-top:20px">Убрать из коллекции</button>`;
  openSheet();
}

function openAdd() {
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava">🪴</div><h2 style="margin:0">Новое растение</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">✕</button></div>
    <form id="add-form">
      <div class="field"><label>Что это за растение</label><input class="input" name="species" required placeholder="Например, Пеперомия"></div>
      <div class="field"><label>Имя (если есть)</label><input class="input" name="name" placeholder="Например, Пепа"></div>
      <div class="field"><label>Эмодзи</label><input class="input" name="emoji" value="🪴" maxlength="4"></div>
      <div class="field"><label>В чём растёт</label><select class="input" name="type">
        ${Object.entries(TYPE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label>Сколько света нужно, лк</label><div class="row2">
        <input class="input" name="lmin" type="number" inputmode="numeric" value="6000" placeholder="от">
        <input class="input" name="lmax" type="number" inputmode="numeric" value="15000" placeholder="до"></div></div>
      <div class="field"><label>Проверять каждые … дней</label><input class="input" name="every" type="number" inputmode="numeric" value="6" min="1" max="60"></div>
      <div class="field"><label>Шпаргалка (по желанию)</label><textarea class="input" name="tip" rows="3" placeholder="Что важно помнить"></textarea></div>
      <button class="btn primary wide" type="submit">Добавить 🌱</button>
    </form>`;
  $('#add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const id = 'c' + Date.now().toString(36);
    const every = clamp(Number(f.get('every')) || 6, 1, 60);
    const lmin = Number(f.get('lmin')) || 5000;
    const lmax = Math.max(lmin, Number(f.get('lmax')) || 15000);
    S.custom[id] = {
      id, species: String(f.get('species')).trim() || 'Растение', cat: 'Мои', emoji: String(f.get('emoji')).trim() || '🪴',
      lux: [lmin, lmax], every, type: f.get('type'), tip: String(f.get('tip')).trim(), quips: GENERIC_QUIPS,
    };
    S.plants[id] = runtime(S.custom[id], today());
    S.plants[id].name = String(f.get('name')).trim();
    save();
    closeSheet();
    toast('Добро пожаловать в джунгли! 🌱');
  });
  openSheet();
}

/* ---------- Свет ---------- */
const LUX_SCALE = 40000;

function lightRow(p) {
  const ls = lightStatus(p);
  const [a, b] = p.luxRange;
  const left = (Math.min(a, LUX_SCALE) / LUX_SCALE) * 100;
  const width = ((Math.min(b, LUX_SCALE) - Math.min(a, LUX_SCALE)) / LUX_SCALE) * 100;
  const dot = p.lux ? `<i class="dot ${ls}" style="left:${clamp((p.lux / LUX_SCALE) * 100, 0, 100)}%"></i>` : '';
  const tag = ls ? ` <span class="tag ${ls}">${ls === 'low' ? 'темно' : ls === 'high' ? 'ярко' : 'ок'}</span>` : '';
  return `<div class="lux-row" id="lux-${esc(p.id)}"><div class="nm">${esc(p.emoji)} ${esc(p.title)}${tag}</div>
    <input class="input" type="number" inputmode="numeric" placeholder="лк" data-field="lux" data-id="${esc(p.id)}" value="${p.lux ?? ''}">
    <div class="need">нужно ${kLux(a)}–${kLux(b)}${p.spot ? ' · ' + esc(p.spot) : ''}</div>
    <div class="lux-bar"><i class="range" style="left:${left}%;width:${width}%"></i>${dot}</div></div>`;
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
      out.push(`🔄 <b>Поменяй местами: ${esc(L.title)} ⇄ ${esc(H.title)}</b><br>
        ${esc(L.title)}: сейчас ${kLux(L.lux)} лк, нужно от ${kLux(L.luxRange[0])}.<br>
        ${esc(H.title)}: сейчас ${kLux(H.lux)} лк, хватит и ${kLux(L.lux)}.`);
    } else {
      out.push(`🔦 <b>${esc(L.title)}</b>: темновато — ${kLux(L.lux)} лк, нужно от ${kLux(L.luxRange[0])}. Подвинь ближе к лампе или добавь часов досветки.`);
    }
  });
  highs.forEach((H) => {
    if (!used.has(H.id)) out.push(`🕶️ <b>${esc(H.title)}</b>: очень ярко — ${kLux(H.lux)} лк, нужно до ${kLux(H.luxRange[1])}. Отодвинь от лампы, чтобы не обжечь листья.`);
  });
  if (!out.length) return ps.length ? '<p class="muted">Света всем хватает 🌞</p>' : '';
  return out.map((t) => `<div class="idea">${t}</div>`).join('');
}

function viewLight() {
  const ps = allPlants().sort((a, b) => b.luxRange[0] - a.luxRange[0] || b.luxRange[1] - a.luxRange[1]);
  const measured = ps.filter((p) => p.lux).length;
  return `<header class="hello"><h1>Свет 💡</h1><div class="date">замерено ${measured} из ${ps.length}</div></header>
    <p class="small muted">Замеряй люксметром у листьев, когда лампы работают как обычно. Впиши цифру — подскажу, кому темно, а кого лучше переставить.</p>
    <div id="ideas">${lightIdeas()}</div>
    <h2>От самых светолюбивых</h2>
    ${ps.map(lightRow).join('')}`;
}

/* ---------- Комната ---------- */
function viewRoom() {
  const r = S.room;
  const ps = allPlants();
  const ranges = ps.map((p) => [p, tempRange(p)]).filter(([, t]) => t);
  const lo = Math.max(...ranges.map(([, t]) => t[0]));
  const hi = Math.min(...ranges.map(([, t]) => t[1]));
  let status = '';
  if (r) {
    const notes = [];
    const cold = ranges.filter(([, t]) => r.t < t[0]).map(([p]) => p.title);
    const hot = ranges.filter(([, t]) => r.t > t[1]).map(([p]) => p.title);
    if (cold.length) notes.push(`🥶 Прохладно для: ${cold.join(', ')}. Включи обогреватель.`);
    if (hot.length) notes.push(`🥵 Жарковато для: ${hot.join(', ')}. Проветри или убавь обогреватель.`);
    if (r.h < 50) {
      const dry = ps.filter((p) => p.humid || p.cat === 'Алоказии').map((p) => p.title);
      notes.push(`🏜️ Сухо (${r.h}%). Включи увлажнитель — особенно страдают ${dry.join(', ')}.`);
    }
    if (r.h > 75) notes.push(`💦 Очень влажно (${r.h}%). Проветри: сырость и застой воздуха — путь к грибкам, следи за сфагнумом.`);
    status = notes.length
      ? notes.map((n) => `<div class="status warn">${esc(n)}</div>`).join('')
      : `<div class="status ok">😊 Всем комфортно. Так держать!</div>`;
  }
  const ago = r ? (r.d === today() ? 'сегодня' : rel(r.d)) : '';
  return `<header class="hello"><h1>Комната 🌡️</h1><div class="date">${r ? 'замер: ' + esc(ago) : 'замеров пока нет'}</div></header>
    <p class="small muted">Впиши, что показывает датчик — скажу, кому некомфортно.</p>
    <div class="room-cards">
      <div class="metric"><div class="lbl">Температура</div><div class="val">${r ? esc(r.t) + '°' : '—'}</div>
        <input class="input" id="in-t" type="number" inputmode="decimal" step="0.5" placeholder="°C" value="${r ? r.t : ''}"></div>
      <div class="metric"><div class="lbl">Влажность</div><div class="val">${r ? esc(r.h) + '%' : '—'}</div>
        <input class="input" id="in-h" type="number" inputmode="numeric" placeholder="%" value="${r ? r.h : ''}"></div>
    </div>
    <button class="btn primary wide" data-act="room-save" style="margin-top:10px">Записать</button>
    ${status}
    <h2>Чтобы было удобно всем</h2>
    <div class="info"><b>Температура</b>${lo <= hi ? `${lo}–${hi} °C — так комфортно всем, включая теплолюбивый банан.` : 'Общего диапазона нет — смотри условия в карточках.'}</div>
    <div class="info"><b>Влажность</b>50–70%. Ниже — сохнут кончики у строманты, ктенанты, алоказий и пальмы. Выше 75% без проветривания — риск грибков.</div>

    <h2>🗣️ Сценарии для Алисы</h2>
    <p class="small muted">Настраиваются в приложении «Дом с Алисой» → Сценарии. Для условий по влажности и температуре датчик должен быть подключён к Алисе.</p>
    <div class="scenario"><span>⏰</span><div><b>Каждый день в 10:00</b> → Алиса говорит: «Пора заглянуть в Жунгли! Растения ждут» 🌿</div></div>
    <div class="scenario"><span>💧</span><div><b>Влажность ниже 50%</b> → включить увлажнитель</div></div>
    <div class="scenario"><span>🛑</span><div><b>Влажность выше 70%</b> → выключить увлажнитель</div></div>
    <div class="scenario"><span>🔥</span><div><b>Температура ниже 21 °C</b> → включить обогреватель</div></div>
    <div class="scenario"><span>❄️</span><div><b>Температура выше 25 °C</b> → выключить обогреватель</div></div>
    <div class="scenario"><span>💡</span><div><b>Фитолампы через умную розетку:</b> включать в 8:00, выключать в 21:00 — 12–14 часов света в день, без ночного досвета.</div></div>`;
}

/* ---------- Настройки и бэкап ---------- */
function openSettings() {
  const lim = S.settings.limit;
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava">⚙️</div><h2 style="margin:0">Настройки</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">✕</button></div>
    <div class="field"><label>Сколько растений проверять в день, максимум</label><div class="chips">
      ${[5, 7, 10, 15, 50].map((n) => `<button class="chip ${lim === n ? 'on' : ''}" data-act="limit" data-n="${n}">${n === 50 ? 'все' : n}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:6px">Остальные спокойно подождут до завтра — первыми покажу тех, кому нужнее.</p></div>
    <h2>Резервная копия</h2>
    <p class="small muted">Все отметки и фото живут только на этом телефоне. Раз в месяц сохраняй копию в «Файлы» или отправь себе в Телеграм.</p>
    <div class="btns"><button class="btn ok" data-act="export">Сохранить копию</button><button class="btn" data-act="import">Восстановить</button></div>
    <h2>Напоминание</h2>
    <p class="small muted">Попроси Алису: «Алиса, напоминай каждый день в 10 утра проверить растения». Или в iPhone: «Команды» → «Автоматизация» → «Время суток» → открыть приложение «Жунгли».</p>
    <button class="btn ghost wide" data-act="reset" style="margin-top:24px">Начать с чистого листа</button>`;
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
    S = Object.assign(blank(), data.state);
    seed(S);
    save();
    await idbReq((st) => st.clear(), 'readwrite');
    for (const [id, url] of Object.entries(data.photos || {})) await idbReq((st) => st.put(url, id), 'readwrite');
    PHOTOS = data.photos || {};
    closeSheet();
    toast('Готово, всё вернулось 🌿');
  } catch (e) {
    toast('Это не похоже на копию Жунглей 🤔');
  }
}

/* ---------- Фото (IndexedDB) ---------- */
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
    keys.forEach((k, i) => { PHOTOS[k] = vals[i]; });
    render();
  } catch (e) { /* без фото тоже работаем */ }
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
    openPlant(photoFor);
    render();
    toast('Красотка! 📸');
  } catch (err) { toast('Не получилось открыть фото'); }
});
$('#import-input').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) doImport(f);
});

/* ---------- UI ---------- */
const sheet = $('#sheet');
function openSheet() { if (!sheet.open) sheet.showModal(); sheet.scrollTop = 0; }
// Перерисовываем сами: событие close срабатывает не во всех браузерах.
function closeSheet() { if (sheet.open) sheet.close(); render(); }
sheet.addEventListener('close', () => render()); // закрытие свайпом/Esc
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

let toastTimer;
function toast(msg, undo) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = esc(msg) + (undo ? ' <button class="undo">Отменить</button>' : '');
  document.body.append(el);
  if (undo) el.querySelector('.undo').onclick = () => { undo(); el.remove(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 4500);
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

const WATER_CHEERS = ['Напоила! 💧', 'Глоток счастья 💧', 'Кап-кап, спасибо! 💧'];
function afterTask(msg, undo) {
  save();
  const before = document.querySelectorAll('.task:not(.bonus):not(.done-row)').length;
  render();
  toast(msg, undo);
  if (before > 0 && pendingCount() === 0) confetti();
}

function render() {
  const view = $('#view');
  view.innerHTML = tab === 'today' ? viewToday() : tab === 'plants' ? viewPlants() : tab === 'light' ? viewLight() : viewRoom();
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act],[data-tab],[data-open]');
  if (!el) return;
  if (el.dataset.tab) {
    tab = el.dataset.tab;
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
      undo = snapshot(); actWater(id);
      afterTask(WATER_CHEERS[Math.floor(Math.random() * WATER_CHEERS.length)], undo); break;
    case 'wet':
      undo = snapshot(); actWet(id);
      afterTask(`Ок, загляну к ${plant(id).title} ${rel(S.plants[id].nextCheck)} 👌`, undo); break;
    case 'later':
      undo = snapshot(); actLater(id); afterTask('Перенесено на завтра ⏭', undo); break;
    case 'vent-done':
      undo = snapshot(); S.vent.last = today(); logToday({ id: allPlants().find((p) => p.ventilate)?.id, a: 'vent' });
      afterTask('Свежий воздух! 🌬️', undo); break;
    case 'vent-off':
      if (confirm('Тепличка больше не нужна? Больше не буду напоминать проветривать.')) {
        undo = snapshot(); S.vent.off = true; afterTask('Ура, Коля стал взрослым! 🎉', undo);
      }
      break;
    case 'bonus-done': {
      undo = snapshot();
      const b = bonusTasks().find((x) => x.key === el.dataset.key);
      S.bonus[el.dataset.key] = today();
      logToday({ id: b?.p?.id, a: 'bonus:' + el.dataset.key, title: b?.title });
      afterTask('Бонус засчитан ✨', undo); break;
    }
    case 'bonus-skip':
      S.snooze[el.dataset.key] = addDays(today(), 3); save(); render(); toast('Ок, через пару дней 🙂'); break;
    case 'show-all': showAll = true; render(); break;
    case 'hide-install': S.hideInstall = true; save(); render(); break;
    case 'settings': openSettings(); break;
    case 'add-plant': openAdd(); break;
    case 'close': closeSheet(); break;
    case 'photo': photoFor = id; $('#photo-input').click(); break;
    case 'water-now':
      undo = snapshot(); actWater(id); save(); closeSheet(); toast('Полив записан 💧', undo); break;
    case 'spot':
      S.plants[id].spot = el.dataset.spot; save();
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    case 'spot-new': {
      const s = prompt('Как называется место?');
      if (s && s.trim()) { S.plants[id].spot = s.trim(); save(); openPlant(id); }
      break;
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
        if (S.custom[id]) delete S.custom[id]; else S.deleted.push(id);
        delete PHOTOS[id];
        idbReq((st) => st.delete(id), 'readwrite').catch(() => {});
        save(); closeSheet(); toast('Убрано 🍂');
      }
      break;
    case 'limit':
      S.settings.limit = Number(el.dataset.n); showAll = false; save();
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    case 'export': doExport(); break;
    case 'import': $('#import-input').click(); break;
    case 'reset':
      if (confirm('Точно стереть все отметки и начать заново? Фото тоже удалятся.')) {
        localStorage.removeItem(KEY);
        idbReq((st) => st.clear(), 'readwrite').finally(() => location.reload());
      }
      break;
    case 'room-save': {
      const t = parseFloat(String($('#in-t').value).replace(',', '.'));
      const h = parseFloat(String($('#in-h').value).replace(',', '.'));
      if (Number.isNaN(t) || Number.isNaN(h)) { toast('Впиши обе цифры 🙂'); break; }
      S.room = { t, h, d: today() }; save(); render(); toast('Записано 🌡️'); break;
    }
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const f = el.dataset && el.dataset.field;
  if (!f) return;
  const id = el.dataset.id;
  const r = S.plants[id];
  if (!r) return;
  if (f === 'name') r.name = el.value.trim();
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
  if (f === 'lux') {
    const v = parseInt(el.value, 10);
    r.lux = Number.isFinite(v) && v > 0 ? v : null;
  }
  save();
  if (f === 'lux' && tab === 'light' && !sheet.open) {
    // Обновляем только строку и подсказки, чтобы не сбивать фокус при вводе подряд.
    const row = document.getElementById('lux-' + id);
    if (row) {
      const tmp = document.createElement('div');
      tmp.innerHTML = lightRow(plant(id));
      const fresh = tmp.firstElementChild;
      row.querySelector('.nm').replaceWith(fresh.querySelector('.nm'));
      row.querySelector('.lux-bar').replaceWith(fresh.querySelector('.lux-bar'));
    }
    $('#ideas').innerHTML = lightIdeas();
    document.querySelector('.hello .date').textContent = `замерено ${allPlants().filter((p) => p.lux).length} из ${allPlants().length}`;
  }
});

// iPhone не перезагружает приложение с экрана «Домой», а возвращает старую страницу.
// Поэтому при каждом открытии проверяем, не вышла ли новая версия.
async function checkUpdate() {
  if (location.protocol === 'file:') return;
  try {
    const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
    const v = r.ok ? (await r.text()).trim() : '';
    if (!v || v === APP_VERSION || sheet.open) return;
    if (sessionStorage.getItem('zhungli.reloadedFor') === v) return; // не зацикливаемся
    sessionStorage.setItem('zhungli.reloadedFor', v);
    location.reload();
  } catch (e) { /* офлайн — работаем на том, что есть */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  checkUpdate();
  if (!sheet.open) render();
});

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

save();
render();
loadPhotos();
checkUpdate();
