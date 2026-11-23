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
  // Warnings are under the tabs (warnsHtml); what pets may know when the plant isn't toxic to them stays here.
  if (petsOn() && petsOf(p) !== 'toxic') html += `<div class="card-warns">${petsHtml(p)}</div>`;
  if (p.generic) html += `<p class="small muted">Это общий тип, советы примерные. Интервал полива подстроится по вашим ответам.</p>`;
  return html;
}
// Warnings never hide behind a tab: under all of them, the sap that irritates skin and toxic to pets (with «Дома есть кошка или собака» on).
function warnsHtml(p) {
  const w = (p.toxic ? `<div class="info warn"><b>${I('triangle-alert')}Осторожно</b>Сок раздражает кожу${p.toxic === 'skin' ? '' : ' и слизистые'}. Работайте в перчатках.</div>` : '')
    + (petsOn() && petsOf(p) === 'toxic' ? petsHtml(p) : '');
  return w ? `<div class="card-warns">${w}</div>` : '';
}
// With «Дома есть кошка или собака» on: what the plant means for them, by ASPCA.
function petsHtml(p) {
  const v = petsOf(p);
  // One block for every answer, colored by it: red toxic, green safe, plain when nothing is known.
  if (v === 'toxic') return `<div class="info warn"><b>${I('paw-print')}Ядовито для кошек и собак</b>${p.petsNote ? esc(p.petsNote) + ' ' : ''}Если питомец погрыз растение, сразу позвоните в ветеринарную клинику.</div>`;
  if (v === 'safe') return `<div class="info safe"><b>${I('paw-print')}Безопасно для кошек и собак</b>По базе ASPCA.</div>`;
  return `<div class="info"><b>${I('paw-print')}Для кошек и собак: нет данных</b>${p.generic ? 'Зависит от растения. Узнаете вид: «Настройки» → «Сменить карточку».' : 'Надёжных сведений о том, ядовито ли растение, нет.'}</div>`;
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
// «Полив», on top of «Уход» in «Настройки»: not a folding row but always open, since «Полито сегодня» is used after
// about 1 in 5 card opens. Two marks (the last watering and the next check), then the button.
function waterBox(p) {
  const g = wayOf(p), w = actWords(p);
  const head = '<div class="water-head"><span class="srow-t">Полив</span></div>';
  if (g.noChecks) return `${head}<div class="srow-body">${whyNot('Поливать не нужно, корни в воде аквариума.')}</div>`;
  const last = p.lastWater ? `${w.sub} ${esc(rel(p.lastWater))}` : w.none.toLowerCase();
  const next = p.nextCheck <= today() ? (g.fixed ? 'пора проверить' : 'проверка сегодня') : `${g.fixed ? 'следующая' : 'проверка'} ${esc(rel(p.nextCheck))}`;
  // Watered (or checked) today already: the button stays, greyed out, so the same watering isn't noted twice.
  const done = p.lastWater === today();
  return `${head}<div class="srow-body"><p class="wmarks"><span>${I(g.fixed ? 'check' : 'droplet')}${last}</span><span>${I('calendar-check')}${next}</span></p>
    <button class="water-now btn ${g.fixed ? 'ok' : 'water'} wide" data-act="water-now" data-id="${esc(p.id)}"${done ? ' disabled' : ''}>${I(g.fixed ? 'check' : 'droplet')}${w.btn}</button></div>`;
}
// Settings that don't apply to a plant stay in place, greyed out (disabled), with a line saying why:
// a section that silently disappears reads as a bug («у меня нет кнопки…»).
const whyNot = (text, id = '') => `<p class="small muted why-not"${id ? ` id="${id}"` : ''}>${text}</p>`;
const WHERE = { dry: 'в грунте для суккулентов', mineral: 'в минеральной смеси', leca: 'в керамзите', water: 'в воде',
  mount: 'на блоке', terrarium: 'в закрытом террариуме', aquarium: 'в аквариуме' };
const upFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// Why a plant isn't on «День подкормки».
function feedWhyNot(p) {
  if (p.distilled) return 'Хищные растения не удобряют в грунт.';
  if (p.type === 'water') return 'В воде удобрение в четверть дозы раз в месяц, при смене воды. Черенкам до корней не нужно.';
  if (MEDIA[p.type].feed === 'each') return `${upFirst(WHERE[p.type])} удобрение в слабой дозе добавляют в каждый полив: отдельного дня подкормки нет.`;
  if (p.noFeed) return 'Для этого растения подкормки нет.';
  return `Для растений ${WHERE[p.type] || 'с таким грунтом'} день подкормки не назначаю.`;
}
const waterWhyNot = (p) => `Растение ${WHERE[p.type]}, не в горшке: способ полива не выбирается.`;
// «Как растёт» in the plant card: the medium with the repotting switch under it, for a pot how it's
// watered, and what that means. All options are chips, nothing hidden in a dropdown.
function wayBox(p, d) {
  // A bog way (a tray of standing water) only where the card or the plant uses it: it rots ordinary roots.
  const ways = Object.fromEntries(Object.entries(WATERING).filter(([k, w]) => !w.bog || k === p.watering || k === cardWatering(d)));
  const chips = (field, label, list, value, attrs = '', off = false, after = '') => `<div class="field" role="group" aria-labelledby="lbl-${field}" aria-describedby="way-hint"${attrs}>
    <label id="lbl-${field}">${label}</label><div class="chips">
    ${Object.entries(list).map(([k, x]) => `<button class="chip ${value === k ? 'on' : ''}" data-act="way-${field}" data-id="${esc(p.id)}" data-way="${k}" aria-pressed="${value === k}"${off ? ' disabled' : ''}>${x.name}</button>`).join('')}</div>${after}</div>`;
  const pot = MEDIA[p.type].pot;
  return `${chips('medium', 'В чём растёт', MEDIA, p.type)}
    ${chips('watering', 'Как поливаю', ways, pot ? p.watering || 'top' : '', ' id="watering-field"', !pot, whyNot(pot ? '' : waterWhyNot(p), 'watering-why'))}
    <div class="field" id="way-note">${wayNote(p, d)}</div>`;
}
// «Недавно пересажено»: its own row under «Сейчас»; changeWay keeps it in step with the medium.
// «Да» / «Нет» for a row whose title is the question («Недавно купили»): chips, like every other choice.
const yesNo = (field, id, on, dis = false, kind = '') => ['1', '0'].map((v) => {
  const sel = (v === '1') === on;
  return `<button class="chip ${sel ? 'on' : ''}" data-act="yes-no" data-field="${field}" data-id="${esc(id)}"${kind ? ` data-kind="${kind}"` : ''} data-v="${v}" aria-pressed="${sel}"${dis ? ' disabled' : ''}>${v === '1' ? 'Да' : 'Нет'}</button>`;
}).join('');
// A yes-no setting inside a row: a short question, then «Да» / «Нет» (no checkboxes in «Настройки»).
const askYesNo = (q, field, id, on, dis = false, kind = '') => `<div class="yn" role="group" aria-labelledby="q-${field}${kind}"><p class="yn-q" id="q-${field}${kind}">${q}</p>
  <div class="chips">${yesNo(field, id, on, dis, kind)}</div></div>`;
const repotBox = (p) => `<div class="field" id="repot-field" role="group" aria-label="Недавно пересажено" aria-describedby="repot-hint"><div class="chips">${yesNo('repotted', p.id, !!repotted(p), !feedsOnDay(p))}</div>
      <div class="mt-6 small muted hint" id="repot-hint">${repotHint(p)}</div></div>`;
// What the chosen way means, and a warning for succulents and cacti, which rot in steady moisture.
// Redrawn alone on a change, so the tapped chip keeps focus.
const wayNote = (p, d) => `<p class="small muted m-0" id="way-hint">${esc(wayOf(p).hint)}</p>
  ${d.type === 'dry' && wayOf(p).wet ? `<div class="info warn mt-8"><b>${I('triangle-alert')}Осторожно</b>Суккуленты и кактусы не любят постоянную влагу: следите, чтобы корни не загнили.</div>` : ''}`;
// Under each yes-no question: what the current answer does, so trying «Да» and «Нет» shows how each works.
// Repotting only matters for plants called on «День подкормки»; for the rest it's greyed out, with why.
const hintLines = (...lines) => lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('');
function repotHint(p) {
  if (!feedsOnDay(p)) return hintLines('Влияет только на подкормку, а у этого растения дня подкормки нет.');
  if (repotted(p)) return hintLines(`Не позову на подкормку до ${parse(addDays(p.repotted, REPOT_DAYS)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, пока приживаются корни. Потом станет «Нет» само.`);
  return hintLines(settling(p) ? 'Не зову на подкормку: растение недавно купили.' : 'Подкормка как обычно.');
}
// «Подкормка» for plants fed on the feeding day: how often, winter under a lamp, the last time and «done today».
// Redrawn alone; the tapped chip or answer gets focus back.
function feedBox(p) {
  const n = feedEvery(p), last = p.fed, off = !feedsOnDay(p), dis = off ? ' disabled' : '';
  const chip = ([d, label]) => `<button class="chip ${!off && n === d ? 'on' : ''}" data-act="feed-every" data-id="${esc(p.id)}" data-n="${d}" aria-pressed="${!off && n === d}"${dis}>${label}</button>`;
  const when = off ? '' : !n ? 'Не позову на «День подкормки».'
    : feedDue(p) ? 'Позову в «Если есть силы» сегодня.'
      : repotted(p) || settling(p) || resting(p) ? 'Сейчас не зову: растение недавно пересадили, купили или оно отдыхает.'
        : winterNow() && !p.lamp ? 'Позову в марте.'
          : `Позову ${rel(addDays(last || today(), winterNow() ? Math.max(n, 30) : n))}.`;
  // «Weakly and regularly» is the orchid facts' advice; a card fed rarely by default (zamioculcas) doesn't get it.
  const regular = (def(p.id).feedEvery ?? 14) <= 30 ? ' Слабо и регулярно лучше, чем крепко и редко.' : '';
  return `${off ? whyNot(feedWhyNot(p)) : p.feedNote ? `<p class="small muted mt-0">${esc(p.feedNote)}${regular}</p>` : ''}<div class="field" role="group" aria-labelledby="lbl-feed"><label id="lbl-feed">Как часто с марта по сентябрь</label><div class="chips">${FEED_EVERY.map(chip).join('')}</div>
    <p class="mt-6 small muted" id="feed-when">${when}</p></div>
    <div class="field">${askYesNo('Зимой стоит под лампой?', 'lamp', p.id, !!(p.lamp && n && !off), !(n && !off))}
      <p class="mt-6 small muted" id="lamp-hint">${off ? 'Нужен день подкормки.' : !n ? 'Сначала выберите, как часто кормить.' : p.lamp ? `Зимой позову ${FEED_WORDS[Math.max(n, 30)]}, удобрение слабее, чем летом.` : 'Зимой не зову: без лампы растение почти не растёт.'}</p></div>
    <button class="btn ok wide" data-act="feed-done" data-id="${esc(p.id)}"${dis || last === today() ? ' disabled' : ''}>${I('utensils')}Подкормлено сегодня</button>
    ${last ? `<p class="small muted last-done" tabindex="-1">Последний раз: ${esc(rel(last))}.</p>` : ''}`;
}
// A plant at rest (cards with `rest`): since when, what to do, and the way back.
// A plant moved to a card without `rest` while resting still gets the way back.
const restBox = (p) => `<div class="info rest"><b>${I('moon')}Покой с ${parse(p.resting.since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</b>${p.rest ? esc(p.rest.tip) : ''}
  <button class="mt-12 btn ok wide" data-act="rest-end" data-id="${esc(p.id)}">${I('sprout')}${esc(p.rest ? p.rest.end : 'Снова растёт')}</button></div>`;
// «Недавно купили»: quarantine and settling in, with dates; a card may add its own word (`settle`).
function newHint(p) {
  const day = (n) => parse(addDays(p.bought, n)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  if (!isNew(p)) return hintLines('Обычный уход, без карантина.');
  return hintLines(...[`Карантин до ${day(NEW_DAYS)}: держите отдельно от других растений, раз в неделю позову осмотреть.`,
    settling(p) ? `До ${day(SETTLE_DAYS)} растение привыкает: лучше не переставлять, не обрезать и не пересаживать, на подкормку не позову.` : '',
    p.settle && settling(p) ? esc(p.settle) : ''].filter(Boolean));
}
const ghHint = (on) => hintLines(on ? 'Каждый день позову проветрить.' : 'Проветривать не зову.');
// «Обрезка» in «Настройки»: a row per kind (like «Теплица») with a yes-no question; on «Да», how often, in which months, and «done today».
// Only the part under the question is redrawn, so the tapped answer keeps focus.
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
  if (!x) return `<div class="mt-6 small muted hint" id="remind-hint-${kind}">${hintLines(...[R.why, c.tip && esc(c.tip), `Не зову ${R.verb}.`].filter(Boolean))}</div>`;
  const often = R.every.find(([n]) => n === x.every);
  const chip = (act, attr, on, label, aria = '') => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-id="${esc(id)}" data-kind="${kind}" ${attr} aria-pressed="${on}"${aria}>${label}</button>`;
  return `<div class="mt-6 small muted hint" id="remind-hint-${kind}">${hintLines(...[c.tip && esc(c.tip), `Позову ${R.verb} в «Если есть силы» ${often ? often[2] : `раз в ${days(x.every)}`}: ${monthsText(x.months)}.`].filter(Boolean))}</div>
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
  : `<div class="field">${askYesNo(`${REMINDERS[kind].toggle}?`, 'remind', id, !!remindOf(S.plants[id], kind), false, kind)}
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
  return box(`<div class="small muted hint">${hintLines(RINSE.why)}</div>
    <div class="field mt-12">${askYesNo('Звать в банный день?', 'bath', p.id, !!(n && !p.noBath), !n)}
      <div class="mt-6 small muted hint" id="rinse-hint">${hintLines(how)}</div></div>
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
  if (g.noChecks) return `<label id="lbl-int">Проверять примерно каждые</label>${whyNot('Корни в аквариуме: проверять полив не нужно.')}`;
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
const HIST_WORDS = { water: 'полив', wet: 'ещё влажно', ok: 'работает', fix: 'поправлено', feed: 'подкормлено', rinse: 'промыто' };
// Dots: a watering or a working system is full, the other answer is light.
const HIST_DOTS = { water: 'w', ok: 'w', wet: 'd', fix: 'd' };
// The legend's words: the kinds shown in the strip (`shown`), else the current way's: a system's checks, or waterings.
const legendHtml = (p, plan, shown) => {
  const keys = shown && shown.size ? Object.keys(HIST_DOTS).filter((k) => shown.has(k)) : wayOf(p).fixed ? ['ok', 'fix'] : ['water', 'wet'];
  return `<p class="small legend" aria-hidden="true">${plan ? '<span><i class="plan"></i>проверка</span>' : ''}${keys.map((k) => `<span><i class="${HIST_DOTS[k]}"></i>${HIST_WORDS[k]}</span>`).join('')}</p>`;
};
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
let openRows = new Set(), openRowsFor = null;
const dayMonth = (iso) => parse(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
// How feeding goes now, as feedDue decides: the schedule (monthly in winter under a lamp), then why it waits: rest,
// a recent repot or purchase (until the later date), winter without a lamp. A date that falls in a lampless winter
// waits until March.
const isWinter = (iso) => { const m = parse(iso).getMonth() + 1; return m < 3 || m > 9; };
function feedValue(p) {
  const n = feedEvery(p);
  if (!n) return 'не кормлю';
  const every = winterNow() && p.lamp && n < 30 ? 'зимой раз в месяц' : FEED_WORDS[n];
  const until = [repotted(p) ? addDays(p.repotted, REPOT_DAYS) : '', settling(p) ? addDays(p.bought, SETTLE_DAYS) : ''].filter(Boolean).sort().pop();
  const pause = resting(p) ? 'пауза, пока в покое'
    : until ? (!p.lamp && isWinter(until) ? 'пауза до марта' : `пауза до ${dayMonth(until)}`)
      : winterNow() && !p.lamp ? 'зимой пауза' : '';
  return [every, p.lamp ? 'под лампой' : '', pause].filter(Boolean).join(', ');
}
// Values are HTML: typed text (name, room, spot) goes through typedHtml so long words hyphenate.
function rowValues(p) {
  const r = S.plants[p.id] || {}, ls = lightStatus(p), pot = MEDIA[p.type].pot, fed = feedsOnDay(p);
  const prune = remindOf(r, 'prune'), n = bathEvery(), place = [S.rooms.length > 1 ? roomOf(p).name : '', p.spot].filter(Boolean);
  const feedOff = p.distilled ? 'не удобряют' : p.type === 'water' ? 'при смене воды' : MEDIA[p.type].feed === 'each' ? 'в каждый полив' : 'нет дня подкормки';
  const rinseOff = p.type === 'water' ? 'соли уходят с водой' : MEDIA[p.type].care ? 'своя промывка' : p.distilled ? 'не нужна' : 'нельзя';
  return {
    name: p.name ? [typedHtml(p.name), false] : ['без имени', true],
    card: isCustom(p.id) ? ['своё растение', true] : [esc(def(p.id).species), false],
    place: place.length ? [place.map(typedHtml).join(', '), false] : ['не выбрано', true],
    light: p.lux ? [`${p.lux} ${LK}${ls ? ', ' + LIGHT_WORDS[ls] : ''}`, false] : ['не замеряли', true],
    gh: [p.greenhouse ? 'в теплице' : 'нет', false],
    way: [`${MEDIA[p.type].name.toLowerCase()}${pot ? ', ' + (WATERING[p.watering] || WATERING.top).name.toLowerCase() : ''}`, false],
    feed: !fed ? [feedOff, true] : [feedValue(p), false],
    prune: prune ? [monthsText(prune.months), false] : remindCard(p, 'prune').no ? ['не обрезают', true] : ['не зову', false],
    rinse: !rinseFits(p) ? [rinseOff, true] : !n ? ['банный день выключен', true] : [p.noBath ? 'не купать' : 'в банный день', false],
    bought: [isNew(p) ? `карантин до ${dayMonth(addDays(p.bought, NEW_DAYS))}` : 'нет', false],
    repot: !fed ? ['не влияет', true] : [repotted(p) ? `без подкормки до ${dayMonth(addDays(p.repotted, REPOT_DAYS))}` : 'нет', false],
    rest: resting(p) ? [`с ${dayMonth(p.resting.since)}`, false] : p.rest ? ['нет', false] : ['не отмечается', true],
  };
}
const ROW_TITLES = { name: 'Имя', card: 'Карточка ухода', place: 'Место', light: 'Свет', gh: 'Теплица', way: 'Как растёт',
  feed: 'Подкормка', prune: 'Обрезка', rinse: 'Промывка грунта', bought: 'Недавно купили', repot: 'Недавно пересажено', rest: 'Покой' };
// Rows whose open body doesn't show their value keep it in the head: the card's name (it doesn't change while open).
const KEEP_VALUE = new Set(['card']);
function setRow(key, body, vals, opened) {
  const [v, off] = vals[key], open = opened.has(key);
  return `<div class="srow" id="sr-${key}"><button class="srow-head${KEEP_VALUE.has(key) ? ' keep-v' : ''}" id="srh-${key}" data-act="srow" data-row="${key}" aria-expanded="${open}" aria-controls="srb-${key}">
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
// «Подкормка» after «Недавно купили: Да»). The sheet scrolls by as much, so the tapped control stays under the finger.
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
// `rows`: settings rows to open, as for a plant just added (name and place).
function openPlant(id, tabKey, rows) {
  const p = plant(id);
  if (!p) return;
  noteEdit = null;
  if (tabKey) cardTab = tabKey; else if (!sheet.open || cardFor !== id) cardTab = 'settings';
  if (openRowsFor !== id || rows) { openRows = new Set(rows); openRowsFor = id; }
  cardFor = id;
  $('#sheet-body').innerHTML = plantCardHtml(id);
  openSheet();
}
// The «Настройки» tab: who the plant is, where it lives, its care, and what's going on now. The bodies keep their
// ids, so each handler still redraws its own part (feedBox, rinseBox, wayBox…).
function settingsHtml(id, p, ls, spots) {
  const v = rowValues(p);
  // Only this plant's open rows: the stories draw a sample plant's card while a real one may be open.
  const opened = openRowsFor === id ? openRows : new Set();
  const row = (key, body) => setRow(key, body, v, opened);
  return `${setGroup('plant', 'Растение',
    row('name', `<div class="field"><label for="f-name">Как зовут</label><input class="input" id="f-name" data-field="name" data-id="${esc(id)}" value="${esc(p.name)}" placeholder="Например, Коля" maxlength="40"></div>
        <div class="field"><label for="f-species">Вид, сорт</label><input class="input" id="f-species" data-field="species" data-id="${esc(id)}" value="${esc(p.species)}" placeholder="${esc(def(id).species)}" maxlength="80">
          ${S.plants[id].species ? `<p class="mt-6 small muted">В каталоге: ${esc(def(id).species)}. Сотрите поле, чтобы вернуть.</p>` : ''}</div>`)
    + row('card', isCustom(id) ? `${whyNot('Своё растение: уход подобран под него, карточки из каталога у него нет.')}<button class="btn primary wide" disabled>${I('arrow-left-right')}Сменить карточку</button>`
      : `<p class="small muted m-0" id="card-hint">Отсюда советы, свет и полив. При смене карточки имя, фото, заметки и история останутся.</p>
          <button class="btn primary wide" data-act="card-change" data-id="${esc(id)}" aria-describedby="card-hint">${I('arrow-left-right')}Сменить карточку</button>`))}
    ${setGroup('where', 'Где живёт',
    row('place', `${S.rooms.length > 1 ? `<div class="field" role="group" aria-labelledby="lbl-room"><label id="lbl-room">Комната</label><div class="chips">
          ${S.rooms.map((rm) => `<button class="chip ${roomOf(p) === rm ? 'on' : ''}" data-act="room-pick" data-id="${esc(id)}" data-room="${esc(rm.id)}">${typedHtml(rm.name)}</button>`).join('')}</div></div>` : ''}
        <div class="field" role="group" aria-labelledby="lbl-spot"><label id="lbl-spot"${S.rooms.length > 1 ? '' : ' class="sr-only"'}>${S.rooms.length > 1 ? 'Где стоит' : 'Место'}</label><div class="chips" id="spot-chips">
          ${spots.map((sp) => spotChip(id, sp, p.spot === sp)).join('')}
          <button class="chip" data-act="spot-form" data-id="${esc(id)}" aria-expanded="false" aria-controls="new-spot-form">${I('plus')}место</button></div>
          <form class="new-spot" id="new-spot-form" data-id="${esc(id)}" hidden><input class="input" id="f-new-spot" placeholder="Новое место" aria-label="Новое место" maxlength="40" enterkeyhint="done">
            <button type="button" class="btn primary" data-act="spot-new" data-id="${esc(id)}" aria-label="Добавить место">${I('plus')}</button></form></div>`)
    + row('light', `<div class="field"><label for="f-lux">Замер люксметром, нужно ${kLux(p.luxRange[0])}–${kLux(p.luxRange[1])} ${LK}</label>
          <input class="input" type="number" inputmode="numeric" id="f-lux" placeholder="Люкс" data-field="lux" data-id="${esc(id)}" value="${p.lux ?? ''}">
          ${ls ? `<p class="mt-6 small"><span class="tag ${ls}">${LIGHT_WORDS[ls]}</span></p>` : ''}</div>`)
    + row('gh', `<div class="field">${askYesNo('Стоит в теплице или под колпаком?', 'greenhouse', id, !!p.greenhouse)}
          <div class="mt-6 small muted hint" id="gh-hint">${ghHint(p.greenhouse)}</div></div>`))}
    ${setGroup('care', 'Уход',
    `<div class="srow water-row" id="water-box">${waterBox(p)}</div>`
    + row('way', `<div id="way-box">${wayBox(p, def(id))}</div>
        <div class="field" role="group" aria-labelledby="lbl-int" id="int-field">${intBox(p)}</div>`)
    + row('feed', `<div id="feed-box">${feedBox(p)}</div>`)
    + row('prune', remindBody(id, 'prune'))
    + row('rinse', `<div id="rinse-wrap">${rinseBox(p)}</div>`))}
    ${setGroup('now', 'Сейчас',
    row('bought', `<div class="field" id="bought-field" role="group" aria-label="Недавно купили" aria-describedby="new-hint"><div class="chips">${yesNo('bought', id, isNew(p))}</div>
          <div class="mt-6 small muted hint" id="new-hint">${newHint(p)}</div></div>`)
    + row('repot', repotBox(p))
    + row('rest', resting(p) ? whyNot('Растение сейчас в покое: вернуть обычный уход можно в блоке «Покой» над вкладками.')
      : p.rest ? `<p class="small muted m-0">В покое позову проверять вдвое реже и не позову подкормить.</p>
        <button class="btn primary wide" data-act="rest-start" data-id="${esc(id)}">${I('moon')}${esc(p.rest.start)}</button>`
        : `${whyNot('Для этого растения покой не отмечается: в его карточке покоя нет.')}<button class="btn primary wide" disabled>${I('moon')}Ушло в покой</button>`))}
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
      <div class="hero-acts">${heroActs(id)}</div>
      <span class="hero-badges">${stateChips(p, true)}${ghBadge(p, true)}${growBadges(p, true)}${petBadge(p, true)}</span></div>
    <div class="sheet-main">
    <div class="hero-text"><h2 class="m-0" id="sh-title">${typedHtml(p.title)}</h2><div class="muted small" id="sh-species">${typedHtml(p.species)}</div></div>
    <p class="quip">${esc(quipOf(p))}</p>
    <div id="glance">${glanceHtml(p)}</div>
    ${resting(p) ? restBox(p) : ''}

    <div class="seg" role="tablist" aria-label="Растение">${CARD_TABS.map(tab).join('')}</div>
    ${panel('settings', `${settingsHtml(id, p, ls, spots)}`)}
    ${panel('notes', `<div id="cheat">${cheatHtml(id)}</div>`)}
    ${panel('history', historyHtml(p))}
    ${warnsHtml(p)}
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

// The status, greenhouse and way badges on the card photo (and its drawing) follow a change right away.
function heroChanged(id) {
  const badges = $('.hero-badges');
  if (!badges) return;
  const p = plant(id);
  badges.innerHTML = `${stateChips(p, true)}${ghBadge(p, true)}${growBadges(p, true)}${petBadge(p, true)}`;
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
  $('#way-note').innerHTML = wayNote(p, d);
  $('#water-box').innerHTML = waterBox(p);
  $('#int-field').innerHTML = intBox(p);
  $('#rinse-wrap').innerHTML = rinseBox(p);
  $('#feed-box').innerHTML = feedBox(p);
  $('#glance').innerHTML = glanceHtml(p);
  // «Недавно пересажено» follows a settle (it sets `repotted`) and whether the plant is fed on the day at all.
  const repotField = $('#repot-field'); if (repotField) repotField.outerHTML = repotBox(p);
  if (res.settle) {
    // Only plants called on «День подкормки» notice it.
    if (feedsOnDay(p)) toast('Это как пересадка: 6 недель без подкормки, пока корни привыкают');
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
    const v = parseInt(el.value, 10);
    r.lux = Number.isFinite(v) && v > 0 ? v : null;
    if (r.lux) track('plant_setting_lux_changed', { from: tab === 'light' ? 'light_tab' : 'card' });
  }
  save();
  if (sheet.open && ['lux', 'name', 'species'].includes(f)) heroChanged(id);
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
    $('#water-box').innerHTML = waterBox(plant(id)); $('#glance').innerHTML = glanceHtml(plant(id));
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
    $('#feed-box').innerHTML = feedBox(plant(id));
    $(`[data-act="feed-every"][data-n="${n}"]`).focus();
    track('plant_setting_feed_schedule_changed', { every: n });
  },
  'feed-done'(el, id) {
    const undo = snapshot();
    feedDone(id); save();
    $('#feed-box').innerHTML = feedBox(plant(id)); refreshHistory(id);
    $('#feed-box .last-done')?.focus();
    track('care_feed_logged');
    toast('Подкормка записана 🍽️', () => {
      undo();
      if (sheet.open && cardFor === id && $('#feed-box')) { $('#feed-box').innerHTML = feedBox(plant(id)); refreshHistory(id); $('[data-act="feed-done"]')?.focus(); }
    });
  },
  // Rest: checks twice as rare (the interval comes back after), no feeding day, until new growth.
  'rest-start'(el, id) {
    const r = S.plants[id];
    // Drip irrigation keeps its picked interval: it checks the system, not the soil.
    const fixed = !!wayOf(plant(id)).fixed;
    r.resting = { since: today(), ...(fixed ? {} : { iv: r.interval }) };
    if (!fixed) r.interval = Math.min(Math.round(r.interval * 2), 45);
    const next = addDays(r.lastWater || today(), Math.round(r.interval));
    r.nextCheck = next < today() ? today() : next;
    save(); track('plant_setting_rest_started', kindOf(id));
    openPlant(id); toast('Хорошо, пусть отдыхает 🌙');
  },
  'rest-end'(el, id) {
    const r = S.plants[id], days = diff(r.resting.since, today());
    if (r.resting.iv) r.interval = r.resting.iv;
    delete r.resting;
    const next = addDays(today(), Math.round(r.interval));
    if (r.nextCheck > next) r.nextCheck = next;
    save(); track('plant_setting_rest_ended', { days, ...kindOf(id) });
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
    const now = { bought: isNew(p0), repotted: !!repotted(p0), greenhouse: !!r.greenhouse, lamp: !!r.lamp, bath: !r.noBath, remind: !!(k && remindOf(r, k)) }[f];
    if (on === now) return;
    el.parentElement.querySelectorAll('.chip').forEach((c) => { const sel = c === el; c.classList.toggle('on', sel); c.setAttribute('aria-pressed', sel); });
    // Boxes redrawn with the chips inside get the focus back on the same answer.
    const refocus = () => $(`[data-act="yes-no"][data-field="${f}"]${k ? `[data-kind="${k}"]` : ''}[data-v="${el.dataset.v}"]`)?.focus();
    if (f === 'remind') { const start = remindStart(p0, k); setRemind(id, k, on ? { every: start.every, months: [...start.months] } : null, on ? 'on' : 'off'); return; } // saves
    if (f === 'lamp') { r.lamp = on; save(); $('#feed-box').innerHTML = feedBox(plant(id)); refocus(); track('plant_setting_feed_lamp_toggled', { on }); return; }
    if (f === 'bath') { r.noBath = on ? undefined : true; save(); $('#rinse-wrap').innerHTML = rinseBox(plant(id)); refocus(); track('plant_setting_bath_toggled', { on }); return; }
    if (f === 'greenhouse') { r.greenhouse = on; save(); $('#gh-hint').innerHTML = ghHint(on); heroChanged(id); track('plant_setting_greenhouse_toggled', { on, from: 'card' }); return; }
    if (f === 'bought') { r.bought = on ? today() : false; delete r.inspected; track('plant_setting_quarantine_toggled', { on, from: 'card' }); }
    if (f === 'repotted') { r.repotted = on ? today() : false; track('plant_setting_repot_toggled', { on }); }
    save();
    const p = plant(id);
    $('#new-hint').innerHTML = newHint(p); $('#repot-hint').innerHTML = repotHint(p); $('#feed-box').innerHTML = feedBox(p);
    if (f === 'bought') heroChanged(id);
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
  'water-now'(el, id) {
    const undo = snapshot(); actWater(id); track('care_watering_logged', kindOf(id)); save(); closeSheet(); toast(actWords(plant(id)).done, undo);
  },
  spot(el, id) {
    if (S.plants[id].spot !== el.dataset.spot) track('plant_setting_spot_changed');
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
    $('#glance').innerHTML = glanceHtml(p);
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
  $('#int-val').textContent = days(r.interval);
  $('#glance').innerHTML = glanceHtml(plant(id));
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
