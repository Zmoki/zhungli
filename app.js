/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// UI shell (sheet, toasts, render), tap handling, update check and startup.

/* ---------- UI ---------- */
const sheet = $('#sheet');
function openSheet() {
  const h = $('#sheet-body h2');
  if (h) sheet.setAttribute('aria-label', h.textContent); else sheet.removeAttribute('aria-label');
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}
// Re-render here: the close event doesn't fire in every browser.
function closeSheet() { endAddFlow(); if (sheet.open) sheet.close(); render(); }
sheet.addEventListener('close', () => { endAddFlow(); render(); }); // closed by swipe, Esc or the close button
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

let toastTimer;
function toast(msg, undo) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = esc(msg) + (undo ? ' <button class="undo">Отменить</button>' : '');
  document.body.append(el);
  $('#live').textContent = msg;
  clearTimeout(toastTimer);
  document.removeEventListener('pointerdown', toastAway, true);
  if (undo) {
    // No time limit while undo is offered: it stays until the next tap elsewhere.
    el.querySelector('.undo').onclick = () => { undo(); el.remove(); };
    setTimeout(() => document.addEventListener('pointerdown', toastAway, true), 0);
  } else {
    toastTimer = setTimeout(() => el.remove(), 4500);
  }
}
function toastAway(e) {
  const el = document.querySelector('.toast');
  if (el && el.contains(e.target)) return;
  document.removeEventListener('pointerdown', toastAway, true);
  el?.remove();
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const em = ['🌿', '🍃', '✨', '🌱', '💚', '🌸'];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    s.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.append(s);
    setTimeout(() => s.remove(), 4200);
  }
}

const WATER_CHEERS = ['Напоено! 💧', 'Глоток счастья 💧', 'Кап-кап, спасибо! 💧'];
function afterTask(msg, undo) {
  if (window.haptic) window.haptic('success');
  save();
  const before = document.querySelectorAll('.task:not(.bonus):not(.done-row)').length;
  render();
  toast(msg, undo);
  if (before > 0 && pendingCount() === 0) { confetti(); track('day_completed', { done_today: (S.log[today()] || []).length }); }
}

// Sizes from data-l / data-w (percent), set through CSSOM: the CSP forbids inline style attributes.
function applySizes(root = document) {
  root.querySelectorAll('[data-l], [data-w]').forEach((el) => {
    if (el.dataset.l) el.style.left = el.dataset.l + '%';
    if (el.dataset.w) el.style.width = el.dataset.w + '%';
  });
}
function render() {
  const view = $('#view');
  // Tile ticks only matter while the collection is empty: once plants are in, by any way, they're done.
  if (Object.keys(S.plants).length) { qsPicked.clear(); qsReported = false; }
  view.innerHTML = tab === 'today' ? viewToday() : tab === 'plants' ? viewPlants() : tab === 'light' ? viewLight() : viewRoom();
  applySizes(view);
  if (tab === 'plants') filterPlants();
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

// Author links: send right away, the app may go to background.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-out]');
  if (a) { track('author_link_clicked', { target: a.dataset.out, from: a.closest('[data-from]')?.dataset.from || 'other' }); flushStats(); }
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act],[data-tab],[data-open]');
  if (!el) return;
  if (el.dataset.tab) {
    tab = el.dataset.tab;
    track('tab_viewed', { tab });
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (el.dataset.open) { openPlant(el.dataset.open); return; }
  const id = el.dataset.id;
  const act = el.dataset.act;
  const otherWay = { 'add-plant': 'catalog', 'add-import': 'import', import: 'restore' }[act];
  if (otherWay) endQuick(otherWay);
  let undo;
  switch (act) {
    case 'water':
      undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', ...kindOf(id) });
      afterTask(WATER_CHEERS[Math.floor(Math.random() * WATER_CHEERS.length)], undo); break;
    case 'wet':
      undo = snapshot(); actWet(id); track('plant_checked', { answer: 'wet', ...kindOf(id) });
      afterTask(`Ок, загляну к ${plant(id).title} ${rel(S.plants[id].nextCheck)} 👌`, undo); break;
    case 'later':
      undo = snapshot(); actLater(id); track('plant_checked', { answer: 'later', ...kindOf(id) }); afterTask('Перенесено на завтра ⏭︎', undo); break;
    case 'vent-done':
      undo = snapshot(); S.plants[id].ventLast = today(); logToday({ id, a: 'vent' }); track('greenhouse_vented');
      afterTask('Свежий воздух! 🌬️', undo); break;
    case 'vent-off':
      if (confirm('Теплица больше не нужна? Больше не буду напоминать проветривать.')) {
        undo = snapshot(); S.plants[id].greenhouse = false; track('greenhouse_removed'); afterTask('Ура, без теплицы! 🎉', undo);
      }
      break;
    case 'bonus-done': {
      undo = snapshot();
      const b = bonusTasks().find((x) => x.key === el.dataset.key);
      bonusKeys(el.dataset.key).forEach((k) => { S.bonus[k] = today(); });
      track('bonus_done', { kind: el.dataset.key.split(':')[0] });
      logToday({ id: b?.p?.id, a: 'bonus:' + el.dataset.key, title: b?.title });
      afterTask('Бонус засчитан ✨', undo); break;
    }
    case 'bonus-skip':
      track('bonus_skipped', { kind: el.dataset.key.split(':')[0] });
      bonusKeys(el.dataset.key).forEach((k) => { S.snooze[k] = addDays(today(), 3); }); save(); render(); toast('Ок, через пару дней 🙂'); break;
    case 'show-all': showAll = true; track('show_all_clicked'); render(); break;
    case 'hide-install': S.hideInstall = true; track('install_hint_hidden', el.dataset.kind ? { kind: el.dataset.kind } : {}); save(); render(); break;
    case 'install': {
      const ask = installPrompt;
      if (!ask) break;
      installPrompt = null; // the browser's prompt works once
      try { Promise.resolve(ask.prompt()).catch(() => {}); } catch (err) { /* the browser refused: userChoice settles anyway */ }
      ask.userChoice.then(({ outcome }) => { track('install_prompt', { outcome }); render(); }, () => render());
      break;
    }
    case 'tg-home': if (window.tgHome) window.tgHome.add(); track('tg_home_screen_tapped'); break;
    case 'stats-ok': S.statsNotice = true; save(); render(); break;
    case 'stats-off':
      statsQueue = []; S.settings.stats = false; S.statsNotice = true; save(); render(); toast('Статистика выключена'); break;
    case 'open-mini-app': track('mini_app_link_clicked', { has_plants: Object.keys(S.plants).length > 0 }); flushStats(); break; // the link opens Telegram
    case 'hide-telegram': S.hideTelegram = true; track('telegram_hint_hidden'); save(); render(); break;
    case 'settings': openSettings(); break;
    case 'news': openNews(); break;
    case 'add-plant': openAdd(); break;
    case 'add-custom': openCustom(el.dataset.q || '', el.dataset.q ? 'search_miss' : 'button'); break;
    case 'add-import': openImport(); break;
    case 'import-file':
      // The file picker hides the app on phones: that's part of importing, not leaving (see visibilitychange).
      if (addFlow) addFlow.picking = true;
      $('#ai-file-input').click(); break;
    case 'import-copy': {
      if (addFlow) addFlow.promptCopied = true;
      copyPrompt(el, (how) => {
        track('import_prompt_copied', { how });
        if (!el.isConnected) return; // the sheet was closed (maybe reopened) meanwhile
        if (how === 'failed' || how === 'none') {
          showPrompt();
          el.textContent = 'Не скопировалось — текст ниже';
          $('#imp-status').textContent = 'Не скопировалось. Запрос показан ниже, скопируйте его вручную.';
          return;
        }
        el.innerHTML = `${I('check')}Скопировано`;
        $('#imp-status').textContent = 'Запрос скопирован';
        // Copying can still fail without a word (iPhone): the prompt itself is one tap away.
        $('#imp-manual').hidden = false;
      });
      el.focus();
      break;
    }
    case 'import-show': showPrompt(); track('import_prompt_shown'); break;
    case 'import-copy-again':
      copyPrompt(el, (how) => {
        track('import_prompt_copied', { how, from: 'again' });
        if (!el.isConnected) return;
        const ok = how === 'exec' || how === 'clipboard';
        el.innerHTML = ok ? `${I('check')}Скопировано` : 'Скопируйте из поля выше';
        $('#imp-status').textContent = ok ? 'Запрос скопирован' : 'Не скопировалось. Скопируйте текст из поля: «Выбрать все», затем «Скопировать».';
      });
      break;
    case 'import-pick': {
      const i = Number(el.dataset.i);
      if (importPicked.has(i)) importPicked.delete(i); else importPicked.add(i);
      if (addFlow) addFlow.picked = importPicked.size;
      el.classList.toggle('on', importPicked.has(i));
      el.querySelector('.pc').innerHTML = I(importPicked.has(i) ? 'check' : 'plus');
      updateImportBar(); break;
    }
    case 'import-add': addImported(); break;
    case 'pick': {
      const k = el.dataset.key;
      if (picked.has(k)) picked.delete(k); else picked.add(k);
      if (addFlow) addFlow.picked = picked.size;
      el.classList.toggle('on', picked.has(k));
      el.querySelector('.pc').innerHTML = I(picked.has(k) ? 'check' : 'plus');
      updatePickBar(); break;
    }
    case 'pick-add': {
      if (addFlow) addFlow.done = true;
      addFromCatalog([...picked], 'catalog'); break;
    }
    case 'qs-pick': {
      const k = el.dataset.key;
      if (qsPicked.has(k)) qsPicked.delete(k); else qsPicked.add(k);
      qsReported = false;
      el.classList.toggle('on', qsPicked.has(k));
      el.setAttribute('aria-pressed', qsPicked.has(k));
      setAddButton($('#qs-add'), qsPicked.size, 'Отметьте, что есть'); break;
    }
    case 'qs-add': {
      const keys = [...qsPicked];
      qsPicked = new Set();
      addFromCatalog(keys, 'quick'); break;
    }
    case 'spot-del': {
      const sp = el.dataset.spot;
      const there = Object.values(S.plants).filter((r) => r.spot === sp);
      if (there.length && !confirm(`Здесь ${plantsN(there.length)}. Убрать место «${sp}»? Растения останутся без места.`)) break;
      there.forEach((r) => { r.spot = ''; });
      S.spots = S.spots.filter((x) => x !== sp); save(); openSettings(); break;
    }
    case 'spot-add': {
      const sp = prompt('Как называется место?');
      if (sp && sp.trim() && !S.spots.includes(sp.trim())) { S.spots.push(sp.trim()); save(); openSettings(); }
      break;
    }
    case 'close': closeSheet(); break;
    case 'photo': photoFor = id; $('#photo-input').click(); break;
    case 'photo-remove':
      if (confirm('Убрать фото? Вместо него будет рисунок.')) {
        dropPhoto(id);
        if (window.photoRemoved) window.photoRemoved(id);
        openPlant(id);
        render();
        track('photo_removed');
        toast('Фото убрано');
      }
      break;
    case 'water-now':
      undo = snapshot(); actWater(id); track('plant_checked', { answer: 'dry', from: 'card', ...kindOf(id) }); save(); closeSheet(); toast(actWords(plant(id)).done, undo); break;
    case 'spot':
      S.plants[id].spot = el.dataset.spot; save();
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    case 'spot-new': {
      const s = prompt('Как называется место?');
      if (s && s.trim()) { S.plants[id].spot = s.trim(); if (!S.spots.includes(s.trim())) S.spots.push(s.trim()); save(); openPlant(id); }
      break;
    }
    case 'note-edit': noteEdit = el.dataset.key; refreshCheat(id); break;
    case 'note-cancel': noteEdit = null; refreshCheat(id); break;
    case 'note-save':
    case 'note-del': {
      const key = el.dataset.key;
      const text = act === 'note-del' ? '' : $('#note-text').value.trim();
      if (act === 'note-del' && (key[0] === 'n' || !careOf(def(id), S.plants[id])[key]) && !confirm('Удалить заметку?')) break;
      const action = setNote(id, key, text);
      if (action) track('note_changed', { action, note: noteKind(key) });
      noteEdit = null; save(); refreshCheat(id); break;
    }
    case 'note-reset': {
      const r = S.plants[id];
      delete r.own[el.dataset.key];
      if (!Object.keys(r.own).length) delete r.own;
      track('note_changed', { action: 'reset', note: el.dataset.key });
      noteEdit = null; save(); refreshCheat(id); break;
    }
    case 'note-restore': {
      const r = S.plants[id];
      NOTE_KEYS.forEach(([k]) => { if (r.own && r.own[k] === '') delete r.own[k]; });
      if (r.own && !Object.keys(r.own).length) delete r.own;
      track('note_changed', { action: 'restore', note: 'catalog' });
      save(); refreshCheat(id); break;
    }
    case 'int-minus':
    case 'int-plus': {
      const r = S.plants[id];
      r.interval = clamp(Math.round(r.interval) + (act === 'int-plus' ? 1 : -1), 1, 60);
      if (r.lastWater) {
        const next = addDays(r.lastWater, r.interval);
        r.nextCheck = next < today() ? today() : next;
      }
      save();
      $('#int-val').textContent = days(r.interval); break;
    }
    case 'delete':
      if (confirm(`Убрать «${plant(id).title}» из коллекции?`)) {
        delete S.plants[id];
        dropPhoto(id);
        for (const k of BONUS_KINDS.map((x) => `${x}:${id}`)) { delete S.bonus[k]; delete S.snooze[k]; }
        // A custom plant's card is no longer needed.
        if (S.custom[id]) delete S.custom[id];
        track('plant_deleted');
        save(); closeSheet(); toast('Убрано 🍂');
      }
      break;
    case 'limit':
      S.settings.limit = Number(el.dataset.n); showAll = false; save(); track('limit_changed', { limit: S.settings.limit });
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    case 'export':
      doExport(); track('backup_exported', el.dataset.from ? { from: el.dataset.from } : {});
      if (el.dataset.from === 'install_hint' && !S.movedHome) { S.movedHome = true; save(); render(); }
      break;
    case 'import': $('#import-input').click(); break;
    case 'reset':
      if (confirm('Точно стереть все отметки и начать заново? Фото тоже удалятся.')) {
        localStorage.removeItem(KEY);
        (window.cloudClear ? window.cloudClear() : Promise.resolve())
          .then(() => idbReq((st) => st.clear(), 'readwrite'))
          .finally(() => location.reload());
      }
      break;
    case 'room-save': {
      const rm = S.rooms.find((x) => x.id === el.dataset.room);
      if (!rm) break;
      const t = parseFloat(String($(`#in-t-${rm.id}`).value).replace(',', '.'));
      const h = parseFloat(String($(`#in-h-${rm.id}`).value).replace(',', '.'));
      if (Number.isNaN(t) || Number.isNaN(h)) { toast('Впишите обе цифры 🙂'); break; }
      Object.assign(rm, { t, h, d: today() }); save(); render(); toast('Записано 🌡️');
      track('room_saved', { temp: Math.round(t), humidity: Math.round(h), rooms: S.rooms.length }); break;
    }
    case 'room-add': {
      const name = (prompt('Как называется комната? Например, «Спальня» или «Кухня»') || '').trim();
      if (!name) break;
      S.rooms.push(newRoom('r' + Date.now().toString(36), name)); save(); render();
      if (el.dataset.from === 'settings') openSettings();
      toast('Комната добавлена. Выберите её в карточках растений 🪴');
      track('room_added', { rooms: S.rooms.length }); break;
    }
    case 'room-rename': {
      const rm = S.rooms.find((x) => x.id === el.dataset.room);
      const name = rm && (prompt('Новое название комнаты', rm.name) || '').trim();
      if (name) { rm.name = name; save(); render(); if (el.dataset.from === 'settings') openSettings(); }
      break;
    }
    case 'room-del': {
      const rm = S.rooms.find((x) => x.id === el.dataset.room);
      if (!rm || S.rooms.length < 2) break;
      const rest = S.rooms.filter((x) => x !== rm);
      if (!confirm(`Убрать комнату «${rm.name}»? Её растения перейдут в «${rest[0].name}».`)) break;
      Object.values(S.plants).forEach((r) => { if (roomOf(r) === rm) r.room = rest[0].id; });
      S.rooms = rest; save(); render();
      if (el.dataset.from === 'settings') openSettings();
      track('room_removed', { rooms: S.rooms.length }); break;
    }
    case 'st-filter':
      plantSt = el.dataset.st;
      el.parentElement.querySelectorAll('.st-chip').forEach((c) => { c.classList.toggle('on', c === el); c.setAttribute('aria-pressed', c === el); });
      filterPlants();
      track('plants_filtered', { status: plantSt || 'all' }); break;
    case 'room-pick':
      S.plants[id].room = el.dataset.room; save();
      el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el)); break;
    default: break;
  }
});

// iPhone doesn't reload a home-screen app; it resumes the old page.
// So check for a new version every time the app is opened.
async function checkUpdate() {
  if (location.protocol === 'file:') return;
  try {
    const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
    const v = r.ok ? (await r.text()).trim() : '';
    if (!v || v === APP_VERSION || sheet.open) return;
    if (sessionStorage.getItem('zhungli.reloadedFor') === v) return; // avoid a reload loop
    sessionStorage.setItem('zhungli.reloadedFor', v);
    location.reload();
  } catch (e) { /* offline: run with what we have */ }
}

let lastOpen = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Leaving for the AI chat after copying the prompt, or opening the file picker, is the expected path, not abandoning.
    const expected = addFlow && addFlow.sheet === 'import' && (addFlow.promptCopied || addFlow.picking);
    if (sheet.open && !expected) endAddFlow(true);
    endQuick('left_app');
    reportVitals();
    flushStats();
    return;
  }
  if (addFlow) addFlow.picking = false;
  if (Date.now() - lastOpen > 30 * 60 * 1000) { newVisit(); track('app_opened', { how: 'resume' }); }
  lastOpen = Date.now();
  checkUpdate();
  if (!sheet.open) render();
});

// iOS 26, home-screen app or Telegram mini app: after the keyboard closes, the viewport can stay as
// short as it was with the keyboard up, so the tab bar floats mid-screen and sheets end early, until
// the app is restarted. When the height is stuck, hiding and showing the whole page for one reflow
// makes iOS measure it again. The tallest height seen per width tells "stuck" from a rotation.
// Not in Safari: its toolbars change the height on their own.
if (IOS && (navigator.standalone || MINI_APP)) {
  const tallest = {};
  const remember = () => { tallest[innerWidth] = Math.max(tallest[innerWidth] || 0, innerHeight); };
  remember();
  addEventListener('resize', remember);
  const isField = (el) => el && el.matches && el.matches('input, textarea, select, [contenteditable="true"]');
  let reported = 0;
  const remeasure = () => {
    if (isField(document.activeElement)) return; // the keyboard is still up
    // In Telegram a collapsed mini app is short on purpose.
    if (MINI_APP && window.Telegram?.WebApp && !window.Telegram.WebApp.isExpanded) return;
    const before = innerHeight, full = tallest[innerWidth] || 0;
    if (full - before <= 4) return; // not stuck
    const root = document.documentElement, y = scrollY, inSheet = sheet.scrollTop;
    root.style.display = 'none';
    void root.offsetHeight; // a synchronous reflow, nothing gets painted in between
    root.style.display = '';
    scrollTo(0, y);
    sheet.scrollTop = inSheet;
    // Whether it happens and whether this helps: at most 3 reports per launch.
    if (reported++ < 3) setTimeout(() => track('viewport_stuck', { before, full, after: innerHeight }), 300);
    remember();
  };
  // Check after the keyboard has had time to slide away, and again in case it was still moving.
  const soon = () => { setTimeout(remeasure, 150); setTimeout(remeasure, 600); };
  document.addEventListener('focusout', (e) => { if (isField(e.target)) soon(); });
  // The keyboard can also close without the field losing focus (scrolling, «Готово»).
  let vvTimer;
  window.visualViewport?.addEventListener('resize', () => { clearTimeout(vvTimer); vvTimer = setTimeout(remeasure, 250); });
}

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (!booting) render(); });
addEventListener('appinstalled', () => { installPrompt = null; track('app_installed'); render(); });

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

save();
booting = false;
render();
loadPhotos();
checkUpdate();
// ready_ms: from navigation start until the first screen is built (painted right after). Not sent when
// the app started in background, since that time includes waiting to be shown.
track('app_opened', { how: 'start', ready_ms: firstHidden === Infinity ? Math.round(performance.now()) : undefined });
// Closing the mini app or the tab may skip visibilitychange.
addEventListener('pagehide', () => { reportVitals(); flushStats(); });
