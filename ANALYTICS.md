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
| `app_opened` | app starts, or returns after 30+ min in background | `how`: `start` / `resume` |
| `tab_viewed` | tab switch | `tab`: `today` / `plants` / `light` / `room` |
| `plant_checked` | answer on a check card, or «Записать полив» in the plant card | `answer`: `dry` / `wet` / `later`; `plant_kind` (catalog id or `custom`); `plant_type`; `generic`; `from`: `card` (plant card only) |
| `day_completed` | last check of the day done | `done_today` |
| `plants_added` | plants added from the picker, the custom form or AI import | `count`, `source`: `catalog` / `custom` / `import`; import: `repaired` (the answer needed fixing: quotes, spaced numbers, comments), `with_room` / `with_spot` (how many came with a room / place, no names sent), `rooms_created`; catalog: `generic_count`, `catalog_ids`; custom: `plant_type` |
| `import_prompt_copied` | «Скопировать запрос» in AI import | — |
| `import_failed` | pasted text has no plant list | `length` of the pasted text; `reason`: `no_list` (no brackets) / `bad_json` (could not be read even after repairs) / `no_plants` (read, but no plant had a name); `has_code_fence`, `has_curly_quotes`, `has_spaced_numbers`. No answer text is sent |
| `add_opened` | «Добавить растения» sheet opened | `from`: tab it was opened from |
| `custom_opened` | «Своё растение с нуля» form opened | — |
| `import_opened` | AI import sheet opened | — |
| `catalog_searched` | catalog search typed (1.2 s pause, no search text sent) | `found` |
| `wick_toggled` | «Фитильный полив» ticked or unticked in the plant card | `on` |
| `plants_filtered` | a status chip tapped under the Plants search | `status`: `all` / `need` / `dim` / `hot` / `watered` / `fine` / `greenhouse` |
| `plants_searched` | search on the Plants tab typed (1.2 s pause, no search text sent) | `found` |
| `add_abandoned` | add sheet closed without adding | `sheet`: `catalog` / `custom` / `import` (last one shown); `searched`; `no_results` (last search found nothing); `picked`; `left_app` (the app went to background with the sheet open; not reported when the import prompt was copied, since going to the AI chat is expected) |
| `js_error` | script error, at most 5 per page load | `message` (150 chars), `source` file, `line` |
| `tg_home_screen_tapped` | mini app: «Добавить» on the home screen hint (Telegram's own dialog) | — |
| `cloud_checked` | mini app: first cloud check after launch | `result`: `restored` / `uploaded` / `same` / `both_empty` / `damaged` / `error`; `cloud_plants`, `local_plants` |
| `cloud_error` | mini app: Telegram CloudStorage refused a read or write (once per kind per launch) | `op`: `read` / `write` / `parse` / `photo_read` / `photo_write` / `photo_parse`; `error` (Telegram's error text) |
| `photos_synced` | mini app: photos synced through Telegram's cloud (only when something happened) | `uploaded`, `downloaded`, `removed`, `skipped` (didn't fit the 1024-key limit) |
| `cloud_restored` | mini app: plants restored from Telegram CloudStorage on this phone | `plants` |
| `mini_app_link_clicked` | «Открыть» on the Telegram-browser hint (opens the mini app) | `has_plants` |
| `telegram_hint_hidden` | «Понятно» on the Telegram hint | — |
| `plant_deleted` | plant deleted | — |
| `plant_named` | nickname set | — |
| `photo_added` | photo added to a plant | — |
| `note_changed` | cheat sheet note changed in the plant card | `action`: `add` / `edit` / `remove` / `reset` (back to catalog) / `restore` (removed tips back); `note`: `water` / `soil` / `cond` / `tip` / `own` / `catalog` |
| `lux_entered` | lux reading saved | `from`: `light_tab` / `card` |
| `greenhouse_toggled` | greenhouse switch in the plant card | `on` |
| `greenhouse_vented` | «Проветрено» on the vent card | — |
| `greenhouse_removed` | greenhouse removed from the vent card | — |
| `bonus_done` | bonus task done | `kind`: `dust` / `rotate` / `feed` |
| `bonus_skipped` | bonus task snoozed | `kind` |
| `news_opened` | «Что нового» opened (header ✨ or settings) | `had_new`: there were unseen changes |
| `show_all_clicked` | «show all» on Today | — |
| `install_hint_hidden` | home screen hint closed | — |
| `limit_changed` | plants-per-day limit changed | `limit` |
| `room_saved` | room temperature and humidity saved | `temp`, `humidity` (rounded), `rooms` (how many rooms) |
| `room_added` | a room added on the Room tab (no room name sent) | `rooms` |
| `room_removed` | a room removed (no room name sent) | `rooms` |
| `backup_exported` | backup downloaded | — |
| `backup_imported` | backup restored | — |
| `stats_enabled` | stats switched back on | — |
| `author_link_clicked` | author link in settings, «Что нового» or a failed AI import | `target`: `website` / `telegram`; `from`: `settings` / `news` / `import` |

## Adding an event

Call `track('noun_verb', { … })` with snake_case names, keep properties free of personal text, and add a row above.
