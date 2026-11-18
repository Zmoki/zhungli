/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// «Как работают Жунгли»: one story per screen, opened from the empty «Сегодня».
// The screens are the app's own views drawn for a sample garden: S is swapped for a sample state only while the
// markup is built, then taps, ids and links are stripped, so nothing in a story reaches the person's data.
// Each screen plays a short animation once (again on coming back): a finger taps, types or scrolls. Stories never move on by themselves: a tap on the right goes on, on the left back,
// × skips them (keyboard: arrows, or the «Назад» / «Дальше» buttons that show on focus). The last one depends on
// where Жунгли is open: on an iPhone browser or in another app's browser, plants ticked there wouldn't reach the
// installed app, so it shows the way there.

/* ---------- A sample garden ---------- */
// [catalog id, spot, next check in days, own fields]. Three checks are due today; the zamioculcas (sample3) is
// the happy one whose card the third story opens, so it has a few weeks of answers.
const ago = (...pairs) => pairs.map(([n, a]) => ({ d: addDays(today(), -n), a }));
const SAMPLE = [['mon-del', 'Подоконник', 0], ['pothos', 'Полка', 0], ['spath', 'Стол', 0],
  ['zz', 'Подоконник', 3, { lastWater: addDays(today(), -6), hist: ago([6, 'water'], [13, 'wet'], [19, 'water'], [33, 'water']) }],
  ['chlorophytum', 'Полка', 2], ['sansevieria', 'Стол', 9], ['phal', 'Подоконник', 4]];
// For «Растения»: every kind of chip has someone in it (суховато, темновато, ярковато, напоено, хорошо, в теплице, в воде).
const SAMPLE_RICH = [['mon-del', 'Подоконник', 0], ['ficus-lyrata', 'Подоконник', 0], ['calathea', 'Подоконник', 3, { greenhouse: true }],
  ['fittonia', 'Подоконник', 2, { greenhouse: true }], ['pothos', 'Полка', 0], ['chlorophytum', 'Полка', 6, { lastWater: today(), hist: ago([0, 'water']) }],
  ['cuttings', 'Полка', 4], ['zz', 'Стол', 3, { lux: 800 }], ['phal', 'Стол', 4, { lux: 30000 }], ['spath', 'Стол', 2]];
function sampleGarden(list = SAMPLE) {
  const s = prepare(null);
  Object.assign(s, { statsNotice: true, hideInstall: true, hideTelegram: true, stayBrowser: today(), spots: ['Подоконник', 'Полка', 'Стол'] });
  list.forEach(([k, spot, inDays, own], i) => {
    const d = PLANTS.find((x) => x.id === k);
    const watered = addDays(today(), -8);
    s.plants['sample' + i] = { ...runtime(d, addDays(today(), inDays)), def: d.id, medium: mediumIn({}, d), spot,
      lastWater: watered, hist: [{ d: watered, a: 'water' }], ...own };
  });
  initBonus(s);
  return s;
}
// Builds markup with `state` as S, and puts the person's own state back whatever happens.
function onSample(state, build) {
  const own = S;
  S = state;
  try { return build(); } finally { S = own; }
}
// Markup → elements with every tap, id and link taken out. `prep` runs first, to tag what the story needs from them.
const STRIP = ['data-act', 'data-open', 'data-tab', 'data-id', 'data-field', 'data-key', 'data-from', 'data-out', 'data-room', 'data-spot',
  'id', 'for', 'target', 'aria-controls', 'aria-labelledby', 'aria-describedby'];
const mark = (pairs) => (box) => Object.entries(pairs).forEach(([cls, sel]) => box.querySelector(sel)?.classList.add(cls));
function tame(html, prep) {
  const box = document.createElement('div');
  box.innerHTML = html;
  prep?.(box);
  box.querySelectorAll('*').forEach((el) => STRIP.forEach((a) => el.removeAttribute(a)));
  box.querySelectorAll('a[href]').forEach((a) => a.removeAttribute('href')); // links only: icons are <use href>
  return box;
}

/* ---------- Frames ---------- */
// A phone showing a whole screen of the app, scaled down to fit. Only to look at: inert and hidden from screen readers.
// The screen is laid out as on a 375 × 812 phone with the default text size: rem follows the person's text size
// (iPhone «Размер текста»), so the virtual screen grows with it and the picture stays the same, only scaled.
// `tabKey`: the tab bar with that tab on; none for a sheet, which covers the bar in the app.
function phone(box, tabKey) {
  const f = document.createElement('div');
  f.className = 'phone';
  f.inert = true;
  f.setAttribute('aria-hidden', 'true');
  f.innerHTML = '<i class="blob"></i><div class="screen"></div><span class="finger"></span>';
  f.dataset.tab = tabKey || '';
  setScreen(f, box);
  return f;
}
// New content for a phone's screen (the next frame of an animation); the finger stays.
function setScreen(f, box, extra = '') {
  const screen = f.querySelector('.screen');
  screen.replaceChildren(...box.childNodes);
  if (f.dataset.tab) {
    const tabs = document.querySelector('.tabs').cloneNode(true);
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === f.dataset.tab));
    screen.append(tame(tabs.outerHTML).firstElementChild);
  }
  if (extra) screen.insertAdjacentHTML('beforeend', extra);
  applySizes(screen);
}
function fitPhones(root) {
  const em = parseFloat(getComputedStyle(document.documentElement).fontSize) / 17;
  root.querySelectorAll('.phone').forEach((f) => {
    const w = 375 * em, scr = f.querySelector('.screen');
    Object.assign(scr.style, { width: `${w}px`, height: `${812 * em}px`, transform: `scale(${f.clientWidth / w})` });
  });
}

/* ---------- Animation ---------- */
const STILL = matchMedia('(prefers-reduced-motion: reduce)');
let storyTimers = [];
const stopStory = () => { storyTimers.forEach(clearTimeout); storyTimers = []; };
// Runs steps one after another ([delay ms, fn]). With reduced motion, all at once: the story shows its last frame.
// The pace is slow on purpose: each step stretches by PACE, and the first waits for the story's line to be read.
const START = 0, PACE = 1.8;
function runSteps(steps) {
  stopStory();
  let t = START;
  steps.forEach(([ms, fn]) => { if (STILL.matches) fn(true); else storyTimers.push(setTimeout(fn, (t += ms * PACE))); });
  // Then the finger goes away.
  if (steps.length && !STILL.matches) storyTimers.push(setTimeout(() => storiesDlg.querySelectorAll('.finger').forEach((x) => x.classList.remove('on')), t + 1200));
}
// The finger moves to an element in the phone and taps it.
function tapAt(f, el) {
  const finger = f.querySelector('.finger');
  if (!el || STILL.matches) return;
  const r = el.getBoundingClientRect(), fr = f.getBoundingClientRect();
  finger.style.left = `${r.left - fr.left + r.width / 2}px`;
  finger.style.top = `${r.top - fr.top + r.height / 2}px`;
  finger.classList.remove('tap');
  void finger.offsetWidth; // restart the tap ring
  finger.classList.add('on', 'tap');
}
// Scrolls a phone's screen to `to` over 0.8 s (smooth scrollTo doesn't run on an inert element).
function glide(scr, to, now) {
  const from = scr.scrollTop, t0 = performance.now();
  if (now) { scr.scrollTop = to; return; }
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 800);
    scr.scrollTop = from + (to - from) * (1 - (1 - p) ** 3);
    if (p < 1 && scr.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const typeInto = (input, text, now) => {
  if (now) { input.value = text; return; }
  [...text].forEach((c, i) => storyTimers.push(setTimeout(() => { input.value += c; }, 600 + i * 300)));
};

/* ---------- The stories ---------- */
let storyI = 0, storyMax = 0, storyEnded = '', ticked = new Set();
// Where the last story leads: plants added here stay put (tiles), or have to go somewhere else first.
function storyEnd() {
  if (MINI_APP) return 'tiles';
  if (IN_TELEGRAM) return 'telegram';
  if (IN_APP) return 'in_app';
  if (IOS && !navigator.standalone) return 'ios';
  return 'tiles';
}
// The first steps to the home screen, by browser and version. Safari 26 on iPhone hides «Поделиться» in the menu
// «≡» at the left of the address bar; older Safari has it in the bottom bar, on iPad at the top. Other iPhone
// browsers (Chrome, Firefox, Edge, Яндекс) add to the home screen from their own «Поделиться». The share sheet a
// page can open (navigator.share) has no «На экран Домой» (checked on an iPhone, Safari 26), so it's steps only.
// Which Safari is this: `26` (iPhone, menu «≡» in the address bar), `old` (iPhone, «Поделиться» in the bottom bar),
// or '' (iPad, other browsers): those get the steps as text, without the animated Safari.
function safariKind() {
  const ua = navigator.userAgent;
  if (!/iPhone|iPod/.test(ua) || /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//.test(ua)) return '';
  return Number((ua.match(/Version\/(\d+)/) || [])[1] || 0) >= 26 ? '26' : 'old';
}
function homeSteps() {
  const sk = safariKind();
  const share = sk === '26' ? ['Нажмите «≡» слева в адресной строке', 'Выберите «Поделиться»']
    : sk === 'old' ? ['Нажмите «Поделиться» внизу экрана']
      : /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//.test(navigator.userAgent) ? ['Нажмите «Поделиться» в адресной строке или в меню браузера']
        : ['Нажмите «Поделиться» вверху справа']; // Safari on iPad
  return [...share, 'Выберите «На экран Домой», затем «Добавить»', 'Откройте Жунгли с новой иконки'];
}
// A drawn iPhone Safari with this page in it, and the way to the home screen played out on it: the menu (Safari 26),
// the share sheet, «На экран Домой», «Добавить», and the new icon. Only to look at; the caption under it says each step.
const SF = {
  menu: '<svg viewBox="0 0 24 24" class="sf-ic"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  share: '<svg viewBox="0 0 24 24" class="sf-ic"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>',
  reload: '<svg viewBox="0 0 24 24" class="sf-ic"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>',
  tabs: '<svg viewBox="0 0 24 24" class="sf-ic"><rect x="7" y="7" width="13" height="13" rx="3"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>',
  back: '<svg viewBox="0 0 24 24" class="sf-ic"><path d="M15 5l-7 7 7 7"/></svg>',
  book: '<svg viewBox="0 0 24 24" class="sf-ic"><path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"/></svg>',
};
function safariPhone(kind) {
  const page = tame(onSample(prepare(null), viewToday));
  const icon = '<img class="sf-app" src="icons/icon-180.png" alt="">';
  const bar = kind === '26'
    ? `<div class="sf-bar"><span class="sf-round">${SF.back}</span><span class="sf-url"><b class="sf-menu-btn">${SF.menu}</b><span>zhungli.zmoki.xyz</span>${SF.reload}</span><span class="sf-round">${SF.tabs}</span></div>`
    : `<div class="sf-bar old"><span class="sf-url">zhungli.zmoki.xyz</span><div class="sf-row">${SF.back}<span class="sf-dim">${SF.back}</span><b class="sf-share-btn">${SF.share}</b>${SF.book}${SF.tabs}</div></div>`;
  const box = document.createElement('div');
  box.innerHTML = `<div class="sf">
    <div class="sf-page"></div>${bar}
    <div class="sf-menu"><span>Добавить закладку</span><b class="sf-share-item">${SF.share}Поделиться</b><span>Найти на странице</span></div>
    <div class="sf-sheet"><div class="sf-sheet-head">${icon}<span><b>Жунгли</b><small>zhungli.zmoki.xyz</small></span></div>
      <div class="sf-apps"><i></i><i></i><i></i><i></i></div>
      <div class="sf-list"><span>Скопировать</span><span>Добавить в «Избранное»</span><b class="sf-home-item">На экран «Домой»</b></div></div>
    <div class="sf-add"><div class="sf-add-bar"><span>Отменить</span><b>На экран «Домой»</b><b class="sf-add-btn">Добавить</b></div>
      <div class="sf-add-card">${icon}<span><b>Жунгли</b><small>zhungli.zmoki.xyz</small></span></div></div>
    <div class="sf-home"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><span class="sf-new">${icon}<small>Жунгли</small></span></div>
  </div>`;
  box.querySelector('.sf-page').append(...page.childNodes);
  return phone(box, '');
}
// The animation: each step shows a layer (data-step on the phone) after the finger taps what leads to it.
// It plays once; then «Показать ещё раз» (`again`) starts it over. Not looped: moving content that runs on by itself
// would need a way to pause it (WCAG 2.2.2).
function safariSteps(f, again, kind) {
  const go = (step, target) => [
    [1300, (now) => { if (!now) tapAt(f, f.querySelector(target)); }],
    [450, () => { f.dataset.step = step; }],
  ];
  return [...(kind === '26' ? go('menu', '.sf-menu-btn') : []), ...go('sheet', kind === '26' ? '.sf-share-item' : '.sf-share-btn'),
    ...go('add', '.sf-home-item'), ...go('home', '.sf-add-btn'), ...go('home', '.sf-new'), [900, () => { again.hidden = false; }]];
}
const steps = (list) => `<ol class="st-steps">${list.map((t) => `<li>${t}</li>`).join('')}</ol>`;
const tgButton = (label, cls = 'ghost') => `<a class="btn st-btn ${cls}" href="${MINI_APP_LINK}" data-act="open-mini-app" data-story-end="telegram">${I('sprout')}${label}</a>`;

const STORIES = [
  { tab: 'today', name: 'Сегодня', h: 'Несколько растений в день', p: 'По вашим ответам Жунгли подстроят полив под каждое.', build: todayStory },
  { tab: 'plants', name: 'Растения', h: 'Вся коллекция по местам', p: 'Мордочки показывают, кому что нужно.', build: plantsStory },
  { tab: 'plants', name: 'Карточка растения', h: 'У каждого своя карточка', p: 'Уход, история полива и ваши заметки.', build: cardStory },
  { tab: 'light', name: 'Свет', h: 'Кому темно, кому ярко', p: 'Впишите замер люксметра.', build: lightStory },
  { tab: 'room', name: 'Комната', h: 'Температура и влажность', p: 'Впишите показания датчика.', build: roomStory },
  { name: 'Начнём', build: endStory },
];

// 1. «Сегодня»: the checks get answered one by one («Полито», «Ещё влажно», «Полито»), with the real toasts,
// until «Джунгли довольны!».
function todayStory(slide) {
  const st = sampleGarden();
  const f = phone(tame(onSample(st, viewToday)), 'today');
  slide.append(f);
  const answer = (a) => [
    [1300, (now) => {
      const card = f.querySelector('.task:not(.bonus):not(.done-row)');
      if (!now) tapAt(f, card?.querySelector(a === 'water' ? '.btns .btn.water' : '.btns .btn:not(.water)'));
    }],
    [500, (now) => {
      const msg = onSample(st, () => {
        const id = todayPlan().shown[0]?.id;
        if (!id) return '';
        if (a === 'water') { actWater(id); return WATER_CHEERS[0]; }
        actWet(id);
        return `Ок, загляну к ${plant(id).title} ${rel(S.plants[id].nextCheck)} 👌`;
      });
      setScreen(f, tame(onSample(st, viewToday)), now || !msg ? '' : `<div class="toast">${esc(msg)}</div>`);
    }],
  ];
  return [...answer('water'), ...answer('wet'), ...answer('water')];
}
// 2. «Растения»: the grid, then the «суховато» chip filters it.
function plantsStory(slide) {
  const f = phone(tame(onSample(sampleGarden(SAMPLE_RICH), viewPlants)), 'plants');
  slide.append(f);
  // A chip tapped: only its plants stay, as the app's own filter does («Все» is key '').
  const filter = (key) => (now) => {
    const chip = f.querySelector(`.st-chip[data-st="${key}"]`);
    if (!now) tapAt(f, chip);
    f.querySelectorAll('.st-chip.on').forEach((c) => c.classList.remove('on'));
    chip?.classList.add('on');
    f.querySelectorAll('.pcard').forEach((c) => { c.hidden = !!key && !c.dataset.st.split(' ').includes(key); });
    f.querySelectorAll('.pgroup').forEach((g) => { g.hidden = ![...g.querySelectorAll('.pcard')].some((c) => !c.hidden); });
  };
  return [[1300, filter('need')], [1700, filter('greenhouse')], [1700, filter('')]];
}
// 3. The plant card of a happy zamioculcas: it scrolls to its tabs, then opens «Настройки» and «История».
function cardStory(slide) {
  const garden = sampleGarden();
  const card = (key) => onSample(garden, () => {
    const own = cardTab;
    cardTab = key;
    try { return tame(`<div class="st-card-sheet">${plantCardHtml('sample3')}</div>`); } finally { cardTab = own; }
  });
  const f = phone(card('notes'), '');
  slide.append(f);
  const scr = f.querySelector('.screen');
  // Scrolls the screen so `el` sits near its top (the screen is scaled: rects are divided back).
  const scrollTo = (el, now) => {
    if (!el) return;
    const k = f.clientWidth / parseFloat(scr.style.width);
    glide(scr, scr.scrollTop + (el.getBoundingClientRect().top - scr.getBoundingClientRect().top) / k - 24, now);
  };
  const tabBtn = (name) => [...f.querySelectorAll('.seg-tab')].find((b) => b.textContent.trim() === name);
  const open = (key, name) => [
    [1300, (now) => { if (!now) tapAt(f, tabBtn(name)); }],
    [500, () => { const top = scr.scrollTop; setScreen(f, card(key)); scr.scrollTop = top; }],
  ];
  return [[1300, (now) => scrollTo(f.querySelector('.seg'), now)], ...open('settings', 'Настройки'), ...open('history', 'История')];
}
// 4. «Свет»: a reading goes in, and the tips appear.
function lightStory(slide) {
  const first = tame(onSample(sampleGarden(), viewLight), mark({ 'st-lux': 'input[data-id="sample0"]' }));
  const f = phone(first, 'light');
  slide.append(f);
  return [
    [1000, (now) => { const inp = f.querySelector('.st-lux'); if (!now) tapAt(f, inp); if (inp) typeInto(inp, '800', now); }],
    [1400, () => {
      const s = sampleGarden();
      s.plants.sample0.lux = 800;
      s.plants.sample1.lux = 9000;
      setScreen(f, tame(onSample(s, viewLight)));
    }],
  ];
}
// 5. «Комната»: a reading of 18 °C and 35%, and who is uncomfortable.
function roomStory(slide) {
  const f = phone(tame(onSample(sampleGarden(), viewRoom), mark({ 'st-t': 'input[id^="in-t-"]', 'st-h': 'input[id^="in-h-"]' })), 'room');
  slide.append(f);
  return [
    [1000, (now) => { const t = f.querySelector('.st-t'); if (!now) tapAt(f, t); if (t) typeInto(t, '18', now); }],
    [900, (now) => { const h = f.querySelector('.st-h'); if (!now) tapAt(f, h); if (h) typeInto(h, '35', now); }],
    [1100, () => {
      const s = sampleGarden();
      Object.assign(s.rooms[0], { t: 18, h: 35, d: today() });
      setScreen(f, tame(onSample(s, viewRoom)));
    }],
  ];
}
// 6. Where to go from here.
function endStory(slide) {
  const kind = storyEnd();
  const box = document.createElement('div');
  box.className = 'st-end';
  if (kind === 'tiles') {
    const n = ticked.size;
    box.innerHTML = `<h2 tabindex="-1">Что у вас растёт?</h2><p class="lead">Остальное найдём в каталоге.</p>
      <div class="qs-grid">${QUICK.map(([k, label]) => `<button class="qs${ticked.has(k) ? ' on' : ''}" data-act="story-tick" data-key="${k}" aria-pressed="${ticked.has(k)}">
        <span class="qs-pic" aria-hidden="true">${plantSvg(PLANTS.find((p) => p.id === k), 'fine')}</span><span class="qs-name">${label}</span></button>`).join('')}</div>
      <button class="btn st-btn wide" data-act="story-add"${n ? '' : ' disabled'}>${n ? `${I('plus')}Добавить ${plantsN(n)}` : 'Отметьте, что есть'}</button>
      <p class="m-0 st-more"><button class="linkish" data-act="story-catalog">Другие растения</button> · <button class="linkish" data-act="story-import">Перенести из чата с ИИ</button></p>`;
  } else if (kind === 'ios') {
    // On iPhone Safari the steps play out on a drawn Safari; the full list stays for screen readers. Elsewhere (iPad,
    // other browsers) and with reduced motion, the list is shown as is.
    const sk = STILL.matches ? '' : safariKind();
    box.innerHTML = `<div class="st-head"><h2 tabindex="-1">Добавьте Жунгли на экран «Домой»</h2>
      <p class="lead">Растения будут жить в иконке.</p></div>
      ${sk ? `<ol class="sr-only">${homeSteps().map((t) => `<li>${t}</li>`).join('')}</ol><span class="st-phone-spot"></span>
        <button class="btn st-btn ghost st-again" data-act="story-replay" hidden>Показать ещё раз</button>` : steps(homeSteps())}
      <p class="m-0 st-more"><button class="linkish" data-act="story-stay">Остаться в браузере</button></p>`;
    if (sk) {
      const f = safariPhone(sk);
      box.querySelector('.st-phone-spot').replaceWith(f);
      slide.append(box);
      return safariSteps(f, box.querySelector('.st-again'), sk);
    }
  } else if (kind === 'in_app') {
    box.innerHTML = `<h2 tabindex="-1">Откройте Жунгли ${PLACE.where}</h2>
      <p class="lead">Отсюда Жунгли не добавить на экран «Домой».</p>
      ${steps(['Нажмите «•••» или «⋮» в углу экрана', `Выберите ${PLACE.menu}`])}
      <div class="btns"><button class="btn st-btn wide" data-act="story-close" data-story-end="browser">Понятно</button></div>
      <p class="m-0 st-more">Или ${tgButton('откройте в Телеграме')}</p>`;
  } else {
    box.innerHTML = `<h2 tabindex="-1">Откройте Жунгли в Телеграме</h2>
      <p class="lead">Там растения хранятся в облаке Телеграма.</p>
      <div class="btns">${tgButton('Открыть', 'wide')}</div>`;
  }
  slide.append(box);
  // The steps light up one by one.
  return box.querySelectorAll('.st-steps li').length ? [...box.querySelectorAll('.st-steps li')].map((li, i) => [i ? 900 : 600, () => li.classList.add('on')]) : [];
}

/* ---------- The dialog ---------- */
const storiesDlg = $('#stories');
function showStory() {
  stopStory();
  const s = STORIES[storyI];
  storyMax = Math.max(storyMax, storyI);
  storiesDlg.innerHTML = `
    <div class="st-bars" aria-hidden="true">${STORIES.map((_, k) => `<i${k <= storyI ? ' class="on"' : ''}></i>`).join('')}</div>
    <div class="st-top"><span class="sr-only">${storyI + 1} из ${STORIES.length}</span>
      <span class="st-keys">${storyI ? '<button class="btn st-btn ghost" data-act="story-prev">Назад</button>' : ''}${storyI < STORIES.length - 1 ? '<button class="btn st-btn" data-act="story-next">Дальше</button>' : ''}</span>
      <button class="icon-btn st-x" data-act="story-close" aria-label="Пропустить">${I('x')}</button></div>
    <div class="st-slide" id="story-slide">${s.h ? `<div class="st-head"><h2 tabindex="-1">${s.h}</h2><p class="lead">${s.p}</p></div>` : ''}</div>
`;
  const slide = $('#story-slide');
  const anim = s.build(slide) || [];
  fitPhones(slide);
  runSteps(anim);
  return slide;
}
let storyFrom = '';
function openStories(from) {
  storyI = 0; storyMax = 0; storyEnded = ''; ticked = new Set(); storyFrom = from;
  S.storiesSeen = today();
  save();
  track('stories_opened', { from });
  storiesDlg.showModal();
  showStory().querySelector('h2')?.focus();
}
function goStory(d) {
  const i = Math.max(0, Math.min(STORIES.length - 1, storyI + d));
  if (i === storyI) return;
  storyI = i;
  showStory().querySelector('h2')?.focus();
}
function closeStories(how) {
  storyEnded ||= how;
  if (storiesDlg.open) storiesDlg.close();
}
storiesDlg.addEventListener('close', () => {
  stopStory();
  track('stories_closed', { reached: storyMax + 1, how: storyEnded || 'close' });
  storiesDlg.innerHTML = '';
});
storiesDlg.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight') goStory(1);
  if (e.key === 'ArrowLeft') goStory(-1);
});
// A tap on the story, not on a control or the card you can answer: the left third goes back, the rest goes on.
storiesDlg.addEventListener('click', (e) => {
  if (e.target.closest('button, a, input, .st-end .qs-grid')) return;
  const r = storiesDlg.getBoundingClientRect();
  goStory(e.clientX < r.left + r.width / 3 ? -1 : 1);
});
addEventListener('resize', () => { if (storiesDlg.open) fitPhones(storiesDlg); });

// The first launch opens them right away: no plants yet and never seen (S.storiesSeen; it travels with backups and
// Telegram's cloud). Not over a sheet. In the mini app a cloud copy may still arrive: then they step aside (storiesYield).
function autoStories() {
  if (S.storiesSeen || Object.keys(S.plants).length || sheet.open || storiesDlg.open) return;
  openStories('auto');
}
function storiesYield() {
  if (storiesDlg.open && storyFrom === 'auto') closeStories('restored');
}
// The card on the empty «Сегодня» that opens the stories.
const storyCard = () => `<button class="st-open" data-act="stories"><span class="st-ring" aria-hidden="true"><span>${plantSvg(PLANTS.find((p) => p.id === 'mon-del'), 'fine')}</span></span>
  <span class="st-open-t"><b>Как работают Жунгли</b><small>6 экранов, меньше минуты</small></span>${I('chevron-right')}</button>`;

Object.assign(ACTS, {
  stories() { openStories(tab); },
  'story-next'() { goStory(1); },
  'story-prev'() { goStory(-1); },
  'story-replay'() { showStory(); },
  'story-close'(el) { closeStories(el.dataset.storyEnd || 'close'); },
  // As «Остаться в браузере» on the install card: the plant picker shows in the browser.
  'story-stay'(el) { closeStories('stay'); el.dataset.kind = 'stories'; ACTS['stay-browser'](el); },
  'story-tick'(el) {
    const k = el.dataset.key;
    if (ticked.has(k)) ticked.delete(k); else ticked.add(k);
    showStory();
    $(`#stories [data-key="${k}"]`)?.focus();
  },
  'story-add'() {
    const keys = [...ticked];
    closeStories('add');
    addFromCatalog(keys, 'stories');
  },
  'story-catalog'() { closeStories('catalog'); openAdd(); },
  'story-import'() { closeStories('import'); openImport(); },
});
// The Telegram link in the last story also closes it (the link itself opens Telegram).
document.addEventListener('click', (e) => {
  const a = e.target.closest('#stories [data-story-end="telegram"]');
  if (a) storyEnded = 'telegram';
});
