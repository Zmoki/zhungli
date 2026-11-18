# Tasks

What «Сегодня» shows and why. The idea: a few plants a day, no backlog, nothing turns red. Plant fields and interval learning are in [PLANTS.md](PLANTS.md).

## Screen order

With no plants yet, «Сегодня» shows the quick picks, without a welcome card (the stories explain the app), (see [PLANTS.md](PLANTS.md#adding-plants)) and the hint card below it.

**Stories:** they open by themselves on the first launch (no plants, never seen; `S.storiesSeen`), and «Показать, как» on the install card opens the last one. One story per screen on a sample garden (`stories.js`): «Сегодня», «Растения», the plant card, «Свет» and «Комната», each a whole screen scaled into a phone frame with a short animation (a finger taps, types or scrolls); and a last story that depends on where Жунгли is open. Where plants added now would stay in the app (installed, the mini app, Android, a computer), it has the quick picks; on an iPhone browser it shows the steps to the home screen for that browser and version (Safari 26 on iPhone: «≡» at the left of the address bar first; older Safari: «Поделиться» in the bottom bar, on iPad at the top; other browsers: their own «Поделиться») played out on a drawn Safari in iPhone Safari (as a list on iPad, in other browsers and with reduced motion), in another app's browser the way to Safari or the browser, and in Telegram's browser the mini app. Each animation loops; press and hold (or Space) pauses it. A tap on the right goes on, on the left back, × skips; they never move on by themselves, and with reduced motion each shows its last frame.

**Install first:** where plants added now wouldn't reach the installed app or could be lost, the quick picks on every empty screen are replaced by the way there: the empty screen's card gets short and the way there goes under it at full width, so its buttons fit the first screen. This lasts until the person gets there or taps «Остаться в браузере» / «Остаться здесь» (remembered; «Восстановить копию» waits too, and settings say where to restore). After that, the reminders to move plants wait 3 days:
- Telegram's in-app browser: open the mini app;
- another app's browser (Facebook, Instagram, VK…; on Android any app's WebView): open Жунгли in Safari or the browser;
- a browser on iPhone or iPad: add to the home screen (the home-screen app keeps its data apart from the browser); «Скрыть» for those who have the icon.

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
| `feedback` | Anyone with answers on 5 different days | Never: once. «Как вам Жунгли?» with «Написать» (opens Telegram @zmoki) and «Не нужно» instead of «Готово» / «Не сегодня»; both put it away for good. |

Feeding skips plants marked `noFeed`, those repotted in the last 6 weeks, succulents (except flowering ones marked `feed`, like kalanchoe), orchids on bark, phalaenopsis in sphagnum and cuttings in water. If nobody is left, there's no task.

New plants get staggered start dates (`initBonus`), so wiping tasks don't all arrive on one day.

The card follows the check card (all task cards come from `taskCard` in `views.js`): picture and name (the plant, or an icon, «День подкормки» and how many plants), the task, the buttons, and how to do it under them; for feeding that's also who to feed.

«Готово» stores today's date. «Не сегодня» hides the task for 3 days. Bonus tasks don't count toward progress.

## Progress and the day log

`S.log[date]` holds entries `{ id, a, title }`, where `a` is `water`, `wet`, `later`, `vent` or `bonus:<key>`. It's kept for 7 days.

- **Pending:** the checks shown plus airings not done.
- **Done:** everything in today's log except `later` and bonus tasks.
- **Total:** pending + done.

Every answer saves, shows a toast with «Отменить», and gives a light tap in Telegram. The last task of the day throws leaf confetti, unless reduced motion is on.
