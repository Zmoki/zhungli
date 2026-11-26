/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Plant card sheet: notes, photo, spot, room, how it grows, and its fields.

// Cheat sheet: catalog tips (edits and removals go to r.own, '' = removed)
// plus the user's own notes in r.notes.
const NOTE_KEYS = [['water', 'Как поливать'], ['soil', 'Грунт'], ['cond', 'Условия'], ['tip', 'Важно']];
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
  // Toxic and safe for pets are tags under the quote (tagsOf); with no data, it's said here.
  if (petsOn() && !petsOf(p)) html += `<div class="card-warns">${petsHtml(p)}</div>`;
  if (p.generic) html += `<p class="small muted">Это общий тип, советы примерные. Интервал полива подстроится по вашим ответам.</p>`;
  return html;
}
// With «Дома есть кошка или собака» on and nothing known about the plant: says so in «Заметки».
function petsHtml(p) {
  return `<div class="info"><b>${I('paw-print')}Для кошек и собак: нет данных</b>${p.generic ? 'Зависит от растения. Узнаете вид: «Настройки» → «Сменить карточку».' : petsUnlisted(p) ? esc(p.petsNote || 'Этого растения нет в базе ASPCA, других сведений мало.') : 'Надёжных сведений о том, ядовито ли растение, нет.'}</div>`;
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

// «Полив» in «Уход»: a folding row that opens by default (OPEN_ROWS), since «Полито сегодня» is used after about 1 in 5
// card opens; closed, it says when the next check is.
// Its white card holds «Как поливаю» first (wateringBox, redrawn alone so a tapped chip keeps focus), then the button
// and under it, centered as under «Подкормка»'s, the next check as on the plant's grid card (waterBox, redrawn on a
// watering; the last one is in «История»). For a reservoir: the top-ups.
function waterBox(p) {
  const g = wayOf(p), w = actWords(p);
  if (g.noChecks) return whyNot('Поливать не нужно, корни в воде аквариума.');
  // Watered (or checked) today already: the button stays, greyed out, so the same watering isn't noted twice.
  const done = p.lastWater === today();
  // The line takes focus after «Полито сегодня», which greys out (the card stays open).
  return `<button class="water-now btn ${g.fixed ? 'ok' : 'water'} wide" data-act="water-now" data-id="${esc(p.id)}"${done ? ' disabled' : ''}>${I(g.fixed ? 'check' : 'droplet')}${w.btn}</button>
    <p class="wnext" id="wnext" tabindex="-1">${nextCheckHtml(p)}</p>`;
}
// Settings that don't apply to a plant stay in place, greyed out (disabled), with a line saying why:
// a section that silently disappears reads as a bug («у меня нет кнопки…»).
const whyNot = (text, id = '') => `<p class="small muted why-not"${id ? ` id="${id}"` : ''}>${text}</p>`;
const WHERE = { dry: 'в грунте для суккулентов', bark_mix: 'в смеси с корой', peat: 'в торфе без удобрений', mineral: 'в минеральной смеси', leca: 'в керамзите', water: 'в воде',
  mount: 'на блоке', terrarium: 'в закрытом террариуме', aquarium: 'в аквариуме' };
const upFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Why a plant isn't on «День подкормки».
function feedWhyNot(p) {
  if (p.distilled) return 'Хищные растения не удобряют в грунт.';
  if (p.type === 'water') return 'В воде удобрение в четверть дозы раз в месяц, при смене воды. Черенкам до корней не нужно.';
  if (MEDIA[p.type].feed === 'each') return `${upFirst(WHERE[p.type])} удобрение в слабой дозе добавляют в каждый полив: отдельного дня подкормки нет.`;
  if (MEDIA[p.type].feed === 'alt') return `${upFirst(WHERE[p.type])} удобрение добавляют через раз: пока вода испаряется, раствор крепнет. Отдельного дня подкормки нет.`;
  if (p.noFeed) return 'Для этого растения подкормки нет.';
  return `Для растений ${WHERE[p.type] || 'с таким грунтом'} день подкормки не назначаю.`;
}
const waterWhyNot = (p) => `Растение ${WHERE[p.type]}, не в горшке: способ полива не выбирается.`;
// «В чём растёт» (its own row in «Уход») and «Как поливаю» (in «Полив», for a pot): every option is a chip, nothing hidden
// in a dropdown. Each has its own note under it, redrawn alone on a change, so the tapped chip keeps focus.
const wayChips = (p, field, list, value, off = false) => Object.entries(list).map(([k, x]) => `<button class="chip ${value === k ? 'on' : ''}" data-act="way-${field}" data-id="${esc(p.id)}" data-way="${k}" aria-pressed="${value === k}"${off ? ' disabled' : ''}>${x.name}</button>`).join('');
// The row's title says «В чём растёт», so the chips' label is for screen readers only.
const mediumBox = (p, d) => `<div class="field" role="group" aria-labelledby="lbl-medium" aria-describedby="medium-hint"><span class="sr-only" id="lbl-medium">В чём растёт</span>
    <div class="chips">${wayChips(p, 'medium', MEDIA, p.type)}</div></div>
    <div class="field" id="medium-note">${mediumNote(p, d)}</div>`;
function wateringBox(p, d) {
  // A bog way (a tray of standing water) only where the card or the plant uses it: it rots ordinary roots.
  const ways = Object.fromEntries(Object.entries(WATERING).filter(([k, w]) => !w.bog || k === p.watering || k === cardWatering(d)));
  const pot = MEDIA[p.type].pot;
  return `<div class="field" role="group" aria-labelledby="lbl-watering" aria-describedby="watering-hint" id="watering-field"><span class="sr-only" id="lbl-watering">Как поливаю</span>
    <div class="chips">${wayChips(p, 'watering', ways, pot ? p.watering || 'top' : '', !pot)}</div>${whyNot(pot ? '' : waterWhyNot(p), 'watering-why')}</div>
    <div class="field" id="watering-note">${wateringNote(p, d)}</div>`;
}
// «Пересажено»: its own row under «Сейчас»; changeWay keeps it in step with the medium.
// «Да» / «Нет»: chips, like every other choice, always under their question (askYesNo).
const yesNo = (field, id, on, dis = false, kind = '') => ['1', '0'].map((v) => {
  const sel = (v === '1') === on;
  return `<button class="chip ${sel ? 'on' : ''}" data-act="yes-no" data-field="${field}" data-id="${esc(id)}"${kind ? ` data-kind="${kind}"` : ''} data-v="${v}" aria-pressed="${sel}"${dis ? ' disabled' : ''}>${v === '1' ? 'Да' : 'Нет'}</button>`;
}).join('');
// A yes-no setting inside a row: a short question, then «Да» / «Нет» (no checkboxes in «Настройки»).
// `hint`: the id of the line under it that says what the current answer does.
const askYesNo = (q, field, id, on, dis = false, kind = '', hint = '') => `<div class="yn" role="group" aria-labelledby="q-${field}${kind}"${hint ? ` aria-describedby="${hint}"` : ''}><p class="yn-q" id="q-${field}${kind}">${q}</p>
  <div class="chips">${yesNo(field, id, on, dis, kind)}</div></div>`;
const repotBox = (p) => `<div class="field" id="repot-field">${askYesNo('Недавно пересадили?', 'repotted', p.id, !!repotted(p), !feedsOnDay(p), '', 'repot-hint')}
      <div class="mt-6 small muted hint" id="repot-hint">${repotHint(p)}</div></div>`;
// What the chosen way means, and warnings by the content facts: succulents and cacti rot in steady moisture; standing
// in water suits only bog plants and cyperus (HOUSE-SELFW-24, 25: the tray reaches other plants only by import); a wick
// is a tested permanent watering only for African violets (SELFW-08). Redrawn alone on a change, so the tapped chip keeps focus.
const warnBox = (text) => `<div class="info warn mt-8"><b>${I('triangle-alert')}Осторожно</b>${text}</div>`;
const SUCC_WET = 'Суккуленты и кактусы не любят постоянную влагу: следите, чтобы корни не загнили.';
// Under «В чём растёт»: the medium's hint (unless a watering way has its own, which says what's checked), its care
// reminder and how it's fed; the succulent warning when the medium itself is wet.
function mediumNote(p, d) {
  const M = MEDIA[p.type], W = MEDIA[p.type].pot && p.watering !== 'top' ? WATERING[p.watering] : null;
  const hint = [W && W.hint ? '' : M.hint, M.careHint, FEED_WITH[M.feed] ? `Удобрение добавляйте ${FEED_WITH[M.feed]}, на день подкормки звать не буду.` : ''].filter(Boolean).join(' ');
  return `<p class="small muted m-0" id="medium-hint">${esc(hint)}</p>${d.type === 'dry' && M.wet ? warnBox(SUCC_WET) : ''}`;
}
// Under «Как поливаю»: the watering's hint, the wick line, and the warnings that come from the watering.
function wateringNote(p, d) {
  const M = MEDIA[p.type], W = M.pot && p.watering !== 'top' ? WATERING[p.watering] : null;
  return `${W && W.hint ? `<p class="small muted m-0" id="watering-hint">${esc(W.hint)}</p>` : ''}
  ${p.watering === 'wick' && !d.wickTested ? '<p class="small muted way-more">Постоянно на фитиле проверены только фиалки. Для других растений данных нет: первые недели следите за листьями.</p>' : ''}
  ${d.type === 'dry' && W && W.wet && !M.wet ? warnBox(SUCC_WET) : ''}
  ${p.watering === 'tray' && cardWatering(d) !== 'tray' ? warnBox('Постоянно стоять в воде могут только хищные растения и циперус. У остальных корни задыхаются и гниют.') : ''}`;
}
// Under each yes-no question: what the current answer does, so trying «Да» and «Нет» shows how each works.
// Repotting only matters for plants called on «День подкормки»; for the rest it's greyed out, with why.
const hintLines = (...lines) => lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('');
function repotHint(p) {
  if (!feedsOnDay(p)) return hintLines('Влияет только на подкормку, а у этого растения дня подкормки нет.');
  if (repotted(p)) return hintLines(`Не позову на подкормку до ${parse(addDays(p.repotted, REPOT_DAYS)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, пока приживаются корни. Потом станет «Нет» само.`);
  return hintLines(settling(p) ? 'Не зову на подкормку: растение недавно приобрели.' : 'Подкормка как обычно.');
}
// «Подкормка» for plants fed on the feeding day: how often, winter under a lamp, the last time and «done today».
// Redrawn alone; the tapped chip or answer gets focus back.
function feedBox(p) {
  const n = feedEvery(p), last = p.fed, off = !feedsOnDay(p), dis = off ? ' disabled' : '';
  const chip = ([d, label]) => `<button class="chip ${!off && n === d ? 'on' : ''}" data-act="feed-every" data-id="${esc(p.id)}" data-n="${d}" aria-pressed="${!off && n === d}"${dis}>${label}</button>`;
  const when = off ? '' : !n ? 'Не позову на «День подкормки».'
    : feedDue(p) ? 'Позову в «Если есть силы» сегодня.'
      : repotted(p) || settling(p) || resting(p) ? 'Сейчас не зову: растение недавно пересадили, приобрели или оно отдыхает.'
        : winterNow() && !p.lamp ? 'Позову в марте.'
          : `Позову ${rel(addDays(last || today(), winterNow() ? Math.max(n, 30) : n))}.`;
  // «Weakly and regularly» is the orchid facts' advice; a card fed rarely by default (zamioculcas) doesn't get it.
  const regular = (def(p.id).feedEvery ?? 14) <= 30 ? ' Слабо и регулярно лучше, чем крепко и редко.' : '';
  // What the answer does right under the chips, then the card's advice: help comes last.
  const help = !off && p.feedNote ? `<p class="mt-12 small muted">${esc(p.feedNote)}${regular}</p>` : '';
  return `${off ? whyNot(feedWhyNot(p)) : ''}<div class="field" role="group" aria-labelledby="lbl-feed" aria-describedby="feed-when"><label id="lbl-feed">Как часто с марта по сентябрь</label><div class="chips">${FEED_EVERY.map(chip).join('')}</div>
    <p class="mt-6 small muted" id="feed-when">${when}</p>${help}</div>
    <button class="btn ok wide" data-act="feed-done" data-id="${esc(p.id)}"${dis || last === today() ? ' disabled' : ''}>${I('utensils')}Подкормлено сегодня</button>
    ${last ? `<p class="small muted last-done" tabindex="-1">Последний раз: ${esc(rel(last))}.</p>` : ''}`;
}
// «Лампа», under «Свет»: «Зимой стоит под лампой?». It's about where the plant stands; what it changes is winter feeding.
// Greyed out, with why, when the plant isn't called on «День подкормки» (as «Пересажено»).
function lampBox(p) {
  const n = feedEvery(p), off = !feedsOnDay(p) || !n;
  const hint = !feedsOnDay(p) ? 'Влияет только на подкормку, а у этого растения дня подкормки нет.'
    : !n ? 'Влияет только на подкормку, а она выключена в «Подкормке».'
      : p.lamp ? `Зимой позову на подкормку ${FEED_WORDS[Math.max(n, 30)]}, удобрение слабее, чем летом.` : 'Зимой на подкормку не зову: без лампы растение почти не растёт.';
  return `${askYesNo('Зимой стоит под лампой?', 'lamp', p.id, !!(p.lamp && !off), off, '', 'lamp-hint')}
    <p class="mt-6 small muted" id="lamp-hint">${hint}</p>`;
}
// Feeding changed: its box, and «Лампа», which depends on it.
function feedChanged(p) {
  $('#feed-box').innerHTML = feedBox(p);
  const lamp = $('#lamp-field');
  if (lamp) lamp.innerHTML = lampBox(p);
}
// A plant at rest (cards with `rest`): since when, what to do, and the way back.
// A plant moved to a card without `rest` while resting still gets the way back.
// «Покой» in «Сейчас»: «Сейчас в покое?» with «Да» / «Нет», like the rows next to it. For a card without rest,
// greyed out with why. A plant moved to such a card while resting can still answer «Нет».
// Drip irrigation keeps its interval at rest (startRest), so only feeding changes for it.
const restDoes = (p) => (wayOf(p).fixed ? '' : 'проверка вдвое реже, ');
const restHint = (p) => (resting(p)
  ? hintLines(wayOf(p).fixed ? 'На подкормку не зову.' : 'Проверяю вдвое реже, на подкормку не зову.', `«Нет», когда ${esc(p.rest ? p.rest.end.toLowerCase() : 'снова растёт')}.`)
  : hintLines('Обычный уход.', p.rest ? `«Да», когда ${esc(p.rest.start.toLowerCase())}: ${restDoes(p)}без подкормки.` : ''));
const restRowBody = (p) => {
  const off = !p.rest && !resting(p);
  return `${off ? whyNot('У этого растения не бывает покоя.') : ''}<div class="field">${askYesNo('Сейчас в покое?', 'rest', p.id, !!resting(p), off, '', 'rest-hint')}
    ${off ? '' : `<div class="mt-6 small muted hint" id="rest-hint">${restHint(p)}</div>`}</div>`;
};
// Rest: checks twice as rare (the interval comes back after), no feeding day, until new growth.
function startRest(id) {
  const r = S.plants[id];
  // Drip irrigation keeps its picked interval: it checks the system, not the soil.
  const fixed = !!wayOf(plant(id)).fixed;
  r.resting = { since: today(), ...(fixed ? {} : { iv: r.interval }) };
  if (!fixed) r.interval = Math.min(Math.round(r.interval * 2), 45);
  const next = addDays(r.lastWater || today(), Math.round(r.interval));
  r.nextCheck = next < today() ? today() : next;
  save(); track('plant_setting_rest_started', kindOf(id));
}
function endRest(id) {
  const r = S.plants[id], days = diff(r.resting.since, today());
  if (r.resting.iv) r.interval = r.resting.iv;
  delete r.resting;
  const next = addDays(today(), Math.round(r.interval));
  if (r.nextCheck > next) r.nextCheck = next;
  save(); track('plant_setting_rest_ended', { days, ...kindOf(id) });
}
const restBox = (p) => `<div class="info rest"><b>${I('moon')}Покой с ${parse(p.resting.since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</b>${p.rest ? esc(p.rest.tip) : ''}
  <button class="mt-12 btn ok wide" data-act="rest-end" data-id="${esc(p.id)}">${I('sprout')}${esc(p.rest ? p.rest.end : 'Снова растёт')}</button></div>`;
// «Новое»: quarantine and settling in, with dates; a card may add its own word (`settle`).
function newHint(p) {
  const day = (n) => parse(addDays(p.bought, n)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  if (!isNew(p)) return hintLines('Обычный уход, без карантина.');
  // Short: the feeding pause shows in «Подкормка» anyway.
  return hintLines(...[`Карантин до ${day(NEW_DAYS)}: держите отдельно, раз в неделю позову осмотреть.`,
    settling(p) ? `До ${day(SETTLE_DAYS)} привыкает: не переставлять, не обрезать, не пересаживать.` : '',
    p.settle && settling(p) ? esc(p.settle) : ''].filter(Boolean));
}
const ghHint = (on) => hintLines(on ? 'Каждый день позову проветрить.' : 'Проветривать не зову.');
// «Обрезка» in «Настройки»: a row per kind (like «Теплица») with a yes-no question; on «Да», how often, in which months, and «done today».
// Only the part under the question is redrawn, so the tapped answer keeps focus.
const MONTH_CHIPS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
// Months as words: runs of 3 and more as «май–сентябрь», the rest one by one: «март, апрель».
// A run may cross the new year («ноябрь–февраль»): the list starts after a month that's off.
function monthsText(ms, names = MONTHS) {
  const on = new Set(ms), runs = [];
  if (on.size === 12) return 'весь год';
  const start = [...Array(12).keys()].map((i) => i + 1).find((m) => !on.has(m));
  for (let i = 1; i <= 12; i++) {
    const m = ((start - 1 + i) % 12) + 1, last = runs[runs.length - 1];
    if (!on.has(m)) continue;
    if (last && last[last.length - 1] % 12 === m - 1) last.push(m); else runs.push([m]);
  }
  return runs.flatMap((r) => (r.length >= 3 ? [`${names[r[0] - 1]}–${names[r[r.length - 1] - 1]}`] : r.map((m) => names[m - 1]))).join(', ');
}
// The same months inside a sentence: «в марте или апреле» (once a year: any one of them), «с мая по сентябрь».
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
function monthsIn(ms, or) {
  if (new Set(ms).size === 12) return 'круглый год';
  const parts = monthsText(ms).split(', ').map((t) => {
    const [a, b] = t.split('–').map((m) => MONTHS.indexOf(m));
    return b === undefined ? { one: true, t: MONTHS_IN[a] } : { t: `с ${MONTHS_GEN[a]} по ${MONTHS[b]}` };
  });
  // «в» once before a run of single months: «в марте или апреле».
  const words = parts.map((x, i) => (x.one && !parts[i - 1]?.one ? `в ${x.t}` : x.t));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} ${or ? 'или' : 'и'} ${words[words.length - 1]}` : words[0];
}
function remindMore(id, kind) {
  const R = REMINDERS[kind], x = remindOf(S.plants[id], kind), last = S.bonus[`${kind}:${id}`], c = remindCard(plant(id), kind);
  // What the answer does first, then the card's tip: help comes last.
  if (!x) return `<div class="mt-6 small muted hint" id="remind-hint-${kind}">${hintLines(`Не зову ${R.verb}.`, c.tip && esc(c.tip))}</div>`;
  const often = R.every.find(([n]) => n === x.every);
  const yearly = x.every >= 300;
  const chip = (act, attr, on, label, aria = '') => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-id="${esc(id)}" data-kind="${kind}" ${attr} aria-pressed="${on}"${aria}>${label}</button>`;
  return `<div class="mt-6 small muted hint" id="remind-hint-${kind}">${hintLines(`Позову ${R.verb} в «Если есть силы» ${often ? often[2] : `раз в ${days(x.every)}`}, ${monthsIn(x.months, yearly)}.`, c.tip && esc(c.tip))}</div>
    <div class="field mt-12" role="group" aria-labelledby="lbl-every-${kind}"><label id="lbl-every-${kind}">Как часто</label><div class="chips">
      ${R.every.map(([n, label]) => chip('remind-every', `data-n="${n}"`, x.every === n, label)).join('')}</div></div>
    <div class="field" role="group" aria-labelledby="lbl-months-${kind}"><label id="lbl-months-${kind}">В какие месяцы</label><div class="chips">
      ${MONTH_CHIPS.map((m, i) => chip('remind-month', `data-m="${i + 1}"`, x.months.includes(i + 1), m, ` aria-label="${MONTHS[i]}"`)).join('')}</div></div>
    <button class="btn ok wide" data-act="remind-done" data-id="${esc(id)}" data-kind="${kind}"${last === today() ? ' disabled' : ''}>${I(R.icon)}${R.btn}</button>
    ${last ? `<p class="small muted last-done" tabindex="-1" id="remind-last-${kind}">Последний раз: ${esc(rel(last))}.</p>` : ''}`;
}
// Every kind is drawn; `fits` (none today) would hide one that doesn't fit how the plant grows, and changeWay shows it again.
// A card that isn't pruned says so instead of the question, unless the reminder is already on.
const remindNo = (id, kind) => !remindOf(S.plants[id], kind) && remindCard(plant(id), kind).no;
const remindBody = (id, kind) => (remindNo(id, kind) ? `<div class="small muted hint">${hintLines(esc(remindCard(plant(id), kind).no))}</div>`
  : `<div class="field">${askYesNo(`${REMINDERS[kind].toggle}?`, 'remind', id, !!remindOf(S.plants[id], kind), false, kind, `remind-hint-${kind}`)}
  <div id="remind-${kind}">${remindMore(id, kind)}</div></div>`);
// «Промывка грунта» in the plant card: done on «Банный день», so here only how it goes for this plant, the last
// time, «Промыто сегодня» and a way to leave it out. Without soil to rinse, why not; nothing for a block or terrarium.
function rinseBox(p) {
  const box = (body) => body; // its row (setRow) is the section
  if (!rinseFits(p)) {
    const care = MEDIA[p.type].care;
    const note = p.type === 'water' ? 'В воде грунта нет: соли уходят со сменой воды.'
      : care && ['flush', 'leach'].includes(care.kind) ? `Здесь своя промывка: позову отдельно («${care.task}»).`
        : p.distilled ? 'Поливают только дистиллированной водой: солям неоткуда взяться.'
          : p.type === 'terrarium' ? 'В закрытом террариуме промывать нельзя: воде некуда стечь.'
            : p.type === 'aquarium' ? 'Корни в аквариуме: грунта для промывки нет.' : 'На блоке грунта для промывки нет.';
    return box(`${whyNot(note)}<button class="btn ok wide" disabled>${I('droplets')}Промыто сегодня</button>`);
  }
  const n = bathEvery(), last = S.bonus['rinse:' + p.id];
  const how = !n ? 'Промывать удобнее всех сразу: включите «Банный день» в «Настройках» приложения.'
    : p.noBath ? 'В банный день не зову.'
      : `Позову в банный день раз в ${(BATH_EVERY.find(([d]) => d === n)?.[1] || `${n} дней`).toLowerCase()}.`;
  // The question first, what the answer does under it, then why rinse at all: help comes last.
  return box(`<div class="field">${askYesNo('Звать в банный день?', 'bath', p.id, !!(n && !p.noBath), !n, '', 'rinse-hint')}
      <div class="mt-6 small muted hint" id="rinse-hint">${hintLines(how, RINSE.why)}</div></div>
    <button class="btn ok wide" data-act="rinse-done" data-id="${esc(p.id)}"${last === today() ? ' disabled' : ''}>${I('droplets')}Промыто сегодня</button>
    ${last ? `<p class="small muted last-done" tabindex="-1">Последний раз: ${esc(rel(last))}.</p>` : ''}`);
}
// Sets one reminder: null turns it off. Reports the change.
function setRemind(id, kind, x, action) {
  const r = S.plants[id];
  if (x) r.remind = { ...(r.remind || {}), [kind]: x };
  else if (r.remind) { delete r.remind[kind]; if (!Object.keys(r.remind).length) delete r.remind; }
  save();
  $(`#remind-${kind}`).innerHTML = remindMore(id, kind);
  // Pruning is the only reminder now: another kind would need its own events in analytics/events.json.
  if (kind !== 'prune') return;
  if (action === 'every') track('plant_setting_prune_schedule_changed', { every: x.every });
  else if (action === 'months') track('plant_setting_prune_months_changed', { months: x.months.length });
  else if (action === 'on' || action === 'off') track('plant_setting_prune_toggled', { on: action === 'on' });
}
const intHint = (p) => `Подстраивается по вашим ответам «${labelsOf(p)[0]}» и «${labelsOf(p)[1]}».`;
// How often it's checked: a stepper for a learned interval; for a system that waters by itself, chips
// with the way's options (it doesn't learn). Redrawn alone when the way changes.
const everyLabel = (n) => (n === 7 ? 'Неделя' : `${n / 7} недели`);
function intBox(p) {
  const g = wayOf(p), iv = Math.round(p.interval);
  if (g.noChecks) return `<label id="lbl-int" class="sr-only">Проверять примерно каждые</label>${whyNot('Корни в аквариуме: проверять полив не нужно.')}`;
  if (g.fixed) {
    return `<label id="lbl-int" class="sr-only">Проверять систему</label><div class="chips">
      ${g.picks.map((n) => `<button class="chip ${iv === n ? 'on' : ''}" data-act="int-pick" data-id="${esc(p.id)}" data-n="${n}" aria-pressed="${iv === n}">${everyLabel(n)}</button>`).join('')}</div>
      <p class="mt-6 small muted" id="int-hint">Сам не меняется: проверю систему так часто, как вы выберете.</p>`;
  }
  return `<label id="lbl-int" class="sr-only">Проверять примерно каждые</label><div class="stepper">
    <button data-act="int-minus" data-id="${esc(p.id)}" aria-label="Чаще">${I('minus')}</button><b id="int-val">раз в ${days(iv)}</b>
    <button data-act="int-plus" data-id="${esc(p.id)}" aria-label="Реже">${I('plus')}</button></div>
    <p class="mt-6 small muted" id="int-hint">${intHint(p)}</p>`;
}

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

// Tags under the quote, every one listed in TAGS.md. Each is a button: a tap opens a bubble with what it means (toggleTag). Keys are the `tag` values
// of `plant_tag_opened`, the same as `plants_filtered`'s `status` where both have it. Facts that were here before
// (interval, light, temperature, medium) are in the settings rows and in «Заметки».
const fullStop = (t) => (/[.!?]$/.test(t) ? t : `${t}.`);
const dayMonth = (iso) => parse(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
function tagsOf(p) {
  const out = [], pets = petsOn() && petsOf(p), g = wayOf(p);
  const tag = (key, cls, icon, word, title, text, sr = '') => out.push({ key, cls, icon, word, title, text, sr });
  const next = g.noChecks ? '' : ` Следующая проверка ${esc(rel(p.nextCheck))}.`;
  const lux = p.lux ? `Здесь ${kLux(p.lux)} ${LK}, а нужно ${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} ${LK}.` : '';
  // The plant (how it is now, rest, how it grows, greenhouse), then safety (the pet paw, sap, quarantine): the grid's left
  // and right badge columns, bottom up. See TAGS.md.
  states(p).forEach((k) => {
    const word = stateWord(k, p);
    const text = { need: fullStop(esc(waterTask(p))), watered: next.trim(), dim: lux, hot: lux, fine: fineText(p) }[k];
    tag(k, k, STATES[k][0], word, upFirst(word), text);
  });
  if (resting(p)) tag('rest', 'rest', 'moon', 'отдыхает', `Покой с ${dayMonth(p.resting.since)}`, upFirst(`${restDoes(p)}без подкормки.`));
  growTags(p, 2).forEach((k) => { const [icon, word] = growBadge(k), w = MEDIA[k] || WATERING[k]; tag(k, 'way', icon, word, upFirst(word), w.tagHint || w.hint || ''); });
  if (p.greenhouse) tag('greenhouse', 'greenhouse', 'house-heart', 'в теплице', 'В теплице', 'Каждый день позову проветрить.');
  if (pets === 'toxic') tag('pets', 'danger', 'paw-toxic', 'опасно', 'Ядовито для кошек и собак', `${p.petsNote ? esc(p.petsNote) + ' ' : ''}Если питомец погрыз растение, сразу позвоните в ветеринарную клинику.`, ' для питомцев');
  if (pets === 'safe') tag('pets_safe', 'safe', 'paw-print', 'безопасно', 'Безопасно для кошек и собак', 'По базе ASPCA.', ' для питомцев');
  if (p.toxic) tag('sap', 'danger', 'triangle-alert', 'едкий сок', 'Едкий сок', `Сок раздражает кожу${p.toxic === 'skin' ? '' : ' и слизистые'}. Работайте в перчатках.`);
  if (isNew(p)) tag('new', 'danger', 'biohazard', 'на карантине', `На карантине до ${dayMonth(addDays(p.bought, NEW_DAYS))}`,
    `Держите отдельно, раз в неделю позову осмотреть.${settling(p) ? ` До ${dayMonth(addDays(p.bought, SETTLE_DAYS))} привыкает: не переставлять, не обрезать, не пересаживать.` : ''}`);
  return out;
}
// «хорошо»: no watering due and the light is fine. On a first check day before any answer the plant isn't called dry
// (states), but the check is on «Сегодня», so it's said here too. Other tasks (quarantine, feeding) have their own tags or rows.
function fineText(p) {
  const g = wayOf(p);
  if (g.noChecks) return 'Поливать не нужно, корни в воде аквариума.';
  if (p.nextCheck <= today()) return `Первая проверка сегодня. ${fullStop(esc(waterTask(p)))}`;
  return `Полив пока не нужен. Следующая проверка ${esc(rel(p.nextCheck))}.`;
}
const tagsHtml = (p) => tagsOf(p).map((t) => `<button class="tag ${t.cls}" data-act="tag" data-id="${esc(p.id)}" data-tag="${t.key}" aria-expanded="false" aria-controls="tag-tip">${I(t.icon)}<span>${t.word}${t.sr ? `<span class="sr-only">${t.sr}</span>` : ''}</span></button>`).join('')
  + '<div class="tag-tip" id="tag-tip" hidden></div>';
// Redraws the tags after a change in the card (closes an open bubble).
function refreshTags(p) {
  const box = $('#tags');
  if (box) box.innerHTML = tagsHtml(p);
}
// A tag's bubble: opens under the tapped tag (or over it near the screen's bottom), over the content (nothing moves).
// Closes on the same tag, a tap elsewhere, Esc, focus moving on, or the phone turning. Screen readers hear its text.
function closeTag() {
  const tip = $('#tag-tip'), on = $('.tag[aria-expanded="true"]');
  if (tip) tip.hidden = true;
  if (on) on.setAttribute('aria-expanded', 'false');
  return on;
}
function toggleTag(el, id) {
  const was = closeTag();
  if (was === el) return;
  const t = tagsOf(plant(id)).find((x) => x.key === el.dataset.tag), tip = $('#tag-tip');
  if (!t || !tip) return;
  tip.innerHTML = `<b>${I(t.icon)}${t.title}</b>${t.text}`;
  tip.hidden = false;
  // Under the tag; when that runs past the bottom of the screen and there's room above (below the strip under ×),
  // over it instead. If neither fits, it stays under and the card scrolls just enough to show it.
  const vh = window.visualViewport ? window.visualViewport.height : innerHeight;
  const r = el.getBoundingClientRect(), h = tip.offsetHeight;
  const up = r.bottom + 12 + h > vh - 8 && r.top - 12 - h >= 84;
  tip.classList.toggle('up', up);
  tip.style.top = `${up ? el.offsetTop - h - 12 : el.offsetTop + el.offsetHeight + 12}px`;
  if (!up) tip.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  tip.style.setProperty('--ax', `${el.offsetLeft + el.offsetWidth / 2 - 10}px`);
  el.setAttribute('aria-expanded', 'true');
  announce(`${t.title}. ${tip.textContent.slice(t.title.length)}`);
  const all = [...el.parentElement.querySelectorAll('.tag')];
  track('plant_tag_opened', { tag: t.key, position: all.indexOf(el) + 1, count: all.length, ...kindOf(id) });
}
document.addEventListener('click', (e) => { if (!e.target.closest('.tag, .tag-tip')) closeTag(); });
// Focus moving on (Tab) closes it too, even to the next tag (one in the row below would be under it).
document.addEventListener('focusin', (e) => { if (e.target.getAttribute?.('aria-expanded') !== 'true' && !e.target.closest?.('.tag-tip')) closeTag(); });
// Turning the phone rewraps the tags: the bubble would point at the wrong one. Height alone changes as browser bars hide.
let tagW = innerWidth;
addEventListener('resize', () => { if (innerWidth !== tagW) { tagW = innerWidth; closeTag(); } });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const on = closeTag();
  if (!on) return;
  // Esc closes the bubble only, not the card.
  e.preventDefault(); e.stopPropagation(); on.focus();
}, true);
// Answers in history. Neutral words: an entry doesn't say which way the plant grew then.
const HIST_WORDS = { water: 'полив', wet: 'ещё влажно', ok: 'работает', fix: 'поправлено', feed: 'подкормлено', rinse: 'промыто' };
// Dots: a watering or a working system is full, the other answer is light.
const HIST_DOTS = { water: 'w', ok: 'w', wet: 'd', fix: 'd' };
// The legend's words: the kinds shown in the strip (`shown`), else the current way's: a system's checks, or waterings.
// Before the first answer (`plan`) only the planned checks are on the strip, so only they are in the legend.
const legendHtml = (p, plan, shown) => {
  const keys = plan ? [] : shown && shown.size ? Object.keys(HIST_DOTS).filter((k) => shown.has(k)) : wayOf(p).fixed ? ['ok', 'fix'] : ['water', 'wet'];
  return `<p class="small legend" aria-hidden="true">${plan ? '<span><i class="plan"></i>проверка</span>' : ''}${keys.map((k) => `<span><i class="${HIST_DOTS[k]}"></i>${HIST_WORDS[k]}</span>`).join('')}</p>`;
};
// 28 days as dots in calendar weeks, Monday first, under the weekday letters, so each dot is a day you can name.
// `cls(iso, i)` gives a day's class; i is 0 for the first day. Days before the first in its week are blank.
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
function dotWeeks(first, cls) {
  const pad = (parse(first).getDay() + 6) % 7;
  const cells = [...WEEKDAYS.map((d) => `<li class="wd">${d}</li>`), ...Array(pad).fill('<li class="pad"></li>')];
  for (let i = 0; i < 28; i++) { const d = addDays(first, i); cells.push(`<li class="${cls(d, i)}"></li>`); }
  return `<ol class="rhythm" aria-hidden="true">${cells.join('')}</ol>`;
}
// The last 4 weeks as dots: watered, still moist, nothing. Today has a ring. The dots and their
// legend are hidden from screen readers: the average and the list below say the same.
// The average counts only waterings in these 4 weeks.
function rhythmHtml(p) {
  const byDay = {}, from = addDays(today(), -27), shown = new Set();
  // Only answers to checks get a dot; other kinds in the history are only in the list.
  p.hist.forEach((h) => {
    if (!HIST_DOTS[h.a] || h.d < from) return;
    shown.add(h.a);
    if (byDay[h.d] !== 'w') byDay[h.d] = HIST_DOTS[h.a];
  });
  const waters = [...new Set(p.hist.filter((h) => h.a === 'water' && h.d >= from).map((h) => h.d))].sort();
  const gaps = waters.slice(1).map((d, i) => diff(waters[i], d));
  const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
  return `${dotWeeks(from, (d) => `${byDay[d] || ''}${d === today() ? ' now' : ''}`)}
    ${legendHtml(p, false, shown)}
    ${avg ? `<p class="small muted m-0">В среднем раз в ${days(avg)}.${wayOf(p).noChecks ? '' : ` Проверка сейчас: раз в ${days(Math.round(p.interval))}.`}</p>` : ''}`;
}

// No answers yet: the next 4 weeks in the same dots, with the planned checks dashed, so the tab
// shows what's coming and how it will look. Plants without checks (an aquarium) get a line instead.
function plannedHtml(p) {
  if (wayOf(p).noChecks) return '<p class="muted">Пока пусто. Здесь будут ваши отметки.</p>';
  const first = !p.nextCheck || p.nextCheck < today() ? today() : p.nextCheck, last = addDays(today(), 27), plan = new Set();
  for (let d = first; d <= last; d = addDays(d, Math.max(1, Math.round(p.interval)))) plan.add(d);
  return `<section class="group" aria-labelledby="g-soon"><h3 id="g-soon">Ближайшие 4 недели</h3>
    ${dotWeeks(today(), (d, i) => `${plan.has(d) ? 'plan' : ''}${i ? '' : ' now'}`)}
    ${legendHtml(p, true)}
    <p class="small muted m-0">Отметок пока нет. Первая проверка ${esc(rel(first))}, дальше ${wayOf(p).fixed ? everyText(Math.round(p.interval)) : `примерно раз в ${days(Math.round(p.interval))}`}. Ваши ответы появятся здесь.</p></section>`;
}

// The list in «История»: each entry with its icon and the word from its button («Полито», «Долито», «Подкормлено»).
const HIST_ICONS = { water: 'droplet', wet: 'droplet-off', ok: 'check', fix: 'wrench', feed: 'utensils', rinse: 'droplets' };
function histDone(p, a) {
  const g = wayOf(p);
  if (a === 'water' || a === 'wet') return g.fixed ? (a === 'water' ? 'Полито' : 'Ещё влажно') : g.labels[a === 'water' ? 0 : 1];
  const fixed = { ok: 'Работает', fix: 'Поправлено', feed: 'Подкормлено', rinse: 'Промыто' }[a];
  return fixed || (REMINDERS[a] ? REMINDERS[a].btn.replace(' сегодня', '') : 'Ещё влажно');
}
// Grouped by month, newest first. A line marks where the learned interval changed («Проверка теперь раз в 6 дней»):
// entries since v152 carry it (`iv`). The newest check answer has «×» to take it back (undoAnswer).
function historyList(p) {
  const newest = p.hist.findIndex((h) => CHECK_ANSWERS.includes(h.a)), year = new Date().getFullYear();
  let out = '', month = '';
  p.hist.forEach((h, i) => {
    const dt = parse(h.d);
    const m = dt.toLocaleDateString('ru-RU', dt.getFullYear() === year ? { month: 'long' } : { month: 'long', year: 'numeric' });
    if (m !== month) { out += `${month ? '</ol>' : ''}<h3 class="hl-month">${esc(m[0].toUpperCase() + m.slice(1))}</h3><ol class="hl-list">`; month = m; }
    const older = p.hist.slice(i + 1).find((x) => x.iv !== undefined);
    if (h.iv !== undefined && older && Math.round(older.iv) !== Math.round(h.iv)) {
      out += `<li class="hl-iv">${I('timer')}<span>Проверка теперь раз в ${days(Math.round(h.iv))}</span></li>`;
    }
    const word = histDone(p, h.a), date = dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
    out += `<li class="hl ${esc(h.a)}"><span class="hl-ic" aria-hidden="true">${I(HIST_ICONS[h.a] || (REMINDERS[h.a] && REMINDERS[h.a].icon) || 'check')}</span>
      <span class="hl-w"><b>${esc(word)}</b><small>${esc(date)}</small></span>
      ${i === newest ? `<button class="hl-x" data-act="hist-undo" data-id="${esc(p.id)}" aria-label="Убрать отметку «${esc(word)}», ${esc(date)}">${I('x')}</button>` : ''}</li>`;
  });
  return out ? `${out}</ol>` : '';
}
// «История»: the last 4 weeks of checks as dots (or the next 4 weeks before the first one), then the list,
// reminders done included. Redrawn alone after «Обрезано сегодня».
function historyHtml(p) {
  const checks = checksOf(p); // reminders done (a pruning) are only in the list
  const list = historyList(p);
  const top = checks.length ? (checks.some((h) => h.d >= addDays(today(), -27)) ? `<section class="group" aria-labelledby="g-weeks"><h3 id="g-weeks">Последние 4 недели</h3>${rhythmHtml(p)}</section>` : '')
    : list && wayOf(p).noChecks ? '' : plannedHtml(p);
  return `${top}${list}`;
}
const refreshHistory = (id) => { const box = $('#cp-history'); if (box && sheet.open && cardFor === id) box.innerHTML = historyHtml(plant(id)); };

// Tabs of the plant card. The card opens on «Настройки»; a redraw of the same open card keeps the tab.
// «Настройки» first: people switch to it after about half of card opens (PostHog, November 2026), and rarely back.
const CARD_TABS = [['settings', 'Настройки'], ['notes', 'Заметки'], ['history', 'История']];
let cardTab = 'settings', cardFor = null;
function showCardTab(k, focus) {
  cardTab = k;
  CARD_TABS.forEach(([t]) => {
    const b = $('#ct-' + t), on = t === k;
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
    $('#cp-' + t).hidden = !on;
  });
  if (focus) $('#ct-' + k).focus();
}
// A tab chosen by a tap or the arrow keys; the tab the card opens on goes with `plant_opened`.
function pickCardTab(k, focus) {
  if (k !== cardTab) track('plant_tab_opened', { tab: k });
  showCardTab(k, focus);
}

// The plant's «Настройки»: four groups of folding rows. Each row shows its current value (rowValues) and opens on
// tap; a value that doesn't apply is grey. Open rows stay open while the same plant's card is redrawn.
// Rows open when a plant's card opens: «Полив», whose button is used most. Closing it lasts until the card closes.
const OPEN_ROWS = ['water'];
let openRows = new Set(OPEN_ROWS), openRowsFor = null;
// How feeding goes now, as feedDue decides: the schedule (monthly in winter under a lamp), then why it waits: rest,
// a recent repot or purchase (until the later date), winter without a lamp. A date that falls in a lampless winter
// waits until March.
const isWinter = (iso) => { const m = parse(iso).getMonth() + 1; return m < 3 || m > 9; };
// Closed row values use three-letter months without a dot («24 дек», «апр–авг»), so they stay short; screen readers
// hear the full ones. A date takes the genitive («10 мая»), a range the nominative («май»).
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_SHORT_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const shortened = (short, full) => `<span aria-hidden="true">${short}</span><span class="sr-only">${full}</span>`;
const shortDay = (iso) => { const d = parse(iso); return shortened(`${d.getDate()}\u00a0${MONTHS_SHORT_GEN[d.getMonth()]}`, dayMonth(iso)); };
// A row value of several parts: each kept whole, so a long one wraps only after a comma («раз в 2 недели, / зимой пауза»).
const vParts = (parts) => parts.filter(Boolean).map((x) => `<span class="vp">${x}</span>`).join(', ');
function feedValue(p) {
  const n = feedEvery(p);
  if (!n) return 'не кормлю';
  const every = winterNow() && p.lamp && n < 30 ? 'зимой раз в месяц' : FEED_WORDS[n];
  const until = [repotted(p) ? addDays(p.repotted, REPOT_DAYS) : '', settling(p) ? addDays(p.bought, SETTLE_DAYS) : ''].filter(Boolean).sort().pop();
  const pause = resting(p) ? 'пауза, пока в покое'
    : until ? (!p.lamp && isWinter(until) ? 'пауза до марта' : `пауза до\u00a0${shortDay(until)}`)
      : winterNow() && !p.lamp ? 'зимой пауза' : '';
  return vParts([every, pause]);
}
// Values are HTML: typed text (name, room, spot) goes through typedHtml so long words hyphenate.
function rowValues(p) {
  const r = S.plants[p.id] || {}, ls = lightStatus(p), pot = MEDIA[p.type].pot, fed = feedsOnDay(p);
  const prune = remindOf(r, 'prune'), n = bathEvery(), g = wayOf(p), iv = Math.round(p.interval), place = [roomOf(p).name, p.spot].filter(Boolean);
  const feedOff = p.distilled ? 'не удобряют' : p.type === 'water' ? 'при смене воды' : FEED_WITH[MEDIA[p.type].feed] || 'нет дня подкормки';
  const rinseOff = p.type === 'water' ? 'соли уходят с водой' : MEDIA[p.type].care ? 'своя промывка' : p.distilled ? 'не нужна' : 'нельзя';
  return {
    name: p.name ? [typedHtml(p.name), false] : ['без имени', true],
    card: isCustom(p.id) ? ['своё растение', true] : [esc(def(p.id).species), false],
    // The room always; a spot not picked yet stays a grey «место не выбрано» after it.
    place: [vParts(p.spot ? place.map(typedHtml) : [typedHtml(roomOf(p).name), '<i class="off-part">место не выбрано</i>']), false],
    light: p.lux ? [`${p.lux} ${LK}${ls ? ', ' + LIGHT_WORDS[ls] : ''}`, false] : ['не замеряли', true],
    gh: [p.greenhouse ? 'в теплице' : 'нет', false],
    // Only feeding notices the lamp: without a feeding day it's grey, as «Пересажено».
    lamp: !fed || !feedEvery(p) ? ['не влияет', true] : [p.lamp ? 'под лампой' : 'нет', false],
    every: g.noChecks ? ['не нужно', true] : [g.fixed ? everyText(iv) : `раз в ~${days(iv)}`, false],
    way: [MEDIA[p.type].name.toLowerCase(), false],
    // Closed «Полив»: when the next check is, «через 7 дней» (a drip system's too); an aquarium is never watered.
    water: g.noChecks ? ['не нужен', true] : [esc(rel(p.nextCheck)).replace(/(\d) /g, '$1\u00a0'), false],
    feed: !fed ? [feedOff, true] : [feedValue(p), false],
    prune: prune ? [shortened(vParts(monthsText(prune.months, MONTHS_SHORT).split(', ')), monthsText(prune.months)), false] : remindCard(p, 'prune').no ? ['не обрезают', true] : ['нет', false],
    rinse: !rinseFits(p) ? [rinseOff, true] : !n ? ['банный день выключен', true] : [p.noBath ? 'не купать' : 'в банный день', false],
    // «да, на карантине до 7 янв»: one phrase, wrapping as text; «до 7 янв» stays together.
    bought: [isNew(p) ? `да, на карантине до\u00a0${shortDay(addDays(p.bought, NEW_DAYS))}` : 'нет', false],
    repot: !fed ? ['не влияет', true] : [repotted(p) ? `да, без подкормки до\u00a0${shortDay(addDays(p.repotted, REPOT_DAYS))}` : 'нет', false],
    rest: resting(p) ? [`с ${shortDay(p.resting.since)}`, false] : p.rest ? ['нет', false] : ['не бывает', true],
  };
}
const ROW_TITLES = { name: 'Имя', card: 'Карточка ухода', place: 'Место', light: 'Свет', gh: 'Теплица', every: 'Проверка', way: 'В чём растёт', water: 'Полив',
  lamp: 'Лампа', feed: 'Подкормка', prune: 'Обрезка', rinse: 'Промывка грунта', bought: 'Новое', repot: 'Пересажено', rest: 'Покой' };
function setRow(key, body, vals, opened) {
  const [v, off] = vals[key], open = opened.has(key);
  return `<div class="srow" id="sr-${key}"><button class="srow-head" id="srh-${key}" data-act="srow" data-row="${key}" aria-expanded="${open}" aria-controls="srb-${key}">
    <span class="srow-t">${ROW_TITLES[key]}</span><span class="srow-v${off ? ' off' : ''}" id="srv-${key}">${v}</span>${I('chevron-right')}</button>
    <div class="srow-body" id="srb-${key}" role="region" aria-labelledby="srh-${key}"${open ? '' : ' hidden'}>${body}</div></div>`;
}
const setGroup = (key, title, rows) => `<section class="srows" aria-labelledby="sg-${key}"><h3 class="srows-title" id="sg-${key}">${title}</h3>${rows}</section>`;
// After any change in the settings, the row values catch up (the handlers redraw only their own bodies).
function refreshRows() {
  if (!sheet.open || !cardFor || !$('#cp-settings')) return;
  const p = plant(cardFor);
  if (!p) return;
  Object.entries(rowValues(p)).forEach(([k, [v, off]]) => { const el = $(`#srv-${k}`); if (el) { if (el.innerHTML !== v) el.innerHTML = v; el.classList.toggle('off', off); } });
  keepTapped();
}
// A tap can change rows above it: another row's value gets longer and wraps («пауза до 21 декабря» in a closed
// «Подкормка» after «Новое: Да»). The sheet scrolls by as much, so the tapped control stays under the finger.
// A handler may draw the control anew, so it's found again by its data attributes.
let tapped = null;
const TAP_KEYS = ['act', 'field', 'kind', 'v', 'n', 'm', 'way', 'row', 'spot', 'room'];
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('#cp-settings [data-act]');
  if (!el || el.dataset.act === 'srow') { tapped = null; return; } // opening a row moves what's below it, as it should
  const sel = TAP_KEYS.filter((k) => el.dataset[k] !== undefined).map((k) => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join('');
  tapped = { el, sel, top: el.getBoundingClientRect().top };
}, true);
function keepTapped() {
  const t = tapped;
  tapped = null;
  if (!t) return;
  const el = t.el.isConnected ? t.el : $(`#cp-settings ${t.sel}`);
  const box = $('#sheet');
  if (!el || !box || el.closest('[hidden]')) return;
  const moved = el.getBoundingClientRect().top - t.top;
  if (Math.abs(moved) >= 1) box.scrollTop += moved;
}
// Submit too: a new spot added with Enter goes through the form, with no click or change after it.
['change', 'click', 'input', 'submit'].forEach((t) => document.addEventListener(t, (e) => { if (e.target.closest && e.target.closest('#cp-settings')) setTimeout(refreshRows, 0); }));
// Once the card has slid over the picture, a solid strip shows under the floating ×, so rows pass under the strip
// instead of half under the button. Only a class changes: nothing in the card moves.
$('#sheet').addEventListener('scroll', (e) => { // `sheet` comes later, in app.js
  const pic = $('#sheet-body .hero-pic'), box = e.currentTarget;
  box.classList.toggle('scrolled', !!pic && box.scrollTop > pic.offsetHeight - 84);
}, { passive: true });
// `rows`: settings rows to open, as for a plant just added (name and place).
function openPlant(id, tabKey, rows) {
  const p = plant(id);
  if (!p) return;
  noteEdit = null;
  if (tabKey) cardTab = tabKey; else if (!sheet.open || cardFor !== id) cardTab = 'settings';
  // A card opened anew starts with the default rows; a redraw of the open card (a photo, a change of card) keeps them.
  if (openRowsFor !== id || rows || !sheet.open) { openRows = new Set([...OPEN_ROWS, ...(rows || [])]); openRowsFor = id; }
  cardFor = id;
  $('#sheet-body').innerHTML = plantCardHtml(id);
  openSheet();
}
// The light word next to a reading, as on the Light tab.
const luxState = (ls) => (ls ? `<span class="light-tag ${ls}">${LIGHT_WORDS[ls]}</span>` : '');
// «Карточка ухода» open: the card itself, as a catalog row shows it (picture, name, light), plus how often it's checked
// and what it grows in. Not a control: a quiet border.
function cardNow(d) {
  const way = [MEDIA[d.type] ? MEDIA[d.type].name.toLowerCase() : '', cardWatering(d) && cardWatering(d) !== 'top' ? WATERING[cardWatering(d)].name.toLowerCase() : ''].filter(Boolean).join(', ');
  // A way that's never checked (an aquarium) has no interval to show, as its «Проверка» row says «не нужно».
  const check = MEDIA[d.type] && MEDIA[d.type].noChecks ? '' : `проверка раз в ~${days(d.every)}`;
  const facts = [d.hint ? esc(d.hint) : '', `свет ${kLux(d.lux[0])}–${kLux(d.lux[1])} ${LK}`, check, way].filter(Boolean).join(' · ');
  return `<div class="pick card-now"><span class="pe fit" aria-hidden="true">${plantSvg(d, 'fine', true)}</span><span class="pt"><b>${esc(d.species)}</b><small>${facts}</small></span></div>`;
}
// The «Настройки» tab: who the plant is, where it lives, its care, and what's going on now. The bodies keep their
// ids, so each handler still redraws its own part (feedBox, rinseBox, mediumBox…). «Уход» goes in the order care is
// thought about: what it grows in, watering (how it's watered, «Полито сегодня», the next check), checks, rinse, feeding, pruning.
function settingsHtml(id, p, ls, spots) {
  const v = rowValues(p);
  // Only this plant's open rows: the stories draw a sample plant's card while a real one may be open.
  const opened = openRowsFor === id ? openRows : new Set(OPEN_ROWS);
  const row = (key, body) => setRow(key, body, v, opened);
  return `${setGroup('plant', 'Растение',
    row('name', `<div class="field"><label for="f-name">Как зовут</label><input class="input" id="f-name" data-field="name" data-id="${esc(id)}" value="${esc(p.name)}" placeholder="Например, Коля" maxlength="40"></div>
        <div class="field"><label for="f-species">Вид, сорт</label><input class="input" id="f-species" data-field="species" data-id="${esc(id)}" value="${esc(p.species)}" placeholder="${esc(def(id).species)}" maxlength="80">
          ${S.plants[id].species ? `<p class="mt-6 small muted">В каталоге: ${esc(def(id).species)}. Сотрите поле, чтобы вернуть.</p>` : ''}</div>`)
    + row('card', cardNow(def(id)) + (isCustom(id) ? `${whyNot('Своё растение: уход подобран под него, карточки из каталога у него нет.')}<button class="btn primary wide" disabled>${I('arrow-left-right')}Сменить карточку</button>`
      : `<p class="small muted m-0" id="card-hint">Отсюда советы, свет и полив. При смене карточки имя, фото, заметки и история останутся.</p>
          <button class="btn primary wide" data-act="card-change" data-id="${esc(id)}" aria-describedby="card-hint">${I('arrow-left-right')}Сменить карточку</button>`)))}
    ${setGroup('where', 'Где живёт',
    // The room shows even when there's only one, so people see rooms exist (they're added in «Комната»).
    row('place', `<div class="field" role="group" aria-labelledby="lbl-room"><label id="lbl-room">Комната</label><div class="chips">
          ${S.rooms.map((rm) => `<button class="chip ${roomOf(p) === rm ? 'on' : ''}" data-act="room-pick" data-id="${esc(id)}" data-room="${esc(rm.id)}" aria-pressed="${roomOf(p) === rm}">${typedHtml(rm.name)}</button>`).join('')}</div></div>
        <div class="field" role="group" aria-labelledby="lbl-spot"><label id="lbl-spot">Где стоит</label><div class="chips" id="spot-chips">
          ${spots.map((sp) => spotChip(id, sp, p.spot === sp)).join('')}
          <button class="chip" data-act="spot-form" data-id="${esc(id)}" aria-expanded="false" aria-controls="new-spot-form">${I('plus')}место</button></div>
          <form class="new-spot" id="new-spot-form" data-id="${esc(id)}" hidden><input class="input" id="f-new-spot" placeholder="Новое место" aria-label="Новое место" maxlength="40" enterkeyhint="done">
            <button type="button" class="btn primary" data-act="spot-new" data-id="${esc(id)}" aria-label="Добавить место">${I('plus')}</button></form></div>`)
    // As a row on the Light tab (lightRow): a question mark while empty, «лк» by the field, the light word beside it, then the need.
    + row('light', `<div class="field"><label for="f-lux">Замер люксметром</label>
          <div class="lux-read"><input class="input" type="number" inputmode="numeric" id="f-lux" placeholder="?" data-field="lux" data-id="${esc(id)}" value="${p.lux ?? ''}" aria-describedby="lux-need lux-hint"><span class="unit" aria-hidden="true">лк</span><span class="lux-state" id="card-lux-state">${luxState(ls)}</span></div>
          <p class="mt-8 small" id="lux-need">Нужно ${kNum(p.luxRange[0])}–\u2060${kNum(p.luxRange[1])}\u00a0тыс люксов</p>
          <p class="mt-6 small muted" id="lux-hint">Мерьте у листьев днём, подойдёт и приложение для телефона.</p></div>`)
    + row('lamp', `<div class="field" id="lamp-field">${lampBox(p)}</div>`)
    + row('gh', `<div class="field">${askYesNo('Стоит в теплице или под колпаком?', 'greenhouse', id, !!p.greenhouse, false, '', 'gh-hint')}
          <div class="mt-6 small muted hint" id="gh-hint">${ghHint(p.greenhouse)}</div></div>`))}
    ${setGroup('care', 'Уход',
    row('way', `<div id="way-box">${mediumBox(p, def(id))}</div>`)
    + row('water', `<div class="watering-in" id="watering-box">${wateringBox(p, def(id))}</div><div id="water-box">${waterBox(p)}</div>`)
    + row('every', `<div class="field" role="group" aria-labelledby="lbl-int" aria-describedby="int-hint" id="int-field">${intBox(p)}</div>`)
    + row('rinse', `<div id="rinse-wrap">${rinseBox(p)}</div>`)
    + row('feed', `<div id="feed-box">${feedBox(p)}</div>`)
    + row('prune', remindBody(id, 'prune')))}
    ${setGroup('now', 'Сейчас',
    row('bought', `<div class="field" id="bought-field">${askYesNo('Недавно приобрели?', 'bought', id, isNew(p), false, '', 'new-hint')}
          <div class="mt-6 small muted hint" id="new-hint">${newHint(p)}</div></div>`)
    + row('repot', repotBox(p))
    + row('rest', restRowBody(p)))}
    <button class="mt-20 btn danger wide" data-act="delete" data-id="${esc(id)}">Убрать из коллекции</button>`;
}
// The plant card's markup on the current `cardTab`; the stories draw it for a sample plant too.
function plantCardHtml(id) {
  const p = plant(id);
  const mc = mood(p)[2];
  const ls = lightStatus(p);
  const spots = [...new Set([...S.spots, ...allPlants().map((x) => x.spot).filter(Boolean)])];
  const tab = ([k, name]) => `<button role="tab" class="seg-tab" id="ct-${k}" aria-controls="cp-${k}" aria-selected="${k === cardTab}" tabindex="${k === cardTab ? 0 : -1}" data-act="card-${k}">${name}</button>`;
  // «История» may have no controls (its only one is «×» on the newest answer), so the panel itself takes focus, as in the ARIA tabs pattern.
  const panel = (k, html) => `<div role="tabpanel" class="card-panel" id="cp-${k}" aria-labelledby="ct-${k}"${k === 'history' ? ' tabindex="0"' : ''}${k === cardTab ? '' : ' hidden'}>${html}</div>`;
  return `
    <div class="hero-bar"><button class="icon-btn hero-close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="hero"><div class="hero-pic">${heroPic(p, mc)}</div>
      <div class="hero-top"><div class="hero-acts">${heroActs(id)}</div></div></div>
    <div class="sheet-main">
    <div class="hero-text"><h2 class="m-0" id="sh-title">${typedHtml(p.title)}</h2><div class="muted small" id="sh-species">${typedHtml(p.species)}</div></div>
    <p class="quip">${esc(quipOf(p))}</p>
    <div class="tags" id="tags">${tagsHtml(p)}</div>
    <div id="rest-box">${resting(p) ? restBox(p) : ''}</div>

    <div class="seg" role="tablist" aria-label="Растение">${CARD_TABS.map(tab).join('')}</div>
    ${panel('settings', `${settingsHtml(id, p, ls, spots)}`)}
    ${panel('notes', `<div id="cheat">${cheatHtml(id)}</div>`)}
    ${panel('history', historyHtml(p))}
    </div>`;
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
    track('plant_photo_added');
    toast('Красотка! 📸');
  } catch (err) { toast('Не получилось открыть фото'); }
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
  delete r.watering; delete r.wick;
  r.medium = medium; // kept even when it's the card's, so a later change of the card doesn't move the plant
  if (watering && watering !== (WATERING[d.watering] ? d.watering : 'top')) { if (watering === 'wick') r.wick = true; else r.watering = watering; }
  const base = r.soilInterval || d.every;
  // Drip irrigation moved to another medium keeps the person's pick and its next check: neither is the card's.
  if (!(WATERING[from.watering]?.fixed && WATERING[watering]?.fixed)) {
    if (isCardWay(r, d)) { r.interval = base; delete r.soilInterval; } else r.interval = wayStart(wayOf({ type: medium, watering }), base, r.lux || d.lux[0]);
    r.nextCheck = addDays(today(), Math.round(r.interval));
  }
  r.wet = 0;
  // Drip irrigation keeps its last check in lastWater: a watering isn't a check of the system, nor the other way round.
  if (!!WATERING[from.watering]?.fixed !== !!WATERING[watering]?.fixed) r.lastWater = null;
  // Roots moved out of soil into a mineral medium, water or air need time: like after repotting, no feeding meanwhile.
  const settle = !!MEDIA[from.medium].organic && !MEDIA[medium].organic;
  if (settle) r.repotted = today();
  initBonus(S);
  return { from, settle };
}

// Moves a plant to another catalog card, say from the generic «Орхидея» to «Фаленопсис».
// What belongs to the plant stays: name, room, spot, photo, notes, history, light reading, greenhouse.
// The roots don't move with the card: the plant keeps its medium and watering, now told against the new
// card. If they differ from the new card's way, that way's tips stand in, as after «В чём растёт».
// Own edits of the old card's tips (`own`) become notes, so the new card's tips show and nothing typed
// is lost; tips hidden on the old card show again. The interval learned from waterings is kept (within
// the new card's bounds on its way); a plant never watered starts from the new card's.
// Own plants (S.custom) have no catalog card to change. Returns what changed and `restore()` for undo, or null.
const CARD_FIELDS = ['def', 'own', 'species', 'medium', 'watering', 'wick', 'soilInterval', 'interval', 'nextCheck'];
function setCard(id, key) {
  const r = S.plants[id], from = def(id), d = PLANTS.find((c) => c.id === key);
  if (!r || !d || !from || d === from || isCustom(id)) return null;
  const medium = mediumIn(r, from), watering = wateringIn(r, from);
  const way = { medium, watering }, newCare = careOf(d, way);
  // What undo puts back: only what this change touched, so edits made since stay.
  const prev = Object.fromEntries(CARD_FIELDS.map((k) => [k, k === 'own' && r.own ? { ...r.own } : r[k]]));
  const prevBonus = ['dust', 'rotate'].map((k) => `${k}:${id}`).map((k) => [k, S.bonus[k], S.snooze[k]]);
  const moved = [];
  if (r.own) {
    NOTE_KEYS.forEach(([k]) => {
      const t = r.own[k];
      if (t === undefined) return;
      if (t && t !== newCare[k]) { r.notes = [...(r.notes || []), t]; moved.push(t); }
      delete r.own[k];
    });
    // Own quips belonged to the old card (the first collection's, or a removed card's, see migrateCardIds).
    delete r.own.quips;
    if (!Object.keys(r.own).length) delete r.own;
  }
  r.def = d.id;
  if (r.species === d.species) delete r.species;
  delete r.watering; delete r.wick; delete r.soilInterval;
  r.medium = medium;
  if (watering && watering !== (WATERING[d.watering] ? d.watering : 'top')) { if (watering === 'wick') r.wick = true; else r.watering = watering; }
  const onWay = isCardWay(r, d), g = wayOf({ type: medium, watering }), before = Math.round(r.interval);
  // Drip irrigation keeps the person's pick.
  if (!r.lastWater && !g.fixed) r.interval = onWay ? d.every : wayStart(g, d.every, r.lux || d.lux[0]);
  else if (onWay) r.interval = clamp(r.interval, ...cardBounds(d, g));
  // A new interval moves the next check, unless «Ещё влажно» answers or «Позже» today set it.
  const iv = Math.round(r.interval), putOff = (S.log[today()] || []).some((e) => e.id === id && e.a === 'later');
  if (iv !== before && !r.wet && !putOff) {
    const next = addDays(r.lastWater || today(), iv);
    r.nextCheck = r.lastWater ? (next < today() ? today() : next) : (next < r.nextCheck ? next : r.nextCheck);
  }
  // Leaf dusting and turning come from the card.
  [['dust', d.big], ['rotate', d.rotate]].forEach(([k, on]) => { if (!on) { delete S.bonus[`${k}:${id}`]; delete S.snooze[`${k}:${id}`]; } });
  initBonus(S);
  const restore = () => {
    const x = S.plants[id];
    if (!x) return false;
    const put = (o, k, v) => { if (v === undefined) delete o[k]; else o[k] = v; };
    Object.entries(prev).forEach(([k, v]) => put(x, k, v));
    // Only the notes this change made go.
    moved.forEach((t) => { const i = (x.notes || []).lastIndexOf(t); if (i >= 0) x.notes.splice(i, 1); });
    if (x.notes && !x.notes.length) delete x.notes;
    prevBonus.forEach(([k, b, z]) => { put(S.bonus, k, b); put(S.snooze, k, z); });
    initBonus(S);
    return true;
  };
  return { from, to: d, moved: moved.length, sameMedium: medium === d.type, restore };
}

// «Другая карточка»: the add sheet's catalog and search (catalogHtml, catalogSearch in add.js); a tap picks the new card.
// Searches here aren't reported as catalog searches: only whether one was made goes with `plant_setting_card_changed`.
let cardSearched = false;
function openCardPicker(id) {
  const d = def(id);
  if (!d || isCustom(id)) return;
  cardSearched = false;
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><button class="icon-btn" data-act="card-back" data-id="${esc(id)}" aria-label="Назад к растению">${I('arrow-left')}</button>
      <h2 class="m-0" tabindex="-1">Другая карточка</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <p class="small muted">Сейчас: ${esc(d.species)}. Уход и подсказки будут из новой карточки. Имя, место, фото, заметки, история полива и замер света останутся.</p>
    ${catalogHtml(id)}`;
  catalogSearch(id);
  openSheet();
  $('#sheet-body h2').focus();
}

// The tags and the drawing on the card follow a change right away.
function heroChanged(id) {
  const p = plant(id);
  if (!p || !$('#tags')) return;
  refreshTags(p);
  const pic = $('.hero-pic');
  if (pic && !photoOf(id)) pic.innerHTML = plantSvg(p, mood(p)[2]);
}
// A chip in «В чём растёт» or «Как поливаю» tapped.
function changeWay(id, f, value) {
  const r = S.plants[id], d = def(id);
  if (!r) return;
  const medium = f === 'medium' ? value : mediumIn(r, d);
  let watering = f === 'watering' ? value : wateringIn(r, d);
  // A medium with its own usual watering (clay pebbles on a reservoir) brings it along.
  // A medium with no watering (water, an aquarium) counts as from above here.
  if (f === 'medium' && MEDIA[medium].watering && (!watering || watering === 'top')) watering = MEDIA[medium].watering;
  const res = setWay(id, medium, watering);
  if (!res) return;
  save();
  const p = plant(id);
  // The chips stay in place, so the tapped one keeps focus; only their state and what's around them change.
  // Not in a pot: no watering way is picked, the chips are greyed out.
  [['medium', p.type], ['watering', MEDIA[p.type].pot ? p.watering || 'top' : '']].forEach(([k, v]) => document.querySelectorAll(`[data-act="way-${k}"]`).forEach((c) => {
    c.classList.toggle('on', c.dataset.way === v);
    c.setAttribute('aria-pressed', c.dataset.way === v);
  }));
  const pot = MEDIA[p.type].pot;
  document.querySelectorAll('[data-act="way-watering"]').forEach((c) => { c.disabled = !pot; });
  $('#watering-why').outerHTML = whyNot(pot ? '' : waterWhyNot(p), 'watering-why');
  $('#medium-note').innerHTML = mediumNote(p, d);
  $('#watering-note').innerHTML = wateringNote(p, d);
  $('#water-box').innerHTML = waterBox(p);
  $('#int-field').innerHTML = intBox(p);
  $('#rinse-wrap').innerHTML = rinseBox(p);
  feedChanged(p);
  refreshTags(p);
  // «Пересажено» follows a settle (it sets `repotted`) and whether the plant is fed on the day at all.
  const repotField = $('#repot-field'); if (repotField) repotField.outerHTML = repotBox(p);
  if (res.settle) {
    // Only plants called on «День подкормки» notice it.
    if (feedsOnDay(p)) toast('Это как пересадка: 2 недели без подкормки, пока корни привыкают');
  }
  noteEdit = null;
  refreshCheat(id);
  heroChanged(id);
  track('plant_setting_grow_changed', { medium: p.type, watering: p.watering || 'none', from_medium: res.from.medium, from_watering: res.from.watering || 'none', settle: res.settle });
}

document.addEventListener('change', (e) => {
  const el = e.target;
  const f = el.dataset && el.dataset.field;
  if (!f) return;
  const id = el.dataset.id;
  const r = S.plants[id];
  if (!r) return;
  if (f === 'name') { r.name = el.value.trim(); if (r.name) track('plant_setting_name_changed'); }
  if (f === 'species') {
    const v = el.value.trim();
    if (!v || v === def(id).species) delete r.species; else r.species = v;
    if (!v) el.value = def(id).species;
  }
  if (f === 'name' || f === 'species') {
    const p = plant(id);
    $('#sh-title').innerHTML = typedHtml(p.title);
    $('#sh-species').innerHTML = typedHtml(p.species);
  }
  if (f === 'lux') {
    const v = parseInt(el.value, 10), was = r.lux;
    r.lux = Number.isFinite(v) && v > 0 ? v : null;
    if (r.lux) track('plant_setting_lux_changed', { from: tab === 'light' ? 'light_tab' : 'card' });
    // A wick's or reservoir's first check follows the light (tankStart): a reading before any answer moves it, while
    // the interval is still the one the last reading gave (not one picked with «Проверка»).
    const d = def(id), p = plant(id), g = wayOf(p), base = r.soilInterval || d.every;
    if (g.start === tankStart && !isCardWay(r, d) && !r.lastWater && !checksOf(p).length
      && Math.round(r.interval) === wayStart(g, base, was || d.lux[0])) {
      const iv = wayStart(g, base, r.lux || d.lux[0]), shift = iv - Math.round(r.interval);
      if (shift) { r.interval = iv; r.nextCheck = addDays(r.nextCheck, shift); }
    }
  }
  save();
  if (sheet.open && ['lux', 'name', 'species'].includes(f)) heroChanged(id);
  if (f === 'lux' && $('#card-lux-state')) $('#card-lux-state').innerHTML = luxState(lightStatus(plant(id)));
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
    document.querySelector('.hello .date').textContent = `замерено ${allPlants().filter((p) => p.lux).length} из ${allPlants().length}`;
  }
});

/* ---------- Taps on the plant card ---------- */
Object.assign(ACTS, {
  tag: toggleTag,
  // A settings row opens and closes in place; the open ones are remembered while this plant's card is redrawn.
  srow(el) {
    const key = el.dataset.row, body = $(`#srb-${key}`), open = el.getAttribute('aria-expanded') !== 'true';
    el.setAttribute('aria-expanded', open); body.hidden = !open;
    if (open) openRows.add(key); else openRows.delete(key);
    if (open) track('plant_setting_opened', { row: key });
  },
  'rinse-done'(el, id) {
    const undo = snapshot(), p = plant(id);
    // A rinse is a thorough watering, as on «Банный день»: the soil check moves on too (once a day).
    if (soilCheck(p.watering) && !wayOf(p).noChecks && S.plants[id].lastWater !== today()) actWater(id);
    rinseDone(id); save();
    $('#rinse-wrap').innerHTML = rinseBox(plant(id)); refreshHistory(id);
    $('#water-box').innerHTML = waterBox(plant(id)); refreshTags(plant(id));
    $('#rinse-wrap .last-done')?.focus();
    track('care_bath_logged');
    toast('Промывка записана 🚿', () => {
      undo();
      if (sheet.open && cardFor === id && $('#rinse-wrap')) { $('#rinse-wrap').innerHTML = rinseBox(plant(id)); $('#water-box').innerHTML = waterBox(plant(id)); refreshHistory(id); $('[data-act="rinse-done"]')?.focus(); }
    });
  },
  'feed-every'(el, id) {
    const n = Number(el.dataset.n);
    S.plants[id].feedEvery = n; save();
    feedChanged(plant(id));
    $(`[data-act="feed-every"][data-n="${n}"]`).focus();
    track('plant_setting_feed_schedule_changed', { every: n });
  },
  'feed-done'(el, id) {
    const undo = snapshot();
    feedDone(id); save();
    feedChanged(plant(id)); refreshHistory(id);
    $('#feed-box .last-done')?.focus();
    track('care_feed_logged');
    toast('Подкормка записана 🍽️', () => {
      undo();
      if (sheet.open && cardFor === id && $('#feed-box')) { feedChanged(plant(id)); refreshHistory(id); $('[data-act="feed-done"]')?.focus(); }
    });
  },
  // The way out of rest in the box above the tabs (the row in «Сейчас» answers «Нет» too).
  'rest-end'(el, id) {
    endRest(id);
    openPlant(id); toast('Ура, проснулась! 🌱');
  },
  photo(el, id) { photoFor = id; $('#photo-input').click(); },
  async 'photo-remove'(el, id) {
    if (await ask({ title: 'Убрать фото?', text: 'Вместо него будет рисунок.', ok: 'Убрать', danger: true })) {
      dropPhoto(id);
      if (window.photoRemoved) window.photoRemoved(id);
      openPlant(id);
      render();
      track('plant_photo_removed');
      toast('Фото убрано');
    }
  },
  // «Да» / «Нет» in «Настройки»: greenhouse, winter lamp, pruning reminder, bath day, just bought, just repotted.
  'yes-no'(el, id) {
    const f = el.dataset.field, k = el.dataset.kind, on = el.dataset.v === '1', r = S.plants[id], p0 = plant(id);
    const now = { bought: isNew(p0), repotted: !!repotted(p0), greenhouse: !!r.greenhouse, lamp: !!r.lamp, bath: !r.noBath, remind: !!(k && remindOf(r, k)), rest: !!resting(p0) }[f];
    if (on === now) return;
    el.parentElement.querySelectorAll('.chip').forEach((c) => { const sel = c === el; c.classList.toggle('on', sel); c.setAttribute('aria-pressed', sel); });
    // Boxes redrawn with the chips inside get the focus back on the same answer.
    const refocus = () => $(`[data-act="yes-no"][data-field="${f}"]${k ? `[data-kind="${k}"]` : ''}[data-v="${el.dataset.v}"]`)?.focus();
    if (f === 'remind') { const start = remindStart(p0, k); setRemind(id, k, on ? { every: start.every, months: [...start.months] } : null, on ? 'on' : 'off'); } // saves
    else if (f === 'lamp') { r.lamp = on; save(); feedChanged(plant(id)); refocus(); track('plant_setting_feed_lamp_toggled', { on }); }
    else if (f === 'bath') { r.noBath = on ? undefined : true; save(); $('#rinse-wrap').innerHTML = rinseBox(plant(id)); refocus(); track('plant_setting_bath_toggled', { on }); }
    else if (f === 'greenhouse') { r.greenhouse = on; save(); $('#gh-hint').innerHTML = ghHint(on); heroChanged(id); track('plant_setting_greenhouse_toggled', { on, from: 'card' }); }
    else if (f === 'rest') {
      if (on) startRest(id); else endRest(id); // both save
      // Only what rest changes is redrawn, so the tapped answer stays under the finger (keepTapped scrolls by the box above the tabs).
      const p = plant(id);
      $('#rest-box').innerHTML = resting(p) ? restBox(p) : ''; $('#rest-hint').innerHTML = restHint(p);
      $('#water-box').innerHTML = waterBox(p); $('#int-field').innerHTML = intBox(p); feedChanged(p);
      heroChanged(id);
    } else {
      if (f === 'bought') { r.bought = on ? today() : false; delete r.inspected; track('plant_setting_quarantine_toggled', { on, from: 'card' }); }
      if (f === 'repotted') { r.repotted = on ? today() : false; track('plant_setting_repot_toggled', { on }); }
      save();
      const p = plant(id);
      $('#new-hint').innerHTML = newHint(p); $('#repot-hint').innerHTML = repotHint(p); feedChanged(p);
      if (f === 'bought') heroChanged(id);
    }
    // Screen readers hear what the new answer does: the first line of the hint under it.
    const hint = { bought: '#new-hint', repotted: '#repot-hint', greenhouse: '#gh-hint', lamp: '#lamp-hint', bath: '#rinse-hint', rest: '#rest-hint', remind: `#remind-hint-${k}` }[f];
    const line = hint && ($(`${hint} p`) || $(hint));
    if (line) announce(line.textContent.trim());
  },
  // «×» on the newest answer in «История»: asks, takes it back, and the card stays on «История».
  async 'hist-undo'(el, id) {
    const h = S.plants[id].hist.find((x) => CHECK_ANSWERS.includes(x.a));
    if (!h) return;
    const word = histDone(plant(id), h.a);
    if (!(await ask({ title: `Убрать отметку «${word}»?`, text: h.was ? 'Следующая проверка и интервал станут как до этой отметки.' : 'Отметка уйдёт из истории.', ok: 'Убрать', danger: true }))) return;
    const undo = snapshot();
    undoAnswer(id);
    track('care_watering_undone', { answer: UNDO_ANSWER[h.a] || h.a, restored: !!h.was, ...kindOf(id) });
    save(); render(); openPlant(id, 'history'); $('#cp-history')?.focus();
    toast('Отметка убрана', () => { undo(); if (sheet.open && cardFor === id) openPlant(id, 'history'); });
  },
  // The card stays open, as for «Подкормлено сегодня»: the button greys out and the marks say «полив сегодня».
  'water-now'(el, id) {
    const undo = snapshot(); actWater(id); track('care_watering_logged', kindOf(id)); save();
    waterChanged(id); $('#wnext')?.focus(); render();
    toast(actWords(plant(id)).done, () => { undo(); waterChanged(id); $('[data-act="water-now"]')?.focus(); });
  },
  spot(el, id) {
    if (S.plants[id].spot !== el.dataset.spot) track('plant_setting_spot_changed');
    S.plants[id].spot = el.dataset.spot; save();
    pressOne(el.parentElement.querySelectorAll('[data-act="spot"]'), el);
  },
  'spot-form'() { spotForm(true); },
  'spot-new'(el, id) { addSpot(id, 'button'); },
  'way-medium'(el, id) { changeWay(id, 'medium', el.dataset.way); },
  'way-watering'(el, id) { changeWay(id, 'watering', el.dataset.way); },
  'card-change'(el, id) { openCardPicker(id); },
  'card-back'(el, id) { openPlant(id, 'settings'); $('[data-act="card-change"]').focus(); },
  'card-pick'(el, id) {
    if (el.dataset.key === def(id).id) { ACTS['card-back'](el, id); return; }
    const res = setCard(id, el.dataset.key);
    if (!res) return;
    save();
    track('plant_setting_card_changed', { from_catalog_id: res.from.id, catalog_id: res.to.id, from_generic: !!res.from.generic, to_generic: !!res.to.generic,
      same_medium: res.sameMedium, notes_moved: res.moved, searched: cardSearched });
    ACTS['card-back'](el, id);
    const undo = () => {
      if (!res.restore()) return;
      save();
      if (sheet.open && cardFor === id) ACTS['card-back'](el, id); else render();
      toast(`Снова карточка «${res.from.species}»`);
    };
    toast(`Теперь карточка «${res.to.species}».${res.sameMedium ? '' : ` Способ выращивания прежний: ${MEDIA[mediumIn(S.plants[id], res.to)].name.toLowerCase()}.`}`, undo);
  },
  'card-notes'() { pickCardTab('notes'); },
  'card-settings'() { pickCardTab('settings'); },
  'card-history'() { pickCardTab('history'); },
  'room-pick'(el, id) {
    if (roomOf(S.plants[id]) !== S.rooms.find((rm) => rm.id === el.dataset.room)) track('plant_setting_room_changed', { rooms: S.rooms.length });
    S.plants[id].room = el.dataset.room; save();
    pressOne(el.parentElement.querySelectorAll('.chip'), el);
  },
  'note-edit'(el, id) { noteEdit = el.dataset.key; refreshCheat(id); },
  'note-cancel'(el, id) { noteEdit = null; refreshCheat(id); },
  'note-save': saveNote,
  'note-del': saveNote,
  'note-reset'(el, id) {
    const r = S.plants[id];
    delete r.own[el.dataset.key];
    if (!Object.keys(r.own).length) delete r.own;
    track('plant_note_changed', { action: 'reset', note: el.dataset.key });
    noteEdit = null; save(); refreshCheat(id);
  },
  'note-restore'(el, id) {
    const r = S.plants[id];
    NOTE_KEYS.forEach(([k]) => { if (r.own && r.own[k] === '') delete r.own[k]; });
    if (r.own && !Object.keys(r.own).length) delete r.own;
    track('plant_note_changed', { action: 'restore', note: 'catalog' });
    save(); refreshCheat(id);
  },
  'remind-every'(el, id) {
    const k = el.dataset.kind, x = remindOf(S.plants[id], k), n = Number(el.dataset.n);
    if (!x || x.every === n) return;
    setRemind(id, k, { ...x, every: n }, 'every');
    $(`[data-act="remind-every"][data-kind="${k}"][data-n="${n}"]`).focus();
  },
  'remind-month'(el, id) {
    const k = el.dataset.kind, x = remindOf(S.plants[id], k), m = Number(el.dataset.m);
    if (!x) return;
    const months = x.months.includes(m) ? x.months.filter((v) => v !== m) : [...x.months, m].sort((a, b) => a - b);
    if (!months.length) { announce('Нужен хотя бы один месяц'); return; }
    setRemind(id, k, { ...x, months }, 'months');
    $(`[data-act="remind-month"][data-kind="${k}"][data-m="${m}"]`).focus();
  },
  'remind-done'(el, id) {
    const k = el.dataset.kind, undo = snapshot();
    remindDone(id, k);
    save();
    $(`#remind-${k}`).innerHTML = remindMore(id, k);
    $(`#remind-${k} .last-done`)?.focus();
    refreshHistory(id);
    if (k === 'prune') track('care_prune_logged');
    // Undo also redraws the reminder and the history in the card, if it's still open.
    toast(REMINDERS[k].toast, () => {
      undo();
      if (sheet.open && cardFor === id && $(`#remind-${k}`)) { $(`#remind-${k}`).innerHTML = remindMore(id, k); refreshHistory(id); $(`[data-act="remind-done"][data-kind="${k}"]`)?.focus(); }
    });
  },
  'int-minus': stepInterval,
  'int-plus': stepInterval,
  'int-pick'(el, id) {
    const r = S.plants[id], n = Number(el.dataset.n);
    if (!r || !wayOf(plant(id)).picks?.includes(n)) return;
    r.interval = n;
    // From the last check, but not before today; never checked yet: from today.
    const next = addDays(r.lastWater || today(), n);
    r.nextCheck = next < today() ? today() : next;
    save();
    el.parentElement.querySelectorAll('.chip').forEach((c) => { c.classList.toggle('on', c === el); c.setAttribute('aria-pressed', c === el); });
    const p = plant(id);
    refreshTags(p);
    $('#water-box').innerHTML = waterBox(p);
    track('plant_setting_watering_schedule_changed', { every: n, how: 'chips', ...kindOf(id) });
  },
  async delete(el, id) {
    if (await ask({ title: `Убрать «${plant(id).title}» из коллекции?`, text: 'Отметки, заметки и фото этого растения удалятся.', ok: 'Убрать', danger: true })) {
      delete S.plants[id];
      dropPhoto(id);
      for (const k of BONUS_KINDS.map((x) => `${x}:${id}`)) { delete S.bonus[k]; delete S.snooze[k]; }
      // A custom plant's card is no longer needed.
      if (S.custom[id]) delete S.custom[id];
      track('plant_deleted');
      save(); closeSheet(); toast('Убрано 🍂');
    }
  },
});
const spotChip = (id, s, on) => `<button class="chip ${on ? 'on' : ''}" data-act="spot" data-id="${esc(id)}" data-spot="${esc(s)}" aria-pressed="${on}">${typedHtml(s)}</button>`;
// One chip of a row picked: the look and, for screen readers, aria-pressed.
const pressOne = (chips, on) => chips.forEach((c) => { c.classList.toggle('on', c === on); c.setAttribute('aria-pressed', c === on); });
// After a watering is noted or taken back in the open card: the parts that show it.
function waterChanged(id) {
  const p = plant(id);
  if (!p || !sheet.open || cardFor !== id || !$('#water-box')) return;
  $('#water-box').innerHTML = waterBox(p); $('#int-field').innerHTML = intBox(p);
  refreshHistory(id); heroChanged(id); refreshRows();
}
// «+ место» opens a field under the chips. It closes again once a spot is added, on Esc, or when it's
// left empty. focusEl: where focus goes after (false: leave it where the person tapped).
function spotForm(open, focusEl) {
  const btn = $('[data-act="spot-form"]'), form = $('#new-spot-form');
  if (!btn || !form) return;
  btn.hidden = open;
  btn.setAttribute('aria-expanded', open);
  form.hidden = !open;
  if (!open) $('#f-new-spot').value = '';
  if (focusEl !== false) (focusEl || (open ? $('#f-new-spot') : btn)).focus();
}
document.addEventListener('focusout', (e) => {
  if (e.target.id !== 'f-new-spot' || e.target.value.trim()) return;
  if (e.relatedTarget && e.relatedTarget.closest('#new-spot-form')) return; // moving to its + button
  spotForm(false, false);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.target.id !== 'f-new-spot') return;
  e.preventDefault(); // Esc closes the field, not the whole card
  e.stopPropagation();
  spotForm(false);
}, true);
// A new spot from that field: picked for this plant and kept in the list. Only the chip row changes.
function addSpot(id, how) {
  const s = $('#f-new-spot').value.trim();
  if (!s) { spotForm(false); return; }
  const moved = S.plants[id].spot !== s;
  S.plants[id].spot = s;
  const fresh = !S.spots.includes(s);
  if (fresh) S.spots.push(s);
  save();
  // A spot typed that's already in the list is only a pick for this plant.
  if (fresh) track('app_setting_spot_changed', { action: 'added', from: 'card', how });
  else if (moved) track('plant_setting_spot_changed');
  const box = $('#spot-chips');
  let chip = [...box.querySelectorAll('[data-act="spot"]')].find((c) => c.dataset.spot === s);
  if (!chip) { $('[data-act="spot-form"]').insertAdjacentHTML('beforebegin', spotChip(id, s, false)); chip = $('[data-act="spot-form"]').previousElementSibling; }
  pressOne(box.querySelectorAll('[data-act="spot"]'), chip);
  spotForm(false, chip);
  announce(`Место: ${s}`);
}
document.addEventListener('submit', (e) => {
  const form = e.target.closest('.new-spot');
  if (form) { e.preventDefault(); addSpot(form.dataset.id, 'enter'); } // Enter, «Готово» on a phone
});
// Tabs: arrows, Home and End move between them, as in any tab list.
document.addEventListener('keydown', (e) => {
  const t = e.target.closest && e.target.closest('.seg-tab');
  if (!t) return;
  const keys = CARD_TABS.map(([k]) => k), i = keys.indexOf(cardTab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: keys.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const k = keys[(next + keys.length) % keys.length];
  track('ui_clicked', { target: 'card-' + k }); // counted like a tap on the tab
  pickCardTab(k, true);
});

async function saveNote(el, id, act) {
  const key = el.dataset.key;
  const text = act === 'note-del' ? '' : $('#note-text').value.trim();
  if (act === 'note-del' && (key[0] === 'n' || !careOf(def(id), S.plants[id])[key]) && !(await ask({ title: 'Удалить заметку?', ok: 'Удалить', danger: true }))) return;
  const action = setNote(id, key, text);
  if (action) track('plant_note_changed', { action, note: noteKind(key) });
  noteEdit = null; save(); refreshCheat(id);
}
function stepInterval(el, id, act) {
  const r = S.plants[id];
  if (intRun && intRun.id !== id) sendIntRun();
  if (!intRun) intRun = { id, from: Math.round(r.interval) };
  r.interval = clamp(Math.round(r.interval) + (act === 'int-plus' ? 1 : -1), 1, 60);
  if (r.lastWater) {
    const next = addDays(r.lastWater, r.interval);
    r.nextCheck = next < today() ? today() : next;
  }
  save();
  $('#int-val').textContent = `раз в ${days(r.interval)}`;
  announce($('#int-val').textContent); // the − / + buttons keep their names: the new value is said
  refreshTags(plant(id));
  clearTimeout(intRun.timer);
  intRun.timer = setTimeout(sendIntRun, 1200);
}
// A run of − / + taps on one plant is one change: sent 1.2 s after the last tap, or at once when the app hides
// (app.js) or another plant's run starts. Nothing when it ends where it began.
let intRun = null;
function sendIntRun() {
  const run = intRun;
  intRun = null;
  if (!run) return;
  clearTimeout(run.timer);
  const r = S.plants[run.id], every = r && Math.round(r.interval);
  if (r && every !== run.from) track('plant_setting_watering_schedule_changed', { every, how: 'stepper', ...kindOf(run.id) });
}
