# Analytics

Anonymous usage stats in PostHog: project «zhungli.zmoki.xyz» (720394, US cloud), [dashboard](https://us.posthog.com/project/720394/dashboard/2321614).

## How it works

- `track(event, props)` in `app.js` queues events and flushes them 2 s after the last one (and when the app goes to background).
- The batch goes to `/ingest/batch`, a Cloudflare Pages Function (`functions/ingest/batch.js`). It adds `$geoip_country_code` from Cloudflare, sets `$geoip_disable` and forwards nothing that identifies the visitor: no IP, no user agent. «Discard client IP data» is on in PostHog.
- On localhost and `file:` events only go to `console.debug('[stats]', …)`.
- On by default with a one-time notice (opt-out); off when `S.settings.stats === false` (checkbox «Статистика» in settings or «Выключить» on the notice).
- What is sent is explained to users in `privacy.html`. Keep it in sync when adding a new kind of data.
- No plant names, nicknames, notes or photos. Custom plants are sent as `custom`.

## Common properties

On every event:

| Property | Value |
| --- | --- |
| `distinct_id` | random UUID in `localStorage['zhungli.anon']`, one per device; its first 8 characters are shown in settings so a user can ask to delete their data |
| `$geoip_country_code` | country from Cloudflare, added by the proxy |
| `app_version` | `?v=` of `app.js` |
| `plants_total` | number of plants on the device |
| `standalone` | `true` when opened from the home screen |
| `in_telegram` | `true` when opened inside Telegram's own browser (detectable on Android, often not on iOS) |
| `mini_app` | `true` when opened as the Telegram mini app (`/tg`, @ZhungliPlantsBot) |
| `tg_version`, `tg_platform` | mini app: Telegram's Bot API version and client (ios, macos, tdesktop…) |
| `$os`, `$device_type` | parsed from the user agent |
| `$host`, `$current_url` | page origin and path |
| `$lib` | `zhungli` |
| `$process_person_profile` | `false`, no person profiles |

## Events

| Event | When | Properties |
| --- | --- | --- |
| `app_opened` | app starts, or returns after 30+ min in background | `how`: `start` / `resume`; `ready_ms` (`start` only, not when started in background): ms from navigation start until the first screen is built |
| `tab_viewed` | tab switch | `tab`: `today` / `plants` / `light` / `room` |
| `plant_checked` | answer on a check card, or «Записать полив» in the plant card | `answer`: `dry` / `wet` / `later`; `plant_kind` (catalog id or `custom`); `plant_type` (medium now), `watering` (see `grow_changed`); `generic`; `from`: `card` (plant card only) |
| `day_completed` | last check of the day done | `done_today` |
| `plants_added` | plants added from the picker, the custom form or AI import | `count`, `source`: `catalog` / `quick` (tiles on an empty screen) / `custom` / `import`; import: `repaired` (the file needed fixing: quotes, spaced numbers, comments), `file_ext`, `with_room` / `with_spot` (how many came with a room / place, no names sent), `rooms_created`; catalog and quick picks: `generic_count`, `catalog_ids`; custom: `plant_type`, `like` (the generic type it was based on), `tuned` (light, interval, type or tip changed by hand in «Тонкая настройка») |
| `import_prompt_copied` | «Скопировать запрос» in AI import, or «Скопировать ещё раз» under the shown prompt | `how`: `exec` (select-and-copy worked) / `clipboard` (only the Clipboard API worked; it can still fail silently on iPhone) / `failed` (both refused, or copying hung for 5 s: the prompt is shown to copy by hand) / `none` (no way to copy); `from`: `again` (the button under the shown prompt) |
| `import_prompt_shown` | «Не вставляется? Показать запрос» in AI import: copying didn't reach the AI chat | — |
| `import_failed` | the picked file has no plant list | `length` of the file's text; `file_ext`: `json` / `txt` / `other` (never the name); `reason`: `empty` / `unreadable` (couldn't be opened) / `too_big` (over 1 MB) / `backup` (a Жунгли backup, not an AI file) / `no_list` (no brackets) / `bad_json` (could not be read even after repairs) / `no_plants` (read, but no plant had a name); `has_code_fence`, `has_curly_quotes`, `has_spaced_numbers`. No file content is sent |
| `add_opened` | «Добавить растения» sheet opened | `from`: tab it was opened from |
| `custom_opened` | own plant form opened | `from`: `button` («Своё растение» in the add sheet) / `search_miss` («Добавить «…»» after a catalog search found nothing) |
| `quick_abandoned` | tiles on an empty screen were ticked but not added: once, when the person turns to another way of adding or leaves the app | `picked` (how many ticked); `then`: `catalog` / `import` / `restore` / `left_app` (what they turned to instead of «Добавить»; they may still add there) |
| `import_opened` | AI import sheet opened | — |
| `catalog_searched` | catalog search typed (1.2 s pause, no search text sent) | `found` |
| `catalog_missed` | the add sheet closed after a search that found nothing: once, with the last such search (a fixed typo or a later hit clears it) | `query` (what was typed, up to 40 characters), `added` (whether plants were added in the end). To learn which plants the catalog lacks |
| `grow_changed` | «В чём растёт» or «Как поливаю» changed in the plant card | `medium`, `from_medium`: `soil` / `dry` / `sphagnum` / `bark` / `coco` / `mineral` / `leca` / `water` / `mount` / `terrarium` / `aquarium`; `watering`, `from_watering`: `top` / `wick` / `reservoir` / `none` (not in a pot); `settle` (counted as repotting) |
| `plants_filtered` | a status or way-of-growing chip tapped under the Plants search | `status`: `all` / `need` / `dim` / `hot` / `watered` / `fine` / `greenhouse`, or a way of growing: `mineral` / `leca` / `water` / `mount` / `terrarium` / `aquarium` / `wick` / `reservoir` |
| `plants_searched` | search on the Plants tab typed (1.2 s pause, no search text sent) | `found` |
| `add_abandoned` | add sheet closed without adding | `sheet`: `catalog` / `custom` / `import` (last one shown); `searched`; `no_results` (last search found nothing); `picked`; `left_app` (the app went to background with the sheet open; not reported when the import prompt was copied or the file picker is open, since going to the AI chat or to Files is expected) |
| `js_error` | script error, at most 5 per page load | `message` (150 chars), `source` file, `line` |
| `$web_vitals` | app goes to background or closes, with the values that changed since the last report | `$web_vitals_FCP_value`, `$web_vitals_LCP_value`, `$web_vitals_INP_value` (ms), `$web_vitals_CLS_value`; `$pathname`; `visit` (random id; a visit starts at launch or with `app_opened` `resume`, and INP starts over with it; a visit can report several times, so take its last values). From the browser's own timings: FCP everywhere; LCP, INP and CLS where supported |
| `slow_tap` | a tap or key press took 200+ ms until the next frame, at most 10 per visit | `target`: the control's `data-act`, `tab-<tab>`, `open-plant` or static element id; `event` (the one whose handlers ran longest: `pointerup`, `click`, `keydown`…); `duration`, `input_delay`, `processing`, `presentation` (ms) |
| `viewport_stuck` | iPhone home-screen app or Telegram mini app: after the keyboard, the screen height stayed short and the app made iOS re-measure it; at most 3 per launch | `before` (height when stuck), `full` (tallest height seen at this width), `after` (height 0.3 s after the re-measure), in CSS pixels |
| `tg_home_screen_tapped` | mini app: «Добавить» on the home screen hint (Telegram's own dialog) | — |
| `cloud_checked` | mini app: first cloud check after launch | `result`: `restored` / `uploaded` / `same` / `both_empty` / `damaged` / `error`; `cloud_plants`, `local_plants` |
| `cloud_error` | mini app: Telegram CloudStorage refused a read or write (once per kind per launch) | `op`: `read` / `write` / `parse` / `photo_read` / `photo_write` / `photo_parse`; `error` (Telegram's error text) |
| `photos_synced` | mini app: photos synced through Telegram's cloud (only when something happened) | `uploaded`, `downloaded`, `removed` (of removed plants or removed photos), `skipped` (didn't fit the 1024-key limit) |
| `cloud_restored` | mini app: plants restored from Telegram CloudStorage on this phone | `plants` |
| `mini_app_link_clicked` | «Открыть» on the Telegram-browser hint (opens the mini app) | `has_plants` |
| `telegram_hint_hidden` | «Понятно» on the Telegram hint | — |
| `plant_deleted` | plant deleted | — |
| `plant_named` | nickname set | — |
| `photo_added` | photo added to a plant | — |
| `photo_removed` | photo removed from a plant (back to the drawing) | — |
| `note_changed` | cheat sheet note changed in the plant card | `action`: `add` / `edit` / `remove` / `reset` (back to catalog) / `restore` (removed tips back); `note`: `water` / `soil` / `cond` / `tip` / `own` / `catalog` |
| `lux_entered` | lux reading saved | `from`: `light_tab` / `card` |
| `greenhouse_toggled` | greenhouse switch in the plant card | `on` |
| `greenhouse_vented` | «Проветрено» on the vent card | — |
| `greenhouse_removed` | greenhouse removed from the vent card | — |
| `bonus_done` | bonus task done | `kind`: `dust` / `rotate` / `feed` / `flush` (clay pebbles) / `leach` (mineral medium) / `roots` (aquarium) |
| `bonus_skipped` | bonus task snoozed | `kind` |
| `news_opened` | «Что нового» opened (header ✨ or settings) | `had_new`: there were unseen changes |
| `show_all_clicked` | «show all» on Today | — |
| `install_hint_hidden` | home screen hint closed | `kind`: `ios_empty` (iPhone, no plants yet) / `ios_move` (iPhone, move with a backup) / `ios_moved` (iPhone, after the backup) / `install` (Android or computer) / `telegram` (mini app) / `in_app` (another app's browser on iPhone or Android) |
| `install_prompt` | Android or computer: «Установить» on the install hint, after the browser's dialog | `outcome`: `accepted` / `dismissed` |
| `app_installed` | the browser reports Жунгли was installed (from the hint or the browser's own menu) | — |
| `limit_changed` | plants-per-day limit changed | `limit` |
| `room_saved` | room temperature and humidity saved | `temp`, `humidity` (rounded), `rooms` (how many rooms) |
| `room_added` | a room added on the Room tab (no room name sent) | `rooms` |
| `room_removed` | a room removed (no room name sent) | `rooms` |
| `backup_exported` | backup downloaded | `from`: `install_hint` (the iPhone «add to home screen» hint, to move plants into the home-screen app) / `in_app_hint` (another app's browser, to move plants to Safari or the browser); absent from Settings |
| `backup_imported` | backup restored | — |
| `stats_enabled` | stats switched back on | — |
| `author_link_clicked` | author link in settings, «Что нового» or a failed AI import | `target`: `website` / `telegram`; `from`: `settings` / `news` / `import` |

## Adding an event

Call `track('noun_verb', { … })` with snake_case names, keep properties free of personal text, and add a row above.
