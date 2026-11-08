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

    if (tg.isVersionAtLeast('6.9')) cloudInit(tg.CloudStorage);
  }

  /* ---------- Plants in Telegram CloudStorage ---------- */
  // Values are limited to 4096 characters, so the state is saved as s0, s1, … plus sn (their count).
  const CHUNK = 4000;
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

  function push() {
    if (!cs) return;
    const chunks = split(JSON.stringify(S));
    chunks.forEach((c, i) => { if (cloudChunks[i] !== c) cs.setItem('s' + i, c); });
    const extra = cloudChunks.slice(chunks.length).map((_, i) => 's' + (chunks.length + i));
    if (extra.length) cs.removeItems(extra);
    if (chunks.length !== cloudChunks.length) cs.setItem('sn', String(chunks.length));
    cloudChunks = chunks;
  }

  function cloudInit(storage) {
    cs = storage;
    cs.getItem('sn', (err, n) => {
      const count = err ? 0 : Number(n) || 0;
      if (!count) { window.cloudSave = later; push(); return; }
      const keys = Array.from({ length: count }, (_, i) => 's' + i);
      cs.getItems(keys, (err2, vals) => {
        window.cloudSave = later;
        if (err2 || !vals) return;
        cloudChunks = keys.map((k) => vals[k] || '');
        let cloud = null;
        try { cloud = JSON.parse(cloudChunks.join('')); } catch (e) { /* damaged copy: the phone's data wins */ }
        // Telegram's copy wins if this phone has no plants yet or older data.
        // An empty phone never overwrites a copy that has plants.
        const plantsIn = (st) => Object.keys((st && st.plants) || {}).length;
        if (plantsIn(cloud) && (!plantsIn(S) || (cloud.savedAt || 0) > (S.savedAt || 0))) {
          S = prepare(cloud);
          try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full */ }
          render();
          if (Object.keys(S.plants).length) toast('Растения загружены из Телеграма 🌿');
          track('cloud_restored', { plants: Object.keys(S.plants).length });
        } else {
          push();
        }
      });
    });
  }

  // Saves are batched: one cloud write a few seconds after the last change.
  function later() {
    clearTimeout(timer);
    timer = setTimeout(push, 3000);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && window.cloudSave) { clearTimeout(timer); push(); } });
})();
