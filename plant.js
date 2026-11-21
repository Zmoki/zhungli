/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Plant card sheet: notes, photo, spot, room, how it grows, and its fields.

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
  if (p.toxic) html += `<div class="info warn"><b>${I('triangle-alert')}Осторожно</b>Сок раздражает кожу${p.toxic === 'skin' ? '' : ' и слизистые'}. Работайте в перчатках.</div>`;
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
    <button class="water-now btn ${g.fixed ? 'ok' : 'water'} wide" data-act="water-now" data-id="${esc(p.id)}">${I(g.fixed ? 'check' : 'droplet')}${w.btn}</button>`;
}
// «Как растёт» in the plant card: the medium with the repotting switch under it, for a pot how it's
// watered, and what that means. All options are chips, nothing hidden in a dropdown.
function wayBox(p, d) {
  const chips = (field, label, list, value, attrs = '') => `<div class="field" role="group" aria-labelledby="lbl-${field}" aria-describedby="way-hint"${attrs}>
    <label id="lbl-${field}">${label}</label><div class="chips">
    ${Object.entries(list).map(([k, x]) => `<button class="chip ${value === k ? 'on' : ''}" data-act="way-${field}" data-id="${esc(p.id)}" data-way="${k}" aria-pressed="${value === k}">${x.name}</button>`).join('')}</div></div>`;
  return `${chips('medium', 'В чём растёт', MEDIA, p.type)}
    <div class="field" id="repot-field"${feedsOnDay(p) ? '' : ' hidden'}><label class="toggle"><input type="checkbox" id="f-repotted" data-field="repotted" data-id="${esc(p.id)}" aria-describedby="repot-hint" ${repotted(p) ? 'checked' : ''}> Недавно пересажено</label>
      <div class="mt-6 small muted hint" id="repot-hint">${repotHint(p)}</div></div>
    ${chips('watering', 'Как поливаю', WATERING, p.watering || 'top', ` id="watering-field"${MEDIA[p.type].pot ? '' : ' hidden'}`)}
    <div class="field" id="way-note">${wayNote(p, d)}</div>`;
}
// What the chosen way means, and a warning for succulents and cacti, which rot in steady moisture.
// Redrawn alone on a change, so the tapped chip keeps focus.
const wayNote = (p, d) => `<p class="small muted m-0" id="way-hint">${esc(wayOf(p).hint)}</p>
  ${d.type === 'dry' && wayOf(p).wet ? `<div class="info warn mt-8"><b>${I('triangle-alert')}Осторожно</b>Суккуленты и кактусы не любят постоянную влагу: следите, чтобы корни не загнили.</div>` : ''}`;
// Under each checkbox: ticked, what it does; unticked, what ticking would do, then what happens now.
// Repotting only matters for plants called on «День подкормки»; for the rest it's hidden.
const hintLines = (...lines) => lines.map((l) => `<p>${l}</p>`).join('');
function repotHint(p) {
  if (repotted(p)) return hintLines(`Не позову на подкормку до ${parse(addDays(p.repotted, REPOT_DAYS)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, пока приживаются корни. Потом галочка снимется сама.`);
  return hintLines('<b>Если отметить:</b> 6 недель не позову на подкормку, пока приживаются корни.', '<b>Сейчас</b> подкормка как обычно: с марта по сентябрь, раз в 2 недели.');
}
const ghHint = (on) => (on ? hintLines('Каждый день напомню проветрить. Снимите галочку, когда растение переедет из теплицы.')
  : hintLines('<b>Если отметить:</b> каждый день напомню проветрить. Для колпака или мини-теплицы.', '<b>Сейчас</b> проветривать не напоминаю.'));
// «Напоминания» in «Настройки»: a checkbox per kind; ticked, how often, in which months, and «done today».
// Only the part under the checkbox is redrawn, so the checkbox keeps focus.
const MONTH_CHIPS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
// Months as words: runs of 3 and more as «май–сентябрь», the rest one by one: «март, апрель».
// A run may cross the new year («ноябрь–февраль»): the list starts after a month that's off.
function monthsText(ms) {
  const on = new Set(ms), runs = [];
  if (on.size === 12) return 'весь год';
  const start = [...Array(12).keys()].map((i) => i + 1).find((m) => !on.has(m));
  for (let i = 1; i <= 12; i++) {
    const m = ((start - 1 + i) % 12) + 1, last = runs[runs.length - 1];
    if (!on.has(m)) continue;
    if (last && last[last.length - 1] % 12 === m - 1) last.push(m); else runs.push([m]);
  }
  return runs.flatMap((r) => (r.length >= 3 ? [`${MONTHS[r[0] - 1]}–${MONTHS[r[r.length - 1] - 1]}`] : r.map((m) => MONTHS[m - 1]))).join(', ');
}
function remindMore(id, kind) {
  const R = REMINDERS[kind], x = remindOf(S.plants[id], kind), last = S.bonus[`${kind}:${id}`], c = remindCard(plant(id), kind);
  if (!x) return `<div class="mt-6 small muted hint" id="remind-hint-${kind}">${hintLines(...[R.why, c.tip && esc(c.tip), `<b>Если отметить:</b> позову ${R.verb} в «Если есть силы»${c.months ? `: ${monthsText(c.months)}` : ' в выбранные месяцы'}.`, `<b>Сейчас</b> не напоминаю.`].filter(Boolean))}</div>`;
  const often = R.every.find(([n]) => n === x.every);
  const chip = (act, attr, on, label, aria = '') => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-id="${esc(id)}" data-kind="${kind}" ${attr} aria-pressed="${on}"${aria}>${label}</button>`;
  return `<div class="mt-6 small muted hint" id="remind-hint-${kind}">${hintLines(...[c.tip && esc(c.tip), `Позову ${R.verb} в «Если есть силы» ${often ? often[2] : `раз в ${days(x.every)}`}: ${monthsText(x.months)}.`].filter(Boolean))}</div>
    <div class="field mt-12" role="group" aria-labelledby="lbl-every-${kind}"><label id="lbl-every-${kind}">Как часто</label><div class="chips">
      ${R.every.map(([n, label]) => chip('remind-every', `data-n="${n}"`, x.every === n, label)).join('')}</div></div>
    <div class="field" role="group" aria-labelledby="lbl-months-${kind}"><label id="lbl-months-${kind}">В какие месяцы</label><div class="chips">
      ${MONTH_CHIPS.map((m, i) => chip('remind-month', `data-m="${i + 1}"`, x.months.includes(i + 1), m, ` aria-label="${MONTHS[i]}"`)).join('')}</div></div>
    <p class="small muted m-0" id="remind-last-${kind}">${last ? `Последний раз: ${esc(rel(last))}.` : 'Ещё не отмечали.'}</p>
    <button class="mt-8 btn ok" data-act="remind-done" data-id="${esc(id)}" data-kind="${kind}">${I(R.icon)}${R.btn}</button>`;
}
// Every kind is drawn; one that doesn't fit how the plant grows (flushing clay pebbles) is hidden, and shown again by changeWay.
// A card that isn't pruned says so instead of the checkbox, unless the reminder is already on.
const remindNo = (id, kind) => !remindOf(S.plants[id], kind) && remindCard(plant(id), kind).no;
const remindBox = (id) => Object.entries(REMINDERS).map(([kind, R]) => remindNo(id, kind)
  ? `<div class="field" id="remind-field-${kind}"><p class="m-0"><b>${R.name}</b></p><div class="mt-6 small muted hint">${hintLines(esc(remindCard(plant(id), kind).no))}</div></div>`
  : `<div class="field" id="remind-field-${kind}"${remindFits(plant(id), kind) ? '' : ' hidden'}><label class="toggle"><input type="checkbox" data-field="remind" data-kind="${kind}" data-id="${esc(id)}" aria-describedby="remind-hint-${kind}" ${remindOf(S.plants[id], kind) ? 'checked' : ''}> ${R.name}</label>
  <div id="remind-${kind}">${remindMore(id, kind)}</div></div>`).join('');
// Sets one reminder: null turns it off. Reports the change.
function setRemind(id, kind, x, action) {
  const r = S.plants[id];
  if (x) r.remind = { ...(r.remind || {}), [kind]: x };
  else if (r.remind) { delete r.remind[kind]; if (!Object.keys(r.remind).length) delete r.remind; }
  save();
  $(`#remind-${kind}`).innerHTML = remindMore(id, kind);
  track('reminder_changed', { kind, action, ...(x ? { every: x.every, months: x.months.length } : {}) });
}
const intHint = (p) => `Подстраивается само, когда на «Сегодня» вы отвечаете «${labelsOf(p)[0]}» или «${labelsOf(p)[1]}».`;
// How often it's checked: a stepper for a learned interval; for a system that waters by itself, chips
// with the way's options (it doesn't learn). Redrawn alone when the way changes.
const everyLabel = (n) => (n === 7 ? 'Неделя' : `${n / 7} недели`);
function intBox(p) {
  const g = wayOf(p), iv = Math.round(p.interval);
  if (g.fixed) {
    return `<label id="lbl-int">Проверять систему</label><div class="chips">
      ${g.picks.map((n) => `<button class="chip ${iv === n ? 'on' : ''}" data-act="int-pick" data-id="${esc(p.id)}" data-n="${n}" aria-pressed="${iv === n}">${everyLabel(n)}</button>`).join('')}</div>
      <p class="mt-6 small muted" id="int-hint">Сам не меняется: проверю систему так часто, как вы выберете.</p>`;
  }
  return `<label id="lbl-int">Проверять примерно каждые</label><div class="stepper">
    <button data-act="int-minus" data-id="${esc(p.id)}" aria-label="Чаще">${I('minus')}</button><b id="int-val">${days(iv)}</b>
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

// Short facts under the name: how often it's checked, light, temperature and what the roots are in.
function glanceHtml(p) {
  const tr = tempRange(p), g = wayOf(p);
  return `<ul class="glance" aria-label="Коротко">
    ${g.noChecks ? '' : g.fixed ? `<li>${I('calendar-check')}<span>проверка ${everyText(Math.round(p.interval))}</span></li>` : `<li>${I('droplet')}<span>раз в ~${days(Math.round(p.interval))}</span></li>`}
    <li>${I('sun')}<span>${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} ${LK}</span></li>
    ${tr ? `<li>${I('thermometer')}<span>${tr[0]}–${tr[1]} °C</span></li>` : ''}
    <li>${I('shovel')}<span>${esc(MEDIA[p.type].name.toLowerCase())}</span></li>
    ${WATERING[p.watering]?.badge ? `<li>${I(WATERING[p.watering].badge[0])}<span>${WATERING[p.watering].badge[1]}</span></li>` : ''}</ul>`;
}
// Answers in history. Neutral words: an entry doesn't say which way the plant grew then.
const HIST_WORDS = { water: 'полив', wet: 'ещё влажно', ok: 'работает', fix: 'поправлено' };
// Dots: a watering or a working system is full, the other answer is light.
const HIST_DOTS = { water: 'w', ok: 'w', wet: 'd', fix: 'd' };
// The legend's words: the kinds shown in the strip (`shown`), else the current way's: a system's checks, or waterings.
const legendHtml = (p, plan, shown) => {
  const keys = shown && shown.size ? Object.keys(HIST_DOTS).filter((k) => shown.has(k)) : wayOf(p).fixed ? ['ok', 'fix'] : ['water', 'wet'];
  return `<p class="small legend" aria-hidden="true">${plan ? '<span><i class="plan"></i>проверка</span>' : ''}${keys.map((k) => `<span><i class="${HIST_DOTS[k]}"></i>${HIST_WORDS[k]}</span>`).join('')}</p>`;
};
// A reminder done reads as its own word («обрезано»); anything else but a watering as «ещё влажно», as before.
const histWord = (a) => HIST_WORDS[a] || (REMINDERS[a] && REMINDERS[a].done) || HIST_WORDS.wet;
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
  const cells = [];
  for (let i = 27; i >= 0; i--) cells.push(`<li class="${byDay[addDays(today(), -i)] || ''}${i ? '' : ' now'}"></li>`);
  const waters = [...new Set(p.hist.filter((h) => h.a === 'water' && h.d >= from).map((h) => h.d))].sort();
  const gaps = waters.slice(1).map((d, i) => diff(waters[i], d));
  const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
  return `<ol class="rhythm" aria-hidden="true">${cells.join('')}</ol>
    ${legendHtml(p, false, shown)}
    ${avg ? `<p class="small muted m-0">В среднем раз в ${days(avg)}.${wayOf(p).noChecks ? '' : ` Проверка сейчас: раз в ${days(Math.round(p.interval))}.`}</p>` : ''}`;
}

// No answers yet: the next 4 weeks in the same dots, with the planned checks dashed, so the tab
// shows what's coming and how it will look. Plants without checks (an aquarium) get a line instead.
function plannedHtml(p) {
  if (wayOf(p).noChecks) return '<p class="muted">Пока пусто. Здесь будут ваши отметки.</p>';
  const first = !p.nextCheck || p.nextCheck < today() ? today() : p.nextCheck, last = addDays(today(), 27), plan = new Set();
  for (let d = first; d <= last; d = addDays(d, Math.max(1, Math.round(p.interval)))) plan.add(d);
  const cells = [];
  for (let i = 0; i < 28; i++) cells.push(`<li class="${plan.has(addDays(today(), i)) ? 'plan' : ''}${i ? '' : ' now'}"></li>`);
  return `<section class="group" aria-labelledby="g-soon"><h3 id="g-soon">Ближайшие 4 недели</h3>
    <ol class="rhythm" aria-hidden="true">${cells.join('')}</ol>
    ${legendHtml(p, true)}
    <p class="small muted m-0">Отметок пока нет. Первая проверка ${esc(rel(first))}, дальше ${wayOf(p).fixed ? everyText(Math.round(p.interval)) : `примерно раз в ${days(Math.round(p.interval))}`}. Ваши ответы появятся здесь.</p></section>`;
}

// «История»: the last 4 weeks of checks as dots (or the next 4 weeks before the first one), then the list,
// reminders done included. Redrawn alone after «Обрезано сегодня».
function historyHtml(p) {
  const checks = checksOf(p); // reminders done (a pruning) are only in the list
  const list = p.hist.slice(0, 8).map((h) => `${shortDate(h.d)}: ${histWord(h.a)}`).join('<br>');
  const top = checks.length ? (checks.some((h) => h.d >= addDays(today(), -27)) ? `<section class="group" aria-labelledby="g-weeks"><h3 id="g-weeks">Последние 4 недели</h3>${rhythmHtml(p)}</section>` : '')
    : list && wayOf(p).noChecks ? '' : plannedHtml(p);
  return `${top}${list ? `<p class="history">${list}</p>` : ''}`;
}
const refreshHistory = (id) => { const box = $('#cp-history'); if (box && sheet.open && cardFor === id) box.innerHTML = historyHtml(plant(id)); };

// Tabs of the plant card. The card opens on «Заметки»; a redraw of the same open card keeps the tab.
const CARD_TABS = [['notes', 'Заметки'], ['settings', 'Настройки'], ['history', 'История']];
let cardTab = 'notes', cardFor = null;
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

function openPlant(id, tabKey) {
  const p = plant(id);
  if (!p) return;
  noteEdit = null;
  if (tabKey) cardTab = tabKey; else if (!sheet.open || cardFor !== id) cardTab = 'notes';
  cardFor = id;
  $('#sheet-body').innerHTML = plantCardHtml(id);
  openSheet();
}
// The plant card's markup on the current `cardTab`; the stories draw it for a sample plant too.
function plantCardHtml(id) {
  const p = plant(id);
  const mc = mood(p)[2];
  const ls = lightStatus(p);
  const spots = [...new Set([...S.spots, ...allPlants().map((x) => x.spot).filter(Boolean)])];
  const tab = ([k, name]) => `<button role="tab" class="seg-tab" id="ct-${k}" aria-controls="cp-${k}" aria-selected="${k === cardTab}" tabindex="${k === cardTab ? 0 : -1}" data-act="card-${k}">${name}</button>`;
  // «История» has no controls, so the panel itself takes focus, as in the ARIA tabs pattern.
  const panel = (k, html) => `<div role="tabpanel" class="card-panel" id="cp-${k}" aria-labelledby="ct-${k}"${k === 'history' ? ' tabindex="0"' : ''}${k === cardTab ? '' : ' hidden'}>${html}</div>`;
  return `
    <div class="hero-bar"><button class="icon-btn hero-close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="hero"><div class="hero-pic">${heroPic(p, mc)}</div>
      <div class="hero-acts">${heroActs(id)}</div>
      <span class="hero-badges">${stateChips(p, true)}${ghBadge(p, true)}${growBadges(p, true)}</span></div>
    <div class="sheet-main">
    <div class="hero-text"><h2 class="m-0" id="sh-title">${typedHtml(p.title)}</h2><div class="muted small" id="sh-species">${typedHtml(p.species)}</div></div>
    <p class="quip">${esc(quipOf(p))}</p>
    <div id="glance">${glanceHtml(p)}</div>
    <div id="water-box">${waterBox(p)}</div>

    <div class="seg" role="tablist" aria-label="Растение">${CARD_TABS.map(tab).join('')}</div>
    ${panel('notes', `<div id="cheat">${cheatHtml(id)}</div>`)}
    ${panel('settings', `
      <section class="group" aria-labelledby="g-name"><h3 id="g-name">Имя</h3>
        <div class="field"><label for="f-name">Как зовут</label><input class="input" id="f-name" data-field="name" data-id="${esc(id)}" value="${esc(p.name)}" placeholder="Например, Коля" maxlength="40"></div>
        <div class="field"><label for="f-species">Вид, сорт</label><input class="input" id="f-species" data-field="species" data-id="${esc(id)}" value="${esc(p.species)}" placeholder="${esc(def(id).species)}" maxlength="80">
          ${S.plants[id].species ? `<p class="mt-6 small muted">В каталоге: ${esc(def(id).species)}. Сотрите поле, чтобы вернуть.</p>` : ''}</div>
        ${isCustom(id) ? '' : `<div class="field" role="group" aria-labelledby="lbl-card"><label id="lbl-card">Карточка ухода</label>
          <p class="m-0" id="card-now">${esc(def(id).species)}</p>
          <p class="mt-6 small muted" id="card-hint">Отсюда советы, свет и интервал полива. Если карточка не та, смените её: имя, фото, заметки и история останутся.</p>
          <button class="mt-8 btn" data-act="card-change" data-id="${esc(id)}" aria-describedby="card-now card-hint">${I('arrow-left-right')}Сменить карточку</button></div>`}</section>

      <section class="group" aria-labelledby="g-place"><h3 id="g-place">Где стоит</h3>
        ${S.rooms.length > 1 ? `<div class="field" role="group" aria-labelledby="lbl-room"><label id="lbl-room">Комната</label><div class="chips">
          ${S.rooms.map((rm) => `<button class="chip ${roomOf(p) === rm ? 'on' : ''}" data-act="room-pick" data-id="${esc(id)}" data-room="${esc(rm.id)}">${typedHtml(rm.name)}</button>`).join('')}</div></div>` : ''}
        <div class="field" role="group" aria-labelledby="lbl-spot"><label id="lbl-spot">Место</label><div class="chips" id="spot-chips">
          ${spots.map((s) => spotChip(id, s, p.spot === s)).join('')}
          <button class="chip" data-act="spot-form" data-id="${esc(id)}" aria-expanded="false" aria-controls="new-spot-form">${I('plus')}место</button></div>
          <form class="new-spot" id="new-spot-form" data-id="${esc(id)}" hidden><input class="input" id="f-new-spot" placeholder="Новое место" aria-label="Новое место" maxlength="40" enterkeyhint="done">
            <button type="button" class="btn primary" data-act="spot-new" data-id="${esc(id)}" aria-label="Добавить место">${I('plus')}</button></form></div></section>

      <section class="group" aria-labelledby="g-light"><h3 id="g-light">Свет</h3>
        <div class="field"><label for="f-lux">Замер люксметром, нужно ${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} ${LK}</label>
          <input class="input" type="number" inputmode="numeric" id="f-lux" placeholder="Люкс" data-field="lux" data-id="${esc(id)}" value="${p.lux ?? ''}">
          ${ls ? `<p class="mt-6 small"><span class="tag ${ls}">${LIGHT_WORDS[ls]}</span></p>` : ''}</div></section>

      <section class="group" aria-labelledby="g-gh"><h3 id="g-gh">Теплица</h3>
        <div class="field"><label class="toggle"><input type="checkbox" id="f-greenhouse" data-field="greenhouse" data-id="${esc(id)}" aria-describedby="gh-hint" ${p.greenhouse ? 'checked' : ''}> В теплице</label>
          <div class="mt-6 small muted hint" id="gh-hint">${ghHint(p.greenhouse)}</div></div></section>

      <section class="group" aria-labelledby="g-way"><h3 id="g-way">Как растёт</h3>
        <div id="way-box">${wayBox(p, def(id))}</div>
        <div class="field" role="group" aria-labelledby="lbl-int" id="int-field"${wayOf(p).noChecks ? ' hidden' : ''}>${intBox(p)}</div>
</section>

      <section class="group" aria-labelledby="g-remind"><h3 id="g-remind">Напоминания</h3>${remindBox(id)}</section>
      <button class="mt-20 btn danger wide" data-act="delete" data-id="${esc(id)}">Убрать из коллекции</button>`)}
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
    track('photo_added');
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
    if (isCardWay(r, d)) { r.interval = base; delete r.soilInterval; } else r.interval = (wayOf({ type: medium, watering }).start || ((b) => b))(base);
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

// Moves a plant to another catalog card, say from the generic «Орхидея на коре» to «Фаленопсис».
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
    if (!Object.keys(r.own).length) delete r.own;
  }
  r.def = d.id;
  if (r.species === d.species) delete r.species;
  delete r.watering; delete r.wick; delete r.soilInterval;
  r.medium = medium;
  if (watering && watering !== (WATERING[d.watering] ? d.watering : 'top')) { if (watering === 'wick') r.wick = true; else r.watering = watering; }
  const onWay = isCardWay(r, d), g = wayOf({ type: medium, watering }), before = Math.round(r.interval);
  // Drip irrigation keeps the person's pick.
  if (!r.lastWater && !g.fixed) r.interval = onWay ? d.every : (g.start || ((b) => b))(d.every);
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
// Searches here aren't reported as catalog searches: only whether one was made goes with `card_changed`.
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

// The status, greenhouse and way badges on the card photo (and its drawing) follow a change right away.
function heroChanged(id) {
  const badges = $('.hero-badges');
  if (!badges) return;
  const p = plant(id);
  badges.innerHTML = `${stateChips(p, true)}${ghBadge(p, true)}${growBadges(p, true)}`;
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
  [['medium', p.type], ['watering', p.watering || 'top']].forEach(([k, v]) => document.querySelectorAll(`[data-act="way-${k}"]`).forEach((c) => {
    c.classList.toggle('on', c.dataset.way === v);
    c.setAttribute('aria-pressed', c.dataset.way === v);
  }));
  $('#watering-field').hidden = !MEDIA[p.type].pot;
  $('#way-note').innerHTML = wayNote(p, d);
  $('#water-box').innerHTML = waterBox(p);
  $('#int-field').hidden = !!wayOf(p).noChecks;
  $('#int-field').innerHTML = intBox(p);
  Object.keys(REMINDERS).forEach((k) => { const f = $(`#remind-field-${k}`); if (f) f.hidden = !remindFits(p, k); });
  $('#glance').innerHTML = glanceHtml(p);
  $('#repot-field').hidden = !feedsOnDay(p);
  if (res.settle) {
    const box = $('[data-field="repotted"]');
    if (box) box.checked = true;
    $('#repot-hint').innerHTML = repotHint(p);
    // Only plants called on «День подкормки» notice it.
    if (feedsOnDay(p)) toast('Это как пересадка: 6 недель без подкормки, пока корни привыкают');
  }
  noteEdit = null;
  refreshCheat(id);
  heroChanged(id);
  track('grow_changed', { medium: p.type, watering: p.watering || 'none', from_medium: res.from.medium, from_watering: res.from.watering || 'none', settle: res.settle });
}

document.addEventListener('change', (e) => {
  const el = e.target;
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
    $('#sh-title').innerHTML = typedHtml(p.title);
    $('#sh-species').innerHTML = typedHtml(p.species);
  }
  if (f === 'repotted') { r.repotted = el.checked ? today() : false; $('#repot-hint').innerHTML = repotHint(plant(id)); }
  if (f === 'remind') {
    const k = el.dataset.kind;
    const start = remindStart(plant(id), k);
    setRemind(id, k, el.checked ? { every: start.every, months: [...start.months] } : null, el.checked ? 'on' : 'off'); // saves
    return;
  }
  if (f === 'greenhouse') { r.greenhouse = el.checked; $('#gh-hint').innerHTML = ghHint(el.checked); track('greenhouse_toggled', { on: el.checked }); }
  if (f === 'lux') {
    const v = parseInt(el.value, 10);
    r.lux = Number.isFinite(v) && v > 0 ? v : null;
    if (r.lux) track('lux_entered', { from: tab === 'light' ? 'light_tab' : 'card' });
  }
  save();
  if (sheet.open && ['greenhouse', 'lux', 'name', 'species'].includes(f)) heroChanged(id);
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

/* ---------- Taps on the plant card ---------- */
Object.assign(ACTS, {
  photo(el, id) { photoFor = id; $('#photo-input').click(); },
  'photo-remove'(el, id) {
    if (confirm('Убрать фото? Вместо него будет рисунок.')) {
      dropPhoto(id);
      if (window.photoRemoved) window.photoRemoved(id);
      openPlant(id);
      render();
      track('photo_removed');
      toast('Фото убрано');
    }
  },
  'water-now'(el, id) {
    const undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', from: 'card', ...kindOf(id) }); save(); closeSheet(); toast(actWords(plant(id)).done, undo);
  },
  spot(el, id) {
    S.plants[id].spot = el.dataset.spot; save();
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
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
    track('card_changed', { from_card: res.from.id, to_card: res.to.id, from_generic: !!res.from.generic, to_generic: !!res.to.generic,
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
  'card-notes'() { showCardTab('notes'); },
  'card-settings'() { showCardTab('settings'); },
  'card-history'() { showCardTab('history'); },
  'room-pick'(el, id) {
    S.plants[id].room = el.dataset.room; save();
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  'note-edit'(el, id) { noteEdit = el.dataset.key; refreshCheat(id); },
  'note-cancel'(el, id) { noteEdit = null; refreshCheat(id); },
  'note-save': saveNote,
  'note-del': saveNote,
  'note-reset'(el, id) {
    const r = S.plants[id];
    delete r.own[el.dataset.key];
    if (!Object.keys(r.own).length) delete r.own;
    track('note_changed', { action: 'reset', note: el.dataset.key });
    noteEdit = null; save(); refreshCheat(id);
  },
  'note-restore'(el, id) {
    const r = S.plants[id];
    NOTE_KEYS.forEach(([k]) => { if (r.own && r.own[k] === '') delete r.own[k]; });
    if (r.own && !Object.keys(r.own).length) delete r.own;
    track('note_changed', { action: 'restore', note: 'catalog' });
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
    $(`#remind-last-${k}`).textContent = 'Последний раз: сегодня.';
    refreshHistory(id);
    track('reminder_logged', { kind: k, from: 'card' });
    // Undo also redraws the reminder and the history in the card, if it's still open.
    toast(REMINDERS[k].toast, () => {
      undo();
      if (sheet.open && cardFor === id && $(`#remind-${k}`)) { $(`#remind-${k}`).innerHTML = remindMore(id, k); refreshHistory(id); }
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
    $('#glance').innerHTML = glanceHtml(p);
    $('#water-box').innerHTML = waterBox(p);
    track('check_interval_set', { days: n, ...kindOf(id) });
  },
  delete(el, id) {
    if (confirm(`Убрать «${plant(id).title}» из коллекции?`)) {
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
const spotChip = (id, s, on) => `<button class="chip ${on ? 'on' : ''}" data-act="spot" data-id="${esc(id)}" data-spot="${esc(s)}">${typedHtml(s)}</button>`;
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
  S.plants[id].spot = s;
  const fresh = !S.spots.includes(s);
  if (fresh) S.spots.push(s);
  save();
  track('spot_added', { how, new_spot: fresh });
  const box = $('#spot-chips');
  let chip = [...box.querySelectorAll('[data-act="spot"]')].find((c) => c.dataset.spot === s);
  if (!chip) { $('[data-act="spot-form"]').insertAdjacentHTML('beforebegin', spotChip(id, s, false)); chip = $('[data-act="spot-form"]').previousElementSibling; }
  box.querySelectorAll('[data-act="spot"]').forEach((c) => c.classList.toggle('on', c === chip));
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
  showCardTab(k, true);
});

function saveNote(el, id, act) {
  const key = el.dataset.key;
  const text = act === 'note-del' ? '' : $('#note-text').value.trim();
  if (act === 'note-del' && (key[0] === 'n' || !careOf(def(id), S.plants[id])[key]) && !confirm('Удалить заметку?')) return;
  const action = setNote(id, key, text);
  if (action) track('note_changed', { action, note: noteKind(key) });
  noteEdit = null; save(); refreshCheat(id);
}
function stepInterval(el, id, act) {
  const r = S.plants[id];
  r.interval = clamp(Math.round(r.interval) + (act === 'int-plus' ? 1 : -1), 1, 60);
  if (r.lastWater) {
    const next = addDays(r.lastWater, r.interval);
    r.nextCheck = next < today() ? today() : next;
  }
  save();
  $('#int-val').textContent = days(r.interval);
  $('#glance').innerHTML = glanceHtml(plant(id));
}
