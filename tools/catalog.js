/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// The whole plant catalog on one page, to read through and discuss: every card with its silhouette, care texts and gaps.
// No packages: run with Node from the repo root.
//   node tools/catalog.js FILE   writes the page (a fragment without <html>/<head>/<body>, as Artifacts take it)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'app');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// As altHtml in core.js: each English name on the second line is marked lang="en".
const altHtml = (s) => String(s).split(', ').map((n) => (/\p{Script=Latin}/u.test(n) ? `<span lang="en">${esc(n)}</span>` : esc(n))).join(', ');

// The catalog and the drawings run as they are; shapes.js only needs the cards.
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${read('plants.js')}\n${read('shapes.js')}\nthis.out = { PLANTS, CHECK_TEXT, plantSvg };`, ctx);
// Hidden cards (`hidden: true`) can't be added any more: they stay in plants.js only for saved plants, so they're left out.
const PLANTS = ctx.out.PLANTS.filter((d) => !d.hidden);
const { CHECK_TEXT, plantSvg } = ctx.out;

// Growing media and watering ways (MEDIA and WATERING in state.js), read without running state.js: each entry's
// text runs from its key to the next key or the end of its object.
const stateJs = read('state.js');
const heads = [...stateJs.matchAll(/^ {2}(\w+): \{ name: '([^']+)'/gm)];
const ENTRIES = heads.map((m, i) => {
  const text = stateJs.slice(m.index, i + 1 < heads.length ? heads[i + 1].index : undefined);
  const end = text.search(/\n\S/);
  return [m[1], m[2], end < 0 ? text : text.slice(0, end)];
});
const NAMES = Object.fromEntries(ENTRIES.map(([k, name]) => [k, name]));
// Ways whose first check doesn't follow the card's interval (`start` in the entry: wayStart in state.js).
const OWN_START = new Set(ENTRIES.filter(([, , t]) => /\bstart:/.test(t)).map(([k]) => k));
// What a medium says about feeding and checks: `feed` ('day', 'each', 'alt', 'none'), `feedEvery`, `feedNote`, `noChecks`,
// and `pot`: only potted media have a watering way to pick (cardWatering in state.js).
const MEDIUM = Object.fromEntries(ENTRIES.map(([k, , t]) => [k, {
  feed: (t.match(/\bfeed: '(\w+)'/) || [])[1],
  feedEvery: +(t.match(/\bfeedEvery: (\d+)/) || [])[1] || 0,
  feedNote: (t.match(/\bfeedNote: '([^']+)'/) || [])[1] || '',
  noChecks: /\bnoChecks: true/.test(t),
  pot: /\bpot: true/.test(t),
}]));
// The app's feeding words (FEED_WITH, FEED_WORDS in state.js) and the interval when nothing sets one (feedEvery).
const objIn = (name) => JSON.parse(stateJs.match(new RegExp(`const ${name} = (\\{[^}]+\\})`))[1].replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
const FEED_WITH = objIn('FEED_WITH');
const FEED_WORDS = objIn('FEED_WORDS');
const FEED_DEFAULT = 14;
// The pruning reminder's months when a card names none (REMINDERS.prune.start in state.js).
const PRUNE_MONTHS = [3, 4];
// Group order, as in the add-plants picker.
const CAT_ORDER = JSON.parse(read('add.js').match(/const CAT_ORDER = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
const VERSION = read('version.txt').trim();
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

// The drawings' colors and rules, taken from style.css so the page draws plants as the app does.
const css = read('style.css');
const DRAW_TOKENS = /--(leaf|leaf-2|leaf-3|bloom|glass|coleus|trunk|t[0-5]|edge):\s*([^;]+);/g;
const blockAfter = (head) => {
  const i = css.indexOf(head);
  if (i < 0) throw new Error(`style.css: no ${head}`);
  return css.slice(i, css.indexOf('}', i));
};
const tokens = (block) => [...block.matchAll(DRAW_TOKENS)].map((m) => `--${m[1]}: ${m[2]};`).join(' ');
const darkMedia = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const DRAW = {
  light: tokens(blockAfter(':root {')),
  dark: tokens(darkMedia.slice(0, darkMedia.indexOf('}'))),
  darkAttr: tokens(blockAfter(':root[data-theme="dark"] {')),
};
const drawRules = css.split('\n').filter((l) => /^(\.(lf|pot|shine|fs|fe|ck|jar|st|rt|vein|cut|co|trap|trunk)(?![-\w])|svg\.pl\b)/.test(l)).join('\n');

const lux = ([a, b]) => `${a.toLocaleString('ru-RU')}–${b.toLocaleString('ru-RU')} лк`;
// As kLux in core.js: «15 тыс».
const kLux = (n) => `${(n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}\u00a0тыс`;
// The card as a row of the app's catalog («Добавить растения», pickRow in add.js): a square tile, the name and one line:
// `alt`, then the hint.
function pickPreview(d) {
  const sub = [d.alt ? altHtml(d.alt) : '', d.hint ? esc(d.hint) : ''].filter(Boolean).join(' · ');
  return `<section class="blk prev"><h4>В каталоге</h4><div class="pick"><span class="pe fit">${plantSvg(d, 'fine', true)}</span><span class="pt"><b>${esc(d.species)}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="pc">${I('plus')}</span></div></section>`;
}
// As days in core.js: «8 дней».
const days = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
// The card as the plant card's «Настройки» → «Карточка ухода» shows it (cardNow in plant.js): its catalog row, then
// under a line its characteristics; not a control, so a quiet border and no plus.
function cardNowPreview(d) {
  const m = MEDIUM[d.type] || {};
  const facts = [
    ['Свет', `${kLux(d.lux[0])}–${kLux(d.lux[1])} лк`],
    m.noChecks ? null : ['Проверка', `раз в ~${days(d.every)}`],
    ['В чём растёт', lc(NAMES[d.type] || d.type)],
    m.pot && d.watering && d.watering !== 'top' ? ['Полив', lc(NAMES[d.watering] || d.watering)] : null,
  ].filter(Boolean).map(([k, v]) => `<li><span class="k">${k}:</span> ${esc(v)}</li>`).join('');
  const sub = [d.alt ? altHtml(d.alt) : '', d.hint ? esc(d.hint) : ''].filter(Boolean).join(' · ');
  return `<section class="blk prev now"><h4>В настройках растения</h4><div class="pick card-now"><div class="cn-head"><span class="pe fit">${plantSvg(d, 'fine', true)}</span><span class="pt"><b>${esc(d.species)}</b>${sub ? `<small>${sub}</small>` : ''}</span></div><ul class="cn-facts">${facts}</ul></div></section>`;
}
// As petsOf in state.js: safe only when both cats and dogs are; 'unlisted' (checked, not in ASPCA) is no data.
const petsOf = (v) => (!v || v === 'unlisted' ? '' : typeof v === 'string' ? v : v.cats === 'toxic' || v.dogs === 'toxic' ? 'toxic' : v.cats === 'safe' && v.dogs === 'safe' ? 'safe' : '');
// As norm in views.js: search ignores case and «ё».
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
const CATS = [...new Set(PLANTS.map((d) => d.cat))].sort((a, b) => (CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99));

// Tag icons and words of growing media and watering ways (`badge` in state.js), as on the app's filter chips.
const BADGES = Object.fromEntries(ENTRIES.map(([k, , t]) => [k, t.match(/badge: \['([a-z-]+)', '([^']+)'\]/)]).filter(([, m]) => m).map(([k, m]) => [k, [m[1], m[2]]]));
// The app's icons (the sprite in index.html), only the ones this page uses.
const indexHtml = read('index.html');
const used = new Set(['funnel', 'search', 'x', 'chevron-right', 'plus', 'paw-print', 'paw-toxic', 'triangle-alert', ...Object.values(BADGES).map((b) => b[0])]);
const SPRITE = [...used].map((id) => (indexHtml.match(new RegExp(`<symbol id="i-${id}"[^>]*>[\\s\\S]*?</symbol>`)) || [''])[0]).join('');
const I = (n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;

// What a reviewer should look at: facts every real card is expected to have.
const GAPS = {
  pets: 'Нет данных о кошках и собаках',
  petsNote: 'Ядовито, но нет симптомов',
  prune: 'Нет совета по обрезке',
  aka: 'Нет других названий для поиска',
  alt: 'Нет второго названия',
};
function gapsOf(d) {
  if (d.generic) return [];
  const out = [];
  if (!petsOf(d.pets) && d.pets !== 'unlisted') out.push('pets');
  else if (petsOf(d.pets) === 'toxic' && !d.petsNote) out.push('petsNote');
  if (!d.prune) out.push('prune');
  if (!d.aka) out.push('aka');
  if (d.alt === undefined) out.push('alt'); // '' is checked: no second name
  return out;
}

// Filter keys of a card; the «Фильтр» sheet has one chip per key that any card has, in these sections.
function keysOf(d) {
  const gaps = gapsOf(d);
  const pets = petsOf(d.pets);
  return [
    `cat:${CATS.indexOf(d.cat)}`, `t:${d.type}`, d.watering && `w:${d.watering}`,
    pets === 'toxic' && 'pets', pets === 'safe' && 'pets_safe', d.pets === 'unlisted' && 'pets_unlisted', d.toxic && 'sap',
    gaps.length && 'gap', ...gaps.map((g) => `gap:${g}`),
    d.generic && 'generic', d.big && 'big', d.humid && 'humid',
  ].filter(Boolean);
}
const badge = (k) => (BADGES[k] ? `${I(BADGES[k][0])}${BADGES[k][1]}` : esc(NAMES[k] || k));
const FILTERS = [
  ['Группа', CATS.map((c, i) => [`cat:${i}`, esc(c), ''])],
  ['Как растёт', [
    ...[...new Set(PLANTS.map((d) => d.type))].map((k) => [`t:${k}`, badge(k), 'way']),
    ...[...new Set(PLANTS.map((d) => d.watering).filter(Boolean))].map((k) => [`w:${k}`, badge(k), 'way']),
  ]],
  ['Безопасность', [
    ['pets', `${I('paw-toxic')}опасно для животных`, 'danger'],
    ['pets_safe', `${I('paw-print')}безопасно для животных`, 'safe'],
    ['pets_unlisted', `${I('paw-print')}нет в базе ASPCA`, ''],
    ['sap', `${I('triangle-alert')}едкий сок`, 'danger'],
  ]],
  ['Пробелы', [['gap', 'любой пробел', 'need'], ...Object.entries(GAPS).map(([k, t]) => [`gap:${k}`, t, 'need'])]],
  ['Карточка', [['generic', 'общие типы', ''], ['big', 'крупные', ''], ['humid', 'влаголюбивые', '']]],
];

// A row: what the app shows, and an optional hint line under it (as in a settings row).
// «Свет: нужно 3 000–15 000 лк» on one line, the hint under it.
const row = (k, v, hint = '', cls = '') => (v || hint ? `<div class="r"><dt>${k}${v ? ':' : ''}</dt> <dd${cls ? ` class="${cls}"` : ''}>${v}${hint ? `<span class="hint">${hint}</span>` : ''}</dd></div>` : '');
// A name from the app as a value after a colon: «Обычный грунт» → «обычный грунт».
const lc = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
// A block of rows under a band, named as in the app; empty blocks are left out.
const block = (title, rows, cls) => (rows.trim() ? `<section class="blk ${cls}"><h4>${title}</h4><dl>${rows}</dl></section>` : '');
function card(d) {
  const pets = petsOf(d.pets);
  const gaps = gapsOf(d);
  const flags = [d.generic && 'Общий тип'].filter(Boolean);
  const m = MEDIUM[d.type] || {};
  // The pruning reminder is off for a new plant («нет»); «Да» to «Звать на обрезку?» calls in these months.
  const months = d.prune && d.prune.months ? d.prune.months.map((x) => MONTHS[x - 1]).join(', ')
    : `${PRUNE_MONTHS.map((x) => MONTHS[x - 1]).join(', ')} (по умолчанию)`;
  // As the «Подкормка» row (rowValues in plant.js): on «День подкормки» the card's interval, else the medium's, else
  // 14 days; otherwise why there's no feeding day.
  const fe = Number.isFinite(d.feedEvery) ? d.feedEvery : m.feedEvery || FEED_DEFAULT;
  const feedsOnDay = !d.noFeed && m.feed === 'day';
  const feed = feedsOnDay
    ? (fe ? `${FEED_WORDS[fe] || `раз в ${fe} дн.`}${Number.isFinite(d.feedEvery) || m.feedEvery ? '' : ' (по умолчанию)'}` : 'не кормлю')
    : d.distilled ? 'не удобряют' : d.type === 'water' ? 'при смене воды' : FEED_WITH[m.feed] || 'нет дня подкормки';
  const own = [d.type, d.watering].filter((k) => OWN_START.has(k));
  const check = d.check
    ? esc(d.check)
    : CHECK_TEXT[d.type] ? `${esc(CHECK_TEXT[d.type])} <span class="muted">(общий для «${esc(NAMES[d.type] || d.type)}»)</span>` : '';
  // «Настройки»: values the person can change, each with its hint as in the app.
  const settings = [
    row('Свет', `нужно ${lux(d.lux)}`),
    row('В чём растёт', esc(lc(NAMES[d.type] || d.type))),
    row('Полив', m.pot ? esc(lc(NAMES[d.watering || 'top'] || d.watering)) : ''),
    row('Проверка', m.noChecks ? 'не нужно' : `раз в ${d.every} дн., дальше подстраивается по ответам`, m.noChecks ? '' : own.map((k) => `Для «${esc(NAMES[k])}» первая проверка считается иначе.`).join(' ')),
    row('Подкормка', feed, feedsOnDay && fe ? esc(d.feedNote || m.feedNote) : ''),
    row('Обрезка', d.prune && d.prune.no ? 'не обрезают' : 'нет', d.prune && d.prune.no ? esc(d.prune.no) : [`«Да» на «Звать на обрезку?»: ${months}.`, d.prune && esc(d.prune.tip || '')].filter(Boolean).join(' ')),
    row('Покой', d.rest ? `с «${esc(d.rest.start)}» до «${esc(d.rest.end)}»` : '', d.rest ? esc([d.rest.tip, d.rest.water].filter(Boolean).join(' ')) : ''),
    row('Новое', '', esc(d.settle || '')),
    row('Место', esc(d.spot || '')),
  ].join('');
  // «Заметки»: the four catalog tips, editable per plant; `ways` replace water and soil for another medium.
  const notes = [
    row('Как поливать', esc(d.water)),
    row('Грунт', esc(d.soil)),
    row('Условия', esc(d.cond)),
    row('Важно', esc(d.tip)),
    ...(d.ways ? Object.entries(d.ways).map(([k, w]) => row(`Если в «${esc(NAMES[k] || k)}»`, [w.water && `Как поливать: ${esc(w.water)}`, w.soil && `Грунт: ${esc(w.soil)}`].filter(Boolean).join(' '))) : []),
  ].join('');
  // Tags under the name and tasks.
  const tags = [
    row('Животные', pets === 'safe' ? 'метка «безопасно»' : pets === 'toxic' ? '<b>метка «опасно»</b>' : d.generic ? '' : d.pets === 'unlisted' ? 'нет в базе ASPCA (проверено)' : 'нет данных', pets === 'toxic' || d.pets === 'unlisted' ? esc(d.petsNote || '') : '', pets === 'toxic' ? 'warn' : pets || d.generic || d.pets === 'unlisted' ? '' : 'gap'),
    row('Сок', d.toxic ? '<b>метка «едкий сок»</b>' : '', d.toxic === 'skin' ? 'Раздражает кожу.' : d.toxic ? 'Раздражает кожу и слизистые.' : '', 'warn'),
    row('Задача полива', check, d.distilled ? 'Только дистиллированная вода, обратного осмоса или чистая дождевая.' : ''),
    row('Если есть силы', [d.big && '«Протереть листья»', d.rotate && '«Повернуть»'].filter(Boolean).join(', ')),
    row('Комната', d.humid ? 'в подсказке о влажном воздухе' : ''),
  ].join('');
  const search = norm([d.species, d.id, d.aka || '', d.cat].join(' '));
  return `<article class="card" id="${esc(d.id)}" data-k="${keysOf(d).join(' ')}" data-search="${esc(search)}">
<div class="side"><header class="head"><div class="tile">${plantSvg(d, 'fine')}</div><div class="name"><h3>${esc(d.species)}</h3><p class="id">${esc(d.id)}</p>${d.aka ? `<p class="aka"><span class="k">Ищется по словам:</span> ${esc(d.aka)}</p>` : ''}${flags.length ? `<p class="flags">${flags.map((f) => `<span>${f}</span>`).join('')}</p>` : ''}</div></header>
${gaps.length ? `<ul class="gaps">${gaps.map((g) => `<li>${GAPS[g]}</li>`).join('')}</ul>` : ''}</div>
<div class="blks">${pickPreview(d)}${cardNowPreview(d)}<div class="col">${block('Настройки', settings, 'b-set')}${block('Метки и задачи', tags, 'b-tags')}</div>
<div class="col">${block('Заметки', notes, 'b-notes')}<section class="blk b-quips"><h4>Реплики</h4><ul class="quips">${d.quips.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></section></div></div>
</article>`;
}

function page() {
  const n = (f) => PLANTS.filter(f).length;
  const real = n((d) => !d.generic);
  const now = new Date();
  const date = [now.getDate(), now.getMonth() + 1].map((x) => String(x).padStart(2, '0')).concat(now.getFullYear()).join('.');
  // Filter chips, as in the app's «Фильтр» sheet: icon and word in the kind's color, a quiet count; only kinds that have cards.
  const counts = {};
  PLANTS.forEach((d) => keysOf(d).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }));
  const chip = (k, label, cls) => `<button type="button" class="st-chip ${cls}" data-k="${k}" aria-pressed="${!k}">${label} <span class="n">${k ? counts[k] : PLANTS.length}</span></button>`;
  const sheet = FILTERS.map(([title, kinds]) => [title, kinds.filter(([k]) => counts[k])]).filter(([, kinds]) => kinds.length)
    .map(([title, kinds]) => `<h3 class="filter-sec">${title}</h3><div class="st-filter" role="group" aria-label="${title}">${kinds.map(([k, label, cls]) => chip(k, label, cls)).join('')}</div>`).join('');
  const sections = CATS.map((c, i) => {
    const list = PLANTS.filter((d) => d.cat === c).sort((a, b) => !!a.generic - !!b.generic || (!a.generic && a.species.localeCompare(b.species, 'ru'))); // as catalogHtml in add.js
    return `<section class="cat"><h2><button type="button" class="cat-head" aria-expanded="true" aria-controls="cat-${i}"><span>${esc(c)} <span class="n">${list.length}</span></span>${I('chevron-right')}</button></h2><div class="grid" id="cat-${i}">${list.map(card).join('\n')}</div></section>`;
  }).join('\n');
  const all = `все ${PLANTS.length} ${plural(PLANTS.length, 'карточка', 'карточки', 'карточек')}`;
  return `<title>Каталог Жунгли</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800;900&display=swap">
<style>
/* Layout: the app's cream ground and Nunito; search and «Фильтр» as on the Plants tab, then folding groups of cards. */
:root {
  --bg: #fff4e2; --card: #ffffff; --field: #ffffff; --sheet: #ffffff; --ink: #2a2118; --muted: #4a3b2e; --line: rgba(42, 33, 24, .14);
  --chip: #f7e6c8; --gap-bg: #ffe0c7; --gap-ink: #7a3200; --warn: #94003a;
  --st-need: #7a3200; --st-fine: #1a522e; --st-danger: #94003a; --st-grow: #004a4f;
  --font: Nunito, ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
  ${DRAW.light}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1a1524; --card: #2a2338; --field: #2a2338; --sheet: #2a2338; --ink: #fff6ea; --muted: #efe5d8; --line: rgba(255, 246, 234, .16);
    --chip: #3b3150; --gap-bg: #4a3326; --gap-ink: #ffd27a; --warn: #ffccd6;
    --st-need: #ffb685; --st-fine: #83d8a3; --st-danger: #ffb2d0; --st-grow: #7fdcd6;
    ${DRAW.dark} color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #1a1524; --card: #2a2338; --field: #2a2338; --sheet: #2a2338; --ink: #fff6ea; --muted: #efe5d8; --line: rgba(255, 246, 234, .16);
  --chip: #3b3150; --gap-bg: #4a3326; --gap-ink: #ffd27a; --warn: #ffccd6;
  --st-need: #ffb685; --st-fine: #83d8a3; --st-danger: #ffb2d0; --st-grow: #7fdcd6;
  ${DRAW.darkAttr} color-scheme: dark;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
/* The app's 1rem is 17px, so its sizes (0.824rem counts) stay at 14px or more */
html { font-size: 17px; }
body { background: var(--bg); color: var(--ink); font-family: var(--font); font-size: 1rem; line-height: 1.5; }
button { font: inherit; color: inherit; cursor: pointer; }
main { max-width: 1400px; margin: 0 auto; padding-block: 24px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { font-size: 2rem; font-weight: 900; margin: 0 0 4px; text-wrap: balance; }
.lead { color: var(--muted); margin: 0 0 20px; max-width: 65ch; }
.sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
.ic { width: 1.15em; height: 1.15em; flex: none; vertical-align: -.2em; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; max-width: 520px; }
/* Search and «Фильтр»: the app's fields (.search, .pfilter in style.css) */
.search, .pfilter { position: relative; }
.search input { width: 100%; min-height: 52px; font: inherit; font-size: 1rem; padding: 8px 50px 8px 46px; border: 2px solid var(--edge); border-radius: 16px; background: var(--field); color: var(--ink); }
.search input::placeholder { color: var(--muted); opacity: 1; }
.search input::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
.search > .ic { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; color: var(--muted); pointer-events: none; }
.search-x, .pfilter-x, .pfilter-end { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--muted); }
.search-x .ic, .pfilter-x .ic, .pfilter-end .ic { width: 22px; height: 22px; stroke-width: 2.5; }
.pfilter-end { pointer-events: none; }
.pfilter-open { width: 100%; min-height: 52px; display: flex; align-items: center; gap: 10px; padding: 8px 50px 8px 14px; text-align: left; border: 2px solid var(--edge); border-radius: 16px; background: var(--field); font-size: 1rem; }
.pfilter-open > .ic { width: 22px; height: 22px; color: var(--muted); stroke-width: 2.2; margin-left: 1px; }
.pfilter-t { line-height: 1.35; }
.pfilter-t .k { color: var(--muted); font-weight: 700; }
.pfilter-t .v { font-weight: 900; }
.pfilter-t .v .ic { width: 18px; height: 18px; stroke-width: 2.4; vertical-align: -3px; margin-right: .25em; }
.pfilter-t .v .n, .st-chip .n, .cat-head .n { font-size: .824rem; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
.pfilter.on .pfilter-open { border-color: var(--ink); }
.shown { color: var(--muted); font-weight: 700; margin: 0; }
/* The «Фильтр» sheet: a bottom sheet with chips in sections; one tap picks a chip and closes it */
dialog { border: 0; padding: 0; width: 100%; max-width: 560px; max-height: 92dvh; margin: auto auto 0; border-radius: 32px 32px 0 0; background: var(--sheet); color: var(--ink); }
dialog::backdrop { background: rgba(26, 21, 36, .35); }
.sheet-body { padding: 18px 16px calc(env(safe-area-inset-bottom, 0px) + 24px); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.sheet-head h2 { font-size: 1.529rem; line-height: 1.15; margin: 0; }
.sheet-x { width: 44px; height: 44px; display: grid; place-items: center; padding: 0; border: 2px solid var(--edge); border-radius: 50%; background: var(--chip); }
.sheet-x .ic { width: 22px; height: 22px; stroke-width: 2.5; }
.filter-sec { font-size: .94rem; font-weight: 900; margin: 20px 0 10px; color: var(--muted); }
.st-filter { display: flex; flex-wrap: wrap; gap: 8px; }
.st-chip { display: inline-flex; align-items: center; gap: .3em; min-height: 44px; font-size: .941rem; font-weight: 900; padding: 5px 14px 5px 10px; border-radius: 99px; border: 2px solid var(--edge); background: var(--field); color: var(--ink); white-space: nowrap; }
.st-chip .ic { width: 18px; height: 18px; stroke-width: 2.4; }
.st-chip[aria-pressed="true"] { border-color: currentColor; box-shadow: 0 0 0 1px currentColor; }
:is(.st-chip, .pfilter-t .v).need { color: var(--st-need); }
:is(.st-chip, .pfilter-t .v).safe { color: var(--st-fine); }
:is(.st-chip, .pfilter-t .v).danger { color: var(--st-danger); }
:is(.st-chip, .pfilter-t .v).way { color: var(--st-grow); }
button:focus-visible, .search input:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
/* Groups fold on their heading, with the app's chevron (as on folding settings rows) */
.cat { margin-bottom: 28px; }
h2 { font-size: 1.4rem; font-weight: 900; margin: 0 0 12px; }
.cat-head { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0; border: 0; background: none; font-weight: 900; text-align: left; }
.cat-head .ic { width: 1em; height: 1em; color: var(--muted); transition: transform .15s; }
.cat-head[aria-expanded="true"] .ic { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .cat-head .ic { transition: none; } }
.grid { display: flex; flex-direction: column; gap: 16px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 28px; padding: 14px 18px 18px 14px; min-width: 0; scroll-margin-top: 16px; }
.head { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
/* The picture as on a Plants grid card (.pcard .pic): a 3:4 pastel tile, the drawing low in it */
.tile { flex: none; width: 116px; aspect-ratio: 3 / 4; border-radius: 21px; display: grid; place-items: center; overflow: hidden; }
/* A catalog row as in the app (.pick in style.css) */
.pick { display: flex; align-items: center; gap: 12px; max-width: 420px; background: var(--field); border: 2px solid var(--edge); border-radius: 20px; padding: 10px 12px; }
/* In «В каталоге» and «В настройках растения»: some air under the band, the row centered in its column */
.prev .pick { margin: 16px auto 4px; }
.pick.card-now { border-color: var(--line); flex-direction: column; align-items: stretch; gap: 0; }
.card-now .cn-head { display: flex; align-items: center; gap: 12px; }
.card-now .cn-facts { list-style: none; margin: 10px 0 0; padding: 10px 0 0; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 2px; font-size: .882rem; }
.card-now .cn-facts .k { color: var(--muted); font-weight: 700; }
.pick .pe { width: 52px; height: 52px; flex: none; display: grid; place-items: center; border-radius: 16px; overflow: hidden; }
.pick .pe svg.pl { width: 46px; height: 46px; }
.pick .pt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pick .pt b { font-weight: 800; }
.pick .pt small { color: var(--muted); font-size: .824rem; line-height: 1.5; }
.pick .pc { color: var(--muted); flex: none; display: inline-flex; }
.pick .pc .ic { width: 22px; height: 22px; stroke-width: 2.5; }
.pick .pe.fit { width: 56px; height: 56px; }
.pick .pe.fit svg.pl { width: 46px; height: 46px; }
:is(.tile, .pe):has(> svg.v0) { background: var(--t0); } :is(.tile, .pe):has(> svg.v1) { background: var(--t1); } :is(.tile, .pe):has(> svg.v2) { background: var(--t2); }
:is(.tile, .pe):has(> svg.v3) { background: var(--t3); } :is(.tile, .pe):has(> svg.v4) { background: var(--t4); } :is(.tile, .pe):has(> svg.v5) { background: var(--t5); }
.tile svg.pl { width: 84%; height: 84%; margin-bottom: 16%; }
.name { min-width: 0; padding-top: 6px; }
h3 { font-size: 1.2rem; font-weight: 900; margin: 0; line-height: 1.25; }
.id { font-family: ui-monospace, Menlo, monospace; font-size: .824rem; color: var(--muted); margin: 2px 0 0; }
.aka { font-size: .882rem; color: var(--muted); margin: 6px 0 0; overflow-wrap: anywhere; }
.aka .k { font-weight: 800; }
.flags { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
.flags span { font-size: .824rem; font-weight: 800; padding: 1px 10px; border-radius: 99px; background: var(--chip); }
.gaps { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 10px 0 0; }
.gaps li { font-size: .88rem; font-weight: 800; padding: 3px 12px; border-radius: 99px; background: var(--gap-bg); color: var(--gap-ink); }
/* Blocks of a card, named as in the app, each under a beige band like a settings group */
.blk { margin-top: 14px; min-width: 0; }
/* Phone: one column in reading order; wide screens: «Настройки», «Метки и задачи», «В каталоге» on the left, «Заметки», «Реплики», «В настройках растения» on the right */
.blks { display: flex; flex-direction: column; }
.col { display: contents; }
.b-set { order: 1; } .b-notes { order: 2; } .b-tags { order: 3; } .b-quips { order: 4; } .prev { order: 5; } .prev.now { order: 6; }
.quips { margin: 0; padding-left: 1.3em; }
.quips li + li { margin-top: 4px; }
/* Wide screens: one plant per row, the picture and name in a column on the left that stays in view, blocks side by side */
@media (min-width: 900px) {
  .card { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 24px; padding: 18px; }
  .side { position: sticky; top: 16px; align-self: start; }
  .head { flex-direction: column; gap: 12px; margin-bottom: 0; }
  .head .tile { width: 100%; }
  .name { padding-top: 0; }
  .blks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 24px; align-items: start; }
  /* Three rows, each pair starting on one level: «Настройки» and «Заметки», «Метки и задачи» and «Реплики», then the card as the
     app shows it: «В каталоге» and «В настройках растения» */
  .b-set { grid-area: 1 / 1; } .b-notes { grid-area: 1 / 2; } .b-tags { grid-area: 2 / 1; } .b-quips { grid-area: 2 / 2; }
  .prev { grid-area: 3 / 1; } .prev.now { grid-area: 3 / 2; }
  .blk { margin-top: 0; }
}
.blk h4 { font-size: .941rem; font-weight: 900; text-align: center; color: var(--ink); background: var(--chip); border-radius: 12px; padding: 4px 10px; margin: 0 0 8px; }
dl { display: flex; flex-direction: column; gap: 10px; margin: 0; padding-left: 4px; }
.r { min-width: 0; }
dt, dd { display: inline; margin: 0; }
dt { font-weight: 800; color: var(--muted); }
dd .hint { display: block; color: var(--muted); font-size: .882rem; margin-top: 2px; }
dd.warn b { color: var(--warn); }
dd.gap { color: var(--gap-ink); font-weight: 800; }
.muted { color: var(--muted); }
@media (max-width: 480px) { .tile { width: 96px; } }
${drawRules}
</style>
<svg class="sprite" aria-hidden="true">${SPRITE}</svg>
<main>
<h1>Каталог Жунгли</h1>
<p class="lead">${real} ${plural(real, 'карточка', 'карточки', 'карточек')} растений и ${PLANTS.length - real} ${plural(PLANTS.length - real, 'общий тип', 'общих типа', 'общих типов')}. Версия ${esc(VERSION)}, собрано ${date}. Карточки разбиты как в приложении: «Настройки», «Заметки», метки и задачи, реплики. Пробелы отмечены оранжевым: это факты, которых в карточке пока нет. Обсуждать можно в комментариях прямо на странице.</p>
<div class="bar">
<div class="search"><input id="q" type="search" aria-label="Найти растение" placeholder="Найти: название, id или другое имя" autocomplete="off">${I('search')}<button type="button" class="search-x" id="q-x" aria-label="Очистить поиск" hidden>${I('x')}</button></div>
<div class="pfilter" id="pfilter"><button type="button" class="pfilter-open" id="f-open" aria-haspopup="dialog">${I('funnel')}<span class="pfilter-t"><span class="k">Фильтр:</span> <span id="f-value">${all}</span></span></button><button type="button" class="pfilter-x" id="f-x" aria-label="Сбросить фильтр" hidden>${I('x')}</button><span class="pfilter-end" id="f-end" aria-hidden="true">${I('chevron-right')}</span></div>
<p class="shown" id="shown" aria-live="polite"></p>
</div>
${sections}
</main>
<dialog id="fsheet" aria-labelledby="fsheet-h"><div class="sheet-body">
<div class="sheet-head"><h2 id="fsheet-h">Фильтр</h2><button type="button" class="sheet-x" id="f-close" aria-label="Закрыть">${I('x')}</button></div>
<div class="st-filter" role="group" aria-label="Все карточки">${chip('', 'Все', '')}</div>
${sheet}
</div></dialog>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  const q = $('q'), sheet = $('fsheet');
  const chips = [...sheet.querySelectorAll('.st-chip')];
  const cards = [...document.querySelectorAll('.card')];
  const ALL = ${JSON.stringify(all)};
  let kind = '';
  function apply() {
    const text = q.value.trim().toLowerCase().replace(/ё/g, 'е');
    let count = 0;
    for (const el of cards) {
      const ok = (!text || el.dataset.search.includes(text)) && (!kind || el.dataset.k.split(' ').includes(kind));
      el.hidden = !ok;
      if (ok) count++;
    }
    for (const s of document.querySelectorAll('.cat')) {
      const n = s.querySelectorAll('.card:not([hidden])').length;
      s.hidden = !n;
      s.querySelector('.cat-head .n').textContent = n;
    }
    $('q-x').hidden = !q.value;
    $('shown').textContent = count === cards.length ? '' : 'Показано ' + count + ' из ' + cards.length;
  }
  function pick(k) {
    kind = k;
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.k === k));
    const c = chips.find((x) => x.dataset.k === k);
    $('f-value').innerHTML = k ? '<span class="v ' + c.className.replace('st-chip', '').trim() + '">' + c.innerHTML + '</span>' : ALL;
    $('pfilter').classList.toggle('on', !!k);
    $('f-x').hidden = !k;
    $('f-end').hidden = !!k;
    apply();
  }
  $('f-open').addEventListener('click', () => sheet.showModal());
  $('f-close').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
  sheet.addEventListener('close', () => $('f-open').focus());
  for (const c of chips) c.addEventListener('click', () => { pick(c.dataset.k); sheet.close(); });
  $('f-x').addEventListener('click', () => { pick(''); $('f-open').focus(); });
  q.addEventListener('input', apply);
  $('q-x').addEventListener('click', () => { q.value = ''; apply(); q.focus(); });
  for (const b of document.querySelectorAll('.cat-head')) b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    $(b.getAttribute('aria-controls')).hidden = !open;
  });
  apply();
})();
</script>
`;
}

const out = process.argv[2];
if (!out) {
  console.error('Usage: node tools/catalog.js FILE');
  process.exit(2);
}
fs.writeFileSync(out, page());
console.log(`${out}: ${PLANTS.length} cards`);
