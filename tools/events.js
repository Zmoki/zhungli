/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
// The tracking plan (analytics/events.json) against the code, and what's made from it.
// No packages: run with Node from the repo root.
//   node tools/events.js            check: every track() call is in the plan with its props, every live event in the
//                                   plan is sent, the plan is well formed, ANALYTICS.md and the ingest renames are
//                                   up to date (exit code 1 if anything is off)
//   node tools/events.js --write    rewrite the generated part of ANALYTICS.md and the renames in functions/ingest/batch.js
//   node tools/events.js --posthog  print the event descriptions, tags and hidden flags to set in PostHog
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_FILE = 'analytics/events.json';
const DOC_FILE = 'ANALYTICS.md';
const INGEST_FILE = 'functions/ingest/batch.js';
const TYPES = ['int', 'number', 'bool', 'enum', 'catalog_id', 'catalog_ids', 'code', 'text'];
// Helpers whose result is spread into track() props, by the group of props they send.
const HELPERS = { kindOf: 'plant' };
// Sets with more values than this are listed once under «Value lists» instead of in every row.
const INLINE_VALUES = 6;

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const plan = JSON.parse(read(PLAN_FILE));
const problems = [];
const problem = (msg) => problems.push(msg);

// ---- The plan itself ----

const valuesOf = (p) => (typeof p.values === 'string' ? plan.values[p.values] : p.values);
function checkProp(where, name, p) {
  if (!/^\$?[a-z][a-zA-Z0-9_]*$/.test(name)) problem(`${where}: prop name «${name}» isn't snake_case`);
  if (!TYPES.includes(p.type)) problem(`${where}.${name}: type «${p.type}» isn't one of ${TYPES.join(', ')}`);
  if (p.type === 'enum' && !Object.keys(valuesOf(p) || {}).length) problem(`${where}.${name}: ${typeof p.values === 'string' ? `unknown value list «${p.values}»` : 'enum without values'}`);
  if (p.type !== 'enum' && p.values) problem(`${where}.${name}: values on a ${p.type}, make it an enum`);
  if (p.type === 'text' && !p.why) problem(`${where}.${name}: text props need «why» (and a line in privacy.html)`);
  if (p.was && !Array.isArray(p.was)) problem(`${where}.${name}: «was» must be a list`);
}
for (const [g, props] of Object.entries(plan.groups)) for (const [n, p] of Object.entries(props)) checkProp(`groups.${g}`, n, p);
for (const [n, p] of Object.entries(plan.common)) checkProp('common', n, p);
const oldNames = new Map();
for (const [name, e] of Object.entries(plan.events)) {
  if (!/^\$?[a-z][a-z0-9_]*$/.test(name)) problem(`${name}: event name isn't snake_case`);
  if (!plan.areas[e.area]) problem(`${name}: unknown area «${e.area}»`);
  if (!e.when) problem(`${name}: no «when»`);
  if (!Number.isInteger(e.since)) problem(`${name}: «since» must be an app version number`);
  if (e.removed != null && !(Number.isInteger(e.removed) && e.removed > e.since)) problem(`${name}: «removed» must be a version after «since»`);
  for (const g of e.use || []) if (!plan.groups[g]) problem(`${name}: unknown group «${g}»`);
  for (const [n, p] of Object.entries(e.props || {})) {
    checkProp(name, n, p);
    for (const g of e.use || []) if (plan.groups[g] && plan.groups[g][n]) problem(`${name}.${n}: already in group «${g}»`);
  }
  if (e.removed != null && e.was) problem(`${name}: a removed event can't take old names («was»)`);
  for (const old of e.was || []) {
    if (plan.events[old]) problem(`${name}: old name «${old}» is still an event`);
    if (oldNames.has(old)) problem(`${name}: old name «${old}» is also an old name of ${oldNames.get(old)}`);
    oldNames.set(old, name);
  }
}
const propsOf = (name) => {
  const e = plan.events[name];
  return Object.assign({}, ...(e.use || []).map((g) => plan.groups[g]), e.props || {});
};

// ---- track() calls in the code ----

// The text from `from` (just after an opening bracket) to its closing bracket, skipping strings and comments.
function balanced(src, from) {
  let depth = 1;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) {
        if (src[i] === '\\') i++;
        else if (c === '`' && src[i] === '$' && src[i + 1] === '{') i += 2 + balanced(src, i + 2).length;
      }
    } else if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
      const end = src.indexOf(src[i + 1] === '/' ? '\n' : '*/', i + 2);
      if (end < 0) break;
      i = src[i + 1] === '/' ? end : end + 1;
    }
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c) && --depth === 0) return src.slice(from, i);
  }
  throw new Error('unbalanced brackets');
}
// Split on commas outside brackets and strings.
function topLevel(text, sep = ',') {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++; }
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === sep && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts.map((s) => s.trim()).filter(Boolean);
}
// Prop names an expression can send: { keys, groups, dynamic } (dynamic: a variable we can't read).
function propsIn(expr, out = { keys: new Set(), groups: new Set(), dynamic: false }) {
  expr = expr.trim();
  const helper = Object.keys(HELPERS).find((h) => expr.startsWith(h + '('));
  if (helper) { out.groups.add(HELPERS[helper]); return out; }
  if (expr.startsWith('{') && balanced(expr, 1).length === expr.length - 2) {
    for (const entry of topLevel(expr.slice(1, -1))) {
      if (entry.startsWith('...')) propsIn(entry.slice(3), out);
      else out.keys.add(entry.split(':')[0].trim().replace(/^['"]|['"]$/g, ''));
    }
    return out;
  }
  // Anything else (a ternary, `cond && {…}`, brackets): read every object literal and helper call in it.
  let found = false;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '"' || c === "'" || c === '`') { for (i++; i < expr.length && expr[i] !== c; i++) if (expr[i] === '\\') i++; continue; }
    const helperHere = Object.keys(HELPERS).find((h) => expr.startsWith(h + '(', i) && !/[\w.$]/.test(expr[i - 1] || ''));
    if (helperHere) { out.groups.add(HELPERS[helperHere]); found = true; i += helperHere.length; continue; }
    if (c === '{') { const body = balanced(expr, i + 1); propsIn(`{${body}}`, out); found = true; i += body.length + 1; }
  }
  // A variable (`stats`) or a fallback (`res.diag || {}`): its props can't be read here.
  if (!found || /\|\|\s*\{/.test(expr)) out.dynamic = true;
  return out;
}
const appFiles = fs.readdirSync(path.join(ROOT, 'app')).filter((f) => f.endsWith('.js')).sort().map((f) => `app/${f}`);
const calls = [];
for (const file of appFiles) {
  const src = read(file);
  for (const m of src.matchAll(/(?<![\w.$])track\(/g)) {
    if (/function\s+$/.test(src.slice(Math.max(0, m.index - 10), m.index))) continue;
    // In a comment: a mention, not a call (`://` in a URL isn't a comment).
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    if (/(^|[^:])\/\//.test(src.slice(lineStart, m.index))) continue;
    if (src.lastIndexOf('/*', m.index) > src.lastIndexOf('*/', m.index)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    let args;
    try { args = topLevel(balanced(src, m.index + m[0].length)); } catch (e) { problem(`${file}:${line}: can't read this track() call (${e.message})`); continue; }
    if (!args.length) { problem(`${file}:${line}: track() without an event name`); continue; }
    // `cond ? 'a' : 'b'`: only the branches name events.
    const nameExpr = topLevel(args[0], '?').slice(-1)[0] || '';
    const names = [...nameExpr.matchAll(/(['"])(\$?[a-z][a-z0-9_]*)\1/g)].map((x) => x[2]);
    if (!names.length) { problem(`${file}:${line}: can't read the event name in track(${args[0]}, …)`); continue; }
    const props = args[1] ? propsIn(args[1]) : { keys: new Set(), groups: new Set(), dynamic: false };
    for (const name of names) calls.push({ file, line, name, props });
  }
}

const sent = new Map(); // event → { keys, dynamic }
for (const c of calls) {
  const e = plan.events[c.name];
  const at = `${c.file}:${c.line}`;
  if (!e) { problem(`${at}: «${c.name}» isn't in ${PLAN_FILE}${oldNames.has(c.name) ? ` (it's an old name of ${oldNames.get(c.name)})` : ''}`); continue; }
  if (e.removed != null) problem(`${at}: «${c.name}» is marked removed in v${e.removed}`);
  const known = propsOf(c.name);
  for (const g of c.props.groups) if (!(e.use || []).includes(g)) problem(`${at}: «${c.name}» sends the «${g}» group; add it to «use»`);
  for (const k of c.props.keys) if (!known[k]) problem(`${at}: «${c.name}» sends «${k}», which isn't in its props`);
  const s = sent.get(c.name) || { keys: new Set(), dynamic: false };
  c.props.keys.forEach((k) => s.keys.add(k));
  c.props.groups.forEach((g) => Object.keys(plan.groups[g] || {}).forEach((k) => s.keys.add(k)));
  s.dynamic = s.dynamic || c.props.dynamic;
  sent.set(c.name, s);
}
for (const [name, e] of Object.entries(plan.events)) {
  if (e.removed != null) continue;
  const s = sent.get(name);
  if (!s) { problem(`${name}: in ${PLAN_FILE} but no track() sends it (gone? mark it «removed»)`); continue; }
  if (s.dynamic) continue;
  for (const k of Object.keys(propsOf(name))) if (!s.keys.has(k)) problem(`${name}.${k}: in ${PLAN_FILE} but no track() sends it`);
}

// ---- ANALYTICS.md ----

const START = `<!-- Generated by tools/events.js from ${PLAN_FILE}. Edit the JSON, then run: node tools/events.js --write -->`;
const END = '<!-- End of the generated part -->';
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
function valuesText(p) {
  const vals = valuesOf(p) || {};
  if (typeof p.values === 'string' && Object.keys(vals).length > INLINE_VALUES) return `a [\`${p.values}\` value](#value-lists)`;
  return Object.entries(vals).map(([v, d]) => `\`${v}\`${d ? ` (${d})` : ''}`).join(' / ');
}
function propText(name, p) {
  const vals = p.values ? valuesText(p) : '';
  const parts = [vals, p.desc].filter(Boolean);
  return `\`${name}\`${parts.length ? ': ' + parts.join('; ') : ''}${p.was ? ` (was ${p.was.map((w) => `\`${w}\``).join(', ')})` : ''}`;
}
function propsCell(e) {
  const lines = Object.entries(e.props || {}).map(([n, p]) => propText(n, p));
  for (const g of e.use || []) lines.push(`the [${g} props](#${g}-props)`);
  return lines.length ? lines.join('<br>') : 'none';
}
function doc() {
  const out = [START, ''];
  out.push('## Common properties', '', 'On every event:', '', '| Property | Value |', '| --- | --- |');
  for (const [n, p] of Object.entries(plan.common)) out.push(`| \`${n}\` | ${cell(p.desc || p.type)} |`);
  for (const [g, props] of Object.entries(plan.groups)) {
    out.push('', `## ${g[0].toUpperCase() + g.slice(1)} props`, '', `Sent together by events that \`use\` the «${g}» group.`, '', '| Property | Value |', '| --- | --- |');
    for (const [n, p] of Object.entries(props)) out.push(`| \`${n}\` | ${cell(propText(n, p).replace(/^`[^`]+`: ?/, '') || p.type)} |`);
  }
  out.push('', '## Events', '', 'By area (the area is also the event\'s tag in PostHog). «Since»: the first app version that sent it under this name; v7 is the first version with stats.');
  const live = Object.entries(plan.events).filter(([, e]) => e.removed == null);
  for (const [area, title] of Object.entries(plan.areas)) {
    const rows = live.filter(([, e]) => e.area === area);
    if (!rows.length) continue;
    out.push('', `### ${title}`, '', '| Event | When | Properties | Since |', '| --- | --- | --- | --- |');
    for (const [n, e] of rows) {
      const name = `\`${n}\`${e.was ? `<br>was ${e.was.map((w) => `\`${w}\``).join(', ')}` : ''}`;
      out.push(`| ${name} | ${cell(e.when + (e.note ? `. ${e.note}` : ''))} | ${cell(propsCell(e))} | v${e.since} |`);
    }
  }
  const gone = Object.entries(plan.events).filter(([, e]) => e.removed != null);
  if (gone.length) {
    out.push('', '## Removed events', '', 'No longer sent; old data keeps them. Hidden in PostHog.', '', '| Event | When | Properties | Sent in |', '| --- | --- | --- | --- |');
    for (const [n, e] of gone) out.push(`| \`${n}\` | ${cell(e.when)} | ${cell(propsCell(e))} | v${e.since}–v${e.removed - 1} |`);
  }
  const big = Object.entries(plan.values).filter(([, v]) => Object.keys(v).length > INLINE_VALUES);
  if (big.length) {
    out.push('', '## Value lists', '');
    for (const [n, v] of big) out.push(`- \`${n}\`: ${Object.entries(v).map(([k, d]) => `\`${k}\`${d ? ` (${d})` : ''}`).join(' / ')}`);
  }
  out.push('', END);
  return out.join('\n');
}
function withGenerated(text, start, end, body, file) {
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 || b < a) { problem(`${file}: generated part markers not found`); return text; }
  return text.slice(0, a) + body + text.slice(b + end.length);
}

// ---- Renames in the ingest function ----

const R_START = '// Generated by tools/events.js from analytics/events.json («was»): old names → new ones, so phones still';
const R_END = '// End of the generated renames';
function renames() {
  const events = {}, props = {};
  for (const [name, e] of Object.entries(plan.events)) {
    for (const old of e.was || []) events[old] = name;
    for (const [n, p] of Object.entries(propsOf(name))) for (const old of p.was || []) (props[name] = props[name] || {})[old] = n;
  }
  return [
    R_START,
    '// on an old app version send the new ones. Edit the JSON, then run: node tools/events.js --write',
    `const RENAMED = ${JSON.stringify(events)};`,
    `const RENAMED_PROPS = ${JSON.stringify(props)};`,
    R_END,
  ].join('\n');
}

// ---- PostHog ----

function posthog() {
  const sentence = (s) => s[0].toUpperCase() + s.slice(1) + (/[.!?…]$/.test(s) ? '' : '.');
  return Object.entries(plan.events).map(([name, e]) => ({
    name,
    description: [e.when, e.note].filter(Boolean).map(sentence).join(' ') + (e.removed != null ? ` Removed in v${e.removed}.` : ` Since v${e.since}.`),
    tags: [e.area],
    hidden: e.removed != null,
    verified: e.removed == null,
  }));
}

// ---- Run ----

const mode = process.argv[2];
const docText = read(DOC_FILE), docNew = withGenerated(docText, START, END, doc(), DOC_FILE);
const ingestText = read(INGEST_FILE), ingestNew = withGenerated(ingestText, R_START, R_END, renames(), INGEST_FILE);
if (mode === '--posthog') {
  console.log(JSON.stringify(posthog(), null, 2));
} else if (mode === '--write') {
  if (docNew !== docText) { fs.writeFileSync(path.join(ROOT, DOC_FILE), docNew); console.log(`Wrote ${DOC_FILE}`); }
  if (ingestNew !== ingestText) { fs.writeFileSync(path.join(ROOT, INGEST_FILE), ingestNew); console.log(`Wrote ${INGEST_FILE}`); }
} else {
  if (docNew !== docText) problem(`${DOC_FILE} is out of date: run node tools/events.js --write`);
  if (ingestNew !== ingestText) problem(`${INGEST_FILE} renames are out of date: run node tools/events.js --write`);
}
if (mode !== '--posthog') {
  const live = Object.values(plan.events).filter((e) => e.removed == null).length;
  console.log(`${live} events in the plan, ${calls.length} track() calls in ${appFiles.length} files.`);
  problems.forEach((p) => console.log('  ' + p));
  console.log(problems.length ? `${problems.length} problem${problems.length > 1 ? 's' : ''}.` : 'No problems.');
  process.exitCode = problems.length ? 1 : 0;
}
