# Analytics

Anonymous usage stats in PostHog: project «zhungli.zmoki.xyz» (720394, US cloud), [dashboard](https://us.posthog.com/project/720394/dashboard/2321614).

## How it works

- `track(event, props)` in `stats.js` queues events and flushes them 2 s after the last one (and when the app goes to background).
- The batch goes to `/ingest/batch`, a Cloudflare Pages Function (`functions/ingest/batch.js`). It adds `$geoip_country_code` from Cloudflare, sets `$geoip_disable` and forwards nothing that identifies the visitor: no IP, no user agent. «Discard client IP data» is on in PostHog.
- On localhost and `file:` events only go to `console.debug('[stats]', …)`.
- Bots don't count as devices. The app sends nothing from bots that run JS (Googlebot, Lighthouse, headless Chrome, `navigator.webdriver`), and the ingest function drops batches whose user agent matches the same pattern, so old cached versions stop counting too. Data before this release still has some.
- On by default with a one-time notice (opt-out); off when `S.settings.stats === false` (checkbox «Статистика» in settings or «Выключить» on the notice). «Начать с чистого листа» keeps it off.
- What is sent is explained to users in `privacy.html`. Keep it in sync when adding a new kind of data.
- No plant names, nicknames, notes or photos. Custom plants are sent as `custom`.

## Common properties

On every event:

| Property | Value |
| --- | --- |
| `distinct_id` | random UUID in `localStorage['zhungli.anon']`, one per device; its first 8 characters are shown in settings so a user can ask to delete their data |
| `$geoip_country_code` | country from Cloudflare, added by the proxy |
| `app_version` | `?v=` of the app scripts |
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
| `app_opened` | app starts, or returns after 30+ min in background | `tasks_due`: tasks waiting on Today at that moment (watering checks shown and greenhouse vents, not «Если есть силы»); `how`: `start` / `resume` / `privacy_return` (reloaded on the way back from the privacy page, within 30 min; not a new launch) / `retry` (reloaded itself after a script or the stylesheet failed, see `start_retried`; not a new launch); `ready_ms` (not for `resume`, nor when started in background): ms from navigation start until the first screen is built; `$referring_domain` (`start` only, once per arrival: a reload with the same referrer sends none): where the app was opened from, as a known source from `REF_SOURCES` in `app.js` (`google.com`, `t.me`, `vk.com`…; Android apps by package), `other` for any other site, or `$direct` (no referrer, or the app itself) |
| `tab_viewed` | tab switch | `tab`: `today` / `plants` / `light` / `room` |
| `plant_checked` | answer on a check card, or «Полито сегодня» in the plant card | `answer`: `dry` / `wet` / `later` (drip irrigation: `dry` is «Работает», `wet` «Поправлено»); `plant_kind` (catalog id or `custom`); `plant_type` (medium now), `watering` (see `grow_changed`); `generic`; `from`: `card` (plant card only) |
| `how_opened` | «Как?» opened on a check card (the watering tip; open by itself for a plant's first 3 checks) | `plant_kind`, `plant_type`, `watering`, `generic` (as in `plant_checked`) |
| `day_completed` | last check of the day done | `done_today` |
| `plants_added` | plants added from the picker, the custom form or AI import | `count`, `source`: `catalog` / `quick` (tiles on an empty screen) / `stories` (tiles in the last story) / `custom` / `import`; import: `repaired` (the file needed fixing: quotes, spaced numbers, comments), `file_ext`, `with_room` / `with_spot` (how many came with a room / place, no names sent), `rooms_created`; catalog and quick picks: `generic_count`, `catalog_ids`; custom: `plant_type`, `like` (the generic type it was based on), `tuned` (light, interval, type or tip changed by hand in «Тонкая настройка») |
| `import_prompt_copied` | «Скопировать запрос» in AI import, or «Скопировать ещё раз» under the shown prompt | `how`: `exec` (select-and-copy worked) / `clipboard` (only the Clipboard API worked; it can still fail silently on iPhone) / `failed` (both refused, or copying hung for 5 s: the prompt is shown to copy by hand) / `none` (no way to copy); `from`: `again` (the button under the shown prompt) |
| `import_prompt_shown` | «Не вставляется? Показать запрос» in AI import: copying didn't reach the AI chat | — |
| `import_failed` | the picked file has no plant list | `length` of the file's text; `file_ext`: `json` / `txt` / `other` (never the name); `reason`: `empty` / `unreadable` (couldn't be opened) / `too_big` (over 1 MB) / `backup` (a Жунгли backup, not an AI file) / `no_list` (no brackets) / `bad_json` (could not be read even after repairs) / `no_plants` (read, but no plant had a name); `has_code_fence`, `has_curly_quotes`, `has_spaced_numbers`. No file content is sent |
| `add_opened` | «Добавить растения» sheet opened | `from`: tab it was opened from |
| `custom_opened` | own plant form opened | `from`: `button` («Своё растение» under «Не нашли своё?») / `search_miss` («Добавить как своё» after a catalog search found nothing) |
| `quick_abandoned` | tiles on an empty screen were ticked but not added: once, when the person turns to another way of adding or leaves the app | `picked` (how many ticked); `then`: `catalog` / `import` / `restore` / `left_app` (what they turned to instead of «Добавить»; they may still add there) |
| `import_opened` | AI import sheet opened | — |
| `name_help_opened` | «Как узнать, что за растение» opened | `from`: `search` (link under the catalog search), `not_found` (search found nothing), `empty` (first screen with no plants) |
| `catalog_searched` | catalog search typed (1.2 s pause, no search text sent) | `found`; `typo: true` when only the typo-forgiving pass found something |
| `catalog_missed` | the add sheet closed after a search that found nothing: once, with the last such search (a fixed typo or a later hit clears it) | `query` (what was typed, up to 40 characters), `added` (whether plants were added in the end). To learn which plants the catalog lacks |
| `grow_changed` | «В чём растёт» or «Как поливаю» changed in the plant card | `medium`, `from_medium`: `soil` / `dry` / `sphagnum` / `bark` / `coco` / `mineral` / `leca` / `water` / `mount` / `terrarium` / `aquarium`; `watering`, `from_watering`: `top` / `bottom` / `wick` / `reservoir` / `tray` / `drip` / `none` (not in a pot); `settle` (counted as repotting) |
| `check_interval_set` | an interval chip tapped in the plant card (drip irrigation, which doesn't learn) | `days`: `7` / `14` / `21` / `28`; `plant_kind`, `plant_type`, `watering`, `generic` (see `plant_checked`) |
| `card_changed` | a plant moved to another catalog card («Сменить карточку» in the plant card) | `from_card`, `to_card` (catalog ids); `from_generic`, `to_generic`; `same_medium` (the plant's medium is the new card's); `notes_moved` (edited tips turned into notes); `searched` (something was typed in the search; searches there send no `catalog_searched`) |
| `plants_filtered` | a status or way-of-growing chip tapped under the Plants search | `status`: `all` / `need` / `dim` / `hot` / `watered` / `fine` / `greenhouse` / `new` (in quarantine) / `rest` (at rest) / `pets` (toxic to pets), or a way of growing: `mineral` / `leca` / `water` / `mount` / `terrarium` / `aquarium` / `wick` / `reservoir` / `tray` / `drip` |
| `plants_searched` | search on the Plants tab typed (1.2 s pause, no search text sent) | `found` |
| `add_abandoned` | add sheet closed without adding | `sheet`: `catalog` / `custom` / `import` / `help` (last one shown); `searched`; `no_results` (last search found nothing); `picked`; `left_app` (the app went to background with the sheet open; not reported when the import prompt was copied or the file picker is open, since going to the AI chat or to Files is expected) |
| `js_error` | script error, at most 5 per page load | `message` (150 chars), `source` file, `line` (one file per part of the app since v89; before that, mostly `app.js`) |
| `start_retried` | the page reloaded itself once because a script or the stylesheet failed to load, or a script didn't fit the others (usually a flaky network on the first launch of a new version); sent after the reload | `reason`: `script_failed` / `style_failed` / `SyntaxError` / `ReferenceError`; `file` (the app script or stylesheet); `started` (the first screen was built anyway, but some buttons would do nothing or it had no styles); `ok` (the reload fixed it) |
| `$web_vitals` | app goes to background or closes, with the values that changed since the last report | `$web_vitals_FCP_value`, `$web_vitals_LCP_value`, `$web_vitals_INP_value` (ms), `$web_vitals_CLS_value`; `$pathname`; `visit` (random id; a visit starts at launch or with `app_opened` `resume`, and INP starts over with it; a visit can report several times, so take its last values). INP leaves out the time a native `prompt`/`confirm` was open, so it can be lower than in CrUX. From the browser's own timings: FCP everywhere; LCP, INP and CLS where supported |
| `slow_tap` | a tap or key press took 200+ ms until the next frame, at most 10 per visit. The time a native `prompt`/`confirm` was open is taken out (it's the user's) | `target`: the control's `data-act`, `tab-<tab>`, `open-plant` or static element id; `event` (the one whose handlers ran longest: `pointerup`, `click`, `keydown`…); `duration`, `input_delay`, `processing`, `presentation` (ms) |
| `viewport_stuck` | iPhone home-screen app or Telegram mini app: after the keyboard, the screen height stayed short and the app made iOS re-measure it; at most 3 per launch | `before` (height when stuck), `full` (tallest height seen at this width), `after` (height 0.3 s after the re-measure), in CSS pixels |
| `tg_home_screen_tapped` | mini app: «Добавить» on the home screen hint (Telegram's own dialog) | — |
| `cloud_checked` | mini app: first cloud check after launch | `result`: `restored` / `uploaded` / `same` / `both_empty` / `damaged` / `error`; `cloud_plants`, `local_plants` |
| `cloud_error` | mini app: Telegram CloudStorage refused a read or write (once per kind per launch) | `op`: `read` / `write` / `parse` / `photo_read` / `photo_write` / `photo_parse`; `error` (Telegram's error text) |
| `photos_synced` | mini app: photos synced through Telegram's cloud (only when something happened) | `uploaded`, `downloaded`, `removed` (of removed plants or removed photos), `skipped` (didn't fit the 1024-key limit) |
| `cloud_restored` | mini app: plants restored from Telegram CloudStorage on this phone | `plants`; `tasks_due` (as in `app_opened`: the launch event went out before the restore) |
| `mini_app_link_clicked` | «Открыть» on the Telegram-browser hint (opens the mini app) | `has_plants` |
| `telegram_hint_hidden` | «Понятно» on the Telegram hint | — |
| `plant_deleted` | plant deleted | — |
| `plant_named` | nickname set | — |
| `photo_added` | photo added to a plant | — |
| `photo_removed` | photo removed from a plant (back to the drawing) | — |
| `note_changed` | cheat sheet note changed in the plant card | `action`: `add` / `edit` / `remove` / `reset` (back to catalog) / `restore` (removed tips back); `note`: `water` / `soil` / `cond` / `tip` / `own` / `catalog` |
| `lux_entered` | lux reading saved | `from`: `light_tab` / `card` |
| `spot_added` | a spot typed in the plant card's new spot field and added (empty field: nothing) | `how`: `button` (+) / `enter` (Enter, «Готово» on a phone); `new_spot`: not in the spot list before. Never the spot's name |
| `greenhouse_toggled` | greenhouse switch in the plant card | `on` |
| `quarantine_toggled` | «Недавно купили» in the plant card, or «Уже не новое» on the task | `on`; `from`: `card` / `task` |
| `quarantine_checked` | «Осмотрено» on a new plant's pest check | none |
| `rest_started` | «Сбросила листья» / «Ушла в зимний покой» in the plant card | `plant_kind`, `plant_type`, `watering`, `generic` |
| `rest_ended` | «Появился новый лист» / «Пошли новые ловушки» | `days` at rest, plus the plant fields |
| `feeding_logged` | plants noted as fed | `from`: `day` («Подкормлено» on «День подкормки», with `n` fed of `of` listed) / `card` («Подкормлено сегодня») |
| `feed_schedule_changed` | «Как часто» in the plant card's «Подкормка» | `every`: `14` / `30` / `90` / `0` |
| `feed_lamp_toggled` | «Зимой под лампой» | `on` |
| `bath_day_changed` | «Банный день» in the app's settings turned on, off, or its interval changed | `every`: `0` (off) / `60` / `120` / `180` |
| `bath_day_started` | «Да!» on «Устраиваем сегодня банный день?» | none |
| `bath_day_done` | «Промыто» on the bath day card | `n` bathed; `left`: plants still due a rinse |
| `winter_hint_hidden` | «Понятно» on the winter light hint on «Сегодня» | none |
| `pets_toggled` | «Дома есть кошка или собака» in settings | `on` |
| `greenhouse_vented` | «Проветрено» on the vent card | — |
| `greenhouse_removed` | greenhouse removed from the vent card | — |
| `bonus_done` | bonus task done (the feeding day is `feeding_logged`) | `kind`: `dust` / `rotate` / `flush` (clay pebbles) / `leach` (mineral medium) / `roots` (aquarium) / `prune` (a reminder turned on in the plant card) / `feedback` («Написать» on «Как вам Жунгли?») |
| `reminder_changed` | «Звать на обрезку» or its options changed in the plant card | `kind`: `prune`; `action`: `on` / `off` / `every` / `months`; `every` (days: `14` / `30` / `60` / `300`) and `months` (how many are on), unless off |
| `reminder_logged` | «Обрезано сегодня» in the plant card | `kind`: `prune`; `from`: `card` |
| `rinse_logged` | «Промыто сегодня» in the plant card's «Промывка грунта» | `from`: `card` |
| `bath_opt_out` | «Не купать это растение» in the plant card | `on` |
| `settings_row_opened` | a row of the plant card's «Настройки» opened | `row`: `name` / `card` / `place` / `light` / `gh` / `way` / `feed` / `prune` / `rinse` / `bought` / `repot` / `rest` |
| `bonus_skipped` | bonus task snoozed («Через 3 дня»; on the bath day too: `kind`: `bath`; the backup task: `backup`), or «Не нужно» on «Как вам Жунгли?» (`kind`: `feedback`) | `kind` |
| `stories_opened` | «Как работают Жунгли» opened: by itself on the first launch, by «Показать, как», or from settings | `from`: `auto` / `settings` («Как работают Жунгли» at the top of settings) / `home_icon` (first launch of the iPhone home-screen app: opens on the last story) / `install_card` (no plants yet) / `install_hint` (iPhone, plants already added), both straight to the last story / `return` (back in the app to stories still open: not a way in, see `left` in `stories_closed`) |
| `stories_closed` | the stories closed | `from`: as in `stories_opened` for this run of them (`return` never: the first open's); `reached`: the furthest story seen (1–6); `seen`: how many stories were shown (opened on the last one: 1, unless they went back); `how`: `close` (× or Esc) / `add` (plants added from the last story's tiles) / `catalog` / `import` / `restore` (before v151: links under the last story's tiles) / `telegram` (went to the mini app) / `restored` (the mini app got plants from Telegram's cloud while they were open) / `followed` (left the app from a last story with steps out of here: to Safari, or to the home screen after «На экран Домой») / `left` (left the app with them open anywhere else). Leaving the app may be the last event, so it's sent then (after the Telegram button as `telegram`); coming back sends `stories_opened` `return`, so each open has one close and a device can have several: count its last one; `ending`, if the last story was seen: `tiles` / `telegram` / `in_app` / `ios_26` (Safari 26 steps) / `ios_old` (older Safari steps) / `ios_other` (text steps: iPad, other browsers); `ticked`: tiles ticked there but not added |
| `news_opened` | «Что нового» opened (header ✨ or settings) | `had_new`: there were unseen changes |
| `plant_opened` | plant card opened by a tap | `plant_kind`, `plant_type`, `watering`, `generic` (see `plant_checked`) |
| `settings_opened` | settings opened from the header | — |
| `privacy_opened` | link to the privacy page tapped | `from`: `stats_notice` / `settings` / `news` |
| `data_reset` | «Начать с чистого листа» confirmed in settings | — (`plants_total` is how many were erased) |
| `tab_synced` | a change in a stale window wasn't saved: another window (browser or installed app, which share storage on Android and computers) had saved newer data, so this one took it instead | — |
| `ui_clicked` | any tap on a button, link or other control (fields are `field_changed`); also arrow keys on the plant card's tabs (`card-<tab>`) | `target`: the control's `data-act`, `tab-<tab>`, `open-plant` or static element id (as in `slow_tap`); links: `link-<data-out or href>` |
| `field_changed` | any input, select or textarea changed (text fields on leaving them) | `field`: static id or name; `type`; `checked` for checkboxes. Never the value |
| `show_all_clicked` | «show all» on Today | — |
| `install_hint_hidden` | home screen hint closed | `kind`: `ios_added` (iPhone, no plants yet: «Уже добавили» on the install-first card; the browser then points to the icon) / `ios_empty` (older versions: «Уже на экране» there) / `ios_move` (iPhone, move with a backup: «Уже на экране») / `ios_icon_move` (same after «Уже добавили»: «Не нужно» on «Перенесите растения в иконку») / `ios_moved` (iPhone, after the backup) / `install` (Android or computer) / `telegram` (mini app) / `in_app` (another app's browser on iPhone or Android) |
| `install_first_shown` | no plants yet, and the plant picker is replaced by the way to install (once per launch) | `where`: `ios` (browser on iPhone or iPad) / `ios_added` (same, after «Уже добавили») / `in_app` (another app's browser) / `telegram_browser` On iPhone the home-screen app gets a new device id, so compare installs with this event as a ratio, not per device. |
| `install_declined` | «Остаться в браузере» / «Остаться здесь» on that card: the plant picker shows | `where` |
| `install_prompt` | Android or computer: «Установить» on the install hint, after the browser's dialog | `outcome`: `accepted` / `dismissed` |
| `app_installed` | the browser reports Жунгли was installed (from the hint or the browser's own menu) | — |
| `limit_changed` | plants-per-day limit changed | `limit` |
| `room_saved` | room temperature and humidity saved | `temp`, `humidity` (rounded), `rooms` (how many rooms) |
| `room_added` | a room added on the Room tab (no room name sent) | `rooms` |
| `room_removed` | a room removed (no room name sent) | `rooms` |
| `backup_exported` | backup downloaded | `from`: `task` (the «Резервная копия» bonus task) / `install_hint` (the iPhone «add to home screen» hint, to move plants into the home-screen app) / `in_app_hint` (another app's browser, to move plants to Safari or the browser); absent from Settings |
| `backup_imported` | backup restored | — |
| `stats_enabled` | stats switched back on | — |
| `author_link_clicked` | author link in settings, «Что нового» or a failed AI import | `target`: `website` / `telegram` / `threads` (Polina's profile); `from`: `settings` / `news` / `import` / `catalog` (search found nothing) / `feedback_task` |

## Adding an event

Call `track('noun_verb', { … })` with snake_case names, keep properties free of personal text, and add a row above.
