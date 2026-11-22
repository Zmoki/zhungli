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
| `hist` | Last 60 entries (`HIST_MAX`): answers `{ d, a: 'water' \| 'wet' \| 'ok' \| 'fix' }` (`ok`, `fix`: a drip system works, was fixed), or a reminder done (`prune`, `rinse`). Since v152 an answer also has `was`, the state before it (`iv`, `lw`, `nc`, `wet`), and `iv` / `nc`, the interval and next check it set: `undoAnswer` uses them for «×» in «История». Only the newest answer keeps `was` and `nc`; older ones keep `iv` in whole days, and only where it changed, so the state stays small for Telegram's cloud. |
| `repotted` | Date of repotting, or `false`. Counts for 6 weeks: no feeding meanwhile. |
| `fed`, `feedEvery`, `lamp` | Last feeding date; days between feedings (14 if missing, 30, 90, 0 = not fed; a card's `feedEvery` is its default); fed in winter under a grow light. See [TASKS.md](TASKS.md#bonus-tasks). |
| `bought`, `inspected` | «Недавно купили» date (6 weeks of quarantine, 4 of settling in) and the last pest check. |
| `resting` | `{ since, iv }` while at rest: the date and the interval to come back to. |
| `greenhouse`, `ventLast` | Under a cover, and the last airing date. |
| `medium` | What the roots are in. Catalog plants keep it from the day they're added, so a card's new `type` doesn't move them. |
| `watering`, `wick` | How it's watered when it's not the card's way (`wick: true` for a wick). |
| `soilInterval` | The card's interval, kept while the plant grows another way. |
| `own` | Edited catalog tips. `''` hides a tip. |
| `notes` | Own notes. |
| `remind` | Reminders turned on in «Обрезка»: `{ prune: { every, months } }`, days and months 1–12. See [Reminders](#reminders). |
| `noBath` | «Нет» to «Звать в банный день?»: left out of «Банный день». |

Own and imported cards (`S.custom`) also keep `tone`, the pot colors they got on import.

### Changing the card

«Сменить карточку» in the plant card's «Настройки» opens the catalog with its search and moves the plant to the picked card (`setCard` in `plant.js`): someone who picked «Орхидея на коре» for a phalaenopsis doesn't have to remove it and lose its history. Only `def` points elsewhere; the rest of the record stays.
- **Medium and watering** stay: the roots don't move with the card. If they differ from the new card's way, that way's tips stand in (see [How it grows](#how-it-grows)), and the toast says the way was kept. «Отменить» in the toast puts back only what the change touched.
- **`own`:** edits of the old card's tips become notes (unless they match the new card's tip), and hidden tips show again: they were written against the old card.
- **Interval:** a plant never watered starts from the new card's `every` (or its way's start). A learned one is kept, within the new card's bounds on its way. `soilInterval` is dropped, so going back to the card's way starts from the new `every`. A new interval moves the next check, unless «Ещё влажно» answers or «Позже» today set it.
- `species` is dropped when it equals the new card's name. Dusting and turning follow the new card's `big` and `rotate`.
- Own and imported plants (`S.custom`) have no catalog card: the button is greyed out, with why.

## How it grows

Two things, kept apart: what the roots are in (`MEDIA` in `state.js`) and, for a pot, how water gets to them (`WATERING`). The same pon can be watered from above, by a wick or from a reservoir. A card's `type` is its usual medium and `watering` its usual watering (default `top`). «В чём растёт» and «Как поливаю» in the plant card pick others. A card's `ways` can give its own check question, watering and substrate tips for another medium (alocasias and phalaenopsis in sphagnum); otherwise the medium's general ones stand in. The check and watering tip only apply to watering from above. `noFeed` there keeps the plant off feeding days in that medium (phalaenopsis in sphagnum, like orchids on bark).

| Medium | Check (watered from above) | Buttons | Feeding |
|---|---|---|---|
| `soil` грунт | top dried? | «Полито» / «Ещё влажно» | «День подкормки» |
| `dry` грунт для суккулентов | dry almost to the bottom? | «Полито» / «Ещё влажно» | none, unless the card has `feed` |
| `sphagnum` сфагнум | dried inside? (phalaenopsis: on top) | «Полито» / «Ещё влажно» | «День подкормки» |
| `bark` кора | bark almost dry, roots silvery? | «Полито» / «Ещё рано» | «День подкормки»; orchid cards add «половинная доза» (`feedNote`, ORC-COND-49) |
| `coco` кокос | top dried? | «Полито» / «Ещё влажно» | «День подкормки» |
| `mineral` пон, пемза, цеолит | top dried? | «Полито» / «Ещё влажно» | with every watering; «Промойте смесь» every 30 days |
| `leca` керамзит | bottom dried? | «Полито» / «Ещё влажно» | with every watering; «Промойте керамзит» every 45 days |
| `water` вода | time to change the water? | «Вода сменена» / «Вода ещё чистая» | none |
| `mount` на блоке | roots silvery? (from 3 days, at most 14) | «Полито» / «Ещё рано» | none |
| `terrarium` закрытый террариум | moss dry, no drops on the glass? (from 30 days, up to 60) | «Сбрызнуто» / «Ещё влажно» | none |
| `aquarium` аквариум | none: never due | — | none; «Осмотрите корни в аквариуме» every 30 days |

`soil`, `dry`, `sphagnum`, `bark`, `coco`, `mineral` and `leca` are in a pot, so they also have a watering:

| Watering | Check | Buttons |
|---|---|---|
| `top` сверху | the medium's | the medium's |
| `bottom` снизу, через поддон | the card's or the medium's, as from above (`soilCheck`) | the medium's; the task says «Полейте через поддон» |
| `wick` фитиль | the wick's reservoir | «Долито» / «Вода есть», due status «пустовато» |
| `reservoir` резервуар в горшке | the level | «Долито» / «Вода есть», due status «пустовато» |
| `tray` в поддоне с водой | the tray (`bog`: offered only on cards that use it, the Venus flytrap and sundew) | «Долито» / «Вода есть», due status «пустовато» |
| `drip` капельный автополив | the system: hoses, drippers, timer, damp soil | «Работает» / «Поправлено», due status «пора проверить» |

Drip irrigation (`fixed` in `WATERING`) waters by itself, so its checks look at the system and nothing is learned:
- **Interval:** the person's pick from chips in the plant card (1, 2, 3 or 4 weeks; 2 by default), not the stepper.
- **«Работает»:** next check after the whole interval. **«Поправлено»:** a look again in a quarter of it (at least 3 days), to see the fix holds.
- `lastWater` holds the last check, and a check doesn't make the plant «напоено». History says «работает» / «поправлено».
- AI import reads `"watering": "drip"`, and words like «капельный», «drip», «irrigation»; «кашпо с автополивом» stays a reservoir.

Water is «мутновато» when due. Water, sphagnum and a block come first among checks due the same day. A card's own `check` replaces the medium's question. A question becomes a task («Полейте, если …», «Смените воду, если …», «Сбрызните, если …»); a check written as an instruction is shown as is.

Picking another way than the card's:
- The card's `check` is dropped, except between watering from above and from below (both check the soil). Its «Как поливаю» tip gives way to the new way's. With another medium, «Субстрат» does too. The rest of the card stays.
- The card's interval is kept in `soilInterval` and comes back with the card's way. A wick, a reservoir or water start at 7 days, drip irrigation at 14, a block at 3, a terrarium at 30, a mineral medium at ⅔ of the card's interval.
- Roots moved out of soil, sphagnum, bark or coco into anything but a terrarium count as repotted: no feeding for 6 weeks.
- Clay pebbles start on a reservoir. A succulent's card on water, clay pebbles, a terrarium, an aquarium, a wick or a reservoir shows a warning about rot.
- Own edits of the tips that no longer fit («Как поливать», and «Грунт» with another medium) become notes, so nothing typed is lost.
- The old medium's recurring task goes away. Recurring tasks due the same day for several plants («Осмотрите корни в аквариуме») come as one task with the list.
- The drawing stays the card's: a dracaena moved into water is still drawn as a dracaena.

Plants that aren't in an ordinary pot get a teal badge, like the greenhouse one (`badge` in `MEDIA`, `WATERING`; looks in [DESIGN.md](DESIGN.md)): words in the plant card, one icon on grid cards. The badge is left out when the plant's name or species already says it («Черенки в воде»), and a medium's usual watering (clay pebbles on a reservoir) gets none. A tillandsia's own `mount` gets no badge or chip (`noBadge`): it may hang or sit on a shelf. The Plants filter has a chip for each way that has plants, the plants whose name says it included.

## Reminders

The plant card's «Настройки» has a row per kind in `REMINDERS` (`state.js`) under «Уход», like «Теплица»: its name as the title and, opened, the question «Звать на обрезку?» (`toggle` plus «?») with «Да» / «Нет». There's no «Напоминания» heading: the app has no notifications, it calls people in «Если есть силы».
- **«Обрезка»** (`prune`): on «Да», it starts at «Раз в год» in March and April, or in the card's `prune.months`. «Как часто»: 2 weeks, a month, 2 months, «Раз в год» (300 days, so it comes back at the start of next season). A card's `prune` comes from the checked pruning facts:
  - `{ no }`: not pruned (palms, orchids, ZZ, most succulents, strelitzia, chlorophytum). The reason stands in place of the question; a reminder already on stays.
  - `{ months, tip }`: its own start months (spring for dracaena, yucca, ficus, February–March for coleus, hoya, begonia) and a tip shown under the question and before the task hint.
  - Cards without `prune` keep the general hint: where to cut, a bleach rinse after a sick plant, and that pale stretched stems need light.
- **«Промывка грунта»** is not a reminder: the soil rinse is done on «Банный день» (see [TASKS.md](TASKS.md#bonus-tasks)). Its section in the plant card says how it goes for this plant, the last time (`rinse:<id>` in `S.bonus`), «Промыто сегодня» and, with the bath day on, «Звать в банный день?» («Нет» sets `noBath`). Without soil to rinse it says why (water, clay pebbles and pon with their own rinse, distilled water only, a closed terrarium, an aquarium, a block). Per-plant rinse reminders from v126 to v136 turn into «Банный день» with the same interval.

Each, once ticked, shows:
- «В какие месяцы»: 12 chips, at least one stays on;
- the last time, and «Обрезано сегодня» to note it done without the reminder.

It comes as a bonus task on «Сегодня» (see [TASKS.md](TASKS.md#bonus-tasks)). A pruning, from there or the card, goes to the history as «обрезано», a rinse as «промыто»; the dots in «Последние 4 недели» show only checks. A new kind (feeding per plant) needs only an entry in `REMINDERS`.

## How the interval learns

A new plant starts with the card's `every`. Plants added together get their first checks spread out: at most 6 a day, and never later than `every − 1` days. An own plant is checked the same day it's added.

| Answer | What changes |
|---|---|
| «Полито» (or «Полито сегодня» in the card) | The interval moves toward the measured days since the last watering: halfway after «Ещё влажно» answers, and only down (×0.95) when the soil was already dry. Bounds: `every × 0.4`…`every × 3`; grown another way than the card's, 1…45 days (a wick or reservoir 2…45, a block 1…14, a terrarium 7…60). Next check: today + interval. |
| «Ещё влажно» | Next check in a quarter of the interval, at least 1 day. The interval itself waits for the next «Полито». |
| «Завтра» | Next check tomorrow. Nothing is learned. |
| Stepper in the card | ±1 day, 1…60. The next check moves to last watering + interval, but not before today. |

## Statuses

`states(p)` gives every status a plant is in now. Watering and light are separate, so a plant can be «напоено» and «темновато» at once.

| Key | Word | When |
|---|---|---|
| `need` | суховато (a reservoir: пустовато, water: мутновато, drip irrigation: пора проверить) | A check is due today or earlier. Not on the first check day of a plant nobody has answered about yet. |
| `watered` | напоено | Watered today (not for drip irrigation, where it's only a check). |
| `dim` | темновато | Lux reading under the card's minimum. |
| `hot` | ярковато | Lux reading over the maximum × 1.25. |
| `fine` | хорошо | None of the above. |

The greenhouse is a badge, not a status, but the filter has a chip for it.

**Mood** is the one status for the face on the pot: `need` first, then wrong light, then the rest.

Where statuses show:
- **Grid cards:** faces only. The word is there for screen readers.
- **Plant card:** face and word on the photo.
- **Filter chips:** under the search, with counts.
- **Light tab:** a tag on each measured row.

## Light

Light status needs a reading in the card or on the Light tab. The tab sorts plants from the most light-hungry. Each row: the picture (3:4) beside the name, what it needs («нужно 8–18 тыс люксов») and the reading field («?» while empty, «лк» beside it); the status tag, one word («темновато», «ярковато», «отлично»), appears once there's a reading; the bar shows the need and the reading. No separate tips: the tag says who is too dark or too bright.

## Rooms and spots

`S.rooms` holds `{ id, name, t, h, d }`: name, temperature, humidity and the reading's date. Spots are `S.spots` plus any spot a plant uses; their order sorts the checks on «Сегодня».

With several rooms, the plant grid groups plants by room and spot («Кухня · Подоконник»). The Room tab compares each room's reading with the temperatures in its plants' cards: the first «18–26 °C» in `cond`. «Прохладно» starts below «не ниже 16 °C» when the card gives one, else below the range. The humidity target is 50–70% next to the plants, not room-wide: in a Russian winter, room-wide humidity above about 40% makes windows sweat. So the tab asks for a reading next to the plants, and the dry warning and smart-home scenarios humidify the air there.

## Cheat sheet

The card's tips (`water`, `soil`, `cond`, `tip`) can be edited, hidden and restored for one plant; the catalog stays untouched. Own notes are added on top. Toxic plants get a warning, and generic types a note that their tips are approximate.

## Adding plants

- **Quick picks:** empty «Сегодня», «Растения», «Свет» and «Комната» show 6 catalog plants as tiles (`QUICK` in `views.js`): mostly the most searched care in Yandex, with one-word names that fit a tile and match the card. «Фикус» adds the genus card, «Кактус» the general type. Tap the ones you have, then add them in one go; once one is ticked, «Добавить» stays in view above the tab bar. Where plants wouldn't reach the installed app, the way to install comes first (see [TASKS.md](TASKS.md#screen-order)).
- **Add sheet:** AI import as a compact row on top, then «Каталог» with its search, which stays at the top while the list scrolls. «Своё растение» is a row under «Не нашли своё?» at the end of the list, or «Добавить как своё» when a search finds nothing (one of the two at a time). Opened from the add sheet, «Своё растение» and AI import have a back arrow to the catalog, which keeps the ticked plants. What was typed in «Новое растение» comes back if it's opened again for the same plant before the sheet closes.
- **Catalog:** pick several at once. Plants are grouped by care (`CAT_ORDER` in `add.js`), with generic types last for plants that aren't listed. Genera with several variety cards also have a genus card first («Алоказия», «Диффенбахия», «Аглаонема», hint «если сорт неизвестен»; «Фикус», «если вид неизвестен», whose `aka` leaves out microcarpa: it needs 20 °C and more) with care that holds for the whole genus, and `aka` lists varieties that have no card of their own. Once the variety is known, «Сменить карточку» moves the plant to it. The «Добавить» bar appears once something is ticked. Search ignores case and ё, trims word endings (so «лиана» finds «лианы»), reads Latin by sound and as Russian typed on an English layout (`searchReadings`: «aloca» and «fkjrf» both find «Алоказия»), and every typed word must match the name, the hint or `aka` (search-only folk and Latin names). The group name counts only when no plant matches. When neither does, typos are forgiven (`typoMatcher`): о/а and е/и/э/я read the same, doubled letters as one, words match from their start, and a searched word (ending trimmed) of 8+ letters may be one letter off (11+: two), so «дифенбахия» finds «Диффенбахия». Groups go by the best match: a plant's own name first, then specific plants found by a folk name, then generic types, so «рассада» or «черенок» show the generic type on top while «орхидея» shows «Фаленопсис» first. When nothing matches, the sheet offers «Добавить как своё» with the typed name, asks to write Zarema (@zmoki) to get it into the catalog, and shows all generic types.
- **Own plant:** «Своё растение» at the end of the catalog, or «Добавить как своё» after a search found nothing: a name and «На что похоже» (a generic type). The care, light and check interval come from that type and can be changed under «Тонкая настройка». If the growing medium is changed there, the type's check question and care tips are left out, since they no longer fit. It creates a card in `S.custom`.
- **Pets:** a card's `pets` is `'toxic'` or `'safe'` for cats and dogs (`petsOf` in `state.js`; ready for `{ cats, dogs }`), `petsNote` the signs. From ASPCA, else NC State or Pet Poison Helpline (the content repo's pets facts). No value means no data; generic cards never say safe. Shown only with «Дома есть кошка или собака» on in settings (`S.settings.pets`): a warning or a line in the plant card, «ядовито / безопасно для питомцев» in the catalog, and an «ядовиты для питомцев» chip on the Plants tab. Own plants, and imported ones not in the catalog, have no data.
- **Carnivorous plants** («Хищные растения»): Venus flytrap and sundew stand in a tray of water (`watering: 'tray'`, with the card's own check «Воды в поддоне мало? Зимой поддон пустой, грунт только влажный.»), nepenthes grows in sphagnum. All three have `noFeed` (no fertilizer, so no feeding day) and `distilled`: their tips ask for distilled, reverse osmosis or rain water, and «Промывка грунта» isn't offered. Facts: the content repo's carnivorous file set. Winter rest of the flytrap is only a tip for now.
- **Name unknown:** «Как узнать, что за растение» (`openNameHelp` in `add.js`), linked under the catalog search, after a search that found nothing and on the empty first screen under the quick picks. It suggests photographing the plant and asking the Яндекс smart camera, Google Lens or an AI chat (which can build the import list right away), then picking a genus card or «Своё растение». Nothing goes through Жунгли. The AI import prompt asks to identify plants from photos in the chat and to set `guess` when the species is a guess.
- **AI import:** four steps, one at a time like «Банный день» («Шаг N из 4»): copy the prompt for any AI chat (DeepSeek, GigaChat, Алиса, ChatGPT…); say how it answered, as text or as a file (chats in Russia answer in text and don't make files); paste the text or pick the plants.json file (.json or .txt, up to 1 MB); check the list and add. Every step ends with «Не получается? Напишите @zmoki», centered under its buttons (on step 4 inside the add bar, so it stays last and in view). A button that can't do anything yet is disabled, not hidden: «Отправлено, дальше» until the prompt is copied (or shown to copy by hand), «Найти растения» until there's text, «Добавить» with nothing ticked. On step 3 «Вставить ответ» reads the clipboard in one tap (the browser may ask first; iPhone shows a «Вставить» bubble); refused or empty, it says to paste into the field by hand, and browsers without clipboard reading show only the field. A paste is read right away, but the screen stays: it says how many plants were found and offers «Проверить список». Nothing on a step moves after a tap: every step is as tall as the tallest of steps 1–3, its buttons sit at the bottom (on step 4 green «Добавить», with «Ответ пришёл не целиком? Вставить ещё часть» as a link under the list, so the two don't look alike), and what a tap adds («Скопировано», «Нашлось N растений», an error) fills the free room above them. Where the import stands, list included, is kept on the device for 3 hours (`zhungli.import`) and cleared once the plants are added or on «Стереть всё»: a phone may reload the app while the person is in the AI chat. The AI only lists each plant: Russian and Latin name, name, room, spot, `type` and `watering` when the chat said so, `like` (a generic type) and `guess`. Care comes from the catalog: a plant whose name matches a card (`catalogCard`: every word of the card's name or of one `aka` name is among the AI's words, Latin read as Russian; words up to 4 letters match whole, longer ones may differ by an ending of up to 2 letters or a small typo; words of 1–2 letters and prepositions don't count, so «Традесканция в воде» keeps its card; the card covering most words wins, then a match by the card's own name, then a specific card over a generic one) is added like a catalog plant, keeping the AI's name as its species when it differs. A medium or watering the chat mentioned is set as if picked in the plant card, without the pause after repotting. Other plants become own plants like a generic type: the one for their medium (water, a block, a terrarium, an aquarium), else `like`, as «Своё растение» makes them. A guessed species gets a note to check it. Parts add up: «Вставить ещё часть» (or «Вставить продолжение» when the answer broke off: «Продолжи» in the chat) goes back to step 3 with the list kept, a plant broken between two parts is joined, and a plant already read from an earlier part is skipped (as many times as it was there; repeats inside one part stay, since two unnamed aloes can share a windowsill). A plant written so badly it can't be read is skipped, and step 3 says how many («1 растение не прочиталось»). Known misses: a plant with an aka word for a group («Пальма Ховея») gets that group's card (Хамедорея), «Фикус микрокарпа» gets the genus card «Фикус», and a lone «Зебрина» gets the first card with it in `aka` (Алоказия). A backup picked here by mistake gets a pointer to settings («Резервная копия» → «Восстановить»). Rooms are created in the AI's order, and an existing room whose name differs only in case is reused.

## Pictures

A photo is resized to 640 px and stored in IndexedDB (`zhungli`/`photos`) on the phone. Without a photo, `plantSvg` in `shapes.js` draws:
- a silhouette, chosen by catalog id or guessed from the name and type;
- one of six pot and tile color pairs, picked by the card;
- a face on the pot for the mood.

Removing a plant also removes its photo, its bonus tasks and its own card.
