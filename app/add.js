/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Adding plants: catalog picker, own plant, import from an AI chat.

// Catalog picker: several plants can be selected at once.
let picked = new Set();
// Crude Russian stem for catalog search: longer words drop their ending, so «лиана» finds «лианы»,
// «трава» finds «травы», «черенок» finds «черенки».
// Title of the generic group in the full list; during a search it's just «Общие типы».
const GENERIC_TITLE = 'Общие типы (если нет в списке)';
const searchStem = (w) => (w.length >= 6 ? w.slice(0, -2) : w.length === 5 ? w.slice(0, -1) : w);
// Latin typed in the catalog search also reads as Russian two ways: botanical Latin by sound («aloca» →
// «алока», «chlorophytum» → «хлорофитум»), and Russian typed on an English layout («fkjrf» → «алока»).
// So every plant is found by its Latin name without listing it in `aka`.
const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RU_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const fromLayout = (s) => s.replace(/./g, (c) => { const i = EN_KEYS.indexOf(c); return i < 0 ? c : RU_KEYS[i]; });
const LATIN_SOUNDS = {
  sch: 'ш', zh: 'ж', kh: 'х', ch: 'х', sh: 'ш', ts: 'ц', ya: 'я', yu: 'ю', yo: 'е', ph: 'ф', th: 'т', ck: 'к', qu: 'кв', ae: 'е', oe: 'оэ',
  a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'дж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п',
  q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', y: 'и', z: 'з',
};
const fromLatin = (s) => s.replace(/sch|zh|kh|ch|sh|ts|ya|yu|yo|ph|th|ck|qu|ae|oe|[a-z]/g, (m, at) => {
  const vowel = (c) => /[aeiouy]/.test(c || '');
  if (m === 'c' && /[eiy]/.test(s[at + 1] || '')) return 'ц'; // cissus → циссус
  if (m === 's' && vowel(s[at - 1]) && vowel(s[at + 1])) return 'з'; // alocasia → алоказия
  if (m === 'e' && !/[a-z]/.test(s[at - 1] || '')) return 'э'; // echeveria → эхеверия
  return LATIN_SOUNDS[m];
});
// The ways a query can be read, each as a list of stemmed words: as typed, and for Latin also by sound and by layout.
function searchReadings(raw) {
  const q = norm(raw);
  const all = /[a-z]/.test(q) ? [q, fromLatin(q), fromLayout(q)] : [q];
  return [...new Set(all)].map((s) => s.split(/\s+/).filter(Boolean).map(searchStem));
}
// When nothing matches as typed (neither a plant nor a group name), the search forgives typos: о/а and е/и/э/я
// count as the same sound, a doubled letter as one, and words match from their start. A searched word of 8+ letters
// as typed may be a letter off, 11+ letters two. So «дифенбахия», «дефенбахия» and
// «манстера» find their plants, but «авокадо» doesn't find «алоказия».
const looseSound = (s) => s.replace(/о/g, 'а').replace(/[еэя]/g, 'и').replace(/(.)\1+/g, '$1');
// Each row's words, loosened once: the texts never change while the sheet is open.
const looseWords = new Map();
const looseTokens = (text) => {
  let t = looseWords.get(text);
  if (!t) looseWords.set(text, t = looseSound(text).split(/[^а-яa-z0-9]+/).filter(Boolean));
  return t;
};
// Whether `w` turns into the start of `t` in at most `max` edits. Gives up as soon as a row of the table is over
// `max`, so most words are dropped after a letter or two: this runs on every keystroke.
function nearStart(w, t, max) {
  if (t.length < w.length - max) return false;
  let prev = [...Array(t.length + 1).keys()];
  for (let i = 1; i <= w.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= t.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (w[i - 1] === t[j - 1] ? 0 : 1));
      if (cur[j] < low) low = cur[j];
    }
    if (low > max) return false;
    prev = cur;
  }
  return Math.min(...prev) <= max;
}
function typoMatcher(readings) {
  // The words come with their ending trimmed (searchStem: 2 letters off a word of 6+), so a stem of 9+ letters was
  // typed with 11+, and of 6+ with 8+.
  const loose = readings.map((ws) => ws.map((w) => [looseSound(w), w.length >= 9 ? 2 : w.length >= 6 ? 1 : 0]));
  return (text) => {
    const tokens = looseTokens(text);
    return loose.some((ws) => ws.every(([w, max]) => tokens.some((t) => t.startsWith(w) || (max && nearStart(w, t, max)))));
  };
}
// A catalog row. Adding, it ticks the card; changing a plant's card (`changeFor`: its id, `nowId`: its card), it picks this one.
// The picture is a strip down the row's left edge (.pick.strip), the drawing fitted into its middle (plantSvg's square viewBox); under the name one line: another name people know it by
// (`alt`) and the hint (generic types). Pet safety isn't here: it shows on the plant, with pets on.
function pickRow(d, changeFor, nowId) {
  const now = !!changeFor && nowId === d.id;
  // The current card shows by its color and check (and aria-current for screen readers), not by a word on its line.
  const sub = [d.alt ? altHtml(d.alt) : '', d.hint ? esc(d.hint) : ''].filter(Boolean).join(' · ');
  const act = changeFor ? `data-act="card-pick" data-id="${esc(changeFor)}"` : 'data-act="pick"';
  return `<button class="pick strip${now ? ' on' : ''}" ${act}${now ? ' aria-current="true"' : ''} data-key="${esc(d.id)}" data-q="${esc(norm([d.species, d.alt, d.hint, d.aka, d.names, d.findBy].join(' ')))}" data-name="${esc(norm(d.species))}" data-cat="${esc(norm(d.cat))}" data-generic="${d.generic ? 1 : 0}">
    <span class="pe fit" aria-hidden="true">${plantSvg(d, 'fine', true)}</span><span class="pt"><b>${esc(d.species)}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="pc" aria-hidden="true">${I(now ? 'check' : changeFor ? 'chevron-right' : 'plus')}</span></button>`;
}
// What happens in the add flow, reported once when the sheet closes without adding.
let addFlow = null;
function startAddFlow(sheetName) {
  if (!addFlow) addFlow = { sheet: sheetName, searched: false, no_results: false, picked: 0, done: false };
  addFlow.sheet = sheetName;
}
function endAddFlow(leftApp = false) {
  // What the catalog lacks: sent whether or not something was added in the end.
  if (addFlow && addFlow.missed) track('add_catalog_missed', { query: addFlow.missed, added: addFlow.done });
  if (!leftApp) customDraft = null; // the sheet is closing: a kept «Новое растение» draft goes with it
  if (addFlow && !addFlow.done) {
    track('add_abandoned', { part: addFlow.sheet, searched: addFlow.searched, no_results: addFlow.no_results, picked: addFlow.picked, left_app: leftApp,
      ...(addFlow.sheet === 'import' && imp && { step: imp.step }) });
  }
  addFlow = null;
}
let searchTimer;
const byCatalogName = (a, b) => !!a.generic - !!b.generic || (!a.generic && a.species.localeCompare(b.species, 'ru'));
// The catalog by groups under a search box: in the add sheet and when changing a plant's card (`changeFor`).
function catalogHtml(changeFor) {
  const groups = {};
  PLANTS.filter((d) => !d.hidden).forEach((d) => { (groups[d.cat] ||= []).push(d); });
  // Plants by name, A to Я («Алоказия» comes before its varieties); a generic type closes its group («Орхидея» after
  // «Фаленопсис»), as «Общие типы» close the list, in the order they're written.
  Object.values(groups).forEach((ds) => ds.sort(byCatalogName));
  const cats = Object.keys(groups).sort((a, b) => catRank(a) - catRank(b));
  const nowId = changeFor && def(changeFor).id;
  return `<div class="search pick-search"><input class="input" id="pick-q" type="search" aria-label="Поиск растений" placeholder="Поиск: монстера, кактус, фиалка…" autocomplete="off">${I('search')}${searchX('')}</div>
    ${changeFor ? '' : nameHelpLink('search', 'Не знаете, как называется растение?')}
    <div id="pick-none" class="pick-none" hidden></div>
    ${cats.map((c) => `<div class="pick-group"${c === 'Общие типы' ? ' data-generic' : ''}><div class="group-title">${c === 'Общие типы' ? GENERIC_TITLE : esc(c)}</div>
      ${groups[c].map((d) => pickRow(d, changeFor, nowId)).join('')}</div>`).join('')}<div id="pick-end"></div>`;
}
// `back`: returning from «Своё растение» or AI import, so the ticks stay and it isn't a new opening.
// `from`: `empty` (an empty page) or `help` (name help); otherwise the tab it was opened on.
function openAdd(back = false, from = '') {
  if (!back) picked = new Set();
  if (!sheet.open) endAddFlow(); // the close event doesn't fire in every browser
  startAddFlow('catalog');
  if (!back) track('add_opened', { from: from || tab });
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><h2 class="m-0">Добавить растения</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <button class="import-cta mini" data-act="add-import"><span class="pe" aria-hidden="true">${I('bot')}</span>
      <span class="pt"><b>Много растений? Перенести из чата с ИИ</b><small>DeepSeek, GigaChat или ChatGPT составит список</small></span>
      <span class="pc" aria-hidden="true">${I('chevron-right')}</span></button>
    <h3 class="sec-title">Каталог</h3>
    ${catalogHtml()}
    <div id="end-own"><div class="group-title">Не нашли своё?</div>
      <button class="import-cta mini" data-act="add-custom"><span class="pe" aria-hidden="true">${I('pencil')}</span>
        <span class="pt"><b>Своё растение</b><small>Название и на что похоже, уход подберу</small></span>
        <span class="pc" aria-hidden="true">${I('chevron-right')}</span></button></div>
    <div class="pick-bar" id="pick-bar" hidden><button class="btn primary wide" data-act="pick-add" id="pick-add" disabled>Ничего не выбрано</button></div>`;
  catalogSearch();
  picked.forEach((k) => {
    const b = $(`#sheet .pick[data-key="${k}"]`);
    if (b) { b.classList.add('on'); b.querySelector('.pc').innerHTML = I('check'); }
  });
  updatePickBar();
  openSheet();
}
// Head of a sheet opened from the add sheet («Своё растение», AI import): a back arrow to the catalog, as in
// «Другая карточка». Opened elsewhere (an empty screen), it only closes.
// After «Добавить как своё» the way back also brings the search (`q`) back.
const subHead = (title, back, q = '') => `<div class="sheet-head">${back
  ? `<button class="icon-btn" data-act="add-back" data-to="${back}"${q ? ` data-q="${esc(q)}"` : ''} aria-label="Назад к каталогу">${I('arrow-left')}</button>`
  : ''}<h2 class="m-0">${title}</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>`;
// The catalog's search. Changing a plant's card (`changeFor`, see openCardPicker in plant.js), searches send no
// events: whether one was made goes with `plant_setting_card_changed`.
let pinWatch = null;
function catalogSearch(changeFor) {
  // The search stays at the top while the list scrolls; once it's stuck there it gets the sheet's solid fill,
  // so the list doesn't show through (before that it sits on the sheet's own glass).
  const bar = $('.pick-search'), mark = document.createElement('div');
  bar.before(mark);
  pinWatch?.disconnect();
  pinWatch = new IntersectionObserver(([e]) => bar.classList.toggle('stuck', !e.isIntersecting), { root: sheet });
  pinWatch.observe(mark);
  sheet.addEventListener('close', () => pinWatch?.disconnect(), { once: true });
  const pickGroups = [...document.querySelectorAll('.pick-group')];
  const pickEnd = $('#pick-end');
  const genericTitle = document.querySelector('.pick-group[data-generic] .group-title');
  let shownOrder = pickGroups;
  $('#pick-q').addEventListener('input', (e) => {
    const raw = e.target.value.trim();
    // Every word must match somewhere: «фикус бенджамина» finds the generic type, not every ficus.
    const readings = searchReadings(raw);
    const words = readings[0];
    const exact = (text) => readings.some((ws) => ws.every((w) => text.includes(w)));
    const found = (test, cat) => pickGroups.some((g) => [...g.querySelectorAll('.pick')].some((b) => test(cat ? `${b.dataset.q} ${b.dataset.cat}` : b.dataset.q)));
    // Tried in order, the first that finds something wins. The plant as typed; the group name, so «лиана» finds
    // the vines but «кактус» doesn't list every succulent; then the same with typos forgiven, so a correct name
    // never brings look-alikes.
    let hits = exact, byCat = false, typo = false;
    if (words.length && !found(exact)) {
      if (found(exact, true)) byCat = true;
      else { hits = typoMatcher(readings); typo = true; byCat = !found(hits); }
    }
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
    // «орхидея» shows «Фаленопсис» before the generic «Орхидея». Without a search, the usual order.
    const order = words.length ? [...pickGroups].sort((a, b) => score.get(b) - score.get(a) || pickGroups.indexOf(a) - pickGroups.indexOf(b)) : pickGroups;
    if (order.some((g, i) => g !== shownOrder[i])) { order.forEach((g) => pickEnd.before(g)); shownOrder = order; }
    // «(если нет в списке)» only reads right at the end of the full list.
    genericTitle.textContent = words.length ? 'Общие типы' : GENERIC_TITLE;
    // Nothing found: never a dead end. Offer the typed name as an own plant (instead of «Не нашли своё?»
    // at the end of the list, so there's one such button), and show all generic types under it.
    // Changing a card there's no own plant to offer: just the generic types.
    const none = $('#pick-none');
    none.hidden = any;
    if ($('#end-own')) $('#end-own').hidden = !any;
    if (!any) {
      none.innerHTML = `<p class="small muted">«${esc(raw)}» нет в каталоге.</p>
        ${changeFor ? '' : `<button class="mt-8 btn primary wide" data-act="add-custom" data-q="${esc(raw)}">${I('plus')}Добавить как своё</button>`}
        ${changeFor ? '' : nameHelpLink('not_found', 'Не знаете точное название? Как узнать')}
        <p class="mt-12 small muted" data-from="catalog">Чтобы оно появилось в каталоге с советами, напишите Зареме в Телеграм ${outLink('telegram', '@zmoki', 'linkish')}.</p>
        ${changeFor ? '<p class="mt-12 small muted">А пока выберите похожий общий тип, уход у них почти одинаковый:</p>' : ''}`;
      // Every generic type, also those closing their own group (orchid, succulent…), under that group's title.
      document.querySelectorAll('.pick[data-generic="1"]').forEach((b) => { b.hidden = false; b.closest('.pick-group').hidden = false; });
    }
    if (changeFor) { if (raw) cardSearched = true; return; }
    if (e.detail === 'restore') return;
    // The last search that found nothing goes out once, when the sheet closes (add_catalog_missed):
    // a pause mid-word or a fixed typo isn't sent. Clearing the box keeps it.
    if (addFlow && raw) addFlow.missed = any ? '' : raw.slice(0, 40);
    if (raw) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        if (addFlow) { addFlow.searched = true; addFlow.no_results = !any; }
        track('add_catalog_searched', { found: any, ...(typo && any && { typo: true }) });
      }, 1200);
    }
  });
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
// Picker groups go by care, from the most common plants; generic types without a group close the list.
const CAT_ORDER = ['Лианы и ампельные', 'Декоративно-лиственные', 'Пальмы, драцены и деревья', 'Ароидные', 'Влаголюбивые',
  'Суккуленты и кактусы', 'Цветущие и орхидеи', 'Хищные растения', 'Общие типы'];
// A category missing from CAT_ORDER (a typo in plants.js) still shows, just before the generic types, and warns.
const catRank = (c) => {
  const r = CAT_ORDER.indexOf(c);
  if (r < 0) console.warn('Catalog category missing from CAT_ORDER:', c);
  return r < 0 ? CAT_ORDER.length - 1.5 : r;
};

// Two fields are enough: what it is and what it's like. The care comes from that generic type;
// the numbers stay editable under «Тонкая настройка».
const GENERIC_TYPES = () => PLANTS.filter((d) => d.generic && !d.hidden);
// What was typed in «Новое растение» before ← to the catalog: it comes back if the form is opened again
// while the add sheet stays open (cleared when the sheet closes or the plant is added).
let customDraft = null;
function openCustom(species = '', from = 'sheet', back = '') {
  startAddFlow('custom');
  track('add_custom_opened', { from });
  const like = GENERIC_TYPES()[0];
  $('#sheet-body').innerHTML = `
    ${subHead('Новое растение', back, from === 'search_miss' ? species : '')}
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
  // A draft for another plant (opened now with a different searched name) doesn't carry over.
  if (customDraft && species && species !== customDraft.species) customDraft = null;
  if (customDraft) {
    const { tuneOpen, ...fields } = customDraft;
    Object.entries(fields).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
    form.querySelector('.tune').open = tuneOpen;
    $('#c-like-hint').textContent = def(form.like.value)?.hint ? `Например: ${def(form.like.value).hint}.` : '';
  }
  // Changing the care in «Тонкая настройка» by hand (not the values a type fills in, not the name)
  // tells whether two fields are enough.
  let tuned = false;
  form.querySelector('.tune').addEventListener('input', (e) => { if (e.target.name !== 'name') tuned = true; });
  // The form's own funnel: which fields people change (never the values) and whether they open «Тонкая настройка».
  const FIELD = { species: 'species', like: 'like', name: 'name', type: 'medium', lmin: 'light', lmax: 'light', every: 'every', tip: 'tip' };
  form.addEventListener('change', (e) => { if (FIELD[e.target.name]) track('add_custom_field_changed', { field: FIELD[e.target.name] }); });
  form.querySelector('.tune summary').addEventListener('click', (e) => { if (!e.currentTarget.parentElement.open) track('add_custom_tune_opened'); });
  if (!species) form.species.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    customDraft = null;
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
    track('add_finished', { count: 1, generic_count: 0, source: 'custom', medium: S.custom[id].type, catalog_id: base.id, tuned });
    toast('Добро пожаловать в джунгли! 🌱');
  });
  openSheet();
}

/* ---------- Import from an AI chat ---------- */
// The user copies a prompt into an AI chat (DeepSeek, GigaChat, ChatGPT…), then pastes its answer or picks
// the plants.json file it sent. The AI only lists the plants and where they are: care comes from the catalog
// card each plant matches, or from the generic type it's like.
const IMPORT_PROMPT = `Составьте список моих растений для приложения «Жунгли». Возьмите растения, о которых мы говорили в этом чате (если непонятно какие, спросите меня). Если в чате есть фото растений, определите вид по фото. Если не уверены, выберите самый вероятный и поставьте "guess": true.

Ответьте только JSON-массивом, без пояснений: обычные двойные кавычки, один объект на растение, все растения без сокращений. Если умеете делать файлы, пришлите файл plants.json, если нет, просто напишите JSON текстом.

Поля:
- species: вид или сорт по-русски
- latin: латинское название
- name: имя, если оно есть у растения, иначе ""
- room: комната, где стоит, если она упоминалась (например "Кухня"), иначе ""
- spot: место в комнате: подоконник, полка, стол и т. п., если оно упоминалось, иначе ""
- type: в чём растёт, только если это сказано в чате, иначе "". Варианты: "soil" (грунт), "dry" (грунт для суккулентов и кактусов), "bark_mix" (рыхлая смесь грунта с корой и перлитом, «aroid mix»), "peat" (торф без удобрений, для хищных растений), "sphagnum" (сфагнум), "bark" (кора), "coco" (кокос), "mineral" (пон, пемза, цеолит), "leca" (керамзит), "water" (в воде), "mount" (на блоке, корни на воздухе), "terrarium" (закрытый террариум), "aquarium" (корни в аквариуме)
- watering: как поливают, только если это сказано в чате, иначе "". Варианты: "top" (сверху), "soak" (погружением, горшок в воду), "bottom" (снизу, через поддон), "wick" (фитиль), "reservoir" (резервуар в горшке, кашпо с автополивом), "drip" (капельный автополив)
- like: на что похоже по уходу. Варианты: "easy" (неприхотливое лиственное), "humid" (тропическое влаголюбивое), "succulent" (суккулент), "cactus" (кактус), "flowering" (цветущее), "orchid" (орхидея), "herbs" (травы и рассада)
- guess: true, если вид определён по фото и вы не уверены, иначе false

Пример:
[{"species":"Монстера деликатесная","latin":"Monstera deliciosa","name":"Моня","room":"Кухня","spot":"Подоконник","type":"","watering":"","like":"easy","guess":false}]`;

// Cleans formatting chat apps add, so JSON.parse can read the answer.
function repairJson(src) {
  return src
    .replace(/^\s*\/\/.*$/gm, '') // line comments
    .replace(/[“”„‟″]/g, '"').replace(/[‘’]/g, "'") // typographic quotes
    .replace(/(\d)[\u00a0\u202f ](?=\d{3}\b)/g, '$1') // 8 000 → 8000
    .replace(/,\s*([\]}])/g, '$1'); // trailing commas
}
// Where the `{…}` starting at `a` closes (braces in strings don't count), or -1 if it never does:
// an answer cut off mid-plant.
function objectEnd(t, a) {
  let depth = 0, inStr = false;
  for (let i = a; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && !--depth) return i;
  }
  return -1;
}
// Every plant object in the text, one by one, so text around them, code fences, a missing [ ] or a broken
// plant don't lose the rest. `tail`: an unclosed plant at the end, to join with the next part of the answer.
// `cut`: the answer stops before its list closes. `bad`: closed `{…}` that couldn't be read even after repairs.
function importObjects(t) {
  const objs = [];
  let parsed = false, repaired = false, tail = '', first = -1, last = -1, bad = 0;
  for (let a = t.indexOf('{'); a !== -1;) {
    const b = objectEnd(t, a);
    if (b < 0) { tail = t.slice(a); a = t.indexOf('{', a + 1); continue; }
    let v = null;
    for (const [src, fix] of [[t.slice(a, b + 1), false], [repairJson(t.slice(a, b + 1)), true]]) {
      try { v = JSON.parse(src); repaired ||= fix; break; } catch (e) { /* try the repaired text, then move on */ }
    }
    if (!v) { bad++; a = t.indexOf('{', a + 1); continue; }
    parsed = true; tail = ''; last = b;
    if (first < 0) first = a;
    // A wrapper like {"plants": […]} holds the list; a plant itself has a name.
    const inner = v.species || v.name ? null : Object.values(v).find((x) => Array.isArray(x) && x.some((y) => y && typeof y === 'object'));
    objs.push(...(inner || [v]));
    a = t.indexOf('{', b + 1);
  }
  // A list opened before the first plant but never closed after the last one.
  const cut = !!tail || (first > 0 && t.lastIndexOf('[', first) >= 0 && t.indexOf(']', last) < 0);
  return { objs, parsed, repaired, tail, cut, bad };
}
// The plants in a pasted answer or a file. `carry`: the unclosed end of the previous part, for an answer
// that came in several messages or was continued after «Продолжи».
function parseImport(text, carry = '') {
  const t = String(text || '').trim();
  if (!t) return { error: 'empty' };
  // What the text looked like, without any of its content.
  const diag = { has_code_fence: t.includes('```'), has_curly_quotes: /[“”„]/.test(t), has_spaced_numbers: /\d[\u00a0\u202f ]\d{3}\b/.test(t) };
  const read = (s) => { const r = importObjects(s); return { ...r, items: r.objs.map(normImport).filter(Boolean) }; };
  let res = read(t);
  // This part may carry on the plant the last one broke off, or start over: whichever reads more plants.
  if (carry) { const joined = read(carry + t); if (joined.items.length > res.items.length) res = joined; }
  if (res.items.length) return { items: res.items, repaired: res.repaired, cut: res.cut, tail: res.tail, bad: res.bad };
  if (!t.includes('{')) return { error: 'no_list', diag };
  return { error: res.parsed ? 'no_plants' : 'bad_json', diag: { ...diag, unread: res.bad } };
}
// Common off-format answers: 'succulent', 'orchid', 'грунт'… Not said: ''.
function importType(x) {
  const t = String(x || '').trim().toLowerCase();
  if (!t) return '';
  if (TYPE_NAMES[t]) return t;
  if (/aquar|аквар/.test(t)) return 'aquarium';
  if (/terrar|террар|флорар|бутыл/.test(t)) return 'terrarium';
  if (/mount|блок|коряг|epiphyt/.test(t)) return 'mount';
  // Specific substrates first: «пон, полугидропоника» is pon on a reservoir, not clay pebbles.
  if (/mineral|pumice|zeolit|\bpon\b|минерал|пемз|цеолит|(^|[^а-я])пон([^а-я]|$)/.test(t)) return 'mineral';
  if (/coco|кокос/.test(t)) return 'coco';
  // Before bark: soil mixed with bark («смесь с корой», «aroid mix») is the mix; an orchid's bark mix stays bark, and
  // soil with perlite only stays soil. Peat alone («торф», «верховой торф», «peat moss») is the
  // carnivores' unfed peat; peat-based soil («торфяной грунт», «peat-based potting mix») is ordinary soil.
  if (/aroid|chunky|mix|смес|ароид/.test(t) && /bark|(^|[^а-я])кор(а|ы|е|у|ой)([^а-я]|$)/.test(t) && !/orchid|орхид/.test(t)) return 'bark_mix';
  if (/aroid|chunky|ароид/.test(t)) return 'bark_mix';
  if (/peat|торф/.test(t)) return /грунт|земл|soil|compost|potting|based|mix|смес|универс/.test(t) ? 'soil' : 'peat';
  if (/leca|clay|hydro|semi|керамз|гидро/.test(t)) return 'leca';
  if (/succ|cact|dry|сух|сукк|какт/.test(t)) return 'dry';
  if (/bark|orchid|кор|орхид/.test(t)) return 'bark';
  if (/sphag|moss|сфаг|мох/.test(t)) return 'sphagnum';
  if (/water|вод/.test(t)) return 'water';
  return 'soil';
}
// How a potted plant is watered; older answers put "wick" in `type`. Not said: ''.
function importWatering(x, type) {
  const t = `${x || ''} ${type || ''}`.trim().toLowerCase();
  if (/wick|фитил/.test(t)) return 'wick';
  // Before the reservoir: «капельный автополив» is drip irrigation, «кашпо с автополивом» a reservoir.
  if (/drip|irrigat|капел|таймер|timer/.test(t)) return 'drip';
  if (/reserv|резерв|автопол|self.?water|semi|hydro|гидро/.test(t)) return 'reservoir';
  if (/bottom|снизу|через поддон/.test(t)) return 'bottom';
  if (/soak|immers|dunk|погруж|окуна|замач/.test(t)) return 'soak';
  return String(x || '').trim() ? 'top' : '';
}
// The generic type a plant is like, for plants the catalog doesn't have.
const IMPORT_LIKE = [[/succ|сукк/, 'g-succ'], [/cact|какт/, 'g-cactus'], [/orchid|орхид/, 'g-orchid'], [/flower|bloom|цвет/, 'g-flower'],
  [/herb|seed|трав|рассад/, 'g-herbs'], [/humid|fern|влаг|папорот/, 'g-humid'], [/easy|leaf|foliage|неприхот|листв/, 'g-easy']];
const importLike = (x) => (IMPORT_LIKE.find(([re]) => re.test(String(x || '').toLowerCase())) || [])[1] || '';
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
function normImport(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const str = (x, max = 500) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
  const species = str(o.species, 80) || str(o.name, 80);
  if (!species) return null;
  const type = importType(o.type);
  return {
    species, latin: str(o.latin, 80), name: str(o.name, 40) === species ? '' : str(o.name, 40),
    room: cap(str(o.room, 40)), spot: cap(str(o.spot ?? o.place, 40)),
    type, watering: type && !MEDIA[type].pot ? '' : importWatering(o.watering, o.type),
    like: importLike(o.like), guess: o.guess === true || /^(true|да|yes)$/i.test(String(o.guess ?? '').trim()),
  };
}
// The catalog card for a plant the AI named. A card fits when every word of its name, or of one of its `aka`
// names, is among the AI's words: the Russian name and the Latin one, read as Russian like in the catalog search.
// Short words (up to 4 letters: «Роза», «Хойя») must match whole, so «Роза» isn't «розан» (a hibiscus);
// longer ones may differ in their ending (2 letters at most: «basil» and «базилик») or by a small typo. Prepositions and
// 1–2 letter Russian words don't count, so «Традесканция в воде» doesn't go to «Черенки в воде». The card covering most of the AI's words
// wins, so «Фикус Бенджамина» gets its own card, not «Фикус». Ties go to a card matched by its own name, then
// a specific card over a generic one, then catalog order. No card: null.
const MATCH_SKIP = new Set(['для', 'под', 'без', 'или', 'над', 'при']);
// Short Latin words stay: «ZZ» is a zamioculcas.
const matchWords = (s) => norm(s).split(/[^a-zа-я0-9]+/).filter((w) => (w.length > 2 || /[a-z]/.test(w)) && !MATCH_SKIP.has(w)).map((w) => {
  const ru = /[a-z]/.test(w) ? fromLatin(w) : w;
  return { raw: looseSound(ru), stem: looseSound(searchStem(ru)) };
});
function wordFits(w, t) {
  if (w.raw === t.raw) return true;
  if (w.raw.length < 5 || t.raw.length < 5) return false;
  if (w.stem === t.stem) return true;
  const [a, b] = w.stem.length <= t.stem.length ? [w.stem, t.stem] : [t.stem, w.stem];
  if (b.startsWith(a) && b.length - a.length <= 2) return true;
  return w.stem.length >= 8 && Math.abs(t.stem.length - w.stem.length) <= 2 && nearStart(w.stem, t.stem, w.stem.length >= 11 ? 2 : 1);
}
// AI import matches by the title, the second line and `aka`, not by the content's search `names`: those also carry
// genus-wide names («Эластика» on «Фикус»), which would take a known species to its genus card.
let catalogNames = null;
function catalogCard(it) {
  catalogNames ||= PLANTS.filter((d) => !d.hidden)
    .map((d) => ({ d, names: [d.species, ...String([d.alt, d.aka].filter(Boolean).join(',')).split(',')].map(matchWords).filter((ws) => ws.length) }));
  const words = matchWords(`${it.species} ${it.latin}`);
  let best = null, top = [0, 0, 0];
  catalogNames.forEach(({ d, names }) => {
    const covered = new Set();
    let own = 0;
    names.forEach((ws, k) => {
      const at = ws.map((w) => words.findIndex((t) => wordFits(w, t)));
      if (at.some((i) => i < 0)) return;
      at.forEach((i) => covered.add(i));
      // A generic type's own name is a group word («Орхидея», «Кактус»): it ranks like a folk name, so a plain
      // «Орхидея» stays with «Фаленопсис», the orchid people mean by it.
      if (!k && !d.generic) own = 1;
    });
    const score = [covered.size, own, d.generic ? 0 : 1];
    const better = score.map((x, i) => x - top[i]).find((x) => x) > 0;
    if (covered.size && better) { best = d; top = score; }
  });
  return best;
}
// A plant the catalog doesn't have becomes an own plant like a generic type: the one for its medium
// (water, a block, a terrarium, an aquarium), else the one the AI said it's like. «Эпифит на блоке» is hidden from the
// catalog (a known plant on a block is that plant with «На блоке»), but still the base for an unknown one.
const MEDIUM_LIKE = { water: 'cuttings', mount: 'g-mount', terrarium: 'g-terrarium', aquarium: 'g-aquarium' };
const importBase = (it) => {
  const id = MEDIUM_LIKE[it.type] || it.like || { dry: 'g-succ', bark: 'g-orchid' }[it.type] || 'g-easy';
  return PLANTS.find((d) => d.id === id) || PLANTS.find((d) => d.id === 'g-easy');
};

// «Как узнать, что за растение»: for people who don't know the name. The phone's own apps or an AI chat tell it
// from a photo; nothing goes through Жунгли. Opened from the add sheet (`back`, with the search as it was) or from
// the empty first screen.
const nameHelpLink = (from, text) => `<p class="mt-8 small name-help"><button class="linkish" data-act="name-help" data-from="${from}">${text}</button></p>`;
function openNameHelp(from, back = '', q = '') {
  track('add_help_opened', { from });
  if (addFlow) addFlow.sheet = 'help';
  const search = back
    ? `<button class="mt-10 btn primary wide" data-act="add-back" data-to="name-help"${q ? ` data-q="${esc(q)}"` : ''}>${I('search')}Искать в каталоге</button>`
    : `<button class="mt-10 btn primary wide" data-act="add-plant" data-from="help">${I('search')}Искать в каталоге</button>`;
  $('#sheet-body').innerHTML = `
    ${subHead('Как узнать, что за растение', back, q)}
    <div class="info"><b>Сфотографируйте</b>Лист целиком и растение сбоку, при дневном свете.</div>
    <div class="info"><b>Спросите приложение</b>Умную камеру в приложении Яндекс или Google Lens. Они покажут похожие растения с названиями.</div>
    <div class="info"><b>Или спросите ИИ</b>Отправьте фото в Алису, GigaChat или ChatGPT: ИИ определит растения и сразу соберёт список для Жунглей.
      <button class="mt-10 btn wide" data-act="add-import" data-from="help">${I('bot')}Перенести из чата с ИИ</button></div>
    <div class="info"><b>Найдите в каталоге</b>Сорт не знаете: берите карточку без сорта, например «Диффенбахия». Даже род неясен: «Своё растение» и в нём «На что похоже».
      ${search}</div>`;
  // The way back returns focus to the link that was tapped (there can be two: under the search and after it).
  document.querySelectorAll('#sheet [data-act="add-back"]').forEach((b) => { b.dataset.from = from; });
  openSheet();
}
// How to copy the shown prompt by hand: the gesture that opens the system menu differs by platform.
const PROMPT_HINT = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Нажмите на текст, затем ещё раз. В меню выберите «Выбрать все», потом «Скопировать».'
  : /Android/.test(navigator.userAgent) ? 'Подержите палец на тексте. В меню выберите «Выбрать все», потом «Копировать».'
    : 'Выделите весь текст (Ctrl+A или ⌘A) и скопируйте.';
// The import goes one step at a time, like «Банный день»: 1 copy the prompt, 2 say how the AI answered
// (text or file), 3 paste the text or pick the file, 4 check the list and add. A button that can't do
// anything yet is shown disabled, not hidden. `imp`: where it stands. `items`: the plants read so far:
// pastes and files add up, so an answer in several messages can be pasted part by part. `carry`: the unclosed
// plant at the end of the last part, joined with the next one. `info`: for stats.
let imp = null;
// Where the import stands is kept on the device for a few hours: on a phone the app may reload while the person
// is in the AI chat, and coming back goes on from the same step. Cleared once the plants are added.
const IMPORT_KEY = 'zhungli.import';
const IMPORT_KEEP = 3 * 3600e3;
function saveImport() {
  try {
    // The pasted text itself (`read`) stays out: it can be long, and the field starts empty anyway.
    const { items, picked, info, back, read, ...rest } = imp;
    localStorage.setItem(IMPORT_KEY, JSON.stringify({
      ...rest, t: Date.now(), picked: [...picked], info: { ...info, via: [...info.via] },
      items: items.map(({ card, base, ...it }) => it),
    }));
  } catch (e) { /* private mode or full storage: the import just starts over next time */ }
}
function loadImport() {
  try {
    const d = JSON.parse(localStorage.getItem(IMPORT_KEY) || 'null');
    if (!d || Date.now() - d.t > IMPORT_KEEP || !(d.step > 1 || d.copied)) return null;
    d.items.forEach(importMatch);
    return { ...d, picked: new Set(d.picked), info: { ...d.info, via: new Set(d.info.via) } };
  } catch (e) { return null; }
}
const clearImport = () => { try { localStorage.removeItem(IMPORT_KEY); } catch (e) { /* nothing kept */ } };
// `from`: `sheet` (the add sheet), `help` (name help) or `empty` (an empty page).
function openImport(back = '', from = '') {
  startAddFlow('import');
  const kept = loadImport();
  imp = kept || { step: 1, copied: false, via: '', found: 0, items: [], picked: new Set(), carry: '', info: { via: new Set(), parts: 0, cut: false, repaired: false, unread: 0, ext: '' } };
  imp.back = back;
  imp.found = 0;
  track('add_import_opened', { from, ...(kept && { restored: true, step: imp.step }) });
  // Leaving for the AI chat after copying is the expected path, not abandoning (see visibilitychange).
  if (addFlow) addFlow.promptCopied = imp.copied;
  importStep(imp.step, false);
  openSheet();
}
// Draws a step. `moved`: a step changed by a tap, so focus goes to its question and it's reported with the step
// it came `from` (and `how`, for «Вставить ещё часть» and «Вставить продолжение»).
function importStep(n, moved = true, how = '') {
  const from = imp.step;
  imp.step = n;
  if (n === 3) { imp.found = 0; imp.read = ''; }
  if (n > 1 || imp.copied) saveImport();
  const q = ['Скопируйте запрос для ИИ', 'Как ИИ прислал ответ?', imp.via === 'file' ? 'Выберите файл от ИИ' : 'Вставьте ответ ИИ', 'Проверьте список'][n - 1];
  const back = (to) => `<button class="mt-8 btn ghost wide" data-act="import-step" data-to="${to}">Назад</button>`;
  // The way to ask for help is in the same place on every step: under its buttons.
  const help = `<p class="imp-help small muted" data-from="import">Не получается? Напишите ${outLink('telegram', '@zmoki', 'linkish')}</p>`;
  // Steps 1–3: what the step says on top, its buttons at the bottom of a sheet of the same height on every step.
  // What appears after a tap («Скопировано», «Нашлось 5 растений», an error) takes the free room between them,
  // so nothing on the screen moves and the buttons stay where the finger is.
  let body = '', actions = '';
  if (n === 1) {
    body = `<p class="m-0">И отправьте в DeepSeek, GigaChat, Алису или ChatGPT. Можно приложить фото растений.</p>
      <button class="mt-14 btn${imp.copied ? '' : ' ok'} wide" data-act="import-copy">${imp.copied ? `${I('check')}Скопировано` : `${I('copy')}Скопировать запрос`}</button>
      <div class="small" id="imp-manual"${imp.copied ? '' : ' hidden'}><p class="mt-8 m-0 muted">Чат вставил запрос файлом? Так и должно быть.</p>
        <p class="m-0 copy-help"><button class="linkish" data-act="import-show">Не вставляется? Показать запрос</button></p></div>
      <div id="imp-prompt-box" hidden><p class="mt-8 small muted" id="imp-prompt-hint">${PROMPT_HINT}</p>
        <textarea class="mt-8 input" id="imp-prompt" rows="8" inputmode="none" aria-label="Запрос для ИИ" aria-describedby="imp-prompt-hint" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>
        <button class="mt-8 btn wide" data-act="import-copy-again">${I('copy')}Скопировать ещё раз</button></div>
      <p class="sr-only" id="imp-status" role="status"></p>`;
    actions = `<button class="btn${imp.copied ? ' ok' : ''} wide" data-act="import-step" data-to="2" id="imp-next"${imp.copied ? '' : ' disabled'}>Отправлено, дальше${I('chevron-right')}</button>${help}`;
  } else if (n === 2) {
    const way = (via, icon, label) => `<button class="import-cta mini mt-10" data-act="import-via" data-via="${via}"><span class="pe" aria-hidden="true">${I(icon)}</span>
      <span class="pt"><b>${label}</b></span><span class="pc" aria-hidden="true">${I('chevron-right')}</span></button>`;
    body = `${way('paste', 'bot', 'Текстом в чате')}${way('file', 'file-up', 'Файлом')}
      <p class="mt-12 small muted">Видите значок файла или «Скачать»? Это файл.</p>`;
    actions = `${back(1)}${help}`;
  } else if (n === 3 && imp.via === 'file') {
    // The file is picked on top, and «Проверить список» at the bottom works once it's read.
    body = `<p class="m-0">Сохраните его из чата и выберите здесь.</p>
      <button class="mt-10 btn ok wide" data-act="import-file">${I('file-up')}Выбрать файл</button>
      <div id="imp-note"></div>`;
    actions = `<button class="btn ok wide" id="imp-go"></button>${back(2)}${help}`;
  } else if (n === 3) {
    // A field to paste into, not a button that reads the clipboard: on iPhone such a button needs a second tap on the
    // system «Вставить» bubble, which confused people.
    body = `<p class="m-0">Под ответом нажмите <span class="kbd" role="img" aria-label="«Копировать»">${I('copy')}</span> и вставьте сюда.</p>
      <textarea class="mt-10 input" id="imp-text" rows="5" aria-label="Ответ ИИ" placeholder="Вставьте ответ сюда" spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>
      <div id="imp-note"></div>`;
    actions = `<button class="btn ok wide" id="imp-go"></button>${back(2)}${help}`;
  } else {
    // Another part is a side way, so a link: one big button at the bottom, «Добавить», as on the other steps.
    body = `<div id="imp-head"></div><div id="imp-list"></div>
      <p class="mt-12 small" id="imp-more">Ответ пришёл не целиком? <button class="linkish" data-act="import-more" data-how="more">Вставить ещё часть</button></p>`;
  }
  // Step 4's buttons stay on screen while the list scrolls (a sticky bar, a direct child of the tall column).
  const foot = n === 4
    ? `<div class="pick-bar imp-actions" id="imp-bar"><button class="btn ok wide" data-act="import-add" id="imp-add" disabled>Ничего не выбрано</button>${help}</div>`
    : `<div class="imp-actions">${actions}</div>`;
  $('#sheet-body').innerHTML = `${subHead('Перенести из чата с ИИ', imp.back)}<div class="imp-flow imp-fixed"><div>
    <p class="small muted m-0">Шаг ${n} из 4</p><h3 class="sec-title mt-6" id="imp-q" tabindex="-1">${q}</h3>${body}</div>${foot}</div>`;
  const ta = $('#imp-text');
  if (ta) {
    // A paste is read right away; typed or edited text waits for «Найти растения», which works once there's text.
    ta.addEventListener('paste', () => setTimeout(importPasted, 0, 'paste'));
    ta.addEventListener('input', importGo);
  }
  if (n === 3) importGo();
  if (n === 4) renderImportList();
  if (moved) {
    $('#imp-q').focus();
    track('add_import_step_shown', { step: n, from_step: from, ...(n > 2 && { via: imp.via }), ...(how && { how }) });
  }
}
// Step 3's main button. Text waiting to be read: «Найти растения». Plants in the list (found now, or from an
// earlier part when the person came back with «Вставить ещё часть»): «Проверить список», so the list is never out of
// reach. Neither: disabled, «Найти растения» for text, «Проверить список» for a file (picked with the button above).
function importGo() {
  const go = $('#imp-go'), ta = $('#imp-text');
  if (!go) return;
  // Text already read (found plants or not) isn't waiting any more.
  const waiting = !!ta && !!ta.value.trim() && ta.value !== imp.read;
  const list = !waiting && (imp.items.length > 0 || !ta);
  go.disabled = !waiting && !imp.items.length;
  go.dataset.act = list ? 'import-step' : 'import-read';
  go.dataset.to = '4';
  go.innerHTML = list ? `Проверить список${I('chevron-right')}` : 'Найти растения';
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
      $('#imp-prompt-hint').textContent = 'Текст менять не нужно: только «Выбрать все» и «Скопировать».';
    });
    ta.addEventListener('input', () => { if (ta.value !== IMPORT_PROMPT) ta.value = IMPORT_PROMPT; });
  }
}
// Plant lists are a few kilobytes; a much bigger file is something else (a photo, a document).
const IMPORT_MAX = 1e6;
// Reads the file the AI sent. For stats only the kind of file goes out
// (json / txt / other): what follows the dot can be part of a name («Растения.Коля»).
async function importFile(f) {
  const dot = f.name.lastIndexOf('.');
  const ext = { json: 'json', txt: 'txt' }[dot < 0 ? '' : f.name.slice(dot + 1).toLowerCase()] || 'other';
  if (f.size > IMPORT_MAX) { readImport(null, 'file', ext, 'too_big'); return; }
  let text = null;
  try { text = (await f.text()).replace(/^\uFEFF/, ''); } catch (e) { /* unreadable */ }
  readImport(text, 'file', ext);
}
// Reads what's in the answer field. `how` it got there, for stats: 'paste' (pasted into the field),
// 'button' («Найти растения» after typing or editing).
function importPasted(how) {
  const ta = $('#imp-text');
  if (!ta || !ta.value.trim()) return;
  const text = ta.value;
  readImport(text.length > IMPORT_MAX ? null : text, 'paste', '', text.length > IMPORT_MAX ? 'too_big' : '', how);
}
// A backup picked here by mistake: it has no plant list for import, but can be restored in settings.
function isBackup(text) {
  try { const d = JSON.parse(text); return !!d && d.app === 'zhungli' && !!d.state; } catch (e) { return false; }
}
// A plant's catalog card, or the generic type it's like when the catalog lacks it.
function importMatch(it) {
  it.card = catalogCard(it);
  if (!it.card) it.base = importBase(it);
}
// One part of the answer (a paste or a file), on step 3: its plants join the list, and the step says how many
// were found, with «Проверить список» to go on (the screen doesn't change by itself). A part with no plants says
// why and leaves the list as it was.
function readImport(text, via, ext = '', fail = '', how = via) {
  const res = fail ? { error: fail } : text === null ? { error: 'unreadable' } : isBackup(text) ? { error: 'backup' } : parseImport(text, imp.carry);
  const note = $('#imp-note');
  if (!note) return;
  if (via === 'paste') imp.read = $('#imp-text')?.value ?? '';
  const where = via === 'file' ? 'этом файле' : 'этом тексте';
  if (res.error) {
    note.innerHTML = res.error === 'backup'
      ? '<p class="mt-10 error-note small">Это резервная копия Жунглей, а не ответ ИИ. Её можно восстановить в настройках: «Резервная копия» → «Восстановить».</p>'
      : `<p class="mt-10 error-note small">${{ unreadable: 'Не получилось открыть этот файл.', too_big: `В ${where} слишком много текста для списка растений. Похоже, это не то.`, empty: 'Файл пустой.' }[res.error] || `В ${where} не нашлось списка растений.`} Нужен ответ ИИ на запрос из шага 1.</p>`;
    announce(note.textContent);
    track('add_import_answer_failed', { via, how, length: text ? text.length : 0, reason: res.error, ...(via === 'file' && { file_ext: ext }), ...(res.diag || {}) });
    importGo();
    return;
  }
  imp.carry = res.tail || '';
  imp.info.via.add(via);
  imp.info.cut = res.cut;
  imp.info.repaired ||= res.repaired;
  if (via === 'file') imp.info.ext = ext;
  // A plant from a part pasted twice, or repeated by the AI when it carried on, is listed once: a plant already
  // read from an earlier part is skipped, as many times as it was there. Repeats inside one part stay, since two
  // unnamed aloes can share a windowsill.
  const key = (it) => [it.species, it.name, it.room, it.spot].map(norm).join('|');
  const earlier = new Map();
  imp.items.forEach((it) => earlier.set(key(it), (earlier.get(key(it)) || 0) + 1));
  const fresh = res.items.filter((it) => {
    const n = earlier.get(key(it));
    if (n) earlier.set(key(it), n - 1);
    return !n;
  });
  // Plants already in the collection (same species and name) start unticked.
  const have = new Set(allPlants().map((p) => `${norm(p.species)}|${norm(p.name)}`));
  fresh.forEach((it) => {
    importMatch(it);
    it.dup = have.has(`${norm(it.species)}|${norm(it.name)}`);
    if (!it.dup) imp.picked.add(imp.items.length);
    imp.items.push(it);
  });
  imp.found = fresh.length;
  // A part pasted again adds nothing: it isn't another part, and its unreadable plants were counted already.
  if (fresh.length) {
    imp.info.parts++;
    imp.info.unread = (imp.info.unread || 0) + res.bad;
  }
  saveImport();
  track('add_import_answer_read', {
    via, how, found: fresh.length, total: imp.items.length, repeated: res.items.length - fresh.length, unread: res.bad, cut: res.cut,
    repaired: res.repaired, matched: fresh.filter((it) => it.card).length, ...(via === 'file' && { file_ext: ext }),
  });
  const first = imp.items.length === fresh.length;
  const said = !fresh.length ? 'Эти растения уже в списке' : first ? `Нашлось ${plantsN(fresh.length)}` : `Нашлось ещё ${fresh.length}, всего ${plantsN(imp.items.length)}`;
  // A plant the AI wrote with a mistake is skipped, and said so: the person can ask the AI for it again.
  const lost = res.bad ? `${plantsN(res.bad)} ${plural(res.bad, 'не прочиталось', 'не прочитались', 'не прочиталось')}. Попросите ИИ прислать ${res.bad === 1 ? 'его' : 'их'} ещё раз.` : '';
  note.innerHTML = `<p class="mt-10 imp-ok">${I('check')}${said}</p>${lost ? `<p class="mt-6 m-0 small">${lost}</p>` : ''}`;
  announce(`${said}. ${lost}`.trim());
  // Found: «Проверить список» is the one main button now.
  $('#sheet [data-act="import-file"]')?.classList.remove('ok');
  importGo();
}
// Step 4: the plants found, ticked except those already in the collection.
function renderImportList() {
  const have = new Set(allPlants().map((p) => `${norm(p.species)}|${norm(p.name)}`));
  const n = imp.items.length;
  const inHave = (it) => have.has(`${norm(it.species)}|${norm(it.name)}`);
  $('#imp-head').innerHTML = imp.info.cut
    ? `<div class="info"><b>Ответ оборвался</b>Напишите ИИ «Продолжи».
      <button class="mt-10 btn wide" data-act="import-more" data-how="continue">${I('plus')}Вставить продолжение</button></div>`
    // All of them already in the collection: nothing is ticked, so say how to add them anyway.
    : `<p class="m-0 small muted">${!imp.items.every(inHave) ? 'Снимите галочку с лишних.' : `${n === 1 ? 'Это растение уже' : 'Все уже'} в коллекции. Отметьте, если нужны ещё раз.`}</p>`;
  // With «Вставить продолжение» on top, the button under the list would say the same.
  $('#imp-more').hidden = imp.info.cut;
  $('#imp-list').innerHTML = imp.items.map((it, i) => {
    const ticked = imp.picked.has(i);
    const sub = [inHave(it) ? 'уже есть в коллекции' : '', ...[it.room, it.spot].filter(Boolean).map(typedHtml),
      it.card ? '' : 'нет в каталоге', it.guess ? 'по фото, проверьте' : ''].filter(Boolean).join(' · ');
    const pic = it.card || { species: it.species, type: it.type || it.base.type };
    return `<button class="pick strip${ticked ? ' on' : ''}" data-act="import-pick" data-i="${i}" aria-pressed="${ticked}">
      <span class="pe fit" aria-hidden="true">${plantSvg(pic, 'fine', true)}</span><span class="pt"><b>${[it.name, it.species].filter(Boolean).map(typedHtml).join(' · ')}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      <span class="pc" aria-hidden="true">${I(ticked ? 'check' : 'plus')}</span></button>`;
  }).join('');
  updateImportBar();
}
// The add button stays in place: disabled with nothing ticked.
const updateImportBar = () => setAddButton($('#imp-add'), imp.picked.size, 'Ничего не выбрано');
// A plant with a catalog card: added like one from the catalog, keeping the AI's name for it as the species
// («Монстера Тай Констеллейшн» on «Монстера деликатесная»). A medium or watering the chat mentioned is set as if
// picked in the plant card, without the «just repotted» pause: the plant already grows that way.
function importCard(it, i, place) {
  const d = it.card, id = newId('p', i);
  const r = S.plants[id] = { ...runtime(d, firstCheck(i, d.every)), def: d.id, medium: mediumIn({}, d), ...place };
  if (norm(it.species) !== norm(d.species)) r.species = it.species;
  if (it.type || it.watering) {
    const medium = it.type || mediumIn(r, d);
    let watering = it.watering || wateringIn(r, d);
    if (it.type && !it.watering && MEDIA[medium].watering && (!watering || watering === 'top')) watering = MEDIA[medium].watering;
    if (setWay(id, medium, watering)) { r.repotted = false; r.nextCheck = firstCheck(i, Math.round(r.interval)); }
  }
  return id;
}
// A plant the catalog lacks: an own card from the generic type it's like, as «Своё растение» makes it.
// The type's check question and care tips fit only its own medium: on another one they're left out.
function importOwn(it, i, place) {
  const base = it.base, id = newId('c', i);
  const type = it.type || base.type;
  const watering = MEDIA[type].pot ? it.watering || MEDIA[type].watering || 'top' : '';
  const own = type === base.type && (!watering || watering === 'top');
  const every = own ? base.every : wayStart(wayOf({ type, watering }), base.every, base.lux[0]);
  const care = type === base.type ? { check: base.check, water: base.water, soil: base.soil, cond: base.cond } : {};
  S.custom[id] = {
    id, species: it.species, cat: 'Мои', emoji: base.emoji || '🪴', ...care, humid: base.humid, big: base.big,
    lux: [...base.lux], every, type, ...(watering && watering !== 'top' ? { watering } : {}), tip: base.tip || '', quips: base.quips || GENERIC_QUIPS,
  };
  S.custom[id].tone = toneOf(S.custom[id]);
  S.plants[id] = { ...runtime(S.custom[id], firstCheck(i, every)), ...place };
  return id;
}
function addImported() {
  if (addFlow) addFlow.done = true;
  const picked = [...imp.picked].sort((a, b) => a - b).map((i) => imp.items[i]);
  const every = (it) => (it.card || it.base).every;
  const list = [...picked].sort((a, b) => every(a) - every(b));
  // A new collection where every plant has a room keeps no empty default «Комната»: the first imported room takes its place.
  const first = S.rooms[0];
  let rename = !Object.keys(S.plants).length && S.rooms.length === 1 && first.t == null && first.name === 'Комната' && list.every((it) => it.room);
  const roomsBefore = S.rooms.length;
  // Rooms come in the order the AI listed them (plants below are sorted by how often to check them).
  picked.forEach((it) => { if (it.room) { importRoom(it.room, rename); rename = false; } });
  list.forEach((it, i) => {
    // Reuse a place that differs only in case («подоконник» → «Подоконник»).
    const spot = it.spot && (S.spots.find((x) => norm(x) === norm(it.spot)) || it.spot);
    if (spot && !S.spots.includes(spot)) S.spots.push(spot);
    const place = { name: it.name, spot, room: importRoom(it.room, false) };
    const id = it.card ? importCard(it, i, place) : importOwn(it, i, place);
    if (it.guess) S.plants[id].notes = ['ИИ определил вид по фото, стоит проверить.'];
  });
  initBonus(S);
  save();
  const noSpot = list.filter((it) => !it.spot).length;
  const carded = list.filter((it) => it.card);
  track('add_finished', {
    count: list.length, generic_count: carded.filter((it) => it.card.generic).length, catalog_ids: carded.map((it) => it.card.id),
    own_count: list.length - carded.length, guess_count: list.filter((it) => it.guess).length,
    found: imp.items.length, already: imp.items.filter((it) => it.dup).length,
    source: 'import', via: imp.info.via.size > 1 ? 'both' : [...imp.info.via][0], parts: imp.info.parts, cut: imp.info.cut,
    repaired: imp.info.repaired, unread: imp.info.unread || 0, ...(imp.info.ext && { file_ext: imp.info.ext }),
    with_room: list.filter((it) => it.room).length, with_spot: list.length - noSpot, rooms_created: S.rooms.length - roomsBefore,
  });
  clearImport();
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

/* ---------- Taps while adding ---------- */
Object.assign(ACTS, {
  // Choosing another way to add ends the quick picks (see endQuick).
  'add-plant'(el) { endQuick('catalog'); openAdd(false, el.dataset.from || ''); },
  // From inside the add sheet, the next sheet gets a way back to it.
  'add-custom'(el) { openCustom(el.dataset.q || '', el.dataset.q ? 'search_miss' : 'sheet', el.closest('#sheet') ? 'add-custom' : ''); },
  'add-import'(el) {
    endQuick('import');
    const inSheet = !!el.closest('#sheet');
    openImport(inSheet ? 'add-import' : '', el.dataset.from || (inSheet ? 'sheet' : 'empty'));
  },
  // From the add sheet the way back keeps the search; from the empty screen the sheet only closes.
  'name-help'(el) {
    const inAdd = !!el.closest('#sheet');
    openNameHelp(el.dataset.from, inAdd ? 'name-help' : '', inAdd ? $('#pick-q')?.value.trim() || '' : '');
  },
  'add-back'(el) {
    const form = $('#add-form');
    if (form) customDraft = { ...Object.fromEntries(new FormData(form)), tuneOpen: form.querySelector('.tune').open };
    openAdd(true);
    if (!el.dataset.q) { $(`#sheet [data-act="${el.dataset.to}"]:not([data-q])${el.dataset.from ? `[data-from="${el.dataset.from}"]` : ''}`)?.focus(); return; }
    // The search comes back as it was, but it isn't a new search: add_catalog_searched isn't sent again.
    const q = $('#pick-q');
    q.value = el.dataset.q;
    q.dispatchEvent(new CustomEvent('input', { detail: 'restore' }));
    // Focus goes back to the button that was tapped, or to «Добавить как своё» when that was the way out.
    const which = `#sheet [data-act="${el.dataset.to}"]${el.dataset.from ? `[data-from="${el.dataset.from}"]` : ''}`;
    const shown = [...document.querySelectorAll(which)].find((b) => b.offsetParent);
    (shown || $('#pick-none [data-act="add-custom"]'))?.focus();
  },
  pick(el) {
    const k = el.dataset.key;
    if (picked.has(k)) picked.delete(k); else picked.add(k);
    if (addFlow) addFlow.picked = picked.size;
    el.classList.toggle('on', picked.has(k));
    el.querySelector('.pc').innerHTML = I(picked.has(k) ? 'check' : 'plus');
    updatePickBar();
  },
  'pick-add'() {
    if (addFlow) addFlow.done = true;
    addFromCatalog([...picked], 'catalog');
  },
  'import-file'() {
    // The file picker hides the app on phones: that's part of importing, not leaving (see visibilitychange).
    if (addFlow) addFlow.picking = true;
    $('#ai-file-input').click();
  },
  'import-copy'(el) {
    if (addFlow) addFlow.promptCopied = true;
    copyPrompt(el, (how) => {
      track('add_import_prompt_copied', { how });
      if (!el.isConnected) return; // the sheet was closed (maybe reopened) meanwhile
      // Copied, or shown to copy by hand: either way the next step opens up, and copying is no longer the main action.
      // Kept on the device: people go to the AI chat right from here, and the app may reload meanwhile.
      imp.copied = true;
      saveImport();
      el.classList.remove('ok');
      const next = $('#imp-next');
      next.disabled = false;
      next.classList.add('ok');
      if (how === 'failed' || how === 'none') {
        showPrompt();
        el.textContent = 'Не скопировалось, текст ниже';
        $('#imp-status').textContent = 'Не скопировалось. Запрос показан ниже, скопируйте его вручную.';
        return;
      }
      el.innerHTML = `${I('check')}Скопировано`;
      $('#imp-status').textContent = 'Запрос скопирован';
      // Copying can still fail without a word (iPhone): the prompt itself is one tap away.
      $('#imp-manual').hidden = false;
    });
    el.focus();
  },
  'import-show'() { showPrompt(); track('add_import_prompt_opened'); },
  'import-read'() { importPasted('button'); },
  'import-step'(el) { importStep(Number(el.dataset.to)); },
  'import-via'(el) { imp.via = el.dataset.via; importStep(3); },
  // «Вставить ещё часть» or «Вставить продолжение»: back to step 3 the same way (text or file), the list kept.
  'import-more'(el) { importStep(3, true, el.dataset.how); },
  'import-copy-again'(el) {
    copyPrompt(el, (how) => {
      track('add_import_prompt_copied', { how, from: 'again' });
      if (!el.isConnected) return;
      const ok = how === 'exec' || how === 'clipboard';
      el.innerHTML = ok ? `${I('check')}Скопировано` : 'Скопируйте из поля выше';
      $('#imp-status').textContent = ok ? 'Запрос скопирован' : 'Не скопировалось. Скопируйте текст из поля: «Выбрать все», затем «Скопировать».';
    });
  },
  'import-pick'(el) {
    const i = Number(el.dataset.i);
    if (imp.picked.has(i)) imp.picked.delete(i); else imp.picked.add(i);
    if (addFlow) addFlow.picked = imp.picked.size;
    el.classList.toggle('on', imp.picked.has(i));
    el.setAttribute('aria-pressed', imp.picked.has(i));
    el.querySelector('.pc').innerHTML = I(imp.picked.has(i) ? 'check' : 'plus');
    updateImportBar();
    saveImport();
  },
  'import-add'() { addImported(); },
});
