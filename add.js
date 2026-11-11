/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Adding plants: catalog picker, own plant, import from an AI chat.

// Catalog picker: several plants can be selected at once.
let picked = new Set();
// Crude Russian stem for catalog search: longer words drop their ending, so «лиана» finds «лианы»,
// «трава» finds «травы», «черенок» finds «черенки».
const searchStem = (w) => (w.length >= 6 ? w.slice(0, -2) : w.length === 5 ? w.slice(0, -1) : w);
function pickRow(d) {
  const meta = `${d.hint ? esc(d.hint) + ' · ' : ''}свет ${kLux(d.lux[0])}–${kLux(d.lux[1])} ${LK}`;
  return `<button class="pick" data-act="pick" data-key="${esc(d.id)}" data-q="${esc(norm([d.species, d.hint, d.aka].join(' ')))}" data-name="${esc(norm(d.species))}" data-cat="${esc(norm(d.cat))}" data-generic="${d.generic ? 1 : 0}">
    <span class="pe" aria-hidden="true">${plantSvg(d, 'fine')}</span><span class="pt"><b>${esc(d.species)}</b><small>${meta}</small></span><span class="pc" aria-hidden="true">${I('plus')}</span></button>`;
}
// What happens in the add flow, reported once when the sheet closes without adding.
let addFlow = null;
function startAddFlow(sheetName) {
  if (!addFlow) addFlow = { sheet: sheetName, searched: false, no_results: false, picked: 0, done: false };
  addFlow.sheet = sheetName;
}
function endAddFlow(leftApp = false) {
  // What the catalog lacks: sent whether or not something was added in the end.
  if (addFlow && addFlow.missed) track('catalog_missed', { query: addFlow.missed, added: addFlow.done });
  if (addFlow && !addFlow.done) track('add_abandoned', { sheet: addFlow.sheet, searched: addFlow.searched, no_results: addFlow.no_results, picked: addFlow.picked, left_app: leftApp });
  addFlow = null;
}
let searchTimer;
function openAdd() {
  picked = new Set();
  if (!sheet.open) endAddFlow(); // the close event doesn't fire in every browser
  startAddFlow('catalog');
  track('add_opened', { from: tab });
  const groups = {};
  PLANTS.filter((d) => !d.hidden).forEach((d) => { (groups[d.cat] ||= []).push(d); });
  const cats = Object.keys(groups).sort((a, b) => catRank(a) - catRank(b));
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('sprout')}</div><h2 class="m-0">Добавить растения</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <button class="import-cta" data-act="add-import"><span class="pe" aria-hidden="true">${I('bot')}</span>
      <span class="pt"><b>Сразу много — из чата с ИИ</b><small>Спросите ChatGPT, Claude или другого ИИ-помощника о своих растениях — он сделает файл со списком и советами по уходу, а вы загрузите его сюда.</small></span>
      <span class="pc" aria-hidden="true">${I('chevron-right')}</span></button>
    <button class="import-cta mt-8" data-act="add-custom"><span class="pe" aria-hidden="true">${I('pencil')}</span>
      <span class="pt"><b>Своё растение</b><small>Название и на что похоже — уход подберу.</small></span>
      <span class="pc" aria-hidden="true">${I('chevron-right')}</span></button>
    <div class="or">или выберите из каталога</div>
    <div class="search"><input class="input" id="pick-q" type="search" aria-label="Поиск растений" placeholder="Поиск: монстера, кактус, фиалка…" autocomplete="off">${I('search')}</div>
    <p class="pick-help small muted">Отметьте все свои растения. Нет вашего — добавьте его как своё или выберите похожий общий тип.</p>
    <div id="pick-none" class="pick-none" hidden></div>
    ${cats.map((c) => `<div class="pick-group"${c === 'Общие типы' ? ' data-generic' : ''}><div class="group-title">${c === 'Общие типы' ? 'Общие типы — если нет в списке' : esc(c)}</div>
      ${groups[c].map(pickRow).join('')}</div>`).join('')}
    <button class="mt-12 btn ghost wide" data-act="add-custom">${I('pencil')}Своё растение</button>
    <div class="pick-bar" id="pick-bar" hidden><button class="btn primary wide" data-act="pick-add" id="pick-add" disabled>Отметьте растения</button></div>`;
  const pickGroups = [...document.querySelectorAll('.pick-group')];
  const pickEnd = pickGroups[pickGroups.length - 1].nextElementSibling; // the bottom «Своё растение»
  const genericTitle = document.querySelector('.pick-group[data-generic] .group-title');
  let shownOrder = pickGroups;
  $('#pick-q').addEventListener('input', (e) => {
    const raw = e.target.value.trim();
    // Every word must match somewhere: «фикус бенджамина» finds the generic type, not every ficus.
    const words = norm(raw).split(/\s+/).filter(Boolean).map(searchStem);
    const hits = (text) => words.every((w) => text.includes(w));
    // The group name counts only when nothing else matched: «лиана» finds the vines,
    // but «кактус» doesn't list every succulent.
    const byCat = words.length > 0 && !pickGroups.some((g) => [...g.querySelectorAll('.pick')].some((b) => hits(b.dataset.q)));
    let any = false;
    const score = new Map();
    pickGroups.forEach((g) => {
      let n = 0, best = 0;
      g.querySelectorAll('.pick').forEach((b) => {
        const on = hits(byCat ? `${b.dataset.q} ${b.dataset.cat}` : b.dataset.q);
        b.hidden = !on;
        if (!on) return;
        n++;
        // A plant matched by its own name ranks highest; a specific plant matched by a folk name ties
        // with a generic type matched by name, and ties keep the catalog order (specific first).
        const named = hits(b.dataset.name);
        best = Math.max(best, b.dataset.generic === '1' ? (named ? 2 : 1) : (named ? 3 : 2));
      });
      g.hidden = !n; any ||= n > 0;
      score.set(g, best);
    });
    // Best-matching groups first: «рассада» and «черенок» show their generic type on top,
    // «орхидея» shows «Фаленопсис» before «Орхидея на коре». Without a search, the usual order.
    const order = words.length ? [...pickGroups].sort((a, b) => score.get(b) - score.get(a) || pickGroups.indexOf(a) - pickGroups.indexOf(b)) : pickGroups;
    if (order.some((g, i) => g !== shownOrder[i])) { order.forEach((g) => pickEnd.before(g)); shownOrder = order; }
    // «— если нет в списке» only reads right at the end of the full list.
    genericTitle.textContent = words.length ? 'Общие типы' : 'Общие типы — если нет в списке';
    // Nothing found: never a dead end. Offer the typed name as an own plant, and show all generic types.
    const none = $('#pick-none');
    none.hidden = any;
    if (!any) {
      none.innerHTML = `<p class="small muted">«${esc(raw)}» нет в каталоге.</p>
        <button class="mt-8 btn primary wide" data-act="add-custom" data-q="${esc(raw)}">${I('plus')}Добавить «${esc(raw.length > 14 ? raw.slice(0, 13) + '…' : raw)}»</button>
        <p class="mt-12 small muted">Или выберите похожий общий тип — уход у них почти одинаковый:</p>`;
      const g = document.querySelector('.pick-group[data-generic]');
      g.hidden = false;
      g.querySelectorAll('.pick').forEach((b) => { b.hidden = false; });
    }
    // The last search that found nothing goes out once, when the sheet closes (catalog_missed):
    // a pause mid-word or a fixed typo isn't sent. Clearing the box keeps it.
    if (addFlow && raw) addFlow.missed = any ? '' : raw.slice(0, 40);
    if (raw) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (addFlow) { addFlow.searched = true; addFlow.no_results = !any; }
        track('catalog_searched', { found: any });
      }, 1200);
    }
  });
  openSheet();
}
// «Добавить N растений» at the bottom of the catalog and the import list.
function setAddButton(b, n, emptyText) {
  b.disabled = !n;
  b.innerHTML = n ? `${I('plus')}Добавить ${plantsN(n)}` : emptyText;
}
// The catalog's add bar appears only once something is ticked.
// The catalog's and the import list's add bars appear only once something is ticked.
const showAddBar = (bar, btn, n) => { setAddButton(btn, n, ''); bar.hidden = !n; };
const updatePickBar = () => showAddBar($('#pick-bar'), $('#pick-add'), picked.size);
// Picker groups go by care, from the most common plants; generic types close the list.
const CAT_ORDER = ['Лианы и ампельные', 'Декоративно-лиственные', 'Пальмы, драцены и деревья', 'Ароидные', 'Влаголюбивые',
  'Суккуленты и кактусы', 'Цветущие и орхидеи', 'Общие типы'];
// A category missing from CAT_ORDER (a typo in plants.js) still shows, just before the generic types, and warns.
const catRank = (c) => {
  const r = CAT_ORDER.indexOf(c);
  if (r < 0) console.warn('Catalog category missing from CAT_ORDER:', c);
  return r < 0 ? CAT_ORDER.length - 1.5 : r;
};

// Two fields are enough: what it is and what it's like. The care comes from that generic type;
// the numbers stay editable under «Тонкая настройка».
const GENERIC_TYPES = () => PLANTS.filter((d) => d.generic && !d.hidden);
function openCustom(species = '', from = 'button') {
  startAddFlow('custom');
  track('custom_opened', { from });
  const like = GENERIC_TYPES()[0];
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('pencil')}</div><h2 class="m-0">Новое растение</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <form id="add-form">
      <div class="field"><label for="c-species">Что это за растение</label><input class="input" id="c-species" name="species" required placeholder="Например, Пеперомия" value="${esc(species)}"></div>
      <div class="field"><label for="c-like">На что похоже</label><select class="input" id="c-like" name="like" aria-describedby="c-like-hint">
        ${GENERIC_TYPES().map((d) => `<option value="${esc(d.id)}">${esc(d.species)}</option>`).join('')}</select>
        <p class="mt-6 small muted" id="c-like-hint"></p></div>
      <details class="tune"><summary>Тонкая настройка${I('chevron-right')}</summary>
        <div class="field"><label for="c-name">Имя (если есть)</label><input class="input" id="c-name" name="name" placeholder="Например, Пепа"></div>
        <div class="field"><label for="c-type">В чём растёт</label><select class="input" id="c-type" name="type">
          ${Object.entries(TYPE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label id="lbl-lux">Сколько света нужно, ${LK}</label><div class="row2">
          <input class="input" name="lmin" aria-label="Света от, люкс" type="number" inputmode="numeric" placeholder="от">
          <input class="input" name="lmax" aria-label="Света до, люкс" type="number" inputmode="numeric" placeholder="до"></div></div>
        <div class="field"><label for="c-every">Проверять каждые … дней</label><input class="input" id="c-every" name="every" type="number" inputmode="numeric"></div>
        <div class="field"><label for="c-tip">Шпаргалка</label><textarea class="input" id="c-tip" name="tip" rows="3" placeholder="Что важно помнить"></textarea></div>
      </details>
      <button class="mt-14 btn primary wide" type="submit">${I('plus')}Добавить</button>
    </form>`;
  const form = $('#add-form');
  // Picking a type fills in its care: watering, light and how often to check.
  const fillFrom = (d) => {
    form.type.value = d.type;
    form.lmin.value = d.lux[0];
    form.lmax.value = d.lux[1];
    form.every.value = d.every;
    form.tip.value = d.tip || '';
    $('#c-like-hint').textContent = d.hint ? `Например: ${d.hint}.` : '';
  };
  fillFrom(like);
  form.like.addEventListener('change', () => fillFrom(def(form.like.value)));
  // Changing the care in «Тонкая настройка» by hand (not the values a type fills in, not the name)
  // tells whether two fields are enough.
  let tuned = false;
  form.querySelector('.tune').addEventListener('input', (e) => { if (e.target.name !== 'name') tuned = true; });
  if (!species) form.species.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (addFlow) addFlow.done = true;
    const f = new FormData(e.target);
    const base = def(String(f.get('like'))) || like;
    const id = newId('c');
    const every = clamp(Number(f.get('every')) || base.every, 1, 60);
    const lmin = Number(f.get('lmin')) || base.lux[0];
    const lmax = Math.max(lmin, Number(f.get('lmax')) || base.lux[1]);
    const type = String(f.get('type'));
    const { humid, big, quips } = base;
    // The type's check question and care tips fit only its own growing medium: changed by hand, they're left out.
    const care = type === base.type ? { check: base.check, water: base.water, soil: base.soil, cond: base.cond } : {};
    S.custom[id] = {
      id, species: String(f.get('species')).trim() || 'Растение', cat: 'Мои', emoji: base.emoji || '🪴',
      ...care, humid, big,
      lux: [lmin, lmax], every, type, tip: String(f.get('tip')).trim(), quips: quips || GENERIC_QUIPS,
    };
    S.custom[id].tone = toneOf(S.custom[id]);
    S.plants[id] = runtime(S.custom[id], today());
    S.plants[id].name = String(f.get('name') || '').trim();
    initBonus(S);
    save();
    closeSheet();
    track('plants_added', { count: 1, generic_count: 0, source: 'custom', plant_type: S.custom[id].type, like: base.id, tuned });
    toast('Добро пожаловать в джунгли! 🌱');
  });
  openSheet();
}

/* ---------- Import from an AI chat ---------- */
// The user copies a prompt into ChatGPT/Claude, picks the plants.json file it sends,
// and the plants become custom plants with their care tips.
const IMPORT_PROMPT = `Сделай файл plants.json со списком моих растений для приложения «Жунгли» и пришли его мне для скачивания — файлом, не текстом в чате. Возьми растения, о которых мы говорили в этом чате (если непонятно, какие, — спроси меня).

Если я говорила, как растёт растение (в воде, в керамзите, в поне, на блоке, в террариуме, в аквариуме, на фитиле, с резервуаром), пиши проверку и уход именно для этого способа.

В файле — только JSON-массив, без пояснений: обычные двойные кавычки, числа без пробелов. Один объект на растение, поля:
- species — вид или сорт по-русски
- name — имя, если оно есть у растения, иначе ""
- room — комната, где стоит, если я её называла (например "Кухня"), иначе ""
- spot — место в комнате: подоконник, полка, стол и т. п., если я его называла, иначе ""
- type — в чём растёт: "soil" (грунт), "dry" (грунт для суккулентов и кактусов, сушить почти полностью), "sphagnum" (сфагнум), "bark" (кора, орхидеи), "coco" (кокос), "mineral" (пон, пемза, цеолит), "leca" (керамзит), "water" (в воде: черенки, растения в банке), "mount" (на блоке, корни на воздухе), "terrarium" (закрытый террариум), "aquarium" (корни в аквариуме)
- watering — как поливать растение в горшке: "top" (сверху), "wick" (фитиль), "reservoir" (резервуар в горшке: кашпо с автополивом, керамзит с запасом раствора); для воды, блока, террариума и аквариума — "top"
- lux — сколько света нужно, люксы: [от, до]
- every — через сколько дней обычно проверять полив (для керамзита — уровень раствора, для воды — пора ли её менять)
- check — вопрос при проверке, например "Верхние 2–3 см сухие?" или "Уровень раствора на минимуме?"
- water — как поливать, доливать или менять воду и когда удобрять
- soil — в чём растёт и какой горшок
- cond — условия; начни с температуры так: "18–26 °C; ..."
- tip — самое важное в уходе
- toxic — true, если сок ядовит или раздражает кожу
- big — true, если крупные листья, которые надо протирать от пыли
- quips — 3 коротких смешных фразы от лица растения, на «вы» ко мне

Пример:
[{"species":"Пеперомия туполистная","name":"","room":"Кухня","spot":"Подоконник","type":"soil","watering":"top","lux":[8000,15000],"every":7,"check":"Верхние 2–3 см сухие?","water":"Когда верхний слой подсох, умеренно.","soil":"Лёгкий грунт с перлитом, горшок с дренажем.","cond":"18–26 °C; обычная влажность.","tip":"Мясистые листья запасают воду — перелив опаснее пересушки.","toxic":false,"big":false,"quips":["Я толстенькая, но это вода.","Не заливайте меня, я и так сочная.","Поверните меня к свету, пожалуйста."]}]`;

// Cleans formatting chat apps add, so JSON.parse can read the answer.
function repairJson(src) {
  return src
    .replace(/^\s*\/\/.*$/gm, '') // line comments
    .replace(/[“”„‟″]/g, '"').replace(/[‘’]/g, "'") // typographic quotes
    .replace(/(\d)[   ](?=\d{3}\b)/g, '$1') // 8 000 → 8000
    .replace(/,\s*([\]}])/g, '$1'); // trailing commas
}
// Finds the plant list in the AI's file: code fences, text around it (even with brackets),
// typographic quotes, spaced numbers, a single object or objects without [ ].
function parseImport(text) {
  const t = String(text || '').trim();
  if (!t) return { error: 'empty' };
  // What the text looked like, without any of its content.
  const diag = { has_code_fence: t.includes('```'), has_curly_quotes: /[“”„]/.test(t), has_spaced_numbers: /\d[   ]\d{3}\b/.test(t) };
  const tries = [];
  const end = t.lastIndexOf(']');
  for (let a = t.indexOf('['), n = 0; a !== -1 && a < end && n < 8; a = t.indexOf('[', a + 1), n++) tries.push(t.slice(a, end + 1));
  const c = t.indexOf('{'), d = t.lastIndexOf('}');
  if (c !== -1 && d > c) tries.push(t.slice(c, d + 1), `[${t.slice(c, d + 1)}]`);
  if (!tries.length) return { error: 'no_list', diag };
  let parsed = false;
  for (const raw of tries) {
    for (const [src, repaired] of [[raw, false], [repairJson(raw), true]]) {
      let v;
      try { v = JSON.parse(src); } catch (e) { continue; }
      parsed = true;
      if (v && !Array.isArray(v)) v = Array.isArray(v.plants) ? v.plants : Object.values(v).find(Array.isArray) || [v];
      const items = v.map(normImport).filter(Boolean);
      if (items.length) return { items, repaired };
    }
  }
  return { error: parsed ? 'no_plants' : 'bad_json', diag };
}
// Common off-format answers: 'succulent', 'orchid', 'грунт'…
function importType(x) {
  const t = String(x || '').toLowerCase();
  if (TYPE_NAMES[t]) return t;
  if (/aquar|аквар/.test(t)) return 'aquarium';
  if (/terrar|террар|флорар|бутыл/.test(t)) return 'terrarium';
  if (/mount|блок|коряг|epiphyt/.test(t)) return 'mount';
  // Specific substrates first: «пон, полугидропоника» is pon on a reservoir, not clay pebbles.
  if (/mineral|pumice|zeolit|\bpon\b|минерал|пемз|цеолит|(^|[^а-я])пон([^а-я]|$)/.test(t)) return 'mineral';
  if (/coco|кокос/.test(t)) return 'coco';
  if (/leca|clay|hydro|semi|керамз|гидро/.test(t)) return 'leca';
  if (/succ|cact|dry|сух|сукк|какт/.test(t)) return 'dry';
  if (/bark|orchid|кор|орхид/.test(t)) return 'bark';
  if (/sphag|moss|сфаг|мох/.test(t)) return 'sphagnum';
  if (/water|вод/.test(t)) return 'water';
  return 'soil';
}
// How a potted plant is watered; the old answer "type": "wick" means soil on a wick.
function importWatering(x, type) {
  const t = `${x || ''} ${type || ''}`.toLowerCase();
  if (/wick|фитил/.test(t)) return 'wick';
  if (/reserv|резерв|автопол|self.?water|semi|hydro|гидро/.test(t)) return 'reservoir';
  return 'top';
}
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
function normImport(o) {
  if (!o || typeof o !== 'object') return null;
  const str = (x, max = 500) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  const species = str(o.species, 80) || str(o.name, 80);
  if (!species) return null;
  // Numbers may come as strings: "7–10", "8 000", "8000–15000 лк".
  const nums = (x) => (String(x ?? '').replace(/(\d)[\s\u00a0\u202f](?=\d{3}\b)/g, '$1').match(/\d+(?:[.,]\d+)?/g) || []).map((m) => Number(m.replace(',', '.')));
  const num = (x) => nums(x)[0];
  const yes = (x) => x === true || /^(true|да|yes)$/i.test(String(x).trim());
  let lux = (Array.isArray(o.lux) ? o.lux.map(num) : nums(o.lux)).filter((x) => x > 0);
  lux = lux.length ? [Math.min(...lux), Math.max(...lux)].map((x) => clamp(Math.round(x), 300, 100000)) : [6000, 15000];
  const quips = Array.isArray(o.quips) ? o.quips.map((q) => str(q, 120)).filter(Boolean).slice(0, 5) : [];
  const type = importType(o.type);
  // Clay pebbles almost always stand in a pot with a reservoir.
  const watering = !MEDIA[type].pot ? 'top' : MEDIA[type].watering && !o.watering ? MEDIA[type].watering : importWatering(o.watering, o.type);
  return {
    species, name: str(o.name, 40) === species ? '' : str(o.name, 40),
    room: cap(str(o.room, 40)), spot: cap(str(o.spot ?? o.place, 40)),
    emoji: [...str(o.emoji, 16)].slice(0, 2).join('') || '🪴',
    type, ...(watering !== 'top' ? { watering } : {}),
    lux, every: clamp(Math.round(num(o.every)) || 6, 1, 60),
    check: str(o.check, 100), water: str(o.water), soil: str(o.soil), cond: str(o.cond), tip: str(o.tip),
    toxic: yes(o.toxic), big: yes(o.big), quips: quips.length ? quips : GENERIC_QUIPS,
  };
}

let importItems = [];
let importRepaired = false;
let importExt = '';
let importPicked = new Set();
// How to copy the shown prompt by hand: the gesture that opens the system menu differs by platform.
const PROMPT_HINT = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Нажмите на текст, затем ещё раз — в меню «Выбрать все», потом «Скопировать».'
  : /Android/.test(navigator.userAgent) ? 'Подержите палец на тексте — в меню «Выбрать все», потом «Копировать».'
    : 'Выделите весь текст (Ctrl+A или ⌘A) и скопируйте.';
function openImport() {
  startAddFlow('import');
  track('import_opened');
  importItems = [];
  importPicked = new Set();
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('bot')}</div><h2 class="m-0">Импорт из чата с ИИ</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="info"><b>Шаг 1</b>Скопируйте запрос и отправьте ИИ, который умеет делать файлы: ChatGPT, Claude или другому. Лучше в чат, где уже обсуждали растения.
      <button class="mt-10 btn ok wide" data-act="import-copy">${I('copy')}Скопировать запрос</button>
      <div class="mt-12 small" id="imp-manual" hidden><p class="m-0 muted">Длинный запрос чат может вставить файлом-вложением — так и должно быть, просто отправьте.</p>
        <p class="m-0 copy-help"><button class="linkish" data-act="import-show">Не вставляется? Показать запрос</button></p></div>
      <div id="imp-prompt-box" hidden><p class="mt-8 small muted" id="imp-prompt-hint">${PROMPT_HINT}</p>
        <textarea class="mt-8 input" id="imp-prompt" rows="8" inputmode="none" aria-label="Запрос для ИИ" aria-describedby="imp-prompt-hint" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>
        <button class="mt-8 btn wide" data-act="import-copy-again">${I('copy')}Скопировать ещё раз</button></div>
      <p class="sr-only" id="imp-status" role="status"></p></div>
    <div class="info"><b>Шаг 2</b>ИИ сделает файл plants.json. Сохраните его на устройство и выберите здесь.
      <button class="mt-10 btn wide" data-act="import-file" id="imp-file">${I('file-up')}Выбрать файл</button></div>
    <div id="imp-list"></div>
    <div class="pick-bar" id="imp-bar" hidden><button class="btn primary wide" data-act="import-add" id="imp-add" disabled>Отметьте растения</button></div>`;
  openSheet();
}
// Selects all of a text field. iOS doesn't select text in a readonly field, so readonly is lifted for the
// moment of selecting (as clipboard.js does); it's back before the next paint, so no keyboard shows.
function selectAll(ta) {
  const ro = ta.readOnly;
  ta.readOnly = false;
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  ta.readOnly = ro;
}
// Copies text and resolves to how it went: 'exec', 'clipboard', 'failed' or 'none'.
// Select-and-copy goes first, inside the tap: on iPhone, a home-screen app's navigator.clipboard.writeText
// can report success without copying anything. The Clipboard API runs only when that fails: a second write
// right after the first can still be going when the person switches to the AI app on a slow iPhone,
// and the app is suspended mid-write, leaving the clipboard empty.
// The text goes into a hidden readonly field in the open sheet (a modal <dialog> makes the rest inert),
// so no keyboard shows.
function copyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.readOnly = true;
  ta.tabIndex = -1;
  ta.className = 'copy-buffer';
  ($('#sheet[open]') || document.body).appendChild(ta);
  selectAll(ta);
  // execCommand can report success with nothing selected (so nothing copied): trust it only for a full selection.
  const selected = ta.selectionEnd - ta.selectionStart === text.length;
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* not supported */ }
  ta.remove();
  if (ok && selected) return Promise.resolve('exec');
  if (!navigator.clipboard) return Promise.resolve('none');
  return navigator.clipboard.writeText(text).then(() => 'clipboard', () => 'failed');
}
// Copies the prompt with a visible «Копирую…» step: the result shows no sooner than a second after the tap,
// so nobody rushes off to the AI app before a slow phone has finished. Taps meanwhile are ignored.
// A copy that throws or hangs counts as 'failed'.
const COPY_PAUSE = 1000;
const COPY_TIMEOUT = 5000;
function copyPrompt(el, done) {
  if (el.dataset.busy) return;
  el.dataset.busy = '1';
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = `${I('copy')}Копирую…`;
  if ($('#imp-status')) $('#imp-status').textContent = 'Копирую запрос…';
  const t0 = Date.now();
  let copying;
  try { copying = copyText(IMPORT_PROMPT); } catch (e) { copying = Promise.resolve('failed'); }
  Promise.race([copying, new Promise((res) => setTimeout(res, COPY_TIMEOUT, 'failed'))])
    .then((how) => setTimeout(() => {
      delete el.dataset.busy;
      el.removeAttribute('aria-busy');
      done(how);
    }, Math.max(0, COPY_PAUSE - (Date.now() - t0))));
}
// The prompt as text to copy by hand, when copying didn't work. An ordinary (editable) field on purpose:
// iPhone offers «Выбрать все» only in fields you can type in, and a readonly one leaves only dragging
// across 2,500 characters. inputmode="none" keeps the on-screen keyboard down, even when it's tapped.
function showPrompt() {
  const ta = $('#imp-prompt');
  if (!ta) return;
  ta.value = IMPORT_PROMPT;
  $('#imp-prompt-box').hidden = false;
  $('#imp-manual').hidden = true;
  $('#imp-prompt-box').scrollIntoView({ block: 'nearest' });
  // Editable only so the system menu offers «Выбрать все»: typing is undone, so a stray key can't end up in the AI chat.
  if (!ta.dataset.locked) {
    ta.dataset.locked = '1';
    // Paste, Cut and AutoFill still show in the system menu; when one is tried, say what the field is for.
    ta.addEventListener('beforeinput', (e) => {
      e.preventDefault();
      $('#imp-prompt-hint').textContent = 'Текст менять не нужно — только «Выбрать все» и «Скопировать».';
    });
    ta.addEventListener('input', () => { if (ta.value !== IMPORT_PROMPT) ta.value = IMPORT_PROMPT; });
  }
}
// Plant lists are a few kilobytes; a much bigger file is something else (a photo, a document).
const IMPORT_MAX = 1e6;
// Reads the file the AI sent and shows its plants. For stats only the kind of file goes out
// (json / txt / other): what follows the dot can be part of a name («Растения.Коля»).
async function importFile(f) {
  const dot = f.name.lastIndexOf('.');
  const ext = { json: 'json', txt: 'txt' }[dot < 0 ? '' : f.name.slice(dot + 1).toLowerCase()] || 'other';
  if (f.size > IMPORT_MAX) { showImport(null, ext, 'too_big'); return; }
  let text = null;
  try { text = (await f.text()).replace(/^\uFEFF/, ''); } catch (e) { /* unreadable */ }
  showImport(text, ext);
}
// A backup picked here by mistake: it has no plant list for import, but can be restored in settings.
function isBackup(text) {
  try { const d = JSON.parse(text); return !!d && d.app === 'zhungli' && !!d.state; } catch (e) { return false; }
}
function showImport(text, ext, fail) {
  const res = fail ? { error: fail } : text === null ? { error: 'unreadable' } : isBackup(text) ? { error: 'backup' } : parseImport(text);
  const box = $('#imp-list');
  if (!box) return;
  $('#imp-file').innerHTML = `${I('file-up')}${res.error ? 'Выбрать файл' : 'Выбрать другой файл'}`;
  if (res.error) {
    importItems = [];
    importPicked = new Set();
    box.innerHTML = res.error === 'backup'
      ? '<p class="error-note small">Это резервная копия Жунглей, а не файл от ИИ. Её можно восстановить в настройках: «Резервная копия» → «Восстановить».</p>'
      : `<p class="error-note small">${{ unreadable: 'Не получилось открыть этот файл.', too_big: 'Этот файл слишком большой для списка растений — похоже, выбран не тот.' }[res.error] || 'В этом файле не нашлось списка растений.'} Нужен файл plants.json, который ИИ сделает по запросу из шага 1.</p>
      <p class="small muted">Всё равно не выходит? Пришлите файл в Телеграм <a class="linkish" href="https://t.me/zmoki" data-out="telegram" data-from="import" target="_blank" rel="noopener">@zmoki</a> — разберусь и починю.</p>`;
    track('import_failed', { length: text ? text.length : 0, reason: res.error, file_ext: ext, ...(res.diag || {}) });
  } else {
    importItems = res.items;
    importRepaired = res.repaired;
    // Plants already in the collection start unticked.
    const have = new Set(allPlants().map((p) => p.species.toLowerCase()));
    importPicked = new Set(importItems.map((it, i) => i).filter((i) => !have.has(importItems[i].species.toLowerCase())));
    importExt = ext;
    // All of them already in the collection: nothing is ticked and the add bar stays hidden, so say how to add them anyway.
    const note = importPicked.size ? `Найдено ${plantsN(importItems.length)}. Снимите галочку с лишних.`
      : `${importItems.length === 1 ? 'Это растение уже' : `Все ${plantsN(importItems.length)} уже`} в коллекции. Отметьте, если нужны ещё раз.`;
    box.innerHTML = `<p class="found-note small muted">${note}</p>` +
      importItems.map((it, i) => {
        const dup = !importPicked.has(i);
        return `<button class="pick ${dup ? '' : 'on'}" data-act="import-pick" data-i="${i}">
        <span class="pe" aria-hidden="true">${plantSvg(it, 'fine')}</span><span class="pt"><b>${esc(it.name ? `${it.name} · ${it.species}` : it.species)}</b>
        <small>${dup ? 'уже есть в коллекции · ' : ''}${it.room || it.spot ? esc([it.room, it.spot].filter(Boolean).join(' · ')) + ' · ' : ''}${esc(TYPE_NAMES[it.type])}${it.watering ? `, ${esc(WATERING[it.watering].name.toLowerCase())}` : ''} · свет ${kLux(it.lux[0])}–${kLux(it.lux[1])} ${LK} · раз в ${days(it.every)}</small></span>
        <span class="pc" aria-hidden="true">${I(dup ? 'plus' : 'check')}</span></button>`;
      }).join('');
  }
  updateImportBar();
}
const updateImportBar = () => showAddBar($('#imp-bar'), $('#imp-add'), importPicked.size);
function addImported() {
  if (addFlow) addFlow.done = true;
  const picked = [...importPicked].sort((a, b) => a - b).map((i) => importItems[i]);
  const list = [...picked].sort((a, b) => a.every - b.every);
  // A new collection where every plant has a room keeps no empty default «Комната»: the first imported room takes its place.
  const first = S.rooms[0];
  let rename = !Object.keys(S.plants).length && S.rooms.length === 1 && first.t == null && first.name === 'Комната' && list.every((it) => it.room);
  const roomsBefore = S.rooms.length;
  // Rooms come in the order the AI listed them (plants below are sorted by how often to check them).
  picked.forEach((it) => { if (it.room) { importRoom(it.room, rename); rename = false; } });
  list.forEach((it, i) => {
    const id = newId('c', i);
    const { name, room, spot: rawSpot, ...d } = it;
    // Reuse a place that differs only in case («подоконник» → «Подоконник»).
    const spot = rawSpot && (S.spots.find((x) => norm(x) === norm(rawSpot)) || rawSpot);
    if (spot && !S.spots.includes(spot)) S.spots.push(spot);
    S.custom[id] = { ...d, id, cat: 'Мои', tone: toneOf(it) };
    S.plants[id] = { ...runtime(S.custom[id], firstCheck(i, it.every)), name, spot, room: importRoom(room, false) };
  });
  initBonus(S);
  save();
  const noSpot = list.filter((it) => !it.spot).length;
  track('plants_added', {
    count: list.length, generic_count: 0, source: 'import', repaired: importRepaired, file_ext: importExt,
    with_room: list.filter((it) => it.room).length, with_spot: list.length - noSpot, rooms_created: S.rooms.length - roomsBefore,
  });
  tab = 'plants'; closeSheet(); window.scrollTo(0, 0);
  toast(`Добавлено ${plantsN(list.length)} 🌱${noSpot ? ' Откройте каждое без места, чтобы его выбрать' : ''}`);
}
// The room id for an imported plant: an existing room with that name, or a new one
// (`renameFirst`: the empty default room takes this name instead).
// Without a room the plant lives in the first room (no `room` field needed).
function importRoom(name, renameFirst) {
  if (!name) return undefined;
  const found = S.rooms.find((r) => norm(r.name) === norm(name));
  if (found) return found.id;
  if (renameFirst) {
    S.rooms[0].name = name;
    return S.rooms[0].id;
  }
  const rm = newRoom('r' + Date.now().toString(36) + S.rooms.length, name);
  S.rooms.push(rm);
  return rm.id;
}

$('#ai-file-input').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) importFile(f);
});
