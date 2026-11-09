# Plants

How a plant works: what it stores, how its watering interval learns, and which statuses it shows. The catalog itself (species, ranges, tips, check questions, spots) is in `plants.js`.

## Card and record

Each plant has two layers. `plant(id)` merges them: card, then personal edits (`own`), then the record.

- **Card** (`def`): what the species needs. It comes from `PLANTS` in `plants.js` (catalog entries and generic types) or from `S.custom` (own and imported plants). A card never holds user data, so the catalog can change without touching anyone's plants.
- **Record** (`S.plants[id]`): this person's plant. Ids start with `p` for catalog plants and `c` for own and imported ones. `def` points at the card. Very old records have no `def`: their id is the card id.

Record fields:

| Field | Meaning |
|---|---|
| `name` | Nickname. The title is the name, or the species when there's none. |
| `species` | Own species name over the catalog one. Empty brings the catalog name back. |
| `room`, `spot` | Room id (missing means the first room) and place in the room. |
| `lux` | Last lux meter reading. |
| `interval` | Learned days between checks. |
| `nextCheck`, `lastWater` | Date of the next check and of the last watering. |
| `wet` | «Ещё влажно» answers since the last watering. |
| `hist` | Last 20 answers, `{ d, a: 'water' \| 'wet' }`. |
| `repotted` | Date of repotting, or `false`. Counts for 6 weeks: no feeding meanwhile. |
| `greenhouse`, `ventLast` | Under a cover, and the last airing date. |
| `wick`, `soilInterval` | Wick watering, and the soil interval to return to when it's off. |
| `own` | Edited catalog tips. `''` hides a tip. |
| `notes` | Own notes. |

Own and imported cards (`S.custom`) also keep `tone`, the pot colors they got on import.

## Growing medium

The card's `type` sets the check question (`CHECK_TEXT`), the answer buttons and a few rules:

| Type | Buttons | Also |
|---|---|---|
| `soil` | «Полито» / «Ещё влажно» | |
| `sphagnum` | «Полито» / «Ещё влажно» | Comes first among checks due the same day. |
| `bark` | «Полито» / «Ещё рано» | No feeding. |
| `dry` | «Полито» / «Ещё влажно» | No feeding. |
| `water` | «Вода сменена» / «Вода ещё чистая» | Comes first among checks due the same day. No feeding. Due status is «мутновато». |

With **wick watering** on, the check is about the reservoir whatever the type. The buttons are «Долито» / «Вода есть», and the due status is «пустовато». Turning it on sets a 7-day interval and keeps the soil one for when it's turned off.

A card's own `check` replaces the type's question. A question becomes the task «Полейте, если …». A check written as an instruction is shown as is.

## How the interval learns

A new plant starts with the card's `every`. Plants added together get their first checks spread out: at most 6 a day, and never later than `every − 1` days. An own plant is checked the same day it's added.

| Answer | What changes |
|---|---|
| «Полито» (or «Записать полив» in the card) | The interval moves toward the measured days since the last watering: halfway after «Ещё влажно» answers, and only down (×0.95) when the soil was already dry. Bounds: `every × 0.4`…`every × 3` (wick: 2…45 days). Next check: today + interval. |
| «Ещё влажно» | Next check in a quarter of the interval, at least 1 day. The interval itself waits for the next «Полито». |
| «Не сейчас, завтра» | Next check tomorrow. Nothing is learned. |
| Stepper in the card | ±1 day, 1…60. The next check moves to last watering + interval, but not before today. |

## Statuses

`states(p)` gives every status a plant is in now. Watering and light are separate, so a plant can be «напоено» and «темновато» at once.

| Key | Word | When |
|---|---|---|
| `need` | суховато (wick: пустовато, water: мутновато) | A check is due today or earlier. Not on the first check day of a plant nobody has answered about yet. |
| `watered` | напоено | Watered today. |
| `dim` | темновато | Lux reading under the card's minimum. |
| `hot` | ярковато | Lux reading over the maximum × 1.25. |
| `fine` | хорошо | None of the above. |

The greenhouse is a badge, not a status, but the filter has a chip for it.

**Mood** is the one status for the face on the pot: `need` first, then wrong light, then the rest.

Where statuses show:
- **Grid cards:** faces only. The word is there for screen readers.
- **Plant card:** face and word on the photo.
- **Filter chips:** under the search, with counts.
- **Light tab:** a tag on each row.

## Light

Light status needs a reading in the card or on the Light tab. The tab sorts plants from the most light-hungry. It suggests:
- swapping pairs, a dark plant with a bright one that can live with less;
- moving the rest closer to the window or lamp;
- moving too-bright plants away.

## Rooms and spots

`S.rooms` holds `{ id, name, t, h, d }`: name, temperature, humidity and the reading's date. Spots are `S.spots` plus any spot a plant uses; their order sorts the checks on «Сегодня».

With several rooms, the plant grid groups plants by room and spot («Кухня · Подоконник»). The Room tab compares each room's reading with the temperatures in its plants' cards: the first «18–26 °C» in `cond`. The humidity target is 50–70% for everyone.

## Cheat sheet

The card's tips (`water`, `soil`, `cond`, `tip`) can be edited, hidden and restored for one plant; the catalog stays untouched. Own notes are added on top. Toxic plants get a warning, and generic types a note that their tips are approximate.

## Adding plants

- **Quick picks:** empty «Сегодня», «Растения», «Свет» and «Комната» show 8 common plants as tiles (`QUICK` in `app.js`). Tap the ones you have, then add them in one go.
- **Catalog:** pick several at once. Generic types cover plants that aren't listed. Search ignores case and ё, and every typed word must match the name, the hint, the category or `aka` (search-only folk and Latin names). When nothing matches, the sheet offers to add the typed name as an own plant and shows all generic types.
- **Own plant:** a name and «На что похоже» (a generic type). The care, light and check interval come from that type and can be changed under «Тонкая настройка». It creates a card in `S.custom`.
- **AI import:** a prompt for ChatGPT or Claude, and the JSON answer pasted back. It creates own cards with tips and quips, plus their rooms and spots. Rooms are created in the AI's order, and an existing room whose name differs only in case is reused.

## Pictures

A photo is resized to 640 px and stored in IndexedDB (`zhungli`/`photos`) on the phone. Without a photo, `plantSvg` in `shapes.js` draws:
- a silhouette, chosen by catalog id or guessed from the name and type;
- one of six pot and tile color pairs, picked by the card;
- a face on the pot for the mood.

Removing a plant also removes its photo, its bonus tasks and its own card.
