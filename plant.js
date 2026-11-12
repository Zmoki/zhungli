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

// Short facts under the name: how often it's checked, light, temperature and what the roots are in.
function glanceHtml(p) {
  const tr = tempRange(p), g = wayOf(p);
  return `<ul class="glance" aria-label="Коротко">
    ${g.noChecks ? '' : `<li>${I('droplet')}<span>раз в ~${days(Math.round(p.interval))}</span></li>`}
    <li>${I('sun')}<span>${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} ${LK}</span></li>
    ${tr ? `<li>${I('thermometer')}<span>${tr[0]}–${tr[1]} °C</span></li>` : ''}
    <li>${I('shovel')}<span>${esc(MEDIA[p.type].name.toLowerCase())}</span></li>
    ${WATERING[p.watering]?.badge ? `<li>${I(WATERING[p.watering].badge[0])}<span>${WATERING[p.watering].badge[1]}</span></li>` : ''}</ul>`;
}
// Answers in history. Neutral words: an entry doesn't say which way the plant grew then.
const HIST_WORDS = { water: 'полив', wet: 'ещё влажно' };
const histWord = (a) => HIST_WORDS[a] || HIST_WORDS.wet; // anything but a watering reads as «ещё влажно», as before
// The last 4 weeks as dots: watered, still moist, nothing. Today has a ring. The dots and their
// legend are hidden from screen readers: the average and the list below say the same.
// The average counts only waterings in these 4 weeks.
function rhythmHtml(p) {
  const byDay = {};
  p.hist.forEach((h) => { if (byDay[h.d] !== 'water') byDay[h.d] = h.a; });
  const cells = [];
  for (let i = 27; i >= 0; i--) {
    const d = addDays(today(), -i), a = byDay[d];
    cells.push(`<li class="${a === 'water' ? 'w' : a === 'wet' ? 'd' : ''}${i ? '' : ' now'}"></li>`);
  }
  const from = addDays(today(), -27);
  const waters = [...new Set(p.hist.filter((h) => h.a === 'water' && h.d >= from).map((h) => h.d))].sort();
  const gaps = waters.slice(1).map((d, i) => diff(waters[i], d));
  const avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
  return `<ol class="rhythm" aria-hidden="true">${cells.join('')}</ol>
    <p class="small legend" aria-hidden="true"><span><i class="w"></i>${HIST_WORDS.water}</span><span><i class="d"></i>${HIST_WORDS.wet}</span></p>
    ${avg ? `<p class="small muted m-0">В среднем раз в ${days(avg)}.${wayOf(p).noChecks ? '' : ` Проверка сейчас — раз в ${days(Math.round(p.interval))}.`}</p>` : ''}`;
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
    <p class="small legend" aria-hidden="true"><span><i class="plan"></i>проверка</span><span><i class="w"></i>${HIST_WORDS.water}</span><span><i class="d"></i>${HIST_WORDS.wet}</span></p>
    <p class="small muted m-0">Отметок пока нет. Первая проверка ${esc(rel(first))}, дальше примерно раз в ${days(Math.round(p.interval))}. Ваши ответы появятся здесь.</p></section>`;
}

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
  const mc = mood(p)[2];
  const ls = lightStatus(p);
  const histHtml = p.hist.slice(0, 8).map((h) => `${shortDate(h.d)} — ${histWord(h.a)}`).join('<br>');
  const spots = [...new Set([...S.spots, ...allPlants().map((x) => x.spot).filter(Boolean)])];
  const tab = ([k, name]) => `<button role="tab" class="seg-tab" id="ct-${k}" aria-controls="cp-${k}" aria-selected="${k === cardTab}" tabindex="${k === cardTab ? 0 : -1}" data-act="card-${k}">${name}</button>`;
  // «История» has no controls, so the panel itself takes focus, as in the ARIA tabs pattern.
  const panel = (k, html) => `<div role="tabpanel" class="card-panel" id="cp-${k}" aria-labelledby="ct-${k}"${k === 'history' ? ' tabindex="0"' : ''}${k === cardTab ? '' : ' hidden'}>${html}</div>`;
  $('#sheet-body').innerHTML = `
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
          ${S.plants[id].species ? `<p class="mt-6 small muted">В каталоге: ${esc(def(id).species)}. Сотрите поле, чтобы вернуть.</p>` : ''}</div></section>

      <section class="group" aria-labelledby="g-place"><h3 id="g-place">Где стоит</h3>
        ${S.rooms.length > 1 ? `<div class="field" role="group" aria-labelledby="lbl-room"><label id="lbl-room">Комната</label><div class="chips">
          ${S.rooms.map((rm) => `<button class="chip ${roomOf(p) === rm ? 'on' : ''}" data-act="room-pick" data-id="${esc(id)}" data-room="${esc(rm.id)}">${esc(rm.name)}</button>`).join('')}</div></div>` : ''}
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
        <div class="field" role="group" aria-labelledby="lbl-int" id="int-field"${wayOf(p).noChecks ? ' hidden' : ''}><label id="lbl-int">Проверять примерно каждые</label><div class="stepper">
          <button data-act="int-minus" data-id="${esc(id)}" aria-label="Чаще">${I('minus')}</button><b id="int-val">${days(Math.round(p.interval))}</b>
          <button data-act="int-plus" data-id="${esc(id)}" aria-label="Реже">${I('plus')}</button></div>
          <p class="mt-6 small muted" id="int-hint">${intHint(p)}</p></div>
</section>
      <button class="mt-20 btn danger wide" data-act="delete" data-id="${esc(id)}">Убрать из коллекции</button>`)}
    ${panel('history', histHtml ? `${p.hist.some((h) => h.d >= addDays(today(), -27)) ? `<section class="group" aria-labelledby="g-weeks"><h3 id="g-weeks">Последние 4 недели</h3>${rhythmHtml(p)}</section>` : ''}
      <p class="history">${histHtml}</p>` : plannedHtml(p))}
    </div>`;
  openSheet();
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
  $('#int-val').textContent = days(Math.round(r.interval));
  $('#int-hint').textContent = intHint(p);
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
  if (f === 'greenhouse') { r.greenhouse = el.checked; $('#gh-hint').innerHTML = ghHint(el.checked); track('greenhouse_toggled', { on: el.checked }); }
  if (f === 'lux') {
    const v = parseInt(el.value, 10);
    r.lux = Number.isFinite(v) && v > 0 ? v : null;
    if (r.lux) track('lux_entered', { from: tab === 'light' ? 'light_tab' : 'card' });
  }
  save();
  if (sheet.open && (f === 'greenhouse' || f === 'lux')) heroChanged(id);
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
  'int-minus': stepInterval,
  'int-plus': stepInterval,
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
const spotChip = (id, s, on) => `<button class="chip ${on ? 'on' : ''}" data-act="spot" data-id="${esc(id)}" data-spot="${esc(s)}">${esc(s)}</button>`;
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
  $('#live').textContent = `Место: ${s}`;
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
