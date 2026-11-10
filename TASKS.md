# Tasks

What «Сегодня» shows and why. The idea: a few plants a day, no backlog, nothing turns red. Plant fields and interval learning are in [PLANTS.md](PLANTS.md).

## Screen order

With no plants yet, «Сегодня» shows the welcome card with quick picks (see [PLANTS.md](PLANTS.md#adding-plants)) and the hint card below it.

1. **Hint card**, usually one, in this order:
   - in Telegram's in-app browser: open the mini app;
   - in another app's browser (Facebook, Instagram, VK…; on Android any app's WebView): open Жунгли in Safari or the browser, with a backup if there are plants;
   - on iPhone or iPad in a browser with no plants yet: add to the home screen first, shown together with the stats notice (the home-screen app keeps its data apart from the browser, so plants added before stay behind);
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
- the card's watering tip (not for wick watering);
- «Не сейчас, завтра», which doesn't use up the limit.

## Greenhouse airing

Every plant marked «В теплице» gets an airing task each day until it's aired. It's outside the daily limit. «Проветрено» stores the date. «Без теплицы» asks first, then turns the greenhouse off.

## Bonus tasks

| Key | For | Comes back |
|---|---|---|
| `dust:<id>` | Plants with big leaves (`big`) | 21 days after the last wipe. |
| `rotate:<id>` | Plants that lean to the light (`rotate`) | 14 days after the last turn. |
| `feed` | Everyone fed, from March to September | 14 days after the last feeding. |

Feeding skips plants marked `noFeed`, those repotted in the last 6 weeks, succulents (except flowering ones marked `feed`, like kalanchoe), orchids on bark and cuttings in water. If nobody is left, there's no task.

New plants get staggered start dates (`initBonus`), so wiping tasks don't all arrive on one day.

The card follows the check card (all task cards come from `taskCard` in `app.js`): picture and name (the plant, or an icon, «День подкормки» and how many plants), the task, the buttons, and how to do it under them; for feeding that's also who to feed.

«Готово» stores today's date. «Не сегодня» hides the task for 3 days. Bonus tasks don't count toward progress.

## Progress and the day log

`S.log[date]` holds entries `{ id, a, title }`, where `a` is `water`, `wet`, `later`, `vent` or `bonus:<key>`. It's kept for 7 days.

- **Pending:** the checks shown plus airings not done.
- **Done:** everything in today's log except `later` and bonus tasks.
- **Total:** pending + done.

Every answer saves, shows a toast with «Отменить», and gives a light tap in Telegram. The last task of the day throws leaf confetti, unless reduced motion is on.
