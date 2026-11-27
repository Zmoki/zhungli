# Tasks

What «Сегодня» shows and why. The idea: a few plants a day, no backlog, nothing turns red. Plant fields and interval learning are in [PLANTS.md](PLANTS.md).

## Screen order

With no plants yet, «Сегодня» shows the quick picks, without a welcome card (the stories explain the app), (see [PLANTS.md](PLANTS.md#adding-plants)) and the hint card below it.

**Stories:** they open by themselves on the first launch (no plants, never seen; `S.storiesSeen`; the iPhone home-screen app, with its own storage, opens straight on the last one, since the person most likely came from them in Safari; the empty «Сегодня» there offers «Восстановить копию» for plants saved in the browser). The last story shows only the tiles; «Добавить» appears with the first tick. «Показать, как» on the install card opens the last story. One story per screen on a sample garden (`stories.js`): «Сегодня», «Растения», the plant card, «Свет» and «Комната», each a whole screen scaled into a phone frame with a short animation (a finger taps, types or scrolls); and a last story that depends on where Жунгли is open. Where plants added now would stay in the app (installed, the mini app, Android, a computer), it has the quick picks; on an iPhone browser it shows the steps to the home screen for that browser and version (Safari 26 on iPhone: «≡» at the left of the address bar first; older Safari: «Поделиться» in the bottom bar, on iPad at the top; other browsers: their own «Поделиться») played out on a drawn Safari in iPhone Safari (as a list on iPad, in other browsers and with reduced motion), in another app's browser the steps to Safari or the browser (a link that opens Safari directly does nothing in Threads), and in Telegram's browser the mini app. Each animation loops; press and hold (or Space) pauses it. A tap on the right goes on, on the left back, × skips; they never move on by themselves, and with reduced motion each shows its last frame.

**Install first:** where plants added now wouldn't reach the installed app or could be lost, the quick picks on every empty screen are replaced by the way there: the empty screen's card gets short and the way there goes under it at full width, so its buttons fit the first screen. This lasts until the person gets there or taps «Остаться в браузере» / «Остаться здесь» (remembered; «Восстановить копию» waits too, and settings say where to restore). After that, the reminders to move plants wait 3 days:
- Telegram's in-app browser: open the mini app;
- another app's browser (Facebook, Instagram, VK, the Google app…; on Android any app's WebView): open Жунгли in Safari or the browser;
- a browser on iPhone or iPad: add to the home screen (the home-screen app keeps its data apart from the browser). «Уже добавили» (`S.homeIcon`) turns this browser into a pointer: «Жунгли уже на экране „Домой“, откройте их с иконки», with «Показать, как» in case it didn't work and «Остаться в браузере» for a change of mind. If they stay and add plants, the later hint asks to move the plants to the icon instead of adding it.

The iPhone and other-app cards are short: «Показать, как» opens the last story, with the steps for that browser.

An iPhone app's own browser is told apart by «Safari/» missing from its user agent (Telegram's too, which often hides itself).

1. **Hint card**, usually one, in this order:
   - in Telegram's in-app browser, once there are plants: move them to the mini app;
   - in another app's browser, once there are plants: open Жунгли in Safari or the browser, with a backup (on iPhone; Android WebViews usually can't save files, so there the plants are added again);
   - the stats notice;
   - add to the home screen, after the first plant: Telegram's own in the mini app; «Установить» in Chrome, Edge and Samsung Internet when the browser offers installing; on iPhone and iPad, moving the plants with «Сохранить копию», then «Открывайте Жунгли с иконки» once the copy is saved.
2. **Progress:** «Осталось N дел» and «X из Y».
3. **Greenhouse airing**.
4. **Watering checks**.
5. **End of day:** «Джунгли довольны!» after something was done, or «Сегодня отдыхаем» with tomorrow's count.
6. **«Ещё N растений подождут»** when the limit hides some.
7. **«Если есть силы»:** up to 2 bonus tasks.
8. **«Уже сделано сегодня»:** a collapsed list.

## Watering checks

- **Due:** `nextCheck` is today or earlier.
- **Priority:** days overdue ÷ interval, plus 0.3 for thirsty plants (sphagnum, cuttings in water, interval ≤ 3 days). Most urgent first.
- **Daily limit:** «Сколько растений проверять в день» in settings: 5, 7 (default), 10, 15 or «все» (50). Today's answers count against it, so the limit holds for the whole day.
- **Order:** the plants that fit are sorted by spot, so the round goes window, shelf, table…
- **The rest wait:** they stay due and come back tomorrow, more urgent. «Показать» lists them all until the app restarts or the limit changes.

A check card has:
- the picture, name, and species · spot · last watering;
- the plant's quip of the day;
- the task, made from the check question;
- the two answers;
- «Как?» under the first answer, with the card's watering tip (not for wick watering). It's open for a plant's first 3 checks (`HOW_OPEN`) and while it rests (the tip is then the rest warning), folded otherwise; a tap opens or folds it for the session. «Как?» takes the main button's color: blue on watering;
- «Завтра» under the second answer, which doesn't use up the limit.

## Greenhouse airing

Every plant marked «В теплице» gets an airing task each day until it's aired. It's outside the daily limit. «Проветрено» stores the date. «Без теплицы» asks first, then turns the greenhouse off.

A plant marked «Новое» (`bought`, the date) is in quarantine for 6 weeks (`NEW_DAYS`, Clemson): «Осмотрите на вредителей» on the day it's marked, then every 7 days, outside the daily limit. «Осмотрено» stores `inspected`; the last one in the period says the quarantine is over. «Уже не новое» clears `bought`. For the first 4 weeks (`SETTLE_DAYS`, UF/IFAS for ficus) it isn't called to the feeding day or to pruning. The plant gets a «на карантине» badge and a filter chip. A card's `settle` adds its own line (the weeping fig drops leaves after buying).

Cards that really rest have `rest` (alocasia, the Venus flytrap). «Покой» in the plant card's settings (`rest.start`) stores `resting: { since, iv }`, doubles the check interval (at most 45 days) and keeps the plant off the feeding day. The check's hint becomes `rest.water`, the card shows `rest.tip` with `rest.end`, which brings the interval back. A «отдыхает» badge and filter chip. From November to February «Сегодня» shows once a winter that tropical plants slow down for lack of light, not for rest (`S.winterSeen`).

## Bonus tasks

| Key | For | Comes back |
|---|---|---|
| `dust:<id>` | Plants with big leaves (`big`) | 21 days after the last wipe. |
| `rotate:<id>` | Plants that lean to the light (`rotate`) | 14 days after the last turn, or the card's own number of days (`rotate: 7` for Пилея). |
| `prune:<id>` | Plants with «Звать на обрезку» on (`remind` in the record), in its months | `every` days after the last pruning (2 weeks, a month, 2 months, or 300 days for «Раз в год»); at once in its months if never. One turned-on reminder comes first; more wait behind the other bonus tasks. Plants with irritating sap (`toxic`) get a gloves warning. |
| `feed:<ids>` | «День подкормки»: the plants due by their own schedule (`feedDue`) | Each plant `feedEvery` days (14, 30, 90, or 0 for never; by default the card's, else the medium's: monthly for succulent soil and a block, else 14) after its last feeding `fed`, from March to September; in winter only plants with «Да» to «Зимой стоит под лампой?» (`lamp`), monthly or rarer if picked. A row per plant like the bath day's (picture, name, species and place), all ticked: «Подкормлено» notes the ticked ones (`fed`, «подкормлено» in the history), the unticked come back in 3 days. «Подкормлено сегодня» in the plant card notes it any day. |
| (bath day) | «Банный день» on in the app's settings (`S.settings.bath`: 60, 120 or 180 days between a plant's rinses) | A card of its own at the top of «Если есть силы», drawn by `bathHtml`, not a bonus task. It offers only plants due a rinse (`rinseFits`, not `noBath`, not resting or settling) whose soil check is due today: rinsing a wet pot through drowns it. At most 5 a time (`BATH_MAX`), never rinsed first, then the oldest rinse. Steps, counted on the card's line («Шаг 2 из 3»): «Устраиваем сегодня банный день?» → «Кого купаем?» (rows like the catalog's with the plant's photo or silhouette, all ticked) → «Пошли купать!» (their pictures in one line instead of names, then the rinse hint) → «Промыто». Bathed plants count as watered (a check answered) and rinsed (`rinse:<id>` in `S.bonus`, «промыто» in the history); the toast names who's left for next time. At most once a week (`S.bonus.bath`); «Через 3 дня» waits 3 days. From Polina. |
| `backup` | Anyone with plants, 30 days (`BACKUP_EVERY`) after the last backup (`S.backupAt`) or, before the first one, after the oldest answer still in the plants' history | «Сохранить» makes the backup, as in settings; restoring a backup counts as one. In the Telegram mini app too: the cloud keeps only small photos. Comes first among the bonus tasks, so daily plant tasks can't keep it out. `S.backupAt` is set when the share sheet finishes, or on a download outside Telegram's and other apps' browsers, which may drop it silently. |
| `feedback` | Anyone with answers on 5 different days | Never: once. «Как вам Жунгли?» with «Написать» (opens Telegram @zmoki) and «Не нужно» instead of the done button / «Через 3 дня»; both put it away for good. |

Feeding skips plants marked `noFeed`, those repotted in the last 2 weeks, and media fed with the water (mineral, clay pebbles) or not at all (water, a terrarium, an aquarium). Succulents are fed monthly in season (HOUSE-MEDIA-19); zamioculcas every 3 months at half a dose by the zamioculcas facts, which say overfeeding is worse than underfeeding. Orchids on bark or in sphagnum are fed (weakly and regularly, by the orchid facts); a card's `feedNote` (orchids: half a dose) goes into the task hint and the plant card's «Подкормка». If nobody is left, there's no task.

New plants get staggered start dates (`initBonus`), so wiping tasks don't all arrive on one day.

The card follows the check card (all task cards come from `taskCard` in `views.js`): picture and name (the plant, or an icon, «День подкормки» and how many plants), the task, the buttons, and how to do it under them; for feeding that's also who to feed.

The done button names what was done («Протёрто», «Повёрнуто», «Промыто», «Осмотрено», «Обрезано», «Подкормлено»: `done` on the task) and stores today's date; for a reminder (`REMINDERS` in `state.js`) it also goes to the plant's history. «Через 3 дня» hides the task for 3 days. Bonus tasks don't count toward progress.

## Progress and the day log

`S.log[date]` holds entries `{ id, a, title }`, where `a` is `water`, `wet`, `ok`, `fix` (drip irrigation checks), `later`, `vent`, `inspect` or `bonus:<key>`. It's kept for 7 days.

- **Pending:** the checks shown plus airings not done.
- **Done:** everything in today's log except `later` and bonus tasks.
- **Total:** pending + done.

Every answer saves, shows a toast with «Отменить», and gives a light tap in Telegram. The last task of the day throws leaf confetti, unless reduced motion is on.
