/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Tabs: Today, Plants, Light and Room, with hints and quick picks.

/* ---------- Today ---------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

// Little greenhouse badge next to the status
// Greenhouse badge: a round icon on grid cards, a worded chip like the status ones in the plant card.
const ghBadge = (p, words) => (!p.greenhouse ? ''
  : words ? `<span class="mood hero-mood greenhouse">${I('house-heart')}в теплице</span>`
    : `<span class="gh" title="В теплице">${I('house-heart')}<span class="sr-only">в теплице</span></span>`) + newBadge(p, words);
// A new plant in quarantine: the same kind of badge, in the plant card only as words.
const newBadge = (p, words) => (!isNew(p) ? ''
  : words ? `<span class="mood hero-mood greenhouse">${I('biohazard')}на карантине</span>`
    : `<span class="gh" title="На карантине">${I('biohazard')}<span class="sr-only">на карантине</span></span>`) + restBadge(p, words);
// With pets at home: a paw on the plant. The plant card says toxic or safe; grid cards mark only the toxic.
const petBadge = (p, words) => {
  const v = petsOn() && petsOf(p);
  if (!v || (!words && v !== 'toxic')) return '';
  const label = v === 'toxic' ? 'ядовито для питомцев' : 'безопасно для питомцев';
  return words ? `<span class="mood hero-mood pets ${v}">${I('paw-print')}${label}</span>`
    : `<span class="gh pets ${v}" title="Ядовито для питомцев">${I('paw-print')}<span class="sr-only">${label}</span></span>`;
};
const restBadge = (p, words) => (!resting(p) ? ''
  : words ? `<span class="mood hero-mood greenhouse">${I('moon')}отдыхает</span>`
    : `<span class="gh" title="Отдыхает">${I('moon')}<span class="sr-only">отдыхает</span></span>`) + (words ? '' : petBadge(p));

// Badges for an unusual way of growing («в воде», «на фитиле»…), as the greenhouse one: worded chips in the
// plant card, and on grid cards one icon (the medium's first), so badges don't pile up over the picture.
// Keys go to the status filter too, so every plant in water can be found there. Left out: a watering that is
// the medium's usual one (clay pebbles on a reservoir), and a card's own medium on a `noBadge` card
// (tillandsia). The badge itself is left out when the plant's name or species already says it
// («Черенки в воде», «Растение в аквариуме»).
const growBadge = (k) => (MEDIA[k] || WATERING[k] || {}).badge;
function growKeys(p) {
  const keys = [];
  if (growBadge(p.type) && !(p.type === p.cardType && def(p.id).noBadge)) keys.push(p.type);
  if (growBadge(p.watering) && p.watering !== MEDIA[p.type].watering) keys.push(p.watering);
  return keys;
}
const saysWay = (p, k) => norm(`${p.title} ${p.species}`).includes(growBadge(k)[1]);
const growBadges = (p, words) => growKeys(p).filter((k) => !saysWay(p, k)).slice(0, words ? 2 : 1).map((k) => {
  const [icon, word] = growBadge(k);
  return words ? `<span class="mood hero-mood way">${I(icon)}${word}</span>`
    : `<span class="gh way" title="${cap(word)}">${I(icon)}<span class="sr-only">${word}</span></span>`;
}).join('');

function ava(p, cls = 'ava') {
  return `<button class="${cls}" data-open="${esc(p.id)}" aria-label="Открыть ${esc(p.title)}">${picOf(p)}</button>`;
}

// Hint cards on «Сегодня»: same layout, usually one at a time. Priority: Telegram's browser, another app's browser
// on iPhone, the stats notice (opt-out), then «add to home screen». With no plants they show below the welcome.
// Where plants wouldn't follow into the installed app, installing comes before the plant picker (installFirst).
// Telegram's and Chrome's install hints wait for the first plant: there the data stays.
const hintCard = (icon, title, text, buttons) => `<div class="task bonus"><b>${I(icon)}${title}</b>
  <p class="mt-6 small muted">${text}</p>
  <div class="btns hint-btns">${buttons}</div></div>`;
// Android and computers (Chrome, Edge, Samsung Internet) offer installing through this event; Safari and Firefox don't.
let installPrompt = null;
// Other apps' built-in browsers (Facebook, Instagram, LinkedIn, Line, VK, OK; on Android any app's WebView, «; wv)»):
// no «На экран Домой» or install, and their data can be lost like in Telegram's. Telegram has its own hint above.
// A few Android browsers are built on the WebView too; they name themselves, so they're left out.
const IN_APP = !IN_TELEGRAM && !MINI_APP && (IOS || /Android/.test(navigator.userAgent))
  && (/FBAN|FBAV|Instagram|LinkedInApp|\bLine\/|VKClient|VKAndroidApp|OKApp|GSA\//i.test(navigator.userAgent)
    || (/Android.*; wv\)/.test(navigator.userAgent) && !/DuckDuckGo|Ecosia|MiuiBrowser|HeyTapBrowser|UCBrowser|OPR\/|YaBrowser|SamsungBrowser|Brave|Vivaldi/.test(navigator.userAgent))
    // iPhone apps' own browsers (Telegram's too, which often can't be told apart) leave «Safari/» out of the
    // user agent; Safari and other browsers keep it. Home-screen apps leave it out as well.
    || (IOS && !navigator.standalone && !/Safari\//.test(navigator.userAgent)));
// Words for the iPhone and in-app hints. Name Safari only when sure: iPad browsers send a Mac user agent
// that doesn't say which browser it is. Chrome, Firefox, Edge and others add to the home screen through
// their own «Поделиться» too.
const PLACE = (() => {
  const ua = navigator.userAgent;
  return {
    device: /iPhone|iPod/.test(ua) ? 'iPhone' : 'iPad',
    where: IOS ? 'в Safari' : 'в браузере',
    menu: IOS ? '«Открыть в Safari» или «в браузере»' : '«Открыть в браузере» или «в Chrome»',
  };
})();
// «Остаться в браузере» holds back the reminders to move plants for a few days.
const STAY_DAYS = 3;
const stayingNow = () => typeof S.stayBrowser === 'string' && today() < addDays(S.stayBrowser, STAY_DAYS);
// Where plants added now wouldn't reach the installed app or could be lost: a browser on iPhone and iPad,
// another app's browser, Telegram's browser. With no plants yet, the plant picker waits behind the way
// to install until the person does it or chooses to stay (S.stayBrowser).
function installWhere() {
  if (MINI_APP || S.stayBrowser || Object.keys(S.plants).length) return null;
  if (IN_TELEGRAM && !S.hideTelegram) return 'telegram_browser';
  if (IN_APP && !S.hideInstall) return 'in_app';
  // Said «Уже добавили»: this browser now only points to the icon (S.homeIcon), until «Остаться в браузере».
  if (IOS && !IN_TELEGRAM && !navigator.standalone && S.homeIcon) return 'ios_added';
  if (IOS && !IN_TELEGRAM && !navigator.standalone && !S.hideInstall) return 'ios';
  return null;
}
let installFirstShown = false;
function installFirst() {
  const kind = installWhere();
  if (!kind) return '';
  if (!installFirstShown) { installFirstShown = true; track('install_first_shown', { where: kind }); }
  const { where } = PLACE;
  const stay = (label) => `<button class="btn ghost" data-act="stay-browser" data-kind="${kind}">${label}</button>`;
  if (kind === 'telegram_browser') {
    return hintCard('sprout', 'Сначала откройте Жунгли в Телеграме',
      'Это браузер внутри Телеграма: здесь растения могут потеряться. В приложении Телеграма они хранятся в облаке.',
      `<a class="btn ok" href="${MINI_APP_LINK}" data-act="open-mini-app">${I('sprout')}Открыть</a>${stay('Остаться здесь')}`);
  }
  // The steps themselves are in the last story («Показать, как»), drawn for this browser and its version.
  const how = '<button class="btn primary" data-act="stories-install">Показать, как</button>';
  if (kind === 'in_app') {
    return hintCard('triangle-alert', `Сначала откройте Жунгли ${where}`,
      'Отсюда Жунгли не добавить на экран «Домой», а растения здесь могут потеряться.', `${how}${stay('Остаться здесь')}`);
  }
  // Already added: the browser is a separate Жунгли with its own (empty) storage, so it sends people to the icon.
  // A change of mind is one tap away and works as «Остаться в браузере».
  if (kind === 'ios_added') {
    return hintCard('smartphone', 'Жунгли уже на экране «Домой»',
      'Откройте их с иконки, там ваши растения. Здесь, в браузере, отдельные Жунгли, и растения отсюда в иконку не попадут.',
      `${how.replace('btn primary', 'btn')}${stay('Остаться в браузере')}`);
  }
  // The person tells which way they go: the icon («Уже добавили») or the browser.
  return hintCard('smartphone', 'Сначала добавьте Жунгли на экран «Домой»',
    'Растения будут жить в иконке, отмеченное в браузере туда не перейдёт.',
    `${how}<button class="btn ghost" data-act="home-added">Уже добавили</button>${stay('Остаться в браузере')}`);
}
function currentHint() {
  const hasPlants = Object.keys(S.plants).length > 0;
  // With no plants the way to install is on the main card (installFirst) or was turned down: no hint about it.
  // After «Остаться в браузере» the reminders to move plants wait a few days too.
  const gated = (!hasPlants && (installWhere() || S.stayBrowser)) || stayingNow();
  // Telegram's in-app browser loses data: offer the mini app (its plants live in Telegram's cloud).
  if (IN_TELEGRAM && !MINI_APP && !S.hideTelegram && !gated) {
    const open = `<a class="btn ok" href="${MINI_APP_LINK}" data-act="open-mini-app">${I('sprout')}Открыть</a>`;
    // Nothing to lose yet: a friendly invite, not a warning.
    if (!hasPlants) {
      return hintCard('sprout', 'Удобнее в приложении Телеграма',
        'Там растения хранятся в облаке Телеграма и появятся на любом устройстве.',
        `${open}<button class="btn ghost" data-act="hide-telegram">Понятно</button>`);
    }
    return hintCard('triangle-alert', 'Растения здесь могут потеряться',
      'Это встроенный браузер Телеграма. Перенесите их в приложение Телеграма: сохраните копию здесь в «Настройках», а там нажмите «Восстановить копию».',
      `${open}<button class="btn ghost" data-act="hide-telegram">Понятно</button>`);
  }
  if (IN_APP && !S.hideInstall && !gated) {
    const why = 'Это встроенный браузер приложения: отсюда Жунгли не добавить на экран «Домой», а растения здесь могут потеряться.';
    const { where, menu } = PLACE;
    // Android apps' WebViews often can't share or download files, so a backup button there could do nothing.
    if (hasPlants && !IOS) {
      return hintCard('triangle-alert', `Откройте Жунгли ${where}`,
        `${why} В меню приложения выберите ${menu}. Сохранить копию здесь обычно не получается, поэтому растения, скорее всего, придётся отметить там заново.`,
        '<button class="btn ghost" data-act="hide-install" data-kind="in_app">Понятно</button>');
    }
    return hasPlants
      ? hintCard('triangle-alert', `Откройте Жунгли ${where}`,
        `${why} Сохраните копию, откройте Жунгли ${where} (в меню приложения выберите ${menu}) и восстановите её там.`,
        '<button class="btn ok" data-act="export" data-from="in_app_hint">Сохранить копию</button><button class="btn ghost" data-act="hide-install" data-kind="in_app">Понятно</button>')
      : hintCard('triangle-alert', `Откройте Жунгли ${where}`,
        `${why} В меню приложения выберите ${menu}.`,
        '<button class="btn ghost" data-act="hide-install" data-kind="in_app">Понятно</button>');
  }
  // Stats run from the first screen, so their notice shows from the first screen too.
  const stats = !S.statsNotice && S.settings.stats !== false
    ? hintCard('lightbulb', 'Анонимная статистика',
      'Чтобы понять, что улучшить, Жунгли отправляют, какие кнопки нажимают, но без названий, заметок и фото. <a class="linkish" href="privacy" data-from="stats_notice">Подробнее</a>',
      '<button class="btn" data-act="stats-ok">Понятно</button><button class="btn ghost" data-act="stats-off">Выключить</button>')
    : '';
  // iPhone keeps a home-screen app's data apart from the browser's: the icon opens an empty Жунгли.
  const iosBrowser = IOS && !navigator.standalone && !MINI_APP && !IN_APP && !S.hideInstall && !gated;
  const { device } = PLACE;
  if (stats) return stats;
  // In the mini app: Telegram's own «add to home screen» (telegram.js sets tgHome when it's available).
  // It waits for the first plant: the mini app keeps its data in Telegram's cloud, so nothing is lost by waiting.
  if (MINI_APP) {
    if (hasPlants && window.tgHome && !S.hideInstall) {
      return hintCard('smartphone', 'Добавьте Жунгли на экран «Домой»',
        'Иконка будет открывать приложение сразу, без поиска бота в Телеграме.',
        '<button class="btn" data-act="tg-home">Добавить</button><button class="btn ghost" data-act="hide-install" data-kind="telegram">Не нужно</button>');
    }
    return '';
  }
  // The installed app shares the browser's data here, so it can wait for the first plant.
  if (installPrompt && hasPlants && !S.hideInstall) {
    return hintCard('smartphone', 'Установите Жунгли как приложение',
      'Жунгли будут открываться с иконки, в своём окне. Растения останутся на месте.',
      '<button class="btn ok" data-act="install">Установить</button><button class="btn ghost" data-act="hide-install" data-kind="install">Не нужно</button>');
  }
  if (iosBrowser) {
    // After «Сохранить копию» here: the plants are (about to be) in the home-screen app, so this copy goes stale.
    if (S.movedHome) {
      return hintCard('smartphone', 'Открывайте Жунгли с иконки',
        'Здесь, в браузере, осталась старая копия: отметки отсюда не попадут в Жунгли на экране «Домой». Если ещё не перенесли растения, нажмите там «Восстановить копию».',
        '<button class="btn" data-act="export" data-from="install_hint">Сохранить ещё раз</button><button class="btn ghost" data-act="hide-install" data-kind="ios_moved">Понятно</button>');
    }
    // Said «Уже добавили» earlier, then stayed: the icon is there, only the plants need to move.
    if (S.homeIcon) {
      return hintCard('smartphone', 'Перенесите растения в иконку',
        'Жунгли на экране «Домой» не видят растения из браузера. Сохраните копию здесь, а там нажмите «Восстановить копию».',
        '<button class="btn ok" data-act="export" data-from="install_hint">Сохранить копию</button><button class="btn ghost" data-act="hide-install" data-kind="ios_icon_move">Не нужно</button>');
    }
    return hintCard('smartphone', 'Добавьте Жунгли на экран «Домой»',
      `Так ${device} не сотрёт ваши отметки. С иконки Жунгли откроются пустыми, поэтому сначала сохраните копию здесь, а там нажмите «Восстановить копию».`,
      '<button class="btn ok" data-act="export" data-from="install_hint">Сохранить копию</button><button class="btn" data-act="stories-install" data-from="install_hint">Показать, как</button><button class="btn ghost" data-act="hide-install" data-kind="ios_move">Уже на экране</button>');
  }
  return winterHint(hasPlants);
}
// Once a winter (November to February): tropical plants slow down for lack of light, they don't need rest
// (the content repo's dormancy facts). «Понятно» hides it until next winter.
const winterOf = () => { const d = new Date(), m = d.getMonth() + 1; return m >= 11 ? d.getFullYear() : m <= 2 ? d.getFullYear() - 1 : 0; };
const winterHint = (hasPlants) => (!hasPlants || !winterOf() || S.winterSeen === winterOf() ? ''
  : hintCard('sun-dim', 'Зимой растения растут медленнее',
    'Тропическим растениям зимой не нужен покой, им не хватает света. Подвиньте их ближе к окну или к лампе, поливайте реже и не кормите, пока нет роста. В тепле без света побеги вытягиваются.',
    '<button class="btn" data-act="winter-ok">Понятно</button>'));

// «Банный день» as a few steps in one card: are we bathing today, who, how, done. Only plants due a rinse
// whose soil is dry today are offered, at most BATH_MAX (bathPlan); the step and the picks live here until the card is done.
// «Кого купаем?» and «День подкормки» pick plants from rows like the catalog's, all ticked;
// `bathOff` and `feedOff` keep the unticked ones across redraws.
let bathStep = 0, bathPicked = [], bathOff = new Set(), feedOff = new Set();
// True while the stories draw a sample garden (onSample): that draw must not reset the user's picks.
let sampleDraw = false;
const pickOff = (kind) => (kind === 'feed' ? feedOff : bathOff);
// A plant's photo, or its silhouette in today's mood.
const picOf = (p) => (photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p, mood(p)[2]));
const plantPick = (kind) => (p) => {
  const on = !pickOff(kind).has(p.id), sub = plantSubHtml(p);
  return `<button class="pick${on ? ' on' : ''}" data-act="plant-pick" data-kind="${kind}" data-pick="${esc(p.id)}" aria-pressed="${on}">
    <span class="pe" aria-hidden="true">${picOf(p)}</span><span class="pt"><b>${typedHtml(p.title)}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    <span class="pc" aria-hidden="true">${I(on ? 'check' : 'plus')}</span></button>`;
};
const pickList = (kind, ps, label) => `<div class="who-pick" role="group" aria-label="${esc(label)}">${ps.map(plantPick(kind)).join('')}</div>`;
function bathHtml(bp) {
  const base = { cls: 'bonus', icon: 'droplets', name: 'Банный день' };
  const later = bp.due.length - bp.offer.length, wet = bp.due.length - bp.ready.length;
  if (bathStep === 1) {
    const why = [bp.ready.length > bp.offer.length ? `за раз купаем не больше ${BATH_MAX}` : '', wet ? `у ${wet === later ? 'них' : 'кого-то'} грунт ещё влажный` : ''].filter(Boolean).join(', а ');
    return taskCard({ ...base, sub: `Шаг 2 из 3 · ${plantsN(bp.offer.length)}`, task: 'Кого купаем?',
      pick: pickList('bath', bp.offer, 'Кого купаем'),
      buttons: `<button class="btn ok" data-act="bath-go">${I('droplets')}Пошли купать!</button><button class="btn ghost" data-act="bath-cancel">Отмена</button>`,
      hint: later ? `Остальных (${plantsN(later)}) позову в другой банный день: ${why}.` : '' });
  }
  if (bathStep === 2) {
    const ps = bathPicked.map(plant).filter(Boolean);
    // The pictures say who: no names on screen, but screen readers get them.
    return taskCard({ ...base, sub: `Шаг 3 из 3 · ${plantsN(ps.length)}`, task: 'Пошли купать!', hint: RINSE.hint,
      pick: `<div class="bath-pics" role="img" aria-label="${esc(ps.map((p) => p.title).join(', '))}">${ps.map((p) => `<span class="bath-pic">${picOf(p)}</span>`).join('')}</div>`,
      buttons: `<button class="btn ok" data-act="bath-done">${I('check')}Промыто</button><button class="btn ghost" data-act="bath-back">Назад</button>` });
  }
  return taskCard({ ...base, sub: `Шаг 1 из 3 · ${plantsN(bp.offer.length)} на сегодня`, task: 'Устраиваем сегодня банный день?',
    buttons: `<button class="btn ok" data-act="bath-yes">${I('check')}Да!</button><button class="btn ghost" data-act="bath-skip">Через 3 дня</button>`,
    hint: 'Промываем грунт от солей удобрений и жёсткой воды. Купаем только тех, у кого грунт подсох: мокрый пролить насквозь значит залить.' });
}
// The page is drawn anew on each step: focus goes to the step's main button, not back to the top.
function bathRender(sel) { render(); document.querySelector(sel)?.focus(); }
const nameList = (ps) => (ps.length <= 3 ? ps.map((p) => p.title).join(', ') : `${ps.slice(0, 3).map((p) => p.title).join(', ')} и ещё ${ps.length - 3}`);

// «Species · place» under a plant's name on task cards, as HTML; `extra` adds app text, e.g. the last watering.
const plantSubHtml = (p, ...extra) => [...[p.name ? p.species : '', p.spot].filter(Boolean).map(typedHtml), ...extra.filter(Boolean).map(esc)].join(' · ');
// Every task card on «Сегодня» has one layout: picture and name, the plant's words, the task,
// the buttons, then how to do it. `p` is the plant (or `icon` and `name` for tasks without one).
// `sub` is app text; `subHtml` is a ready line from plantSubHtml().
// `pick`: HTML between the task and the buttons, such as the feeding day's ticks.
// `fold`: the hint folds under «Как?», next to `after` («Завтра»): { id, open, water } (water: «Как?» in the watering blue).
function taskCard({ cls = '', p, icon, name, sub, subHtml, quip, task, pick = '', buttons, who, hint, after = '', fold }) {
  const pic = p ? ava(p) : `<div class="ava" aria-hidden="true">${I(icon)}</div>`;
  const line = subHtml ?? (p && sub === undefined ? plantSubHtml(p) : esc(sub ?? ''));
  return `<div class="task${cls ? ' ' + cls : ''}"><div class="task-top">${pic}<div><div class="task-name">${p ? typedHtml(p.title) : esc(name)}</div>
    ${line ? `<div class="task-sub">${line}</div>` : ''}</div></div>
    ${quip ? `<p class="quip">${esc(quip)}</p>` : ''}
    <div class="question">${esc(task)}</div>${pick}
    <div class="btns">${buttons}</div>
    ${fold ? `<div class="task-links"><button class="later how${fold.water ? ' water' : ''}" data-act="how" data-id="${esc(fold.id)}" aria-expanded="${fold.open}" aria-controls="how-${esc(fold.id)}">${I('circle-help')}Как?</button>${after}</div>
    <div class="hint" id="how-${esc(fold.id)}"${fold.open ? '' : ' hidden'}>${esc(hint)}</div></div>`
    : `${who || hint ? `<div class="hint">${who ? `Кого: ${who.map(typedHtml).join(', ')}. ` : ''}${esc(hint)}</div>` : ''}${after}</div>`}`;
}
// «Как?» on check cards: open for a plant's first checks (HOW_OPEN answers), folded after; a tap keeps its choice for the session.
const HOW_OPEN = 3, howOpen = new Map();

function viewToday() {
  const t = today();
  const { log, shown, vents, inspects, pending, doneMain, waiting, total } = todayPlan();
  const pct = total ? Math.round((doneMain / total) * 100) : 100;
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<header class="hello head-row"><div><h1>${greeting()}!</h1><div class="date">${esc(date)}</div></div>
    ${headButtons()}</header>`;

  // Empty: no welcome card, the stories (stories.js) open by themselves on the first launch and explain the app.
  // Only the quick picks, or the way to install first.
  if (!allPlants().length) {
    return html + emptyCard('', '', {
      bare: true,
      after: `<p class="mt-12 small muted">Уже вели Жунгли ${navigator.standalone ? 'в браузере или на другом устройстве' : 'на другом устройстве'}? <button class="linkish" data-act="import">Восстановить копию</button></p>`,
    }) + currentHint();
  }

  html += currentHint();

  if (total > 0) {
    html += `<div class="progress"><div class="head-row"><b>${pending ? `Осталось ${pending} ${plural(pending, 'дело', 'дела', 'дел')}` : 'Всё на сегодня!'}</b>
      <span class="muted small">${doneMain} из ${total}</span></div><div class="bar"><i data-w="${pct}"></i></div></div>`;
  }

  inspects.forEach((p) => {
    html += taskCard({
      p, task: 'Осмотрите на вредителей',
      buttons: `<button class="btn ok" data-act="inspect-done" data-id="${esc(p.id)}">${I('search')}Осмотрено</button>
        <button class="btn" data-act="inspect-off" data-id="${esc(p.id)}">Уже не новое</button>`,
      hint: `Нижнюю сторону листьев, пазухи и молодые листья, удобно с лупой. Пока держите его отдельно от других растений. Нашли вредителей: не ставьте к остальным и обмойте листья тёплой водой.`,
    });
  });

  vents.forEach((v) => {
    html += taskCard({
      p: v, quip: pickDaily(v.id, VENT_QUIPS), task: 'Проветрите теплицу минут на\u00a015–\u206030', // no line break inside «на 15–30»
      buttons: `<button class="btn air" data-act="vent-done" data-id="${esc(v.id)}">${I('wind')}Проветрено</button>
        <button class="btn" data-act="vent-off" data-id="${esc(v.id)}">Без теплицы</button>`,
      hint: 'С каждым днём можно держать открытой чуть дольше.',
    });
  });

  shown.forEach((p) => {
    const [yes, no] = labelsOf(p), g = wayOf(p), [yi, ni] = g.icons || ['droplet'];
    html += taskCard({
      p, subHtml: plantSubHtml(p, p.lastWater ? `${actWords(p).sub} ${rel(p.lastWater)}` : ''), quip: quipOf(p), task: waterTask(p),
      buttons: `<button class="btn ${g.fixed ? 'ok' : 'water'}" data-act="water" data-id="${esc(p.id)}">${I(yi)}${yes}</button>
        <button class="btn" data-act="wet" data-id="${esc(p.id)}">${ni ? I(ni) : ''}${no}</button>`,
      hint: resting(p) && p.rest ? p.rest.water : p.water,
      fold: (resting(p) && p.rest ? p.rest.water : p.water) ? { id: p.id, open: howOpen.get(p.id) ?? checksOf(p).length < HOW_OPEN, water: !g.fixed } : null,
      after: `<button class="later" data-act="later" data-id="${esc(p.id)}">${I('skip-forward')}Завтра</button>`,
    });
  });

  if (!pending) {
    if (doneMain) {
      html += `<div class="celebrate"><div class="big">🎉</div><h2>Джунгли довольны!</h2>
        <p class="muted">Вы сегодня молодец. Остальное завтра.</p></div>`;
    } else {
      const tom = allPlants().filter((p) => p.nextCheck === addDays(t, 1) && !wayOf(p).noChecks).length;
      html += `<div class="celebrate"><div class="big">😴</div><h2>Сегодня отдыхаем</h2>
        <p class="muted">Все в порядке, никто не просит пить.${tom ? ` Завтра проверим ${plantsN(tom)}.` : ''}</p></div>`;
    }
  }

  if (waiting > 0) {
    html += `<button class="more" data-act="show-all">${I('moon')}Ещё ${waiting} ${plural(waiting, 'растение подождёт', 'растения подождут', 'растений подождут')} до завтра.<br>Есть силы? Показать</button>`;
  }

  const bonus = bonusTasks(), bp = bathPlan();
  if (!sampleDraw) {
    if (!bonus.some((b) => b.pick)) feedOff = new Set(); // a feeding day over or put off starts all ticked next time
    if (!(bp && bp.shown)) { bathStep = 0; bathPicked = []; bathOff = new Set(); } // a bath day put off or over starts from the question next time
  }
  const bathCard = bp && bp.shown ? bathHtml(bp) : '';
  if (bonus.length || bathCard) {
    html += `<h2 class="h-ic">${I('sparkles')}Если есть силы</h2>${bathCard}`;
    bonus.forEach((b) => {
      html += taskCard({
        cls: 'bonus', p: b.p, icon: b.icon, name: b.title, sub: b.sub, task: b.task, who: b.who, hint: b.hint,
        // «День подкормки»: a row per plant, all ticked; «Подкормлено» notes the ticked ones, the rest come back in a few days.
        pick: b.pick ? pickList('feed', b.pick, b.pickLegend) : '',
        // The done button names what was done («Протёрто», «Подкормлено»); the other one says when the task comes back.
        buttons: b.contact
          ? `${outLink('telegram', 'Написать', 'btn ok', 'data-act="feedback-answer" data-wrote="1" data-from="feedback_task"')}
          <button class="btn ghost" data-act="feedback-answer">Не нужно</button>`
          : `${b.backup ? `<button class="btn ok" data-act="export" data-from="task">${I('save')}Сохранить</button>`
            : `<button class="btn ok" data-act="bonus-done" data-key="${esc(b.key)}">${I('check')}${esc(b.done)}</button>`}
          <button class="btn ghost" data-act="bonus-skip" data-key="${esc(b.key)}">Через 3 дня</button>`,
      });
    });
  }

  const doneRows = log.filter((e) => e.a !== 'later');
  if (doneRows.length) {
    const label = { water: 'полито', wet: 'ещё влажно', ok: 'работает', fix: 'поправлено', vent: 'проветрено', inspect: 'осмотрено', bonus: 'сделано' };
    html += `<details><summary class="group-title">Уже сделано сегодня · ${doneRows.length}</summary>`;
    doneRows.forEach((e) => {
      const p = e.id ? plant(e.id) : null;
      const what = e.title || (p ? p.title : '');
      html += `<div class="task done-row">${p ? ava(p) : `<div class="ava" aria-hidden="true">${I('check')}</div>`}<div class="grow">${p && !e.title ? typedHtml(p.title) : esc(what)}</div>
        <span class="muted small">${label[String(e.a).split(':')[0]] || ''}</span></div>`;
    });
    html += `</details>`;
  }
  return html;
}

/* ---------- Plants ---------- */
function viewPlants() {
  const ps = allPlants();
  let html = `<header class="hello head-row"><div><h1>Мои джунгли</h1><div class="date">${plantsN(ps.length)}</div></div>
    ${headButtons()}</header>
    ${ps.length ? `<button class="btn primary wide" data-act="add-plant">${I('plus')}Добавить растения</button>` : ''}`;
  if (!ps.length) html += emptyCard('Пока пусто', 'Добавьте первое растение, и джунгли начнутся 🌱');
  if (ps.length >= 6) html += `<div class="search mt-12"><input class="input" id="plants-q" type="search" aria-label="Найти растение" placeholder="${S.rooms.length > 1 ? 'Найти: имя, вид, место, комната' : 'Найти: имя, вид или место'}" autocomplete="off" value="${esc(plantQ)}">${I('search')}${searchX(plantQ)}</div>` + stateFilter(ps);
  // With several rooms: groups go room by room, titled «Кухня · Белый стол».
  if (S.rooms.length > 1) S.rooms.forEach((rm) => { html += spotGroups(ps.filter((p) => roomOf(p) === rm), rm.name); });
  else html += spotGroups(ps);
  if (ps.length) html += `<p id="plants-none" class="empty-note muted" hidden>Таких растений нет. Попробуйте другое слово или «Все».</p>`;
  return html;
}

// Plant cards grouped by place, in the order of the places list; `room` prefixes the titles.
function spotGroups(ps, room) {
  let html = '';
  const groups = {};
  ps.sort(bySpot).forEach((p) => { (groups[p.spot || ''] ||= []).push(p); });
  Object.keys(groups).sort((a, b) => spotIdx(a) - spotIdx(b)).forEach((spot) => {
    html += `<section class="pgroup"><div class="group-title">${room || spot ? [room, spot].filter(Boolean).map(typedHtml).join(' · ') : 'Место не выбрано'}</div><div class="grid">`;
    groups[spot].forEach((p) => {
      const ph = photoOf(p.id);
      const st = states(p);
      const pic = ph ? `<img class="fill" src="${ph}" alt=""><img src="${ph}" alt="">` : plantSvg(p, mood(p, st)[2]);
      html += `<button class="pcard" data-open="${esc(p.id)}" data-st="${filterKeys(p, st).join(' ')}" data-q="${esc(norm([p.title, p.species, p.spot, S.rooms.length > 1 ? roomOf(p).name : ''].join(' ')))}"><div class="pic">${pic}<span class="badges">${stateChips(p, false, st)}${ghBadge(p)}${growBadges(p)}</span></div>
        <b>${typedHtml(p.title)}</b><small>${p.name ? typedHtml(p.species) + '<br>' : ''}${wayOf(p).noChecks ? `<span class="next">${esc(wayOf(p).name)}</span>` : `<span class="next">${wayOf(p).fixed ? `${I('calendar-check')}<span class="sr-only">проверка автополива</span>` : `${I('droplet')}<span class="sr-only">проверка полива</span>`} ${esc(rel(p.nextCheck))}</span>`}</small></button>`;
    });
    html += `</div></section>`;
  });
  return html;
}

// Status filter under the search: «Все» and one chip per state that has plants, with face, word and count.
// The chips also teach which face means what.
let plantSt = '';
// Filter keys of a plant: its states, «greenhouse» when it lives in the теплица, and its unusual way of growing.
const filterKeys = (p, st = states(p)) => [...st, ...(p.greenhouse ? ['greenhouse'] : []), ...(isNew(p) ? ['new'] : []), ...(resting(p) ? ['rest'] : []), ...(petsOn() && petsOf(p) === 'toxic' ? ['pets'] : []), ...growKeys(p)];
function stateFilter(ps) {
  const n = {};
  const due = [];
  ps.forEach((p) => filterKeys(p).forEach((k) => { n[k] = (n[k] || 0) + 1; if (k === 'need') due.push(p); }));
  // A chosen state with no plants left shows «Все»; filterPlants() then clears plantSt.
  const sel = n[plantSt] ? plantSt : '';
  // Same chips as in the plant card; the chosen one gets a ring in its own color.
  const chip = (k, label, cls = k || 'all') => `<button class="mood hero-mood st-chip ${cls} ${sel === k ? 'on' : ''}" data-act="st-filter" data-st="${k}" aria-pressed="${sel === k}">${label}</button>`;
  // The plants' own word when every plant due shares it («мутновато», «пустовато»), else «суховато».
  const word = (k) => (k === 'need' && new Set(due.map((p) => stateWord(k, p))).size === 1 ? stateWord(k, due[0]) : STATES[k][1]);
  return `<div class="st-filter mt-10" role="group" aria-label="Показать растения">${chip('', `Все <span class="n">${ps.length}</span>`)}
    ${Object.keys(STATES).filter((k) => n[k]).map((k) => chip(k, `${I(STATES[k][0])}${word(k)} <span class="n">${n[k]}</span>`)).join('')}
    ${n.greenhouse ? chip('greenhouse', `${I('house-heart')}в теплице <span class="n">${n.greenhouse}</span>`) : ''}
    ${n.rest ? chip('rest', `${I('moon')}отдыхают <span class="n">${n.rest}</span>`, 'greenhouse') : ''}
    ${n.new ? chip('new', `${I('biohazard')}на карантине <span class="n">${n.new}</span>`, 'greenhouse') : ''}
    ${n.pets ? chip('pets', `${I('paw-print')}ядовиты для питомцев <span class="n">${n.pets}</span>`, 'pets toxic') : ''}
    ${[...Object.keys(MEDIA), ...Object.keys(WATERING)].filter((k) => n[k] && growBadge(k)).map((k) => chip(k, `${I(growBadge(k)[0])}${growBadge(k)[1]} <span class="n">${n[k]}</span>`, 'way')).join('')}</div>`;
}

// Search on the Plants tab: filters the cards in place, so the field keeps focus.
let plantQ = '';
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
function filterPlants() {
  if (!$('#plants-q')) { plantQ = ''; plantSt = ''; } // no search or filter (fewer than 6 plants): show everything
  if (plantSt && !document.querySelector(`.st-chip.on[data-st="${plantSt}"]`)) plantSt = ''; // no plants left in that state
  const q = norm(plantQ.trim());
  let any = false;
  document.querySelectorAll('.pgroup').forEach((g) => {
    let n = 0;
    g.querySelectorAll('.pcard').forEach((c) => {
      const on = (!q || c.dataset.q.includes(q)) && (!plantSt || c.dataset.st.split(' ').includes(plantSt));
      c.hidden = !on; if (on) n++;
    });
    g.hidden = !n; any ||= n > 0;
  });
  const none = $('#plants-none');
  if (none) none.hidden = any;
  return any;
}
let plantsSearchTimer;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'plants-q') return;
  plantQ = e.target.value;
  const found = filterPlants();
  clearTimeout(plantsSearchTimer);
  if (plantQ.trim()) plantsSearchTimer = setTimeout(() => track('plants_searched', { found }), 1200);
});

/* ---------- Light ---------- */
const LUX_SCALE = 40000;

// Thousands without «тыс»: «8–18 тыс люксов».
const kNum = (n) => (n / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
// A row: the picture beside the name, what it needs and the reading («?» while empty; the tag once measured), then the bar.
function lightRow(p) {
  const ls = lightStatus(p);
  const [a, b] = p.luxRange;
  const left = (Math.min(a, LUX_SCALE) / LUX_SCALE) * 100;
  const width = ((Math.min(b, LUX_SCALE) - Math.min(a, LUX_SCALE)) / LUX_SCALE) * 100;
  const dot = p.lux ? `<i class="dot ${ls}" data-l="${clamp((p.lux / LUX_SCALE) * 100, 0, 100)}"></i>` : '';
  const state = ls ? `<span class="tag ${ls}">${LIGHT_WORDS[ls]}</span>` : '';
  return `<div class="lux-row" id="lux-${esc(p.id)}"><span class="nm-pl lux-pic">${photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p, mood(p)[2])}</span>
    <div class="nm">${typedHtml(p.title)}</div>
    <div class="need">нужно ${kNum(a)}–\u2060${kNum(b)}\u00a0тыс люксов${p.spot ? ' · ' + typedHtml(p.spot) : ''}</div>
    <div class="lux-read"><input class="input" type="number" inputmode="numeric" placeholder="?" aria-label="Замер для ${esc(p.title)}, люкс" data-field="lux" data-id="${esc(p.id)}" value="${p.lux ?? ''}"><span class="unit" aria-hidden="true">лк</span><span class="lux-state">${state}</span></div>
    <div class="lux-bar"><i class="range" data-l="${left}" data-w="${width}"></i>${dot}</div></div>`;
}

// Empty screens: tap the plants you have and add them in one go. Anything else is one tap away. Six, so the add
// button stays near them: the most searched care in Yandex («<растение> уход»), with one-word names so tiles read
// at a glance. «Фикус» leads the searches: its tile adds the genus card, and «Сменить карточку» picks the
// species once it's known. «Кактус» is the general type: one tile for every cactus, and a drawing no other tile has.
// Begonia's searches include garden ones, but even half of them would beat the next plant, so it stays.
const QUICK = [['phal', 'Орхидея'], ['ficus-genus', 'Фикус'], ['calathea', 'Калатея'], ['g-cactus', 'Кактус'],
  ['anth', 'Антуриум'], ['begonia', 'Бегония']];
let qsPicked = new Set();
let qsReported = false;
// Tiles ticked but not added: reported once when the person turns to another way of adding or leaves the app.
// The ticks stay, so coming back to the same screen keeps them.
function endQuick(then) {
  if (!qsPicked.size || qsReported) return;
  track('quick_abandoned', { picked: qsPicked.size, then });
  qsReported = true;
}
// «Добавить» under the tiles. The word after the number can hide on a narrow screen with large text (style.css).
const qsAddText = (n) => (n ? `${I('plus')}Добавить ${n}<span class="qs-noun"> ${plural(n, 'растение', 'растения', 'растений')}</span>` : 'Ничего не выбрано');
function quickStart() {
  const tiles = QUICK.map(([k, label]) => {
    const on = qsPicked.has(k);
    return `<button class="qs${on ? ' on' : ''}" data-act="qs-pick" data-key="${k}" aria-pressed="${on}">
      <span class="qs-pic" aria-hidden="true">${plantSvg(PLANTS.find((p) => p.id === k), 'fine')}</span><span class="qs-name">${label}</span></button>`;
  }).join('');
  const n = qsPicked.size;
  return `<p class="mt-14 qs-title"><b>Что у вас растёт?</b> Отметьте, а остальное найдём в каталоге.</p>
    <div class="qs-grid">${tiles}</div>
    <button class="mt-12 btn primary wide" data-act="qs-add" id="qs-add"${n ? '' : ' disabled'}>${qsAddText(n)}</button>
    <button class="mt-8 btn ghost wide" data-act="add-plant">${I('search')}Другие растения</button>
    <p class="mt-12 small muted">Растений много? <button class="linkish" data-act="add-import">Перенести из чата с ИИ</button></p>
    <p class="mt-8 small muted name-help">Не знаете название? <button class="linkish" data-act="name-help" data-from="empty">Как узнать</button></p>`;
}
// After adding from the catalog or the quick picks: one plant opens its card, several go to «Растения».
function addFromCatalog(keys, source) {
  const ids = addPlants(keys);
  if (!ids.length) return;
  track('plants_added', { count: ids.length, generic_count: ids.filter((i) => def(i).generic).length, catalog_ids: ids.map((i) => def(i).id), source });
  save();
  if (ids.length === 1) { openPlant(ids[0], 'settings', ['name', 'place']); render(); toast('Добро пожаловать в джунгли! Дайте имя и выберите место 🌱'); return; }
  tab = 'plants'; closeSheet(); window.scrollTo(0, 0);
  toast(`Добавлено ${plantsN(ids.length)} 🌱 Откройте каждое, чтобы выбрать место`);
}

// The card on an empty screen with the quick picks. Where installing comes first (installFirst), the card gets short
// (no big picture, `short` text) and the way to install goes under it at full width, so its buttons fit the first screen.
// `bare`: without the title and text (the empty «Сегодня»).
function emptyCard(title, text, { big = '', short = text, after = '', bare = false } = {}) {
  const gate = installFirst();
  if (gate) return bare ? gate : `<div class="celebrate compact"><h2>${title}</h2><p class="muted">${short}</p></div>${gate}`;
  return `<div class="celebrate">${bare ? '' : `${big}<h2>${title}</h2><p class="muted">${text}</p>`}${quickStart()}${after}</div>`;
}

function viewLight() {
  const ps = allPlants().sort((a, b) => b.luxRange[0] - a.luxRange[0] || b.luxRange[1] - a.luxRange[1]);
  const measured = ps.filter((p) => p.lux).length;
  if (!ps.length) {
    return `<header class="hello head-row"><div><h1>Свет</h1></div>${headButtons()}</header>
      ${emptyCard('Свет для каждого растения', 'Добавьте растения, и я покажу, кому сколько света нужно, а по замерам люксметром подскажу, кого переставить ближе к окну.', { short: 'Добавьте растения, и я покажу, кому сколько света нужно.' })}`;
  }
  return `<header class="hello head-row"><div><h1>Свет</h1><div class="date">замерено ${measured} из ${ps.length}</div></div>${headButtons()}</header>
    <p class="small muted">Замеряйте люксметром у листьев днём. Подойдёт и приложение для телефона.</p>
    <h2>От самых светолюбивых</h2>
    ${ps.map(lightRow).join('')}`;
}

/* ---------- Rooms ---------- */
const roomOf = (p) => S.rooms.find((r) => r.id === p.room) || S.rooms[0];
// Shown with the room's humidity advice: room-wide humidity makes windows sweat in winter.
const CONDENSATION = 'Зимой при влажности выше 40% на холодных окнах выпадает конденсат, поэтому увлажняйте воздух у растений, а не во всей комнате.';
const roomsN = (n) => `${n} ${plural(n, 'комната', 'комнаты', 'комнат')}`;

// One room: its reading, who is uncomfortable, and what suits everyone in it.
function roomCard(rm, ps, many) {
  const ranges = ps.map((p) => [p, tempRange(p)]).filter(([, t]) => t);
  const lo = Math.max(...ranges.map(([, t]) => t[0]));
  const hi = Math.min(...ranges.map(([, t]) => t[1]));
  const humidOnes = ps.filter((p) => p.humid).map((p) => p.title);
  const has = rm.t != null && rm.h != null;
  let status = '';
  if (has) {
    const notes = [];
    const cold = ranges.filter(([, t]) => rm.t < t[2]).map(([p]) => p.title);
    const hot = ranges.filter(([, t]) => rm.t > t[1]).map(([p]) => p.title);
    if (cold.length) notes.push(['snowflake', `Прохладно для: ${cold.map(typedHtml).join(', ')}. Уберите от холодного окна или включите обогреватель.`]);
    if (hot.length) notes.push(['flame', `Жарковато для: ${hot.map(typedHtml).join(', ')}. Проветрите или отодвиньте от горячей батареи.`]);
    if (rm.h < 50) {
      notes.push(['droplet-off', `Сухо (${esc(rm.h)}%). Увлажните воздух рядом с растениями${humidOnes.length ? `: особенно страдают ${humidOnes.map(typedHtml).join(', ')}` : ''}.`]);
    }
    if (rm.h > 75) notes.push(['droplets', `Очень влажно (${esc(rm.h)}%). Проветрите: сырость и застой воздуха ведут к грибкам. Следите за сфагнумом.`]);
    // Above every card's floor («не ниже 16 °C») but below the range they all like: fine, not ideal.
    const mild = !cold.length && ranges.length && lo <= hi && rm.t < lo;
    status = notes.map(([i, n]) => `<div class="status warn">${I(i)}<span>${n}</span></div>`).join('')
      + (mild ? `<div class="status ok">${I('smile')}<span>Терпимо для всех. Удобнее всего при ${lo}–${hi} °C.</span></div>`
        : !notes.length && ps.length ? `<div class="status ok">${I('smile')}<span>Всем комфортно. Так держать!</span></div>` : '');
  }
  const ago = has ? (rm.d === today() ? 'сегодня' : rel(rm.d)) : '';
  const name = esc(rm.name);
  const head = many ? `<div class="room-head"><div><h2>${typedHtml(rm.name)}</h2>
      <div class="small muted">${plantsN(ps.length)} · ${has ? 'замер: ' + esc(ago) : 'замеров пока нет'}</div></div>
      <button class="icon-btn" data-act="room-rename" data-room="${esc(rm.id)}" aria-label="Переименовать комнату ${name}">${I('pencil')}</button>
      <button class="icon-btn" data-act="room-del" data-room="${esc(rm.id)}" aria-label="Убрать комнату ${name}">${I('x')}</button></div>` : '';
  const comfort = !ranges.length ? '' : many
    ? `<p class="small muted mt-10">Удобно всем здесь: ${lo <= hi ? `${lo}–${hi} °C` : 'общего диапазона нет, смотрите карточки'}, влажность 50–70% рядом с растениями.</p>`
    : `<h2>Чтобы было удобно всем</h2>
    <div class="info"><b>Температура</b>${lo <= hi ? `При ${lo}–${hi} °C комфортно всем вашим растениям.` : 'Общего диапазона нет, смотрите условия в карточках.'}</div>
    <div class="info"><b>Влажность</b>50–70% рядом с растениями.${humidOnes.length ? ` Если ниже, сохнут кончики листьев у этих растений: ${esc(humidOnes.join(', '))}.` : ''} Выше 75% без проветривания есть риск грибков. ${CONDENSATION}</div>`;
  return `<section class="${many ? 'room' : ''}">${head}
    <div class="room-cards">
      <div class="metric"><div class="lbl">Температура</div><div class="val">${has ? esc(rm.t) + '°' : '—'}</div>
        <input class="input" id="in-t-${esc(rm.id)}" aria-label="Температура${many ? ', ' + name : ''}, °C" type="number" inputmode="decimal" step="0.5" placeholder="°C" value="${has ? rm.t : ''}"></div>
      <div class="metric"><div class="lbl">Влажность</div><div class="val">${has ? esc(rm.h) + '%' : '—'}</div>
        <input class="input" id="in-h-${esc(rm.id)}" aria-label="Влажность${many ? ', ' + name : ''}, %" type="number" inputmode="numeric" placeholder="%" value="${has ? rm.h : ''}"></div>
    </div>
    <button class="mt-10 btn primary wide" data-act="room-save" data-room="${esc(rm.id)}">Записать</button>
    ${status}
    ${many && !ps.length ? '<p class="small muted mt-10">Пока без растений. Выберите эту комнату в карточке растения.</p>' : ''}
    ${comfort}</section>`;
}

function viewRoom() {
  const ps = allPlants();
  const many = S.rooms.length > 1;
  const one = S.rooms[0];
  const date = many ? roomsN(S.rooms.length)
    : one.t != null ? 'замер: ' + (one.d === today() ? 'сегодня' : rel(one.d)) : 'замеров пока нет';
  return `<header class="hello head-row"><div><h1>${many ? 'Комнаты' : 'Комната'}</h1><div class="date">${esc(date)}</div></div>${headButtons()}</header>
    ${ps.length ? '' : emptyCard('Температура и влажность', 'Добавьте растения, и я подскажу, какая температура и влажность удобны именно им.', { short: 'Добавьте растения, и я подскажу, какой климат им нужен.' })}
    <p class="small muted">Впишите, что показывает датчик рядом с растениями, и я скажу, кому некомфортно.</p>
    ${S.rooms.map((rm) => roomCard(rm, ps.filter((p) => roomOf(p) === rm), many)).join('')}
    <button class="mt-12 btn ghost wide" data-act="room-add">Добавить комнату</button>
    ${many ? (ps.some(tempRange) ? `<p class="small muted mt-6">${CONDENSATION}</p>` : '') : '<p class="small muted mt-6">Растения в разных комнатах? Добавьте комнату, у каждой будет свой замер.</p>'}

    <h2>Если есть умный дом</h2>
    <p class="small muted">Например, в «Доме с Алисой» → Сценарии. Для условий по влажности и температуре датчик должен быть подключён к умному дому. Датчик влажности и увлажнитель ставьте рядом с растениями.</p>
    <div class="scenario"><span>${I('alarm-clock')}</span><div><b>Каждый день в 10:00</b> → Алиса говорит: «Пора заглянуть в Жунгли! Растения ждут»</div></div>
    <div class="scenario"><span>${I('droplets')}</span><div><b>Влажность у растений ниже 50%</b> → включить увлажнитель</div></div>
    <div class="scenario"><span>${I('droplet-off')}</span><div><b>Влажность у растений выше 70%</b> → выключить увлажнитель</div></div>
    <div class="scenario"><span>${I('flame')}</span><div><b>Температура ниже 21 °C</b> → включить обогреватель</div></div>
    <div class="scenario"><span>${I('snowflake')}</span><div><b>Температура выше 25 °C</b> → выключить обогреватель</div></div>
    <div class="scenario"><span>${I('lamp')}</span><div><b>Фитолампы через умную розетку, если есть:</b> включать в 8:00, выключать в 21:00. Это 12–14 часов света в день, без ночного досвета.</div></div>`;
}

/* ---------- Taps on the tabs ---------- */
const WATER_CHEERS = ['Напоено! 💧', 'Глоток счастья 💧', 'Кап-кап, спасибо! 💧'];
Object.assign(ACTS, {
  water(el, id) {
    const undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', ...kindOf(id) });
    afterTask(wayOf(plant(id)).fixed ? 'Автополив работает ✅' : WATER_CHEERS[Math.floor(Math.random() * WATER_CHEERS.length)], undo);
  },
  wet(el, id) {
    const undo = snapshot(); actWet(id); track('plant_checked', { answer: 'wet', ...kindOf(id) });
    afterTask(wayOf(plant(id)).fixed ? `Отлично! Проверю систему ещё раз ${rel(S.plants[id].nextCheck)} 🔧` : `Ок, загляну к ${plant(id).title} ${rel(S.plants[id].nextCheck)} 👌`, undo);
  },
  later(el, id) {
    const undo = snapshot(); actLater(id); track('plant_checked', { answer: 'later', ...kindOf(id) }); afterTask('Перенесено на завтра ⏭︎', undo);
  },
  'vent-done'(el, id) {
    const undo = snapshot(); S.plants[id].ventLast = today(); logToday({ id, a: 'vent' }); track('greenhouse_vented');
    afterTask('Свежий воздух! 🌬️', undo);
  },
  'inspect-done'(el, id) {
    const undo = snapshot(); S.plants[id].inspected = today(); logToday({ id, a: 'inspect' }); track('quarantine_checked');
    afterTask(isNew(plant(id)) && diff(S.plants[id].bought, today()) + 7 >= NEW_DAYS ? 'Карантин позади: можно ставить к остальным 🌿' : 'Осмотрено 🔍 Загляну через неделю', undo);
  },
  'inspect-off'(el, id) {
    const undo = snapshot(); S.plants[id].bought = false; track('quarantine_toggled', { on: false, from: 'task' }); afterTask('Хорошо, больше не зову осматривать', undo);
  },
  async 'vent-off'(el, id) {
    if (await ask({ title: 'Теплица больше не нужна?', text: 'Больше не позову проветривать.', ok: 'Не нужна' })) {
      const undo = snapshot(); S.plants[id].greenhouse = false; track('greenhouse_removed'); afterTask('Ура, без теплицы! 🎉', undo);
    }
  },
  how(el, id) {
    const open = el.getAttribute('aria-expanded') !== 'true';
    document.getElementById('how-' + id).hidden = !open;
    el.setAttribute('aria-expanded', open);
    howOpen.set(id, open);
    if (open) track('how_opened', kindOf(id));
  },
  'bath-yes'() { bathStep = 1; bathRender('[data-act="bath-go"]'); track('bath_day_started'); },
  'bath-cancel'() { bathStep = 0; bathOff = new Set(); bathRender('[data-act="bath-yes"]'); },
  'plant-pick'(el) {
    const off = pickOff(el.dataset.kind), id = el.dataset.pick, on = off.has(id);
    if (on) off.delete(id); else off.add(id);
    el.classList.toggle('on', on); el.setAttribute('aria-pressed', on);
    el.querySelector('.pc').innerHTML = I(on ? 'check' : 'plus');
  },
  'bath-go'(el) {
    bathPicked = [...el.closest('.task').querySelectorAll('[data-pick]')].filter((x) => x.getAttribute('aria-pressed') === 'true').map((x) => x.dataset.pick);
    if (!bathPicked.length) { toast('Отметьте, кого купаем'); return; }
    bathStep = 2; bathRender('[data-act="bath-done"]');
  },
  'bath-back'() { bathStep = 1; bathRender('[data-act="bath-go"]'); },
  'bath-skip'() { S.snooze.bath = addDays(today(), 3); save(); render(); track('bonus_skipped', { kind: 'bath' }); toast('Ок, через 3 дня 🙂'); },
  // A rinse is a thorough watering: it counts as one, and the plant's rinse restarts.
  'bath-done'() {
    const undo = snapshot(), ids = bathPicked.filter((id) => S.plants[id]);
    // Logged as waterings, so they count on «Сегодня» like a check answered; one watered meanwhile isn't watered twice.
    ids.forEach((id) => { if (S.plants[id].lastWater !== today()) actWater(id); rinseDone(id); });
    S.bonus.bath = today();
    bathStep = 0; bathPicked = []; bathOff = new Set();
    logToday({ a: 'bonus:bath', title: 'Банный день' });
    const left = bathPlan().due;
    track('bath_day_done', { n: ids.length, left: left.length });
    afterTask(left.length ? `Все чистые 🛁 В следующий раз: ${nameList(left)}` : 'Все чистые 🛁 До следующего круга', undo);
  },
  'bonus-done'(el) {
    const undo = snapshot();
    if (el.dataset.key.startsWith('feed:')) {
      const boxes = [...el.closest('.task').querySelectorAll('[data-pick]')], on = (x) => x.getAttribute('aria-pressed') === 'true';
      const fed = boxes.filter(on).map((x) => x.dataset.pick);
      if (!fed.length) { toast('Отметьте, кого подкормили'); return; }
      fed.forEach(feedDone);
      boxes.filter((x) => !on(x)).forEach((x) => { S.snooze['feed:' + x.dataset.pick] = addDays(today(), 3); });
      feedOff = new Set();
      track('feeding_logged', { from: 'day', n: fed.length, of: boxes.length });
      logToday({ a: 'bonus:feed', title: 'День подкормки' });
      afterTask(fed.length === boxes.length ? 'Все накормлены 🍽️' : `Подкормлено: ${plantsN(fed.length)} 🍽️`, undo);
      return;
    }
    const b = bonusTasks().find((x) => x.key === el.dataset.key);
    bonusDone(el.dataset.key);
    track('bonus_done', { kind: el.dataset.key.split(':')[0] });
    logToday({ id: b?.p?.id, a: 'bonus:' + el.dataset.key, title: b?.title });
    afterTask('Бонус засчитан ✨', undo);
  },
  'bonus-skip'(el) {
    track('bonus_skipped', { kind: el.dataset.key.split(':')[0] });
    bonusKeys(el.dataset.key).forEach((k) => { S.snooze[k] = addDays(today(), 3); }); save(); render(); toast('Ок, через 3 дня 🙂');
  },
  // The feedback task asks once: «Написать» (the link opens Telegram) and «Не нужно» both put it away for good.
  'feedback-answer'(el) {
    S.bonus.feedback = today();
    track(el.dataset.wrote ? 'bonus_done' : 'bonus_skipped', { kind: 'feedback' });
    save();
    // After the link has done its job: re-rendering now would remove it mid-click.
    setTimeout(() => { render(); if (!el.dataset.wrote) toast('Хорошо, больше не спрошу 🙂'); }, 0);
  },
  'show-all'() { showAll = true; track('show_all_clicked'); render(); },
  'stay-browser'(el) { S.stayBrowser = today(); track('install_declined', { where: el.dataset.kind }); save(); render(); },
  'home-added'() { S.homeIcon = today(); track('install_hint_hidden', { kind: 'ios_added' }); save(); render(); },
  'hide-install'(el) { S.hideInstall = true; track('install_hint_hidden', el.dataset.kind ? { kind: el.dataset.kind } : {}); save(); render(); },
  install() {
    const ask = installPrompt;
    if (!ask) return;
    installPrompt = null; // the browser's prompt works once
    try { Promise.resolve(ask.prompt()).catch(() => {}); } catch (err) { /* the browser refused: userChoice settles anyway */ }
    ask.userChoice.then(({ outcome }) => { track('install_prompt', { outcome }); render(); }, () => render());
  },
  'tg-home'() { if (window.tgHome) window.tgHome.add(); track('tg_home_screen_tapped'); },
  'winter-ok'() { S.winterSeen = winterOf(); save(); render(); track('winter_hint_hidden'); },
  'stats-ok'() { S.statsNotice = true; save(); render(); },
  'stats-off'() { statsQueue = []; S.settings.stats = false; S.statsNotice = true; save(); render(); toast('Статистика выключена'); },
  'open-mini-app'() { track('mini_app_link_clicked', { has_plants: Object.keys(S.plants).length > 0 }); flushStats(); }, // the link opens Telegram
  'hide-telegram'() { S.hideTelegram = true; track('telegram_hint_hidden'); save(); render(); },
  'qs-pick'(el) {
    const k = el.dataset.key;
    if (qsPicked.has(k)) qsPicked.delete(k); else qsPicked.add(k);
    qsReported = false;
    el.classList.toggle('on', qsPicked.has(k));
    el.setAttribute('aria-pressed', qsPicked.has(k));
    const b = $('#qs-add');
    b.disabled = !qsPicked.size;
    b.innerHTML = qsAddText(qsPicked.size);
  },
  'qs-add'() {
    const keys = [...qsPicked];
    qsPicked = new Set();
    addFromCatalog(keys, 'quick');
  },
  'st-filter'(el) {
    plantSt = el.dataset.st;
    el.parentElement.querySelectorAll('.st-chip').forEach((c) => { c.classList.toggle('on', c === el); c.setAttribute('aria-pressed', c === el); });
    filterPlants();
    track('plants_filtered', { status: plantSt || 'all' });
  },
  'room-save'(el) {
    const rm = S.rooms.find((x) => x.id === el.dataset.room);
    if (!rm) return;
    const t = parseFloat(String($(`#in-t-${rm.id}`).value).replace(',', '.'));
    const h = parseFloat(String($(`#in-h-${rm.id}`).value).replace(',', '.'));
    if (Number.isNaN(t) || Number.isNaN(h)) { toast('Впишите обе цифры 🙂'); return; }
    Object.assign(rm, { t, h, d: today() }); save(); render(); toast('Записано 🌡️');
    track('room_saved', { temp: Math.round(t), humidity: Math.round(h), rooms: S.rooms.length });
  },
  // Rooms are also added, renamed and removed from settings (data-from="settings").
  async 'room-add'(el) {
    const name = (await ask({ title: 'Как называется комната?', input: { placeholder: 'Например, «Спальня» или «Кухня»' }, ok: 'Добавить' })) || '';
    if (!name) return;
    S.rooms.push(newRoom('r' + Date.now().toString(36), name)); save(); render();
    if (el.dataset.from === 'settings') openSettings();
    toast('Комната добавлена. Выберите её в карточках растений 🪴');
    track('room_added', { rooms: S.rooms.length });
  },
  async 'room-rename'(el) {
    const rm = S.rooms.find((x) => x.id === el.dataset.room);
    const name = rm && ((await ask({ title: 'Новое название комнаты', input: { value: rm.name }, ok: 'Сохранить' })) || '');
    if (name) { rm.name = name; save(); render(); if (el.dataset.from === 'settings') openSettings(); }
  },
  async 'room-del'(el) {
    const rm = S.rooms.find((x) => x.id === el.dataset.room);
    if (!rm || S.rooms.length < 2) return;
    const rest = S.rooms.filter((x) => x !== rm);
    if (!(await ask({ title: `Убрать комнату «${rm.name}»?`, text: `Её растения перейдут в «${rest[0].name}».`, ok: 'Убрать', danger: true }))) return;
    Object.values(S.plants).forEach((r) => { if (roomOf(r) === rm) r.room = rest[0].id; });
    S.rooms = rest; save(); render();
    if (el.dataset.from === 'settings') openSettings();
    track('room_removed', { rooms: S.rooms.length });
  },
});
