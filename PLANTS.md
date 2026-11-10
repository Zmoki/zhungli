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
| `grow`, `wick` | How it grows when it's not the card's way: `grow` holds the way, `wick` is wick watering. |
| `soilInterval` | The card's interval, kept while the plant grows another way. |
| `own` | Edited catalog tips. `''` hides a tip. |
| `notes` | Own notes. |

Own and imported cards (`S.custom`) also keep `tone`, the pot colors they got on import.

## How it grows

The card's `type` is how the plant usually grows. «Как растёт» in the plant card picks another way; `GROW` in `app.js` holds them all:

| Way | Check | Buttons | Also |
|---|---|---|---|
| `soil` грунт | top dried? | «Полито» / «Ещё влажно» | |
| `dry` сушить почти полностью | dry almost to the bottom? | «Полито» / «Ещё влажно» | No feeding, unless the card has `feed`. |
| `sphagnum` сфагнум | dried inside? | «Полито» / «Ещё влажно» | Comes first among checks due the same day. |
| `bark` кора | bark dry, roots silvery? | «Полито» / «Ещё рано» | No feeding. |
| `mineral` минеральный субстрат | top dried? | «Полито» / «Ещё влажно» | No feeding day: fertilizer goes in with every watering. |
| `wick` фитильный полив | the reservoir | «Долито» / «Вода есть» | Due status «пустовато». |
| `leca` керамзит или гидропоника | solution at the minimum? | «Долито» / «Раствор есть» | Due status «пустовато». No feeding day: fertilizer goes in with every top-up. «Промойте керамзит» every 45 days. |
| `water` в воде | time to change the water? | «Вода сменена» / «Вода ещё чистая» | Comes first among checks due the same day. Due status «мутновато». No feeding. |
| `aquarium` в аквариуме | none | — | Never due, no feeding. «Осмотрите корни в аквариуме» every 30 days. |

A card's own `check` replaces the way's question. A question becomes a task («Полейте, если …», «Долейте раствор, если …», «Смените воду, если …»). A check written as an instruction is shown as is.

Picking another way than the card's:
- The card's `check` is dropped. Its «Как поливать» and «Субстрат» tips give way to the way's own; the rest of the card stays.
- The card's interval is kept in `soilInterval` and comes back with the card's way. A reservoir or water starts at 7 days, a mineral substrate at ⅔ of the card's interval.
- The old way's recurring task goes away.

## How the interval learns

A new plant starts with the card's `every`. Plants added together get their first checks spread out: at most 6 a day, and never later than `every − 1` days. An own plant is checked the same day it's added.

| Answer | What changes |
|---|---|
| «Полито» (or «Записать полив» in the card) | The interval moves toward the measured days since the last watering: halfway after «Ещё влажно» answers, and only down (×0.95) when the soil was already dry. Bounds: `every × 0.4`…`every × 3`; grown another way than the card's, 1…45 days (a reservoir: 2…45). Next check: today + interval. |
| «Ещё влажно» | Next check in a quarter of the interval, at least 1 day. The interval itself waits for the next «Полито». |
| «Не сейчас, завтра» | Next check tomorrow. Nothing is learned. |
| Stepper in the card | ±1 day, 1…60. The next check moves to last watering + interval, but not before today. |

## Statuses

`states(p)` gives every status a plant is in now. Watering and light are separate, so a plant can be «напоено» and «темновато» at once.

| Key | Word | When |
|---|---|---|
| `need` | суховато (a reservoir: пустовато, water: мутновато) | A check is due today or earlier. Not on the first check day of a plant nobody has answered about yet. |
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

- **Quick picks:** empty «Сегодня», «Растения», «Свет» and «Комната» show 8 popular catalog plants as tiles (`QUICK` in `app.js`). Tap the ones you have, then add them in one go.
- **Catalog:** pick several at once. Plants are grouped by care (`CAT_ORDER` in `app.js`), with generic types last for plants that aren't listed. The «Добавить» bar appears once something is ticked. Search ignores case and ё, trims word endings (so «лиана» finds «лианы»), and every typed word must match the name, the hint or `aka` (search-only folk and Latin names); the group name counts only when nothing else matches. Groups go by the best match: a plant's own name first, then specific plants found by a folk name, then generic types, so «рассада» or «черенок» show the generic type on top while «орхидея» shows «Фаленопсис» first. When nothing matches, the sheet offers to add the typed name as an own plant and shows all generic types.
- **Own plant:** «Своё растение», right under AI import in the add sheet: a name and «На что похоже» (a generic type). The care, light and check interval come from that type and can be changed under «Тонкая настройка». If the growing medium is changed there, the type's check question and care tips are left out, since they no longer fit. It creates a card in `S.custom`.
- **AI import:** a prompt for ChatGPT or Claude, and the JSON answer pasted back. It creates own cards with tips and quips, plus their rooms and spots. Rooms are created in the AI's order, and an existing room whose name differs only in case is reused.

## Pictures

A photo is resized to 640 px and stored in IndexedDB (`zhungli`/`photos`) on the phone. Without a photo, `plantSvg` in `shapes.js` draws:
- a silhouette, chosen by catalog id or guessed from the name and type;
- one of six pot and tile color pairs, picked by the card;
- a face on the pot for the mood.

Removing a plant also removes its photo, its bonus tasks and its own card.
