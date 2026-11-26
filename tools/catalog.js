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

// The catalog and the drawings run as they are; shapes.js only needs the cards.
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${read('plants.js')}\n${read('shapes.js')}\nthis.out = { PLANTS, CHECK_TEXT, plantSvg };`, ctx);
const { PLANTS, CHECK_TEXT, plantSvg } = ctx.out;

// Names of growing media and watering ways (MEDIA and WATERING in state.js), read without running state.js.
const NAMES = Object.fromEntries([...read('state.js').matchAll(/^ {2}(\w+): \{ name: '([^']+)'/gm)].map((m) => [m[1], m[2]]));
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
const petsOf = (v) => (!v ? '' : typeof v === 'string' ? v : v.cats === 'toxic' || v.dogs === 'toxic' ? 'toxic' : 'safe');

// What a reviewer should look at: facts every real card is expected to have.
function gapsOf(d) {
  if (d.generic) return [];
  const out = [];
  if (!petsOf(d.pets)) out.push('Нет данных о кошках и собаках');
  else if (petsOf(d.pets) === 'toxic' && !d.petsNote) out.push('Ядовито, но нет симптомов');
  if (!d.prune) out.push('Нет совета по обрезке');
  if (!d.aka) out.push('Нет других названий для поиска');
  return out;
}

const row = (k, v, cls = '') => (v ? `<dt>${k}</dt><dd${cls ? ` class="${cls}"` : ''}>${v}</dd>` : '');
function card(d) {
  const pets = petsOf(d.pets);
  const gaps = gapsOf(d);
  const flags = [
    d.hidden && 'Скрыта',
    d.generic && 'Общий тип',
    d.big && 'Крупное',
    d.humid && 'Влаголюбивое',
    d.rotate && 'Поворачивать к свету',
    d.wickTested && 'Фитиль проверен',
  ].filter(Boolean);
  const prune = d.prune && (d.prune.no
    ? `Не обрезают. ${esc(d.prune.no)}`
    : `${d.prune.months ? `<b>${d.prune.months.map((m) => MONTHS[m - 1]).join(', ')}.</b> ` : ''}${esc(d.prune.tip || '')}`);
  const feed = [
    d.noFeed && 'Не подкармливать.',
    d.feedEvery && `Раз в ${d.feedEvery} дней.`,
    d.feedNote && esc(d.feedNote),
  ].filter(Boolean).join(' ');
  const check = d.check
    ? esc(d.check)
    : CHECK_TEXT[d.type] ? `${esc(CHECK_TEXT[d.type])} <span class="muted">(общий для «${esc(NAMES[d.type] || d.type)}»)</span>` : '';
  const more = [
    d.rest && `<h4>Покой</h4><p><b>Начало:</b> ${esc(d.rest.start)}. <b>Конец:</b> ${esc(d.rest.end)}.</p><p>${esc(d.rest.tip)}</p>${d.rest.water ? `<p><b>Полив:</b> ${esc(d.rest.water)}</p>` : ''}`,
    d.ways && Object.entries(d.ways).map(([k, w]) => `<h4>Если растёт в «${esc(NAMES[k] || k)}»</h4>${w.water ? `<p><b>Полив:</b> ${esc(w.water)}</p>` : ''}${w.soil ? `<p><b>Грунт:</b> ${esc(w.soil)}</p>` : ''}`).join(''),
    `<h4>Реплики</h4><ul>${d.quips.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>`,
    d.aka && `<h4>Слова для поиска</h4><p class="muted">${esc(d.aka)}</p>`,
    d.hint && `<h4>Подсказка в списке</h4><p>${esc(d.hint)}</p>`,
  ].filter(Boolean).join('');
  const search = [d.species, d.id, d.aka || '', d.cat].join(' ').toLowerCase();
  return `<article class="card" id="${esc(d.id)}" data-cat="${esc(d.cat)}" data-gaps="${gaps.length ? 1 : 0}" data-pets="${pets}"${d.toxic ? ' data-sap="1"' : ''}${d.hidden ? ' data-hidden="1"' : ''} data-search="${esc(search)}">
<header class="head"><div class="tile">${plantSvg(d, 'fine')}</div><div class="name"><h3>${esc(d.emoji)} ${esc(d.species)}</h3><p class="id">${esc(d.id)}</p>${flags.length ? `<p class="flags">${flags.map((f) => `<span>${f}</span>`).join('')}</p>` : ''}</div></header>
${gaps.length ? `<ul class="gaps">${gaps.map((g) => `<li>${g}</li>`).join('')}</ul>` : ''}
<dl>
${row('Свет', lux(d.lux))}
${row('Растёт в', `${esc(NAMES[d.type] || d.type)}${d.watering ? `, полив «${esc(NAMES[d.watering] || d.watering)}»` : ''}. Первая проверка через ${d.every} дн.`)}
${row('Проверка', check)}
${row('Полив', esc(d.water))}
${row('Грунт', esc(d.soil))}
${row('Условия', esc(d.cond))}
${row('Совет', esc(d.tip))}
${row('Животные', pets === 'safe' ? 'Безопасно для кошек и собак.' : pets === 'toxic' ? `<b>Ядовито для кошек и собак.</b> ${esc(d.petsNote || '')}` : d.generic ? '' : 'Нет данных.', pets === 'toxic' ? 'warn' : pets ? '' : d.generic ? '' : 'gap')}
${row('Сок', d.toxic === 'skin' ? 'Раздражает кожу.' : d.toxic ? 'Раздражает кожу и слизистые.' : '', 'warn')}
${row('Обрезка', prune)}
${row('Подкормка', feed)}
${row('Вода', d.distilled ? 'Только дистиллированная, обратного осмоса или чистая дождевая.' : '')}
${row('После покупки', esc(d.settle || ''))}
${row('Место', esc(d.spot || ''))}
</dl>
<details><summary>Реплики, слова для поиска${d.rest ? ', покой' : ''}${d.ways ? ', другие способы' : ''}</summary>${more}</details>
</article>`;
}

function page() {
  const cats = [...new Set(PLANTS.map((d) => d.cat))].sort((a, b) => (CAT_ORDER.indexOf(a) + 1 || 99) - (CAT_ORDER.indexOf(b) + 1 || 99));
  const n = (f) => PLANTS.filter(f).length;
  const real = n((d) => !d.generic);
  const withGaps = n((d) => gapsOf(d).length);
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const chip = (attr, val, label, count) => `<button type="button" class="chip" data-f="${attr}" data-v="${esc(val)}" aria-pressed="false">${label} <span class="n">${count}</span></button>`;
  const sections = cats.map((c) => {
    const list = PLANTS.filter((d) => d.cat === c);
    return `<section class="cat" data-cat="${esc(c)}"><h2>${esc(c)} <span class="n">${list.length}</span></h2><div class="grid">${list.map(card).join('\n')}</div></section>`;
  }).join('\n');
  return `<title>Каталог Жунгли</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800;900&display=swap">
<style>
/* Layout: the app's cream ground and Nunito; a filter bar, then groups of cards in one or two columns. */
:root {
  --bg: #fff4e2; --card: #ffffff; --ink: #2a2118; --muted: #4a3b2e; --line: rgba(42, 33, 24, .14);
  --chip: #f7e6c8; --chip-on: #0f4426; --on-chip-on: #ffffff;
  --gap-bg: #ffe0c7; --gap-ink: #7a3200; --warn: #94003a;
  --font: Nunito, ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
  ${DRAW.light}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #1a1524; --card: #2a2338; --ink: #fff6ea; --muted: #efe5d8; --line: rgba(255, 246, 234, .16);
    --chip: #3b3150; --chip-on: #a5ecc0; --on-chip-on: #1a1524;
    --gap-bg: #4a3326; --gap-ink: #ffd27a; --warn: #ffccd6;
    ${DRAW.dark} color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #1a1524; --card: #2a2338; --ink: #fff6ea; --muted: #efe5d8; --line: rgba(255, 246, 234, .16);
  --chip: #3b3150; --chip-on: #a5ecc0; --on-chip-on: #1a1524;
  --gap-bg: #4a3326; --gap-ink: #ffd27a; --warn: #ffccd6;
  ${DRAW.darkAttr} color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font-family: var(--font); font-size: 16px; line-height: 1.5; }
main { max-width: 1180px; margin: 0 auto; padding-block: 24px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { font-size: 2rem; font-weight: 900; margin: 0 0 4px; text-wrap: balance; }
.lead { color: var(--muted); margin: 0 0 20px; max-width: 65ch; }
.bar { display: flex; flex-direction: column; gap: 12px; margin-bottom: 28px; }
.bar input, .bar select { font: inherit; font-size: 1rem; min-height: 44px; padding: 8px 14px; border-radius: 14px; border: 1px solid var(--edge); background: var(--card); color: var(--ink); width: 100%; max-width: 420px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { font: inherit; font-weight: 800; font-size: .94rem; min-height: 44px; padding: 6px 14px; border-radius: 99px; border: 1px solid var(--edge); background: var(--chip); color: var(--ink); cursor: pointer; white-space: nowrap; }
.chip[aria-pressed="true"] { background: var(--chip-on); color: var(--on-chip-on); border-color: var(--chip-on); }
.chip .n, h2 .n { font-weight: 600; opacity: .85; font-variant-numeric: tabular-nums; }
.chip:focus-visible, .bar input:focus-visible, .bar select:focus-visible, summary:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
.shown { color: var(--muted); font-weight: 700; margin: 0; }
.cat { margin-bottom: 36px; }
h2 { font-size: 1.4rem; font-weight: 900; margin: 0 0 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 500px), 1fr)); gap: 16px; align-items: start; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 18px; min-width: 0; scroll-margin-top: 16px; }
.head { display: flex; gap: 14px; align-items: center; margin-bottom: 12px; }
.tile { flex: none; width: 76px; height: 76px; border-radius: 20px; display: grid; place-items: center; }
.tile:has(> svg.v0) { background: var(--t0); } .tile:has(> svg.v1) { background: var(--t1); } .tile:has(> svg.v2) { background: var(--t2); }
.tile:has(> svg.v3) { background: var(--t3); } .tile:has(> svg.v4) { background: var(--t4); } .tile:has(> svg.v5) { background: var(--t5); }
.tile svg.pl { width: 84%; height: 84%; }
.name { min-width: 0; }
h3 { font-size: 1.2rem; font-weight: 900; margin: 0; line-height: 1.25; }
.id { font-family: ui-monospace, Menlo, monospace; font-size: .85rem; color: var(--muted); margin: 2px 0 0; }
.flags { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 0; }
.flags span { font-size: .82rem; font-weight: 800; padding: 1px 10px; border-radius: 99px; background: var(--chip); }
.gaps { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 0 0 12px; }
.gaps li { font-size: .88rem; font-weight: 800; padding: 3px 12px; border-radius: 99px; background: var(--gap-bg); color: var(--gap-ink); }
dl { display: grid; grid-template-columns: 7.5em 1fr; gap: 6px 12px; margin: 0; }
dt { font-weight: 800; color: var(--muted); font-size: .9rem; padding-top: 2px; }
dd { margin: 0; min-width: 0; }
dd.warn b { color: var(--warn); }
dd.gap { color: var(--gap-ink); font-weight: 800; }
.muted { color: var(--muted); }
details { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 8px; }
summary { cursor: pointer; font-weight: 800; color: var(--muted); min-height: 32px; display: flex; align-items: center; }
details h4 { font-size: .95rem; margin: 12px 0 4px; }
details p, details ul { margin: 0 0 6px; }
details ul { padding-left: 1.2em; }
@media (max-width: 480px) { dl { grid-template-columns: 1fr; gap: 0; } dd { margin-bottom: 8px; } }
${drawRules}
</style>
<main>
<h1>Каталог Жунгли</h1>
<p class="lead">${real} карточек растений и ${PLANTS.length - real} общих типов. Версия ${esc(VERSION)}, собрано ${date} Пробелы отмечены оранжевым: это факты, которых в карточке пока нет. Обсуждать можно в комментариях прямо на странице.</p>
<div class="bar">
<input id="q" type="search" aria-label="Найти растение" placeholder="Найти: название, id или другое имя" autocomplete="off">
<select id="cat" aria-label="Группа"><option value="">Все группы</option>${cats.map((c) => `<option value="${esc(c)}">${esc(c)} (${n((d) => d.cat === c)})</option>`).join('')}</select>
<div class="chips" role="group" aria-label="Отбор">${chip('gaps', '1', 'С пробелами', withGaps)}${chip('pets', 'toxic', 'Ядовиты для животных', n((d) => petsOf(d.pets) === 'toxic'))}${chip('sap', '1', 'Едкий сок', n((d) => d.toxic))}${chip('hidden', '1', 'Скрытые', n((d) => d.hidden))}</div>
<p class="shown" id="shown" aria-live="polite"></p>
</div>
${sections}
</main>
<script>
(() => {
  const q = document.getElementById('q');
  const chips = [...document.querySelectorAll('.chip')];
  const cards = [...document.querySelectorAll('.card')];
  const shown = document.getElementById('shown');
  const cat = document.getElementById('cat');
  function apply() {
    const text = q.value.trim().toLowerCase();
    const on = chips.filter((c) => c.getAttribute('aria-pressed') === 'true');
    let count = 0;
    for (const el of cards) {
      const ok = (!text || el.dataset.search.includes(text)) && (!cat.value || el.dataset.cat === cat.value) && on.every((c) => el.dataset[c.dataset.f] === c.dataset.v);
      el.hidden = !ok;
      if (ok) count++;
    }
    for (const s of document.querySelectorAll('.cat')) s.hidden = !s.querySelector('.card:not([hidden])');
    shown.textContent = count === cards.length ? 'Показаны все: ' + count : 'Показано ' + count + ' из ' + cards.length;
  }
  for (const c of chips) c.addEventListener('click', () => {
    const was = c.getAttribute('aria-pressed') === 'true';
    c.setAttribute('aria-pressed', String(!was));
    apply();
  });
  q.addEventListener('input', apply);
  cat.addEventListener('change', apply);
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
