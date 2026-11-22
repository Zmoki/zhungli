/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// Every Russian text in the app's code, for review, and a check of the text rules (CLAUDE.md, DESIGN.md).
// No packages: run with Node from the repo root.
//   node tools/texts.js               rule problems in UI, «Что нового», page and catalog texts (exit code 1 if any)
//   node tools/texts.js --html FILE   also a page with every UI text by screen, to read through
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// UI files and what they draw, in the order people meet them.
const SCREENS = [
  ['views.js', '«Сегодня», «Растения», «Свет», «Комната»'],
  ['plant.js', 'Карточка растения'],
  ['add.js', 'Добавить растения, перенос из чата с ИИ'],
  ['settings.js', 'Настройки'],
  ['stories.js', '«Как работают Жунгли»'],
  ['state.js', 'Способы выращивания, задания, слова для всех экранов'],
  ['core.js', 'Общее'],
  ['app.js', 'Общее'],
  ['telegram.js', 'Телеграм'],
  ['shapes.js', 'Картинки растений'],
  ['changelog.js', '«Что нового»'],
];
// Texts outside the scripts: pages and the home-screen manifest.
const PAGES = [
  ['index.html', 'Страница приложения'],
  ['privacy.html', 'Конфиденциальность'],
  ['manifest.webmanifest', 'Значок на экране «Домой»'],
];
const CATALOG = 'plants.js';
const CYR = /[А-Яа-яЁё]/;

// The string literals of a JS file, with the line and the declaration they're in. Templates keep their
// `${…}` as {…}; strings inside those expressions are read too. Comments and regex literals are skipped.
function literals(src) {
  const out = [];
  let i = 0, line = 1, prev = '';
  const regexAfter = /^([(,=:[!&|?{};+\-*%<>~^]|return|typeof|case|of|in|delete|void|else|await|yield|throw|new|do|)$/;
  const step = () => { if (src[i] === '\n') line++; i++; };
  // After a backslash: the character it stands for (\n, \u00a0, \u{1F33F}, \x41), or the next one as is.
  function escaped() {
    step();
    const c = src[i];
    let m;
    if (c === 'u' && (m = src.slice(i).match(/^u\{([0-9a-fA-F]+)\}|^u([0-9a-fA-F]{4})/))) { for (let k = 0; k < m[0].length; k++) step(); return String.fromCodePoint(parseInt(m[1] || m[2], 16)); }
    if (c === 'x' && (m = src.slice(i).match(/^x([0-9a-fA-F]{2})/))) { step(); step(); step(); return String.fromCharCode(parseInt(m[1], 16)); }
    step();
    return { n: '\n', t: '\t' }[c] || c;
  }
  function quoted(q) {
    const start = line;
    let s = '';
    step();
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') { s += escaped(); continue; }
      s += src[i]; step();
    }
    step();
    out.push({ text: s, line: start });
  }
  function template() {
    const start = line;
    let s = '';
    step();
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { s += escaped(); continue; }
      if (src[i] === '$' && src[i + 1] === '{') { step(); step(); expr(); s += '{…}'; continue; }
      s += src[i]; step();
    }
    step();
    out.push({ text: s, line: start });
  }
  // Inside `${…}`: until its own closing brace.
  function expr() {
    let depth = 1;
    while (i < src.length) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}' && !--depth) { step(); return; }
      if (c === "'" || c === '"') { quoted(c); continue; }
      if (c === '`') { template(); continue; }
      step();
    }
  }
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') step(); continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) step(); step(); step(); continue; }
    if (c === "'" || c === '"') { quoted(c); prev = 'x'; continue; }
    if (c === '`') { template(); prev = 'x'; continue; }
    if (c === '/' && regexAfter.test(prev)) {
      step();
      let cls = false;
      while (i < src.length && (cls || src[i] !== '/')) { if (src[i] === '\\') step(); else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; step(); }
      step();
      while (/[a-z]/.test(src[i] || '')) step();
      prev = 'x';
      continue;
    }
    // The token before a `/` tells a regex from a division: a word (`return`, a name) or a mark.
    if (/[\w$]/.test(c)) { let w = ''; while (/[\w$]/.test(src[i] || '')) { w += src[i]; step(); } prev = w; continue; }
    if (!/\s/.test(c)) prev = c;
    step();
  }
  return out;
}

// The function, handler or constant a line belongs to: the nearest declaration above it.
// `top`: the top-level declaration only (ACTS handlers and object keys are inside one).
function owners(src) {
  const names = [], tops = [];
  src.split('\n').forEach((l, k) => {
    const t = l.match(/^(?:async\s+)?function\s+([\w$]+)/) || l.match(/^(?:const|let)\s+([\w$]+)\s*=/);
    const m = t || l.match(/^\s{2}(?:async\s+)?'?([\w-]+)'?(?:\(|: )/);
    if (m) names[k + 1] = m[1];
    if (t) tops[k + 1] = t[1];
  });
  const near = (list, n) => { for (let k = n; k > 0; k--) if (list[k]) return list[k]; return ''; };
  return (n) => ({ owner: near(names, n), top: near(tops, n) });
}

// What a reader sees: tags out, entities as their characters (so «&mdash;» is checked as «—»), spaces collapsed.
const ENTITIES = { nbsp: ' ', mdash: '—', ndash: '–', laquo: '«', raquo: '»', hellip: '…', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const plain = (s) => s.replace(/<[^>]*>/g, ' ')
  .replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, h, n) => (d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : ENTITIES[n.toLowerCase()] ?? ''))
  .replace(/\s+/g, ' ').trim();

// The rules, each a test and what to do instead. `catalog: false`: UI only.
const RULES = [
  // «—» in quotes is the dash itself being named («Из текстов пропали длинные тире «—»»).
  { id: 'long-dash', test: (t) => /—/.test(t.replace(/«—»/g, '')) && t.trim() !== '—', say: 'Длинное тире «—»: двоеточие, запятая, точка или скобки' },
  { id: 'ty', test: (t) => /(^|[^А-Яа-яЁё])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои|твоих)(?![А-Яа-яЁё])/i.test(t), say: 'На «ты»: в приложении на «вы»' },
  // Style rules (`skip`) leave out the privacy page: it's a statement, and every change to it needs a «Что нового» entry.
  { id: 'semicolon', test: (t) => CYR.test(t) && /;\s*[А-Яа-яЁё]/.test(t), say: '«;» в тексте: одна мысль в предложении', skip: ['privacy.html'] },
  // A word in quotes is the word itself being named («грунт» вместо «субстрата»).
  { id: 'substrate', test: (t) => /субстрат/i.test(t.replace(/«[^«»]*»/g, '')), say: '«субстрат»: пишем «грунт» (или «смесь» для минеральных)' },
  { id: 'straight-quotes', test: (t) => CYR.test(t) && /"[^"]*[А-Яа-яЁё][^"]*"/.test(t), say: 'Прямые кавычки "": ёлочки «»' },
  { id: 'dots', test: (t) => /\.\.\./.test(t), say: 'Три точки: символ «…»' },
  { id: 'gotovo', test: (t) => /^Готово$/.test(t.trim()), say: '«Готово» на кнопке: прошедшая форма действия («Полито»)', catalog: false },
  { id: 'space-punct', test: (t) => /[А-Яа-яЁё»] [,.:!?](\s|$)/.test(t), say: 'Пробел перед знаком препинания' },
  { id: 'double-space', test: (t) => /\S {2,}\S/.test(t), say: 'Два пробела подряд' },
  // Text in separate tags or around {…} is separate lines on screen, not one sentence.
  { id: 'long-sentence', test: (t, raw) => raw.split(/<[^>]*>|\{…\}/).map(plain).join('\n').split(/(?<=[.!?…])\s+|\n/).some((s) => s.split(/\s+/).length > 25), say: 'Предложение длиннее 25 слов: разделить', skip: ['privacy.html'] },
];

// Not for people to read in the app: the prompt goes to an AI chat (its JSON example needs straight quotes), and the
// notes of the first collection were copied into those plants once.
const SKIP = new Set(['IMPORT_PROMPT', 'LEGACY_NOTES']);
function read(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const owner = owners(src);
  return literals(src).map((x) => ({ ...x, file, raw: x.text, text: plain(x.text), ...owner(x.line) }))
    .filter((x) => CYR.test(x.text) && !SKIP.has(x.top));
}

// An HTML page's visible text (between tags) and the attributes people read or hear, with their lines;
// a manifest's string values.
function readPage(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let lineAt = (k) => src.slice(0, k).split('\n').length;
  const items = [];
  const add = (text, k) => { const t = plain(text); if (CYR.test(t)) items.push({ text: t, raw: text, line: lineAt(k), file, owner: '', top: '' }); };
  if (file.endsWith('.webmanifest')) {
    const walk = (v) => (typeof v === 'string' ? add(v, src.indexOf(JSON.stringify(v).slice(1, -1))) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : 0);
    walk(JSON.parse(src));
    return items;
  }
  // Scripts, styles and comments out, and inline tags too, so a paragraph with a link or bold reads as one text.
  // Only their line breaks stay, so line numbers still match the file.
  const html = src.replace(/<(script|style)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<\/?(?:a|b|i|em|strong|span|small|code|br)\b[^>]*>/g, (m) => m.replace(/[^\n]/g, ''));
  lineAt = (k) => html.slice(0, k).split('\n').length;
  for (const m of html.matchAll(/>([^<]+)</g)) add(m[1], m.index + 1);
  for (const m of html.matchAll(/\b(?:aria-label|title|placeholder|alt|content)="([^"]*)"/g)) add(m[1], m.index);
  return items;
}

function check(items, catalog) {
  const found = [];
  items.forEach((x) => RULES.forEach((r) => { if ((!catalog || r.catalog !== false) && !(r.skip || []).includes(x.file) && r.test(x.text, x.raw)) found.push({ ...x, rule: r }); }));
  return found;
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function page(screens, problems) {
  const total = screens.reduce((n, s) => n + s.items.length, 0);
  const row = (x) => {
    const p = problems.filter((q) => q.file === x.file && q.line === x.line && q.text === x.text);
    // Each tag's text on its own line, as on screen.
    const lines = x.raw.split(/<[^>]*>/).map(plain).filter((l) => CYR.test(l)).join('\n');
    return `<li${p.length ? ' class="bad"' : ''}><span class="t">${esc(lines)}</span>${p.map((q) => `<span class="why">${esc(q.rule.say)}</span>`).join('')}<span class="where">${esc(x.owner)} · ${x.file}:${x.line}</span></li>`;
  };
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Тексты Жунглей</title><style>
:root{--bg:#fbf6ec;--ink:#2a2118;--muted:#5e4f40;--line:#e6dccb;--bad:#fde2e2;--badink:#7a1717}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1a1524;--ink:#f3ecf8;--muted:#c4bad0;--line:#3a3048;--bad:#4a1f2a;--badink:#ffd2d2;color-scheme:dark}}
:root[data-theme=dark]{--bg:#1a1524;--ink:#f3ecf8;--muted:#c4bad0;--line:#3a3048;--bad:#4a1f2a;--badink:#ffd2d2;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:1.5rem;margin:8px 0}h2{font-size:1.15rem;margin:0}
details{border-top:1px solid var(--line);padding:10px 0}summary{cursor:pointer}summary small{color:var(--muted);font-weight:400}
ul{list-style:none;padding:0;margin:8px 0}li{padding:8px 0;border-bottom:1px solid var(--line)}
li.bad{background:var(--bad);padding:8px;border-radius:8px}
.t{display:block;white-space:pre-line}.why{display:block;color:var(--badink);font-weight:700;font-size:.9rem}.where{display:block;color:var(--muted);font-size:.8rem}
p.lead{color:var(--muted)}
</style></head><body><main><h1>Тексты Жунглей</h1>
<p class="lead">${total} текстов в коде по экранам, ${problems.length} с замечаниями по правилам (они выделены). Фрагменты {…} подставляются в коде. Каталог (plants.js) здесь не перечислен, только его замечания.</p>
${screens.map((s) => `<details${s.items.some((x) => problems.some((p) => p.file === x.file && p.line === x.line)) ? ' open' : ''}><summary><h2>${esc(s.title)} <small>${s.file} · ${s.items.length}</small></h2></summary><ul>${s.items.map(row).join('')}</ul></details>`).join('\n')}
${(() => { const cat = problems.filter((p) => p.file === CATALOG); return `<details open><summary><h2>Каталог: замечания <small>${CATALOG} · ${cat.length}</small></h2></summary><ul>${cat.map(row).join('')}</ul></details>`; })()}
</main></body></html>`;
}

const screens = [...SCREENS.map(([file, title]) => ({ file, title, items: read(file) })),
  ...PAGES.map(([file, title]) => ({ file, title, items: readPage(file) }))].filter((s) => s.items.length);
const catalog = read(CATALOG);
const problems = [...screens.flatMap((s) => check(s.items, false)), ...check(catalog, true)];

problems.forEach((p) => console.log(`${p.file}:${p.line}  ${p.rule.id}  ${p.text.length > 90 ? p.text.slice(0, 90) + '…' : p.text}`));
console.log(`\n${screens.reduce((n, s) => n + s.items.length, 0)} UI texts, ${catalog.length} catalog texts, ${problems.length} problems`);
const at = process.argv.indexOf('--html');
if (at > 0 && process.argv[at + 1]) {
  fs.writeFileSync(process.argv[at + 1], page(screens, problems));
  console.log(`Review page: ${process.argv[at + 1]}`);
}
process.exitCode = problems.length ? 1 : 0;
