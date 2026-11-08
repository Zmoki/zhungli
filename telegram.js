/*! Жунгли · https://zhungli.zmoki.xyz/ · Copyright (c) 2026 Zarema Khalilova. All rights reserved. No copying, hosting or reuse without permission. See LICENSE. */
'use strict';
// Telegram mini app (opened at /tg): Telegram's theme, back button, haptics, links,
// and a copy of the plants in Telegram CloudStorage so they follow the Telegram account.
// Photos stay on the phone: CloudStorage only holds short text values.

(function () {
  if (!MINI_APP) return;
  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-web-app.js';
  script.onload = start;
  document.head.append(script);

  function start() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    window.tgInfo = { tg_version: tg.version, tg_platform: tg.platform };

    // Telegram's light/dark theme instead of the system one, and matching bars.
    const theme = () => {
      document.documentElement.dataset.theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if (tg.isVersionAtLeast('6.1')) { try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch (e) { /* older client */ } }
      if (tg.isVersionAtLeast('7.10')) { try { tg.setBottomBarColor(bg); } catch (e) { /* older client */ } }
    };
    theme();
    tg.onEvent('themeChanged', theme);

    // Telegram's back button closes the open sheet.
    if (tg.isVersionAtLeast('6.1')) {
      tg.BackButton.onClick(() => closeSheet());
      const sync = () => (sheet.open ? tg.BackButton.show() : tg.BackButton.hide());
      new MutationObserver(sync).observe(sheet, { attributes: true, attributeFilter: ['open'] });
      sync();
    }

    // A light tap when a plant is watered or a task is done.
    window.haptic = (type = 'success') => {
      if (tg.isVersionAtLeast('6.1')) { try { tg.HapticFeedback.notificationOccurred(type); } catch (e) { /* no haptics */ } }
    };

    // Outside links open in Telegram or the browser, not inside the mini app.
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[target="_blank"]');
      if (!a) return;
      e.preventDefault();
      if (/^https:\/\/t\.me\//.test(a.href)) tg.openTelegramLink(a.href); else tg.openLink(a.href);
    });

    // Telegram's own «add to home screen» (Bot API 8.0): offer it only if the icon isn't there yet.
    if (tg.isVersionAtLeast('8.0')) {
      tg.checkHomeScreenStatus((status) => {
        if (status !== 'missed') return;
        window.tgHome = { add: () => tg.addToHomeScreen() };
        render();
      });
      tg.onEvent('homeScreenAdded', () => { window.tgHome = null; S.hideInstall = true; save(); render(); });
    }

    if (tg.isVersionAtLeast('6.9')) cloudInit(tg.CloudStorage);
  }

  /* ---------- Plants in Telegram CloudStorage ---------- */
  // Values are limited to 4096 (counted as bytes by some clients), so the state is saved
  // as s0, s1, … plus sn (their count) in pieces of 1300 characters: under 4096 bytes for any text.
  const CHUNK = 1300;
  // Diagnostics without content: each kind of cloud error is reported once per launch.
  const reported = new Set();
  const cloudError = (op, err) => {
    if (!err || reported.has(op)) return;
    reported.add(op);
    track('cloud_error', { op, error: String(err).slice(0, 80) });
  };
  let cs = null;
  let cloudChunks = [];
  let timer;

  function split(json) {
    const out = [];
    for (let i = 0; i < json.length;) {
      let end = Math.min(i + CHUNK, json.length);
      // Don't cut an emoji (a surrogate pair) in half.
      const code = json.charCodeAt(end - 1);
      if (end < json.length && code >= 0xd800 && code <= 0xdbff) end--;
      out.push(json.slice(i, end));
      i = end;
    }
    return out;
  }

  const plantsIn = (st) => Object.keys((st && st.plants) || {}).length;
  let dirty = false; // this device changed something the cloud doesn't have yet
  let cloudHasPlants = false;
  // Whether this device ever had plants: only then may an empty state be uploaded
  // (the user deleted them), so a fresh empty device can't wipe the cloud copy.
  let hadPlants = false;

  function push() {
    if (!cs || !dirty) return;
    // A device that never had plants has nothing worth uploading, and must not
    // overwrite plants another device saved meanwhile (Telegram Desktop opened empty first).
    if (!plantsIn(S) && !hadPlants) { dirty = false; return; }
    // syncV marks copies written by this sync version (older versions could upload empty garbage).
    const chunks = split(JSON.stringify({ ...S, syncV: 2 }));
    chunks.forEach((c, i) => { if (cloudChunks[i] !== c) cs.setItem('s' + i, c, (err) => cloudError('write', err)); });
    const extra = cloudChunks.slice(chunks.length).map((_, i) => 's' + (chunks.length + i));
    if (extra.length) cs.removeItems(extra);
    if (chunks.length !== cloudChunks.length) cs.setItem('sn', String(chunks.length), (err) => cloudError('write', err));
    cloudChunks = chunks;
    cloudHasPlants = plantsIn(S) > 0;
    dirty = false;
  }

  // Reads Telegram's copy and keeps the newer one: at start and every time the app comes back
  // (Telegram Desktop keeps the mini app open, so start alone isn't enough).
  // What the first check at launch found, for diagnostics (no content).
  let checked = false;
  const report = (result, cloudPlants) => {
    if (checked) return;
    checked = true;
    track('cloud_checked', { result, cloud_plants: cloudPlants, local_plants: plantsIn(S) });
  };
  function pull() {
    cs.getItem('sn', (err, n) => {
      if (err) { cloudError('read', err); report('error', null); return; }
      const count = Number(n) || 0;
      if (!count) { cloudHasPlants = false; report(plantsIn(S) ? 'uploaded' : 'both_empty', 0); if (plantsIn(S)) { dirty = true; push(); } return; }
      const keys = Array.from({ length: count }, (_, i) => 's' + i);
      cs.getItems(keys, (err2, vals) => {
        if (err2 || !vals) { cloudError('read', err2 || 'no values'); report('error', null); return; }
        const chunks = keys.map((k) => vals[k] || '');
        let cloud = null;
        try { cloud = JSON.parse(chunks.join('')); } catch (e) {
          // Damaged copy (e.g. some pieces were rejected earlier): replace it with this device's plants.
          cloudError('parse', `${count} chunks, ${chunks.filter((c) => !c).length} missing`);
          report('damaged', null);
          cloudChunks = chunks;
          if (plantsIn(S)) { dirty = true; hadPlants = true; push(); }
          return;
        }
        cloudChunks = chunks;
        cloudHasPlants = plantsIn(cloud) > 0;
        const cloudAt = cloud.savedAt || 0;
        const localAt = S.savedAt || 0;
        if (cloudHasPlants && (!plantsIn(S) || cloudAt > localAt)) {
          if (cloudAt === localAt && plantsIn(S)) { report('same', plantsIn(cloud)); return; } // already the same
          delete cloud.syncV;
          S = prepare(cloud);
          try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full */ }
          dirty = false;
          hadPlants = true;
          if (!sheet.open) render();
          toast('Растения загружены из Телеграма 🌿');
          report('restored', plantsIn(cloud));
          track('cloud_restored', { plants: plantsIn(S) });
        } else if (plantsIn(S) && ((!cloudHasPlants && !cloud.syncV) || localAt > cloudAt)) {
          // An empty copy left by an older version never beats real plants;
          // an empty copy from this version means the plants were deleted on purpose.
          report('uploaded', plantsIn(cloud));
          dirty = true;
          push();
        } else {
          report('same', plantsIn(cloud));
        }
      });
    });
  }

  function cloudInit(storage) {
    cs = storage;
    hadPlants = plantsIn(S) > 0;
    window.cloudSave = later;
    // «Начать с чистого листа» clears Telegram's copy too, or the plants would come back.
    window.cloudClear = () => new Promise((done) => {
      const keys = ['sn', ...cloudChunks.map((_, i) => 's' + i)];
      cs.removeItems(keys, () => done());
      setTimeout(done, 1500); // don't block the reset if Telegram doesn't answer
    });
    pull();
  }

  // Saves are batched: one cloud write a few seconds after the last change.
  function later() {
    dirty = true;
    if (plantsIn(S)) hadPlants = true;
    clearTimeout(timer);
    timer = setTimeout(push, 3000);
  }
  document.addEventListener('visibilitychange', () => {
    if (!cs) return;
    if (document.hidden) { clearTimeout(timer); push(); } else pull();
  });
})();
