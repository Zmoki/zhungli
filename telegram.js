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
    schedulePhotos();
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
  // Photos sync only against reconciled plants: while a pull is running, S may lack plants
  // added elsewhere, and syncPhotos would delete their photos in the cloud.
  let pullingSince = 0;
  let photosWaiting = false;
  const pullDone = () => {
    pullingSince = 0;
    if (photosWaiting) { photosWaiting = false; schedulePhotos(); }
  };
  function pull() {
    pullingSince = Date.now();
    cs.getItem('sn', (err, n) => {
      if (err) { pullDone(); cloudError('read', err); report('error', null); return; }
      const count = Number(n) || 0;
      if (!count) { pullDone(); cloudHasPlants = false; report(plantsIn(S) ? 'uploaded' : 'both_empty', 0); if (plantsIn(S)) { dirty = true; push(); } else schedulePhotos(); return; }
      const keys = Array.from({ length: count }, (_, i) => 's' + i);
      cs.getItems(keys, (err2, vals) => {
        pullDone();
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
          if (cloudAt === localAt && plantsIn(S)) { report('same', plantsIn(cloud)); schedulePhotos(); return; } // already the same
          delete cloud.syncV;
          S = prepare(cloud);
          try { store(); } catch (e) { /* storage full */ }
          dirty = false;
          hadPlants = true;
          if (!sheet.open) render();
          toast('Растения загружены из Телеграма 🌿');
          report('restored', plantsIn(cloud));
          track('cloud_restored', { plants: plantsIn(S), tasks_due: pendingCount() });
          schedulePhotos();
        } else if (plantsIn(S) && ((!cloudHasPlants && !cloud.syncV) || localAt > cloudAt)) {
          // An empty copy left by an older version never beats real plants;
          // an empty copy from this version means the plants were deleted on purpose.
          report('uploaded', plantsIn(cloud));
          dirty = true;
          push();
        } else {
          report('same', plantsIn(cloud));
          schedulePhotos();
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
      const keys = ['sn', ...cloudChunks.map((_, i) => 's' + i), ...photoKeys()];
      saveMeta({});
      cs.removeItems(keys, () => done());
      setTimeout(done, 1500); // don't block the reset if Telegram doesn't answer
    });
    pull();
  }

  /* ---------- Photos in Telegram CloudStorage ---------- */
  // Each photo is synced as a small copy (up to 400 px, about 20–30 KB); the original stays on
  // the device it was added on. Base64 is plain ASCII, so photo pieces can hold 4000 characters.
  // Index: m0, m1, … + mn = JSON { plantId: { h: hash of the original, t: when it was set, n: pieces } }.
  // A removed photo stays in the index as { h: '-', t, n: 0 } so other devices remove it too.
  // Pieces: f_<plantId>_<i>. Synced only after the plants are reconciled (end of a pull or push).
  const PIECE = 4000;
  const MAX_PHOTO_PIECES = 800; // Telegram allows 1024 keys per user; the rest is for the plants
  const META_KEY = 'zhungli.photoMeta'; // this device: { plantId: { h, t } } of its photos
  const GONE = '-'; // h of a removed photo
  let manifest = {};
  let manifestChunks = 0;
  let photoTimer;
  let photoBusy = false;
  let photoAgain = false;
  // The meta a running sync works on: photoChanged / photoRemoved write into it, so the sync
  // sees their changes and doesn't save over them.
  let syncMeta = null;

  const loadMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } };
  const saveMeta = (m) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* storage full */ } };
  // A quick fingerprint to notice a changed photo (not cryptographic).
  const hashOf = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 7) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(36) + '.' + str.length.toString(36);
  };
  const pieceKeys = (id, n) => Array.from({ length: n }, (_, i) => `f_${id}_${i}`);
  const photoKeys = () => ['mn', ...Array.from({ length: manifestChunks }, (_, i) => 'm' + i),
    ...Object.entries(manifest).flatMap(([id, m]) => pieceKeys(id, m.n))];
  const cGet = (keys) => new Promise((res) => cs.getItems(keys, (err, vals) => { if (err) cloudError('photo_read', err); res(err ? null : vals || {}); }));
  const cSet = (k, v) => new Promise((res) => cs.setItem(k, v, (err) => { if (err) cloudError('photo_write', err); res(!err); }));
  const cDel = (keys) => new Promise((res) => (keys.length ? cs.removeItems(keys, () => res()) : res()));
  const cut = (text, size) => { const out = []; for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size)); return out; };

  function makeThumb(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 400 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.7).split(',')[1]);
      };
      img.onerror = rej;
      img.src = dataUrl;
    });
  }

  async function readManifest() {
    const head = await cGet(['mn']);
    if (!head) return null;
    const count = Number(head.mn) || 0;
    manifestChunks = count;
    if (!count) return {};
    const keys = Array.from({ length: count }, (_, i) => 'm' + i);
    const vals = await cGet(keys);
    if (!vals) return null;
    try { return JSON.parse(keys.map((k) => vals[k] || '').join('')); } catch (e) { cloudError('photo_parse', count + ' chunks'); return {}; }
  }
  async function writeManifest() {
    const pieces = cut(JSON.stringify(manifest), PIECE);
    for (let i = 0; i < pieces.length; i++) await cSet('m' + i, pieces[i]);
    if (manifestChunks > pieces.length) await cDel(Array.from({ length: manifestChunks - pieces.length }, (_, i) => 'm' + (pieces.length + i)));
    await cSet('mn', String(pieces.length));
    manifestChunks = pieces.length;
  }

  function schedulePhotos() {
    clearTimeout(photoTimer);
    photoTimer = setTimeout(syncPhotos, 1500);
  }

  async function syncPhotos() {
    if (!cs) return;
    if (photoBusy) { photoAgain = true; return; }
    // A pull that doesn't answer in 10 s no longer holds photos back.
    if (pullingSince && Date.now() - pullingSince < 10000) { photosWaiting = true; return; }
    photoBusy = true;
    try {
      const cloud = await readManifest();
      if (cloud === null) return;
      manifest = cloud;
      const meta = loadMeta();
      syncMeta = meta;
      const stats = { uploaded: 0, downloaded: 0, removed: 0, skipped: 0 };
      let changed = false;
      const redrawn = []; // plants whose photo arrived or left
      // Photos added before syncing existed count as old ones.
      for (const id of Object.keys(PHOTOS)) if (!meta[id]) meta[id] = { h: hashOf(PHOTOS[id]), t: 1 };
      // Plants that no longer exist: drop their photos in the cloud and here.
      for (const id of Object.keys(manifest)) {
        if (S.plants[id]) continue;
        await cDel(pieceKeys(id, manifest[id].n));
        delete manifest[id];
        changed = true;
        stats.removed++;
      }
      for (const id of Object.keys(PHOTOS)) {
        if (S.plants[id]) continue;
        dropPhoto(id);
        delete meta[id];
      }
      for (const id of Object.keys(meta)) if (!S.plants[id]) delete meta[id];
      // Photos removed on this device: drop them in the cloud and leave a marker.
      for (const [id, mine] of Object.entries(meta)) {
        if (mine.h !== GONE || PHOTOS[id]) continue;
        const m = manifest[id];
        if (!m || m.h === GONE || m.t > mine.t) continue;
        await cDel(pieceKeys(id, m.n));
        manifest[id] = { h: GONE, t: mine.t, n: 0 };
        changed = true;
        stats.removed++;
      }
      // Newer photos (or removals) from other devices.
      for (const [id, m] of Object.entries(manifest)) {
        const mine = meta[id];
        if (mine && (mine.h === m.h || mine.t >= m.t)) continue;
        if (m.h === GONE) {
          if (PHOTOS[id]) {
            dropPhoto(id);
            stats.removed++;
            redrawn.push(id);
          }
          meta[id] = { h: GONE, t: m.t };
          continue;
        }
        const keys = pieceKeys(id, m.n);
        const vals = await cGet(keys);
        if (!vals || meta[id] !== mine) continue; // changed here meanwhile: the next run decides
        const url = 'data:image/jpeg;base64,' + keys.map((k) => vals[k] || '').join('');
        if (!isPhoto(url) || keys.some((k) => !vals[k])) continue;
        PHOTOS[id] = url;
        meta[id] = { h: m.h, t: m.t };
        await idbReq((st) => st.put(url, id), 'readwrite').catch(() => {});
        stats.downloaded++;
        redrawn.push(id);
      }
      // This device's photos the cloud doesn't have yet, or has older ones of.
      let used = Object.values(manifest).reduce((sum, m) => sum + m.n, 0);
      for (const id of Object.keys(PHOTOS)) {
        const mine = meta[id];
        const m = manifest[id];
        if (!mine || !PHOTOS[id]) continue; // changed during this sync: another run follows
        if (m && (m.h === mine.h || m.t > mine.t)) continue;
        const data = await makeThumb(PHOTOS[id]).catch(() => null);
        if (!data) continue;
        const pieces = cut(data, PIECE);
        if (used - (m ? m.n : 0) + pieces.length > MAX_PHOTO_PIECES) { stats.skipped++; continue; }
        let ok = true;
        for (let i = 0; i < pieces.length; i++) ok = (await cSet(`f_${id}_${i}`, pieces[i])) && ok;
        if (!ok) continue;
        if (m && m.n > pieces.length) await cDel(pieceKeys(id, m.n).slice(pieces.length));
        used += pieces.length - (m ? m.n : 0);
        manifest[id] = { h: mine.h, t: mine.t, n: pieces.length };
        changed = true;
        stats.uploaded++;
      }
      if (changed) await writeManifest();
      saveMeta(meta);
      if (redrawn.length) { if (sheet.open) redrawn.forEach(heroPhotoChanged); else render(); }
      if (stats.uploaded || stats.downloaded || stats.removed || stats.skipped) track('photos_synced', stats);
    } finally {
      syncMeta = null;
      photoBusy = false;
      if (photoAgain) { photoAgain = false; schedulePhotos(); }
    }
  }

  // A photo was added or replaced on this device (plant.js and settings.js call this).
  window.photoChanged = (id, url) => {
    const meta = syncMeta || loadMeta();
    meta[id] = { h: hashOf(url), t: Date.now() };
    saveMeta(meta);
    if (cs) schedulePhotos();
  };
  // A photo was removed on this device (plant.js and settings.js call this).
  window.photoRemoved = (id) => {
    const meta = syncMeta || loadMeta();
    meta[id] = { h: GONE, t: Date.now() };
    saveMeta(meta);
    if (cs) schedulePhotos();
  };

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
