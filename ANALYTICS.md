# Analytics

Anonymous usage stats in PostHog: project «zhungli.zmoki.xyz» (720394, US cloud), [dashboard](https://us.posthog.com/project/720394/dashboard/2321614).

## How it works

- `track(event, props)` in `app.js` queues events and flushes them 2 s after the last one (and when the app goes to background).
- The batch goes to `/ingest/batch`, a Cloudflare Pages Function (`functions/ingest/batch.js`) that forwards it to PostHog with the visitor's IP for GeoIP.
- On localhost and `file:` events only go to `console.debug('[stats]', …)`.
- Off when `S.settings.stats === false` (checkbox «Статистика» in settings).
- No plant names, nicknames, notes or photos. Custom plants are sent as `custom`.

## Common properties

On every event:

| Property | Value |
| --- | --- |
| `distinct_id` | random UUID in `localStorage['zhungli.anon']`, one per device |
| `app_version` | `?v=` of `app.js` |
| `plants_total` | number of plants on the device |
| `standalone` | `true` when opened from the home screen |
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
| `plants_added` | plants added from the picker, the custom form or AI import | `count`, `source`: `catalog` / `custom` / `import`; catalog: `generic_count`, `catalog_ids`; custom: `plant_type` |
| `import_prompt_copied` | «Скопировать запрос» in AI import | — |
| `import_failed` | pasted text has no plant list | `length` of the pasted text |
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
| `room_saved` | room temperature and humidity saved | `temp`, `humidity` (rounded) |
| `backup_exported` | backup downloaded | — |
| `backup_imported` | backup restored | — |
| `stats_enabled` | stats switched back on | — |
| `author_link_clicked` | author link in settings, «Что нового» or a failed AI import | `target`: `website` / `telegram`; `from`: `settings` / `news` / `import` |

## Adding an event

Call `track('noun_verb', { … })` with snake_case names, keep properties free of personal text, and add a row above.
