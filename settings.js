/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Settings, «Что нового» and backup.

/* ---------- Settings and backup ---------- */
// Credits at the bottom of «Что нового». Settings have them as cards (openSettings).
const CREDITS = `Сделали ${outLink('threads', 'Полина')} и ${outLink('website', 'Зарема')} · <a href="privacy">Конфиденциальность</a><br>
      Идеи и баги присылайте в Телеграм ${outLink('telegram', '@zmoki')}`;

// Header buttons: «Что нового» (with a dot when there are unseen changes) and settings.
const hasNews = () => CHANGELOG.some((e) => e.v > Number(S.seen || 0));
const headButtons = () => `<div class="head-btns">
  <button class="icon-btn ${hasNews() ? 'has-new' : ''}" data-act="news" aria-label="Что нового">${I('sparkles')}</button>
  <button class="icon-btn" data-act="settings" aria-label="Настройки">${I('settings')}</button></div>`;

function openNews() {
  const fresh = Number(APP_VERSION) >= CHANGELOG[0].v;
  const date = (d) => parse(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('sparkles')}</div><h2 class="m-0">Что нового</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="info"><b>Ваша версия</b>${esc(APP_VERSION)}${fresh ? ', самая свежая' : ''}</div>
    ${CHANGELOG.map((e) => `<div class="news ${String(e.v) === APP_VERSION ? 'current' : ''}">
      <h3>Версия ${e.v}<span class="muted small"> · ${date(e.d)}</span></h3>
      <ul>${e.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}
    <p class="small muted credit" data-from="news">${CREDITS}</p>`;
  track('news_opened', { had_new: hasNews() });
  S.seen = APP_VERSION;
  save();
  openSheet();
}

function openSettings() {
  const lim = S.settings.limit;
  $('#sheet-body').innerHTML = `
    <div class="sheet-head"><div class="ava" aria-hidden="true">${I('settings')}</div><h2 class="m-0">Настройки</h2>
      <button class="icon-btn close" data-act="close" aria-label="Закрыть">${I('x')}</button></div>
    <div class="field" role="group" aria-labelledby="lbl-limit"><label id="lbl-limit">Сколько растений проверять в день, максимум</label><div class="chips">
      ${[5, 7, 10, 15, 50].map((n) => `<button class="chip ${lim === n ? 'on' : ''}" data-act="limit" data-n="${n}">${n === 50 ? 'все' : n}</button>`).join('')}</div>
      <p class="mt-6 small muted">Остальные спокойно подождут до завтра, а первыми покажу тех, кому нужнее.</p></div>
    <h2>Комнаты</h2>
    <p class="small muted">У каждой комнаты свой замер температуры и влажности. ${S.rooms.length > 1 ? 'Нажмите на комнату, чтобы убрать её. Растения из неё перейдут в первую.' : 'Нажмите, чтобы переименовать. Растения в разных комнатах? Добавьте ещё одну.'}</p>
    <div class="chips">${S.rooms.map((rm) => (S.rooms.length > 1
    ? `<button class="chip" data-act="room-del" data-room="${esc(rm.id)}" data-from="settings" aria-label="Убрать комнату ${esc(rm.name)}">${typedHtml(rm.name)}${I('x')}</button>`
    : `<button class="chip" data-act="room-rename" data-room="${esc(rm.id)}" data-from="settings" aria-label="Переименовать комнату ${esc(rm.name)}">${typedHtml(rm.name)}${I('pencil')}</button>`)).join('')}
      <button class="chip" data-act="room-add" data-from="settings">${I('plus')}комната</button></div>
    <h2>Места</h2>
    <p class="small muted">Где стоят растения. Нажмите на место, чтобы убрать его из списка.</p>
    <div class="chips">${S.spots.map((sp) => `<button class="chip" data-act="spot-del" data-spot="${esc(sp)}" aria-label="Убрать место ${esc(sp)}">${typedHtml(sp)}${I('x')}</button>`).join('')}
      <button class="chip" data-act="spot-add">${I('plus')}место</button></div>
    <h2>Резервная копия</h2>
    <p class="small muted">${MINI_APP ? 'Растения, заметки и уменьшенные фото хранятся в облаке Телеграма. Для надёжности раз в месяц сохраняйте копию в файлы.' : 'Все отметки и фото живут только на этом устройстве. Раз в месяц сохраняйте копию в файлы или отправляйте себе в Телеграм.'}</p>
    <div class="btns"><button class="btn ok" data-act="export">Сохранить копию</button><button class="btn" data-act="import">Восстановить</button></div>
    ${installWhere() ? `<p class="mt-6 small muted">Восстанавливайте копию ${{ ios: 'в Жунгли на экране «Домой»', in_app: `в Жунгли ${PLACE.where}`, telegram_browser: 'в приложении Телеграма' }[installWhere()]}: отсюда растения туда не попадут.</p>` : ''}
    <h2>Чистый лист</h2>
    <p class="small muted">Сотрёт все растения, комнаты, места, заметки, фото и настройки ${MINI_APP ? 'здесь и в облаке Телеграма' : 'на этом устройстве'}. Если они ещё пригодятся, сначала сохраните копию.</p>
    <button class="btn danger wide" data-act="reset">Начать с чистого листа</button>
    <div data-from="settings">
      <section class="set-card app" aria-labelledby="h-app"><h2 id="h-app">Приложение</h2>
        <div class="ids">
          <p class="id-row"><span class="muted">Версия</span><b>${esc(APP_VERSION)}</b></p>
          ${savedAnonId() ? `<p class="id-row"><span class="muted">Номер устройства</span><b>${esc(savedAnonId().slice(0, 8))}</b></p>
          <p class="small muted m-0">Пригодится, если захотите удалить отправленную статистику.</p>` : ''}
          <button class="linkish small" data-act="news">Что нового</button>
        </div>
        <p class="m-0"><b>Идеи и баги</b></p>
        <p class="mt-6 small muted">Пишите вопросы и идеи мне в личку. Отвечаю быстро и часто обновляю Жунгли, так что можно поучаствовать в улучшении приложения.</p>
        <div class="btns">${outLink('telegram', 'Написать @zmoki', 'btn primary')}</div>
      </section>
      <section class="set-card stats" aria-labelledby="h-stats"><h2 id="h-stats">Статистика</h2>
        <label class="toggle"><input type="checkbox" id="stats-on" ${S.settings.stats === false ? '' : 'checked'}> Отправлять анонимную статистику</label>
        <p class="mt-6 small muted m-0">Без названий, имён, заметок, фото и мест. <a class="linkish" href="privacy">Конфиденциальность</a></p>
      </section>
      <section class="set-card credits" aria-labelledby="h-credits"><h2 id="h-credits">Сделали</h2>
        <p class="m-0"><b>Полина</b></p>
        <p class="small muted">Удобство и растения · ${outLink('threads', '@pollyhill', 'linkish')} в Threads</p>
        <p class="m-0"><b>Зарема</b></p>
        <p class="small muted m-0">Разработка · ${outLink('website', 'zmoki.xyz', 'linkish')}</p>
      </section>
    </div>`;
  openSheet();
}

async function doExport() {
  const data = JSON.stringify({ app: 'zhungli', v: 1, at: new Date().toISOString(), state: S, photos: PHOTOS });
  const name = `zhungli-${today()}.json`;
  const file = new File([data], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Копия Жунглей' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function doImport(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'zhungli' || !data.state) throw new Error('bad');
    if (!confirm('Заменить текущие данные копией от ' + new Date(data.at).toLocaleDateString('ru-RU') + '?')) return;
    S = prepare(data.state);
    stored = readStored(); // a restore replaces data on purpose, even newer data from another window
    save();
    await idbReq((st) => st.clear(), 'readwrite');
    const photos = Object.fromEntries(Object.entries(data.photos || {}).filter(([, url]) => isPhoto(url)));
    for (const [id, url] of Object.entries(photos)) await idbReq((st) => st.put(url, id), 'readwrite');
    const gone = Object.keys(PHOTOS).filter((id) => !photos[id]);
    PHOTOS = photos;
    preparePhotos();
    // In the mini app, restored photos are the newest: they replace older ones in Telegram's cloud,
    // and photos the backup doesn't have are removed there too.
    if (window.photoChanged) Object.entries(photos).forEach(([id, url]) => window.photoChanged(id, url));
    if (window.photoRemoved) gone.forEach((id) => window.photoRemoved(id));
    closeSheet();
    track('backup_imported');
    toast('Готово, всё вернулось 🌿');
  } catch (e) {
    toast('Это не похоже на копию Жунглей 🤔');
  }
}

$('#import-input').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) doImport(f);
});

/* ---------- Taps in settings ---------- */
Object.assign(ACTS, {
  settings() { track('settings_opened'); openSettings(); },
  news() { openNews(); },
  limit(el) {
    S.settings.limit = Number(el.dataset.n); showAll = false; save(); track('limit_changed', { limit: S.settings.limit });
    el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
  },
  'spot-del'(el) {
    const sp = el.dataset.spot;
    const there = Object.values(S.plants).filter((r) => r.spot === sp);
    if (there.length && !confirm(`Здесь ${plantsN(there.length)}. Убрать место «${sp}»? Растения останутся без места.`)) return;
    there.forEach((r) => { r.spot = ''; });
    S.spots = S.spots.filter((x) => x !== sp); save(); openSettings();
  },
  'spot-add'() {
    const sp = prompt('Как называется место?');
    if (sp && sp.trim() && !S.spots.includes(sp.trim())) { S.spots.push(sp.trim()); save(); openSettings(); }
  },
  export(el) {
    doExport(); track('backup_exported', el.dataset.from ? { from: el.dataset.from } : {});
    if (el.dataset.from === 'install_hint' && !S.movedHome) { S.movedHome = true; save(); render(); }
  },
  import() { endQuick('restore'); $('#import-input').click(); },
  reset() {
    if (confirm('Точно стереть все отметки и начать заново? Фото и настройки тоже удалятся.')) {
      track('data_reset');
      flushStats();
      // A stats opt-out is about the person, not the plants: it outlives the reset.
      if (S.settings.stats === false) {
        const fresh = prepare(null);
        fresh.settings.stats = false;
        fresh.statsNotice = S.statsNotice;
        localStorage.setItem(KEY, JSON.stringify(fresh));
      } else localStorage.removeItem(KEY);
      (window.cloudClear ? window.cloudClear() : Promise.resolve())
        .then(() => idbReq((st) => st.clear(), 'readwrite'))
        .finally(() => location.reload());
    }
  },
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id !== 'stats-on') return;
  if (!el.checked) statsQueue = [];
  S.settings.stats = el.checked;
  save();
  if (el.checked) track('stats_enabled');
});
