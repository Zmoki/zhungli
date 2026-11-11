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
    : `<span class="gh" title="В теплице">${I('house-heart')}<span class="sr-only">в теплице</span></span>`);

// Badges for an unusual way of growing («в воде», «на фитиле»…), as the greenhouse one: worded chips in the
// plant card, and on grid cards one icon (the medium's first), so badges don't pile up over the picture.
// Keys go to the status filter too. Left out: a catalog card's own medium, which its name already says
// (lucky bamboo, cuttings in water), and a watering that is the medium's usual one (clay pebbles on a reservoir).
const growBadge = (k) => (MEDIA[k] || WATERING[k] || {}).badge;
function growKeys(p) {
  const keys = [];
  if (growBadge(p.type) && !(p.type === p.cardType && !isCustom(p.id))) keys.push(p.type);
  if (growBadge(p.watering) && p.watering !== MEDIA[p.type].watering) keys.push(p.watering);
  return keys;
}
const growBadges = (p, words) => growKeys(p).slice(0, words ? 2 : 1).map((k) => {
  const [icon, word] = growBadge(k);
  return words ? `<span class="mood hero-mood way">${I(icon)}${word}</span>`
    : `<span class="gh way" title="${cap(word)}">${I(icon)}<span class="sr-only">${word}</span></span>`;
}).join('');

function ava(p, cls = 'ava') {
  const inner = photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p, mood(p)[2]);
  return `<button class="${cls}" data-open="${esc(p.id)}" aria-label="Открыть ${esc(p.title)}">${inner}</button>`;
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
  && (/FBAN|FBAV|Instagram|LinkedInApp|\bLine\/|VKClient|VKAndroidApp|OKApp/i.test(navigator.userAgent)
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
    share: /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//.test(ua) ? 'Safari → «Поделиться»' : '«Поделиться»',
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
  if (IOS && !IN_TELEGRAM && !navigator.standalone && !S.hideInstall) return 'ios';
  return null;
}
let installFirstShown = false;
function installFirst() {
  const kind = installWhere();
  if (!kind) return '';
  if (!installFirstShown) { installFirstShown = true; track('install_first_shown', { where: kind }); }
  const { share, device, where, menu } = PLACE;
  const stay = (label) => `<button class="btn ghost" data-act="stay-browser" data-kind="${kind}">${label}</button>`;
  if (kind === 'telegram_browser') {
    return hintCard('sprout', 'Сначала откройте Жунгли в Телеграме',
      'Это встроенный браузер Телеграма: отмеченное здесь может потеряться. В приложении Телеграма растения хранятся в облаке и появятся на любом устройстве.',
      `<a class="btn ok" href="${MINI_APP_LINK}" data-act="open-mini-app">${I('sprout')}Открыть</a>${stay('Остаться здесь')}`);
  }
  if (kind === 'in_app') {
    return hintCard('triangle-alert', `Сначала откройте Жунгли ${where}`,
      `Это встроенный браузер приложения: отсюда Жунгли не добавить на экран «Домой», а отмеченное здесь может потеряться. В меню приложения выберите ${menu}.`,
      stay('Остаться здесь'));
  }
  return hintCard('smartphone', 'Сначала добавьте Жунгли на экран «Домой»',
    `${share} → «На экран Домой», затем откройте Жунгли с иконки и отмечайте растения там. ${device} хранит их отдельно от браузера: отмеченное здесь туда не перейдёт, а браузер может его стереть, если пару недель не заходить.`,
    `${stay('Остаться в браузере')}<button class="btn ghost" data-act="hide-install" data-kind="ios_empty">Уже на экране</button>`);
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
      'Это встроенный браузер Телеграма. Перенесите их в приложение Телеграма: «Настройки» → «Сохранить копию» здесь, затем «Восстановить» там.',
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
        `${why} Сохраните копию, откройте Жунгли ${where} (в меню приложения — ${menu}) и восстановите её там.`,
        '<button class="btn ok" data-act="export" data-from="in_app_hint">Сохранить копию</button><button class="btn ghost" data-act="hide-install" data-kind="in_app">Понятно</button>')
      : hintCard('triangle-alert', `Откройте Жунгли ${where}`,
        `${why} В меню приложения выберите ${menu}.`,
        '<button class="btn ghost" data-act="hide-install" data-kind="in_app">Понятно</button>');
  }
  // Stats run from the first screen, so their notice shows from the first screen too.
  const stats = !S.statsNotice && S.settings.stats !== false
    ? hintCard('lightbulb', 'Анонимная статистика',
      'Чтобы понять, что улучшить, Жунгли отправляют, какие кнопки нажимают, — без названий, заметок и фото. <a class="linkish" href="privacy" data-from="stats_notice">Подробнее</a>',
      '<button class="btn" data-act="stats-ok">Понятно</button><button class="btn ghost" data-act="stats-off">Выключить</button>')
    : '';
  // iPhone keeps a home-screen app's data apart from the browser's: the icon opens an empty Жунгли.
  const iosBrowser = IOS && !navigator.standalone && !MINI_APP && !IN_APP && !S.hideInstall && !gated;
  const { share, device } = PLACE;
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
    return hintCard('smartphone', 'Добавьте Жунгли на экран «Домой»',
      `Так ${device} не сотрёт ваши отметки. ${share} → «На экран Домой». Оттуда Жунгли откроются пустыми: сначала сохраните копию здесь, а там нажмите «Восстановить копию».`,
      '<button class="btn ok" data-act="export" data-from="install_hint">Сохранить копию</button><button class="btn ghost" data-act="hide-install" data-kind="ios_move">Уже на экране</button>');
  }
  return '';
}

// «Species · place» under a plant's name on task cards; `extra` adds e.g. the last watering.
const plantSub = (p, ...extra) => [p.name ? p.species : '', p.spot, ...extra].filter(Boolean).join(' · ');
// Every task card on «Сегодня» has one layout: picture and name, the plant's words, the task,
// the buttons, then how to do it. `p` is the plant (or `icon` and `name` for tasks without one).
function taskCard({ cls = '', p, icon, name, sub, quip, task, buttons, hint, after = '' }) {
  const pic = p ? ava(p) : `<div class="ava" aria-hidden="true">${I(icon)}</div>`;
  const line = p && sub === undefined ? plantSub(p) : sub;
  return `<div class="task${cls ? ' ' + cls : ''}"><div class="task-top">${pic}<div><div class="task-name">${esc(p ? p.title : name)}</div>
    ${line ? `<div class="task-sub">${esc(line)}</div>` : ''}</div></div>
    ${quip ? `<p class="quip">${esc(quip)}</p>` : ''}
    <div class="question">${esc(task)}</div>
    <div class="btns">${buttons}</div>
    ${hint ? `<div class="hint">${esc(hint)}</div>` : ''}${after}</div>`;
}

function viewToday() {
  const t = today();
  const { log, shown, vents, pending, doneMain, waiting, total } = todayPlan();
  const pct = total ? Math.round((doneMain / total) * 100) : 100;
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  let html = `<header class="hello head-row"><div><h1>${greeting()}!</h1><div class="date">${esc(date)}</div></div>
    ${headButtons()}</header>`;

  if (!allPlants().length) {
    return html + `<div class="celebrate"><div class="big">🌱</div><h2>Привет! Это Жунгли</h2>
      <p class="muted">Каждый день покажу пару растений, которые пора проверить, и запомню, как быстро сохнет каждое. Без долгов и красных просрочек.</p>
      ${quickStart()}
      ${installWhere() ? '' : `<p class="mt-12 small muted">Уже вели Жунгли ${navigator.standalone ? 'в браузере или на другом устройстве' : 'на другом устройстве'}? <button class="linkish" data-act="import">Восстановить копию</button></p>`}</div>
      ${currentHint()}`;
  }

  html += currentHint();

  if (total > 0) {
    html += `<div class="progress"><div class="head-row"><b>${pending ? `Осталось ${pending} ${plural(pending, 'дело', 'дела', 'дел')}` : 'Всё на сегодня!'}</b>
      <span class="muted small">${doneMain} из ${total}</span></div><div class="bar"><i data-w="${pct}"></i></div></div>`;
  }

  vents.forEach((v) => {
    html += taskCard({
      p: v, quip: pickDaily(v.id, VENT_QUIPS), task: 'Проветрите теплицу минут на\u00a015–\u206030', // no line break inside «на 15–30»
      buttons: `<button class="btn air" data-act="vent-done" data-id="${esc(v.id)}">${I('wind')}Проветрено</button>
        <button class="btn" data-act="vent-off" data-id="${esc(v.id)}">Без теплицы</button>`,
      hint: 'С каждым днём можно держать открытой чуть дольше.',
    });
  });

  shown.forEach((p) => {
    const [yes, no] = labelsOf(p);
    html += taskCard({
      p, sub: plantSub(p, p.lastWater ? `${actWords(p).sub} ${rel(p.lastWater)}` : ''), quip: quipOf(p), task: waterTask(p),
      buttons: `<button class="btn water" data-act="water" data-id="${esc(p.id)}">${I('droplet')}${yes}</button>
        <button class="btn" data-act="wet" data-id="${esc(p.id)}">${no}</button>`,
      hint: p.water,
      after: `<button class="later" data-act="later" data-id="${esc(p.id)}">${I('skip-forward')}Не сейчас, завтра</button>`,
    });
  });

  if (!pending) {
    if (doneMain) {
      html += `<div class="celebrate"><div class="big">🎉</div><h2>Джунгли довольны!</h2>
        <p class="muted">Вы сегодня молодец. Остальное — завтра.</p></div>`;
    } else {
      const tom = allPlants().filter((p) => p.nextCheck === addDays(t, 1) && !wayOf(p).noChecks).length;
      html += `<div class="celebrate"><div class="big">😴</div><h2>Сегодня отдыхаем</h2>
        <p class="muted">Все в порядке, никто не просит пить.${tom ? ` Завтра проверим ${plantsN(tom)}.` : ''}</p></div>`;
    }
  }

  if (waiting > 0) {
    html += `<button class="more" data-act="show-all">${I('moon')}Ещё ${waiting} ${plural(waiting, 'растение подождёт', 'растения подождут', 'растений подождут')} до завтра.<br>Есть силы? Показать</button>`;
  }

  const bonus = bonusTasks();
  if (bonus.length) {
    html += `<h2 class="h-ic">${I('sparkles')}Если есть силы</h2>`;
    bonus.forEach((b) => {
      html += taskCard({
        cls: 'bonus', p: b.p, icon: b.icon, name: b.title, sub: b.sub, task: b.task, hint: b.hint,
        buttons: `<button class="btn ok" data-act="bonus-done" data-key="${esc(b.key)}">${I('check')}Готово</button>
          <button class="btn ghost" data-act="bonus-skip" data-key="${esc(b.key)}">Не сегодня</button>`,
      });
    });
  }

  const doneRows = log.filter((e) => e.a !== 'later');
  if (doneRows.length) {
    const label = { water: 'полито', wet: 'ещё влажно', vent: 'проветрено', bonus: 'сделано' };
    html += `<details><summary class="group-title">Уже сделано сегодня · ${doneRows.length}</summary>`;
    doneRows.forEach((e) => {
      const p = e.id ? plant(e.id) : null;
      const what = e.title || (p ? p.title : '');
      html += `<div class="task done-row">${p ? ava(p) : `<div class="ava" aria-hidden="true">${I('check')}</div>`}<div class="grow">${esc(what)}</div>
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
  if (!ps.length) html += `<div class="celebrate"><h2>Пока пусто</h2><p class="muted">Добавьте первое растение — и джунгли начнутся 🌱</p>${quickStart()}</div>`;
  if (ps.length >= 6) html += `<div class="search mt-12"><input class="input" id="plants-q" type="search" aria-label="Найти растение" placeholder="${S.rooms.length > 1 ? 'Найти: имя, вид, место, комната' : 'Найти: имя, вид или место'}" autocomplete="off" value="${esc(plantQ)}">${I('search')}</div>` + stateFilter(ps);
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
    html += `<section class="pgroup"><div class="group-title">${esc(room ? [room, spot].filter(Boolean).join(' · ') : spot || 'Место не выбрано')}</div><div class="grid">`;
    groups[spot].forEach((p) => {
      const ph = photoOf(p.id);
      const st = states(p);
      const pic = ph ? `<img class="fill" src="${ph}" alt=""><img src="${ph}" alt="">` : plantSvg(p, mood(p, st)[2]);
      html += `<button class="pcard" data-open="${esc(p.id)}" data-st="${filterKeys(p, st).join(' ')}" data-q="${esc(norm([p.title, p.species, p.spot, S.rooms.length > 1 ? roomOf(p).name : ''].join(' ')))}"><div class="pic">${pic}<span class="badges">${stateChips(p, false, st)}${ghBadge(p)}${growBadges(p)}</span></div>
        <b>${esc(p.title)}</b><small>${p.name ? esc(p.species) + '<br>' : ''}${wayOf(p).noChecks ? `<span class="next">${esc(wayOf(p).name)}</span>` : `<span class="next">${I('droplet')}<span class="sr-only">проверка полива</span> ${esc(rel(p.nextCheck))}</span>`}</small></button>`;
    });
    html += `</div></section>`;
  });
  return html;
}

// Status filter under the search: «Все» and one chip per state that has plants, with face, word and count.
// The chips also teach which face means what.
let plantSt = '';
// Filter keys of a plant: its states, «greenhouse» when it lives in the теплица, and its unusual way of growing.
const filterKeys = (p, st = states(p)) => [...st, ...(p.greenhouse ? ['greenhouse'] : []), ...growKeys(p)];
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

function lightRow(p) {
  const ls = lightStatus(p);
  const [a, b] = p.luxRange;
  const left = (Math.min(a, LUX_SCALE) / LUX_SCALE) * 100;
  const width = ((Math.min(b, LUX_SCALE) - Math.min(a, LUX_SCALE)) / LUX_SCALE) * 100;
  const dot = p.lux ? `<i class="dot ${ls}" data-l="${clamp((p.lux / LUX_SCALE) * 100, 0, 100)}"></i>` : '';
  const state = ls ? `<span class="tag ${ls}">${LIGHT_WORDS[ls]}</span>` : '<span class="small muted">ещё не замерено</span>';
  return `<div class="lux-row" id="lux-${esc(p.id)}"><span class="nm-pl lux-pic">${photoOf(p.id) ? `<img src="${photoOf(p.id)}" alt="">` : plantSvg(p, mood(p)[2])}</span>
    <div class="nm">${esc(p.title)}</div><div class="lux-state">${state}</div>
    <input class="input" type="number" inputmode="numeric" placeholder="лк" aria-label="Замер для ${esc(p.title)}, люкс" data-field="lux" data-id="${esc(p.id)}" value="${p.lux ?? ''}">
    <div class="need">нужно ${kLux(a)}–\u2060${kLux(b)}${p.spot ? ' · ' + esc(p.spot) : ''}</div>
    <div class="lux-bar"><i class="range" data-l="${left}" data-w="${width}"></i>${dot}</div></div>`;
}

function lightIdeas() {
  const ps = allPlants().filter((p) => p.lux);
  const lows = ps.filter((p) => lightStatus(p) === 'low').sort((x, y) => (y.luxRange[0] - y.lux) - (x.luxRange[0] - x.lux));
  const highs = ps.filter((p) => lightStatus(p) === 'high');
  const used = new Set();
  const out = [];
  lows.forEach((L) => {
    const H = ps
      .filter((h) => h.id !== L.id && !used.has(h.id) && h.lux >= L.luxRange[0] && h.luxRange[0] <= L.lux)
      .sort((x, y) => (y.lux - y.luxRange[0]) - (x.lux - x.luxRange[0]))[0];
    if (H) {
      used.add(H.id); used.add(L.id);
      out.push(['swap', `${I('arrow-left-right')}<b>Поменяйте местами: ${esc(L.title)} ⇄ ${esc(H.title)}</b><br>
        ${esc(L.title)}: сейчас ${kLux(L.lux)} ${LK}, нужно от ${kLux(L.luxRange[0])}.<br>
        ${esc(H.title)}: сейчас ${kLux(H.lux)} ${LK}, хватит и ${kLux(L.lux)}.`]);
    } else {
      out.push(['low', `${I('sun-dim')}<b>${esc(L.title)}</b>: темновато — ${kLux(L.lux)} ${LK}, нужно от ${kLux(L.luxRange[0])}. Подвиньте ближе к окну или лампе или добавьте часов досветки.`]);
    }
  });
  highs.forEach((H) => {
    if (!used.has(H.id)) out.push(['high', `${I('sun')}<b>${esc(H.title)}</b>: очень ярко — ${kLux(H.lux)} ${LK}, нужно до ${kLux(H.luxRange[1])}. Отодвиньте от лампы или прямого солнца, чтобы не обжечь листья.`]);
  });
  if (!out.length) return ps.length ? '<p class="muted">Света всем хватает 🌞</p>' : '';
  return out.map(([kind, t]) => `<div class="idea ${kind}">${t}</div>`).join('');
}

// Empty screens: tap the plants you have and add them in one go. Anything else is one tap away.
const QUICK = [['mon-del', 'Монстера'], ['zz', 'Замиокулькас'], ['spath', 'Спатифиллум'], ['phal', 'Орхидея'],
  ['pothos', 'Потос'], ['ficus-benj', 'Фикус Бенджамина'], ['sansevieria', 'Сансевиерия'], ['violet', 'Фиалка']];
let qsPicked = new Set();
let qsReported = false;
// Tiles ticked but not added: reported once when the person turns to another way of adding or leaves the app.
// The ticks stay, so coming back to the same screen keeps them.
function endQuick(then) {
  if (!qsPicked.size || qsReported) return;
  track('quick_abandoned', { picked: qsPicked.size, then });
  qsReported = true;
}
function quickStart() {
  const gate = installFirst();
  if (gate) return gate;
  const tiles = QUICK.map(([k, label]) => {
    const on = qsPicked.has(k);
    return `<button class="qs${on ? ' on' : ''}" data-act="qs-pick" data-key="${k}" aria-pressed="${on}">
      <span class="qs-pic" aria-hidden="true">${plantSvg(PLANTS.find((p) => p.id === k), 'fine')}</span><span class="qs-name">${label}</span></button>`;
  }).join('');
  const n = qsPicked.size;
  return `<p class="mt-14 qs-title"><b>Что у вас растёт?</b> Отметьте — остальное найдём в каталоге.</p>
    <div class="qs-grid">${tiles}</div>
    <button class="mt-12 btn primary wide" data-act="qs-add" id="qs-add"${n ? '' : ' disabled'}>${n ? `${I('plus')}Добавить ${plantsN(n)}` : 'Отметьте, что есть'}</button>
    <button class="mt-8 btn ghost wide" data-act="add-plant">${I('search')}Другие растения</button>
    <p class="mt-12 small muted">Растений много? <button class="linkish" data-act="add-import">Перенесите из чата с ИИ</button></p>`;
}
// After adding from the catalog or the quick picks: one plant opens its card, several go to «Растения».
function addFromCatalog(keys, source) {
  const ids = addPlants(keys);
  if (!ids.length) return;
  track('plants_added', { count: ids.length, generic_count: ids.filter((i) => def(i).generic).length, catalog_ids: ids.map((i) => def(i).id), source });
  save();
  if (ids.length === 1) { openPlant(ids[0]); render(); toast('Добро пожаловать в джунгли! Дайте имя и выберите место 🌱'); return; }
  tab = 'plants'; closeSheet(); window.scrollTo(0, 0);
  toast(`Добавлено ${plantsN(ids.length)} 🌱 Откройте каждое, чтобы выбрать место`);
}

// Shown on tabs that need plants when there are none yet.
const emptyCard = (title, text) => `<div class="celebrate"><h2>${title}</h2><p class="muted">${text}</p>${quickStart()}</div>`;

function viewLight() {
  const ps = allPlants().sort((a, b) => b.luxRange[0] - a.luxRange[0] || b.luxRange[1] - a.luxRange[1]);
  const measured = ps.filter((p) => p.lux).length;
  if (!ps.length) {
    return `<header class="hello head-row"><div><h1>Свет</h1></div>${headButtons()}</header>
      ${emptyCard('Свет для каждого растения', 'Добавьте растения — покажу, кому сколько света нужно, а по замерам люксметром подскажу, кого переставить ближе к окну.')}`;
  }
  return `<header class="hello head-row"><div><h1>Свет</h1><div class="date">замерено ${measured} из ${ps.length}</div></div>${headButtons()}</header>
    <p class="small muted">Замеряйте люксметром у листьев днём, при обычном свете. Впишите цифру — подскажу, кому темно, а кого лучше переставить. Нет люксметра? Подойдёт приложение-люксметр для телефона, оно меряет примерно.</p>
    <div id="ideas">${lightIdeas()}</div>
    <h2>От самых светолюбивых</h2>
    ${ps.map(lightRow).join('')}`;
}

/* ---------- Rooms ---------- */
const roomOf = (p) => S.rooms.find((r) => r.id === p.room) || S.rooms[0];
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
    const cold = ranges.filter(([, t]) => rm.t < t[0]).map(([p]) => p.title);
    const hot = ranges.filter(([, t]) => rm.t > t[1]).map(([p]) => p.title);
    if (cold.length) notes.push(['snowflake', `Прохладно для: ${cold.join(', ')}. Уберите от холодного окна или включите обогреватель.`]);
    if (hot.length) notes.push(['flame', `Жарковато для: ${hot.join(', ')}. Проветрите или отодвиньте от батареи.`]);
    if (rm.h < 50) {
      notes.push(['droplet-off', `Сухо (${rm.h}%). Включите увлажнитель${humidOnes.length ? ` — особенно страдают ${humidOnes.join(', ')}` : ''}.`]);
    }
    if (rm.h > 75) notes.push(['droplets', `Очень влажно (${rm.h}%). Проветрите: сырость и застой воздуха — путь к грибкам, следите за сфагнумом.`]);
    status = notes.length
      ? notes.map(([i, n]) => `<div class="status warn">${I(i)}<span>${esc(n)}</span></div>`).join('')
      : ps.length ? `<div class="status ok">${I('smile')}<span>Всем комфортно. Так держать!</span></div>` : '';
  }
  const ago = has ? (rm.d === today() ? 'сегодня' : rel(rm.d)) : '';
  const name = esc(rm.name);
  const head = many ? `<div class="room-head"><div><h2>${name}</h2>
      <div class="small muted">${plantsN(ps.length)} · ${has ? 'замер: ' + esc(ago) : 'замеров пока нет'}</div></div>
      <button class="icon-btn" data-act="room-rename" data-room="${esc(rm.id)}" aria-label="Переименовать комнату ${name}">${I('pencil')}</button>
      <button class="icon-btn" data-act="room-del" data-room="${esc(rm.id)}" aria-label="Убрать комнату ${name}">${I('x')}</button></div>` : '';
  const comfort = !ranges.length ? '' : many
    ? `<p class="small muted mt-10">Удобно всем здесь: ${lo <= hi ? `${lo}–${hi} °C` : 'общего диапазона нет, смотрите карточки'}, влажность 50–70%.</p>`
    : `<h2>Чтобы было удобно всем</h2>
    <div class="info"><b>Температура</b>${lo <= hi ? `${lo}–${hi} °C — так комфортно всем вашим растениям.` : 'Общего диапазона нет — смотрите условия в карточках.'}</div>
    <div class="info"><b>Влажность</b>50–70%.${humidOnes.length ? ` Ниже — сохнут кончики листьев у: ${esc(humidOnes.join(', '))}.` : ''} Выше 75% без проветривания — риск грибков.</div>`;
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
    ${ps.length ? '' : emptyCard('Температура и влажность', 'Добавьте растения — подскажу, какая температура и влажность удобны именно им.')}
    <p class="small muted">Впишите, что показывает датчик — скажу, кому некомфортно.</p>
    ${S.rooms.map((rm) => roomCard(rm, ps.filter((p) => roomOf(p) === rm), many)).join('')}
    <button class="mt-12 btn ghost wide" data-act="room-add">Добавить комнату</button>
    ${many ? '' : '<p class="small muted mt-6">Растения в разных комнатах? Добавьте комнату — у каждой будет свой замер.</p>'}

    <h2>Если есть умный дом</h2>
    <p class="small muted">Например, в «Доме с Алисой» → Сценарии. Для условий по влажности и температуре датчик должен быть подключён к умному дому.</p>
    <div class="scenario"><span>${I('alarm-clock')}</span><div><b>Каждый день в 10:00</b> → Алиса говорит: «Пора заглянуть в Жунгли! Растения ждут»</div></div>
    <div class="scenario"><span>${I('droplets')}</span><div><b>Влажность ниже 50%</b> → включить увлажнитель</div></div>
    <div class="scenario"><span>${I('droplet-off')}</span><div><b>Влажность выше 70%</b> → выключить увлажнитель</div></div>
    <div class="scenario"><span>${I('flame')}</span><div><b>Температура ниже 21 °C</b> → включить обогреватель</div></div>
    <div class="scenario"><span>${I('snowflake')}</span><div><b>Температура выше 25 °C</b> → выключить обогреватель</div></div>
    <div class="scenario"><span>${I('lamp')}</span><div><b>Фитолампы через умную розетку, если есть:</b> включать в 8:00, выключать в 21:00 — 12–14 часов света в день, без ночного досвета.</div></div>`;
}

/* ---------- Taps on the tabs ---------- */
const WATER_CHEERS = ['Напоено! 💧', 'Глоток счастья 💧', 'Кап-кап, спасибо! 💧'];
Object.assign(ACTS, {
  water(el, id) {
    const undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', ...kindOf(id) });
    afterTask(WATER_CHEERS[Math.floor(Math.random() * WATER_CHEERS.length)], undo);
  },
  wet(el, id) {
    const undo = snapshot(); actWet(id); track('plant_checked', { answer: 'wet', ...kindOf(id) });
    afterTask(`Ок, загляну к ${plant(id).title} ${rel(S.plants[id].nextCheck)} 👌`, undo);
  },
  later(el, id) {
    const undo = snapshot(); actLater(id); track('plant_checked', { answer: 'later', ...kindOf(id) }); afterTask('Перенесено на завтра ⏭︎', undo);
  },
  'vent-done'(el, id) {
    const undo = snapshot(); S.plants[id].ventLast = today(); logToday({ id, a: 'vent' }); track('greenhouse_vented');
    afterTask('Свежий воздух! 🌬️', undo);
  },
  'vent-off'(el, id) {
    if (confirm('Теплица больше не нужна? Больше не буду напоминать проветривать.')) {
      const undo = snapshot(); S.plants[id].greenhouse = false; track('greenhouse_removed'); afterTask('Ура, без теплицы! 🎉', undo);
    }
  },
  'bonus-done'(el) {
    const undo = snapshot();
    const b = bonusTasks().find((x) => x.key === el.dataset.key);
    bonusKeys(el.dataset.key).forEach((k) => { S.bonus[k] = today(); });
    track('bonus_done', { kind: el.dataset.key.split(':')[0] });
    logToday({ id: b?.p?.id, a: 'bonus:' + el.dataset.key, title: b?.title });
    afterTask('Бонус засчитан ✨', undo);
  },
  'bonus-skip'(el) {
    track('bonus_skipped', { kind: el.dataset.key.split(':')[0] });
    bonusKeys(el.dataset.key).forEach((k) => { S.snooze[k] = addDays(today(), 3); }); save(); render(); toast('Ок, через пару дней 🙂');
  },
  'show-all'() { showAll = true; track('show_all_clicked'); render(); },
  'stay-browser'(el) { S.stayBrowser = today(); track('install_declined', { where: el.dataset.kind }); save(); render(); },
  'hide-install'(el) { S.hideInstall = true; track('install_hint_hidden', el.dataset.kind ? { kind: el.dataset.kind } : {}); save(); render(); },
  install() {
    const ask = installPrompt;
    if (!ask) return;
    installPrompt = null; // the browser's prompt works once
    try { Promise.resolve(ask.prompt()).catch(() => {}); } catch (err) { /* the browser refused: userChoice settles anyway */ }
    ask.userChoice.then(({ outcome }) => { track('install_prompt', { outcome }); render(); }, () => render());
  },
  'tg-home'() { if (window.tgHome) window.tgHome.add(); track('tg_home_screen_tapped'); },
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
    setAddButton($('#qs-add'), qsPicked.size, 'Отметьте, что есть');
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
  'room-add'(el) {
    const name = (prompt('Как называется комната? Например, «Спальня» или «Кухня»') || '').trim();
    if (!name) return;
    S.rooms.push(newRoom('r' + Date.now().toString(36), name)); save(); render();
    if (el.dataset.from === 'settings') openSettings();
    toast('Комната добавлена. Выберите её в карточках растений 🪴');
    track('room_added', { rooms: S.rooms.length });
  },
  'room-rename'(el) {
    const rm = S.rooms.find((x) => x.id === el.dataset.room);
    const name = rm && (prompt('Новое название комнаты', rm.name) || '').trim();
    if (name) { rm.name = name; save(); render(); if (el.dataset.from === 'settings') openSettings(); }
  },
  'room-del'(el) {
    const rm = S.rooms.find((x) => x.id === el.dataset.room);
    if (!rm || S.rooms.length < 2) return;
    const rest = S.rooms.filter((x) => x !== rm);
    if (!confirm(`Убрать комнату «${rm.name}»? Её растения перейдут в «${rest[0].name}».`)) return;
    Object.values(S.plants).forEach((r) => { if (roomOf(r) === rm) r.room = rest[0].id; });
    S.rooms = rest; save(); render();
    if (el.dataset.from === 'settings') openSettings();
    track('room_removed', { rooms: S.rooms.length });
  },
});
