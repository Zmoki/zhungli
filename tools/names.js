/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// Catalog names from zhungli-content (plants/*.yml): each card's title, its second line and its search names.
// No packages: run with Node from the repo root. Reads the content repo's git ref, not its working tree, so a local
// checkout with unfinished edits doesn't leak in (fetch it first).
//   node tools/names.js            check app/plants.js against the content (exit code 1 if anything is off)
//   node tools/names.js --write    rewrite `species`, `alt` and `names` of the linked cards in app/plants.js
//   options: --content DIR (default ../zhungli-content), --ref REF (default origin/main)
//
// A card's names come from the genus (the plant file's own entry) when it is the only card of that file and its plant
// is the genus or a species, else from its plant (`plantIds[0]`): «Толстянка», not «Толстянка овальная», but «Фикус
// лировидный» among the ficuses and «Строманта Триостар» for a variety.
// A card with several plants of one file that isn't the only one there («Аглаонема серебристая») keeps the names
// written in the app. Title: name.ru. Second line: the first two of name.aka, then name.en, then title (Latin), at
// most three, none twice and none the same as the title. Search: every ru, en, aka and title of the card's plants
// and their genus. Text as written in the content, case included.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PLANTS_FILE = 'app/plants.js';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CONTENT = path.resolve(ROOT, arg('--content', '../zhungli-content'));
const REF = arg('--ref', 'origin/main');
const WRITE = process.argv.includes('--write');

const git = (...a) => execFileSync('git', ['-C', CONTENT, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });

// ---- A YAML reader for what plants/*.yml use: block maps and lists, [flow, lists], quoted and plain scalars,
// comments. Not a general YAML parser: anything else is an error, so a new construct can't be misread.
function parseYaml(text, file) {
  const lines = [];
  text.split('\n').forEach((raw, n) => {
    const s = stripComment(raw);
    if (!s.trim()) return;
    if (/^\s*(---|\.\.\.)\s*$/.test(s) || /:\s*[|>][-+]?\s*$/.test(s)) throw new Error(`${file}:${n + 1}: unsupported YAML`);
    lines.push({ ind: s.match(/^ */)[0].length, s: s.trim(), n: n + 1 });
  });
  let i = 0;
  const block = (ind) => (lines[i] && lines[i].s.startsWith('- ') ? seq(ind) : map(ind));
  function map(ind) {
    const o = {};
    while (i < lines.length && lines[i].ind === ind && !lines[i].s.startsWith('- ')) {
      const { s, n } = lines[i++];
      const m = s.match(/^([^:]+?):(?:\s+(.*))?$/);
      if (!m) throw new Error(`${file}:${n}: expected key: value`);
      o[m[1]] = m[2] !== undefined ? scalar(m[2], n) : i < lines.length && lines[i].ind > ind ? block(lines[i].ind) : null;
    }
    return o;
  }
  function seq(ind) {
    const a = [];
    while (i < lines.length && lines[i].ind === ind && lines[i].s.startsWith('- ')) {
      const l = lines[i];
      const rest = l.s.slice(2);
      if (/^[^'"[\]{}]+?:(\s|$)/.test(rest)) { l.s = rest; l.ind = ind + 2; a.push(map(ind + 2)); } // - key: value …
      else { i++; a.push(scalar(rest, l.n)); }
    }
    return a;
  }
  function scalar(v, n) {
    v = v.trim();
    if (v.startsWith('[')) {
      if (!v.endsWith(']')) throw new Error(`${file}:${n}: unclosed list`);
      return splitFlow(v.slice(1, -1)).map((x) => scalar(x, n));
    }
    if (v.startsWith('"')) return JSON.parse(v);
    if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
    if (v === 'null' || v === '~' || v === '') return null;
    if (v === 'true' || v === 'false') return v === 'true';
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }
  const out = block(0);
  if (i < lines.length) throw new Error(`${file}:${lines[i].n}: unexpected indentation`);
  return out;
}
// A comment starts at « #» outside quotes.
function stripComment(s) {
  let q = '';
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === q) q = ''; continue; }
    if ((c === '"' || c === "'") && (k === 0 || /[\s[,:-]/.test(s[k - 1]))) q = c;
    else if (c === '#' && (k === 0 || /\s/.test(s[k - 1]))) return s.slice(0, k);
  }
  return s;
}
function splitFlow(s) {
  const out = [];
  let q = '', cur = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ',') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

// ---- Content plants by id ----
const commit = git('rev-parse', '--short', REF).trim();
const files = git('ls-tree', '--name-only', REF, 'plants/').split('\n').filter((f) => f.endsWith('.yml'));
const byId = new Map();
for (const f of files) {
  const doc = parseYaml(git('show', `${REF}:${f}`), f);
  if (!doc || !doc.id) continue;
  const genus = { ...doc, file: f };
  byId.set(doc.id, { plant: genus, genus });
  for (const k of ['species', 'cultivars', 'hybrids']) (doc[k] || []).forEach((p) => p && p.id && byId.set(p.id, { plant: { ...p, file: f }, genus }));
}

// ---- The catalog ----
const src = fs.readFileSync(path.join(ROOT, PLANTS_FILE), 'utf8');
const ctx = { window: {}, out: {} };
vm.runInNewContext(`${src}\nout.PLANTS = PLANTS;`, ctx);
const PLANTS = ctx.out.PLANTS;
const problems = [];
const cardsOfFile = new Map();
for (const d of PLANTS) {
  const first = (d.plantIds || [])[0];
  if (!first) continue;
  const hit = byId.get(first);
  if (!hit) { problems.push(`${d.id}: plant ${first} isn't in the content`); continue; }
  cardsOfFile.set(hit.genus.file, (cardsOfFile.get(hit.genus.file) || 0) + 1);
}

const key = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[‘’']/g, "'");
const uniq = (list, not = []) => {
  const seen = new Set(not.map(key)), out = [];
  list.filter(Boolean).forEach((s) => { if (!seen.has(key(s))) { seen.add(key(s)); out.push(s); } });
  return out;
};
const namesOf = (p) => [p.name && p.name.ru, p.name && p.name.en, ...((p.name && p.name.aka) || []), p.title];

// What each linked card should say.
const want = new Map();
for (const d of PLANTS) {
  const ids = d.plantIds || [];
  const hits = ids.map((id) => byId.get(id)).filter(Boolean);
  if (!hits.length || hits.length < ids.length) continue;
  const file = hits[0].genus.file;
  // A variety keeps its own names even alone in its file: «Строманта Триостар», not «Строманта».
  const only = cardsOfFile.get(file) === 1 && !hits.some((h) => h.plant !== h.genus && !(h.genus.species || []).some((x) => x.id === h.plant.id));
  const source = only ? hits[0].genus : ids.length === 1 ? hits[0].plant : null;
  // Genus names go to every card of the file, except an aka another species or variety card of the file has as its own search word
  // («Эластика» stays with «Фикус каучуконосный», «Счастливый бамбук» with «Драцена Сандера»).
  const claimed = new Set(PLANTS.filter((c) => c !== d && (c.plantIds || []).some((id) => byId.get(id) && byId.get(id).genus.file === file && byId.get(id).plant !== byId.get(id).genus))
    .flatMap((c) => String(c.aka || '').split(',')).map((w) => key(w.trim())));
  const g = hits[0].genus, gn = g.name || {};
  const genusNames = hits.some((h) => h.plant === g) ? namesOf(g).filter((w) => !claimed.has(key(w)) || w === gn.ru || w === gn.en || w === g.title) : [gn.ru, gn.en, ...(gn.aka || []).filter((w) => !claimed.has(key(w))), g.title];
  const search = uniq([...hits.filter((h) => h.plant !== g).flatMap((h) => namesOf(h.plant)), ...genusNames]);
  if (!source) { want.set(d.id, { search }); continue; }
  const n = source.name || {};
  if (!n.ru) { problems.push(`${d.id}: ${source.title} has no name.ru`); continue; }
  // A genus card among its species' cards doesn't show their names («Эластика» on «Фикус»).
  const line = uniq([...(n.aka || []).filter((a) => only || !claimed.has(key(a))).slice(0, 2), n.en, source.title], [n.ru]).slice(0, 3);
  want.set(d.id, { species: n.ru, alt: line.join(', '), search });
}

// ---- Check or rewrite ----
const q = (s) => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);
let text = src, changed = 0;
for (const d of PLANTS) {
  const w = want.get(d.id);
  if (!w) continue;
  const start = text.indexOf(`id: '${d.id}', `);
  if (start < 0) { problems.push(`${d.id}: card not found in ${PLANTS_FILE}`); continue; }
  const next = text.indexOf('\n  {', start);
  const end = next < 0 ? text.indexOf('\n];', start) : next;
  let blk = text.slice(start, end);
  const before = blk;
  const names = w.search.filter((s) => !(w.species && key(s) === key(w.species))).join(', ');
  if (w.species !== undefined) {
    blk = blk.replace(/species: (?:'[^'\n]*'|"[^"\n]*")/, `species: ${q(w.species)}`);
    if (/\balt: /.test(blk)) blk = blk.replace(/\balt: (?:'[^'\n]*'|"[^"\n]*")/, `alt: ${q(w.alt)}`);
    else problems.push(`${d.id}: no alt line to rewrite`);
  }
  if (/\bnames: /.test(blk)) blk = blk.replace(/\bnames: (?:'[^'\n]*'|"[^"\n]*")/, `names: ${q(names)}`);
  else blk = blk.replace(/(\n(\s+)alt: [^\n]*\n)/, `$1$2names: ${q(names)},\n`);
  if (!/\bnames: /.test(blk)) problems.push(`${d.id}: no place for names`);
  if (blk !== before) {
    changed++;
    if (!WRITE) {
      const was = (re) => (before.match(re) || [])[1];
      const now = (re) => (blk.match(re) || [])[1];
      for (const [label, re] of [['title', /species: ((?:'[^'\n]*'|"[^"\n]*"))/], ['second line', /\balt: ((?:'[^'\n]*'|"[^"\n]*"))/], ['names', /\bnames: ((?:'[^'\n]*'|"[^"\n]*"))/]])
        if (was(re) !== now(re)) problems.push(`${d.id}: ${label} ${was(re) || '(none)'} → ${now(re)}`);
    }
  }
  text = text.slice(0, start) + blk + text.slice(end);
}

console.log(`zhungli-content ${REF} (${commit}): ${files.length} plant files, ${byId.size} plants; ${want.size} linked cards.`);
if (WRITE) {
  if (text !== src) fs.writeFileSync(path.join(ROOT, PLANTS_FILE), text);
  console.log(`${changed} cards rewritten in ${PLANTS_FILE}.`);
}
const shown = WRITE ? problems.filter((p) => !p.includes(' → ')) : problems;
shown.forEach((p) => console.log('  ' + p));
console.log(shown.length ? `${shown.length} problem${shown.length > 1 ? 's' : ''}.` : 'No problems.');
process.exitCode = shown.length ? 1 : 0;
