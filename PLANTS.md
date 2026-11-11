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
| `medium`, `watering`, `wick` | How it grows when it's not the card's way: what the roots are in, and how it's watered (`wick: true` for a wick). |
| `soilInterval` | The card's interval, kept while the plant grows another way. |
| `own` | Edited catalog tips. `''` hides a tip. |
| `notes` | Own notes. |

Own and imported cards (`S.custom`) also keep `tone`, the pot colors they got on import.

## How it grows

Two things, kept apart: what the roots are in (`MEDIA` in `state.js`) and, for a pot, how water gets to them (`WATERING`). The same pon can be watered from above, by a wick or from a reservoir. A card's `type` is its usual medium and `watering` its usual watering (default `top`). «В чём растёт» and «Как поливаю» in the plant card pick others.

| Medium | Check (watered from above) | Buttons | Feeding |
|---|---|---|---|
| `soil` грунт | top dried? | «Полито» / «Ещё влажно» | «День подкормки» |
| `dry` грунт для суккулентов | dry almost to the bottom? | «Полито» / «Ещё влажно» | none, unless the card has `feed` |
| `sphagnum` сфагнум | dried inside? | «Полито» / «Ещё влажно» | «День подкормки» |
| `bark` кора | bark dry, roots silvery? | «Полито» / «Ещё рано» | none |
| `coco` кокос | top dried? | «Полито» / «Ещё влажно» | «День подкормки» |
| `mineral` пон, пемза, цеолит | top dried? | «Полито» / «Ещё влажно» | with every watering; «Промойте субстрат» every 30 days |
| `leca` керамзит | bottom dried? | «Полито» / «Ещё влажно» | with every watering; «Промойте керамзит» every 45 days |
| `water` вода | time to change the water? | «Вода сменена» / «Вода ещё чистая» | none |
| `mount` на блоке | roots silvery? (from 3 days, at most 14) | «Полито» / «Ещё рано» | none |
| `terrarium` закрытый террариум | moss dry, no drops on the glass? (from 30 days, up to 60) | «Сбрызнуто» / «Ещё влажно» | none |
| `aquarium` аквариум | none: never due | — | none; «Осмотрите корни в аквариуме» every 30 days |

`soil`, `dry`, `sphagnum`, `bark`, `coco`, `mineral` and `leca` are in a pot, so they also have a watering:

| Watering | Check | Buttons |
|---|---|---|
| `top` сверху | the medium's | the medium's |
| `wick` фитиль | the wick's reservoir | «Долито» / «Вода есть», due status «пустовато» |
| `reservoir` резервуар в горшке | the level | «Долито» / «Вода есть», due status «пустовато» |

Water is «мутновато» when due. Water, sphagnum and a block come first among checks due the same day. A card's own `check` replaces the medium's question. A question becomes a task («Полейте, если …», «Смените воду, если …», «Сбрызните, если …»); a check written as an instruction is shown as is.

Picking another way than the card's:
- The card's `check` is dropped, and its «Как поливаю» tip gives way to the new way's. With another medium, «Субстрат» does too. The rest of the card stays.
- The card's interval is kept in `soilInterval` and comes back with the card's way. A wick, a reservoir or water start at 7 days, a block at 3, a terrarium at 30, a mineral medium at ⅔ of the card's interval.
- Roots moved out of soil, sphagnum, bark or coco into anything but a terrarium count as repotted: no feeding for 6 weeks.
- Clay pebbles start on a reservoir. A succulent's card on water, clay pebbles, a terrarium, an aquarium, a wick or a reservoir shows a warning about rot.
- Own edits of the tips that no longer fit («Как поливать», and «Субстрат» with another medium) become notes, so nothing typed is lost.
- The old medium's recurring task goes away. Recurring tasks due the same day for several plants («Осмотрите корни в аквариуме») come as one task with the list.
- The drawing stays the card's: a dracaena moved into water is still drawn as a dracaena.

Plants that aren't in an ordinary pot get a teal badge, like the greenhouse one (`badge` in `MEDIA`, `WATERING`; looks in [DESIGN.md](DESIGN.md)): words in the plant card, one icon on grid cards. A catalog card's own medium («Счастливый бамбук» in water) and a medium's usual watering (clay pebbles on a reservoir) get none. The Plants filter has a chip for each way that has plants.

## How the interval learns

A new plant starts with the card's `every`. Plants added together get their first checks spread out: at most 6 a day, and never later than `every − 1` days. An own plant is checked the same day it's added.

| Answer | What changes |
|---|---|
| «Полито» (or «Записать полив» in the card) | The interval moves toward the measured days since the last watering: halfway after «Ещё влажно» answers, and only down (×0.95) when the soil was already dry. Bounds: `every × 0.4`…`every × 3`; grown another way than the card's, 1…45 days (a wick or reservoir 2…45, a block 1…14, a terrarium 7…60). Next check: today + interval. |
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

- **Quick picks:** empty «Сегодня», «Растения», «Свет» and «Комната» show 8 popular catalog plants as tiles (`QUICK` in `views.js`). Tap the ones you have, then add them in one go.
- **Catalog:** pick several at once. Plants are grouped by care (`CAT_ORDER` in `add.js`), with generic types last for plants that aren't listed. The «Добавить» bar appears once something is ticked. Search ignores case and ё, trims word endings (so «лиана» finds «лианы»), and every typed word must match the name, the hint or `aka` (search-only folk and Latin names); the group name counts only when nothing else matches. Groups go by the best match: a plant's own name first, then specific plants found by a folk name, then generic types, so «рассада» or «черенок» show the generic type on top while «орхидея» shows «Фаленопсис» first. When nothing matches, the sheet offers to add the typed name as an own plant and shows all generic types.
- **Own plant:** «Своё растение», right under AI import in the add sheet: a name and «На что похоже» (a generic type). The care, light and check interval come from that type and can be changed under «Тонкая настройка». If the growing medium is changed there, the type's check question and care tips are left out, since they no longer fit. It creates a card in `S.custom`.
- **AI import:** a prompt for ChatGPT, Claude or another AI that can send files, and the plants.json file it sends, picked in the app (.json or .txt, up to 1 MB). A file, not pasted text: long answers in chats like Telegram arrive split into several messages and break the list. A backup picked here by mistake gets a pointer to «Восстановить копию». It creates own cards with tips and quips, plus their rooms and spots. Rooms are created in the AI's order, and an existing room whose name differs only in case is reused.

## Pictures

A photo is resized to 640 px and stored in IndexedDB (`zhungli`/`photos`) on the phone. Without a photo, `plantSvg` in `shapes.js` draws:
- a silhouette, chosen by catalog id or guessed from the name and type;
- one of six pot and tile color pairs, picked by the card;
- a face on the pot for the mood.

Removing a plant also removes its photo, its bonus tasks and its own card.
