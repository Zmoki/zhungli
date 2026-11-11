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
