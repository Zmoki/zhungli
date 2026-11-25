# Design

The core look and feel of Жунгли. Accessibility and tone rules are in [CLAUDE.md](CLAUDE.md); tokens and their values are in `style.css` `:root`.

## Character

- **Playful and calm.** Plants are characters: a face on the pot, their own words in green bubbles, emoji for mood (see below).
- **No guilt.** No red overdue items or backlog counters. A skipped plant waits until tomorrow. A finished day gets «Джунгли довольны!», a quiet one «Сегодня отдыхаем».
- **Short and warm text.** One idea per line, buttons of one or two words.
- **Plain words in care texts.** One idea per sentence, no «;». «Грунт», not «субстрат» (for pon and other mineral media, «смесь»). A term only when nothing simpler fits, with the reason in the same sentence («рыхлая смесь торфа, перлита и коры, чтобы вода быстро уходила»), not «с дренажом».

## Ground and layers

- **Ground:** plain cream (`--bg`) with three soft blobs: sun at the top right, leaf on the right, sky at the bottom left (`.blobs`). They're pastel on purpose, so plain text on top keeps 7:1.
- **Glass:** floating layers (tab bar, round icon buttons, sheets) and the cards on «Сегодня», Комната and the light tips use frosted glass (`--glass-bg`, `--glass-blur`). `prefers-reduced-transparency` turns it solid.
- **Solid cards:** long lists (plant grid, Light rows) are solid `--surface` cards without blur, so photos stand out and scrolling stays smooth.
- **Settings cards:** the bottom of settings is three cards: «Приложение» on beige, «Статистика» on glass, «Сделали» on lilac (`--credits`). «Что нового» opens with a compact «Приложение» card: version and the Telegram button. The device number is only in settings (it is needed only to delete sent stats).
- **Shadows:** cards get the quiet `--shadow-soft`; only floating layers get `--shadow`.
- **Sheet heads:** the title and ×, plus ← when there's a sheet to go back to. No icon square: it took a third of the first screen.
- **Stories** («Как работают Жунгли»): their own look, the same in both themes. Deep leaf green (`--st-bg`) with cream text, white progress bars, flat pill buttons without the chunky floor, and the app's real screens inside in a cream phone frame. The phones are pictures (hidden from screen readers, which get the same steps as text) scaled down to fit, so their text may end up under 14px; the drawn Safari's text is in rem like the app's.
- **Shape:** big rounded corners (`--radius`, 26px) and round chips.
- **Space:** generous, so each card and control reads on its own (W3C COGA: use white space): 24px between cards, 20px inside a task card, 14px between buttons, 10px between chips, 12px between picker rows and info blocks, 36px above a section heading.

## Color means something

Bright flat fills always carry dark `--on-color` text. Each color has one job:

| Color | Token | Used for |
|---|---|---|
| Beige | `--beige` | Common actions, settings, adding (`.btn.primary`, `.import-cta`), editable blocks. A darker beige (`--band`) is the title band of a plant settings group. |
| Blue | `--sky`, `--blue` for text | Watering (`.btn.water`) and the next check line on grid cards. |
| Green | `--leafy` | Done, OK (`.btn.ok`). |
| Pink | `--gum`, `--air` | Greenhouse and airing (`.btn.air`). |
| Red | `--danger` | Deleting (`.btn.danger`). |
| Leaf green | `--quote` | The plant's own words (`.quip`). Never used for anything editable. |

### Tags, badges, chips

Three words, used the same in the UI, code and docs:

| Word | In Russian texts | What it is | Where | Class |
|---|---|---|---|---|
| **tag** | метка | an icon and a word about the plant | the plant card's row under the quote (tap for a bubble), the pet label in the catalog | `.tag`, `.pet-tag`; the Light tab's colored word is `.light-tag` |
| **badge** | значок | an icon only, in a white circle | grid cards, over the picture | `.badge` |
| **chip** | — | a choice you press | «Да» / «Нет», places, filters | `.chip`, `.st-chip` (the Plants tab filter) |

Each kind of tag has its own hue, the same on tags, badges and filter chips (the kind is a class: `.need`, `.danger`, `.greenhouse`…). Every tag with its word, icon, color and bubble is in [TAGS.md](TAGS.md). Toxic and safe for pets differ by shape too: the paw on «опасно» is turned the other way.

Grid badges on pictures are white glass (`--glass-photo`) with the status color on the icon. Plant card tags are white (`--sheet-solid`) with the color on the word, the icon and the border.

## Buttons

Chunky and tactile: a bright fill, a darker rim and a 4 px floor in the rim color. Pressed, the button drops onto its floor. In a plant's «Настройки» every action button looks and behaves the same: full width, centered, with its floor (beige for neutral actions like «Сменить карточку», colored for done-actions like «Полито сегодня»), and greyed out when it doesn't apply now (done today already, or not for this plant). Labels stay on one line; rows of buttons wrap instead. Checkboxes match: a chunky box on a floor, green with a dark check when ticked; their text reads like a chip's.

## Action words

The same action has the same word everywhere, so people don't have to wonder whether two buttons do the same thing (W3C COGA: same name for the same thing).

- **Done:** the action's past form, as on the check card's «Полито»: «Подкормлено», «Промыто», «Протёрто», «Повёрнуто», «Обрезано», «Проветрено», «Осмотрено». In the plant card it gets «сегодня» («Полито сегодня»). Never a generic «Готово».
- **Later:** the button says when the task comes back: «Завтра» (checks), «Через 3 дня» (bonus tasks, bath day). Its toast says the same.
- **Never:** «Не нужно».
- **Under a heading:** a button under a heading or title that names the thing drops the noun: «Сохранить» and «Восстановить» under «Резервная копия». Elsewhere it keeps it («Сохранить копию»).
- **Buttons and links:** an infinitive or a noun («Перенести из чата с ИИ», «Сохранить копию»), never an imperative. The task line above the buttons is the imperative («Полейте…»).
- **Removing:** «Убрать» for a plant, photo, place or room; «Удалить» for a note; «Стереть» for all data.
- **Steps:** a task of several steps says where you are: «Шаг 2 из 3».
- **How:** a check card's how-to folds under «Как?», next to «Завтра», each under one of the two answers. «Как?» takes the main button's color; warnings never fold.

## Help

«Как работают Жунгли» is the first button in settings, so help is always in the same place (WCAG 2.2, 3.2.6).

## Search

Search fields have a magnifier on the left and, once something is typed, an ✕ on the right that empties the field (`searchX()` in `core.js`). Safari on iPhone draws no clear button of its own, and the browser's own one is hidden where it exists.

## Nothing disappears

A plant's «Настройки» never hide a section or a switch that doesn't apply to it: it stays in place, disabled and greyed out, with a short line saying why (`.why-not`, `whyNot()` in `plant.js`). Examples: «Подкормка» for a plant in pon («удобрение добавляют в каждый полив»), «Как поливаю» for a plant in water, «Покой» for a plant that doesn't rest. A section that silently disappears reads as a bug («у меня нет кнопки…»).

## Questions

Never the browser's `confirm()` or `prompt()`: they ignore the theme and text size and look foreign in the home-screen app. `ask()` in `app.js` opens a small card in the middle of the screen, over the sheet too: a title as the question, a line on what happens, an optional text field, and two buttons, «Отмена» first. Undoing actions (removing, erasing, replacing) have a red button and start with focus on «Отмена»; a name starts in the field, and Enter saves it.

## Plant card

Top to bottom: the picture (only «Фото» on it), the name, the plant's words right under it, then one row of tags: how the plant is now (the smiles), then what lasts a while (quarantine, rest, greenhouse), then what never changes (sap, toxic or safe for pets when «Дома есть кошка или собака» is on), then up to two ways of growing (the list is in [TAGS.md](TAGS.md)). A tag is a button: a tap opens a bubble with what it means (the full «Ядовито для кошек и собак» and what to do, the check's task, the light reading against what the plant needs). The bubble floats under the tag over what's below, so nothing moves; it closes on the same tag, a tap elsewhere or Esc (only the bubble, not the card), and screen readers hear its text. Facts that used to sit here (check interval, light range, temperature, medium) are in the settings rows and «Заметки». Below them three tabs: «Настройки» (where the card opens: people switch to it after about half of card opens, PostHog, November 2026; four cards of folding rows, each with its name centered in a darker beige band on top so it clearly belongs to its rows: «Растение» name and care card; «Где живёт» place, light, greenhouse; «Уход» watering («Полив», a plain block on top, not a folding row: two marks, the last watering and the next check, and «Полито сегодня», used after about 1 in 5 card opens, greyed out once the plant is watered that day; the card stays open after it, as after the other done buttons), «Проверка» (how often it's checked: the − / + stepper, or a system's chips), how it grows, feeding, pruning, soil rinse; «Сейчас» just bought, recently repotted, rest («Сейчас в покое?»). Each closed row shows its current value on the right, grey and italic when it doesn't apply (an open row hides it: its controls show it, and the head stays one line, so nothing under the finger moves while answering; «Карточка» keeps it, since nothing inside names the card. If a tap changes rows above it, the sheet scrolls by as much, so the tapped control stays in place), and opens on tap into a white card set inside the row with a margin all round, like the picture in a plant tile; what's inside never repeats the row's title (one room: «Место» has no visible label of its own; a row whose title is a yes-no question, «Недавно купили» or «Недавно пересажено», answers with «Да» / «Нет» chips); open rows stay open while the same plant's card is redrawn), «Заметки» (tips and own notes; «нет данных» for pets when nothing is known) and «История» (the last 4 weeks as dots in calendar weeks under the weekday letters, then the list by month: each entry an icon in its action's color, the word from its button and the date; a blue line where the learned interval changed; «×» on the newest answer to take a wrong one back. With no answers yet, the next 4 weeks with the planned checks dashed). The photo buttons sit at the top left of the picture, off the pot's face. Once the card has slid over the picture, a solid strip shows under the floating ×, so rows pass under the strip, not half under the button. A card opened right after adding one plant starts on «Настройки» with «Имя» and «Место» open. Choices show all their options as chips, never in a dropdown. A yes-no setting is a short question with «Да» / «Нет» chips, never a checkbox («Стоит в теплице или под колпаком?», «Звать на обрезку?»), and the question looks like any other setting's label («Как часто»): small, heavy and muted. Its hint, right under the chips, says what the current answer does («Каждый день позову проветрить.» / «Проветривать не зову.») and changes with it (screen readers hear the new line), so people can try both answers and see how each works. The card's tip or why comes after that line: help comes last. No «Если «Да»:» and no «Ещё не отмечали»: «Последний раз: …» shows only once there is one, as a quiet line under its button. «Недавно пересажено» only matters for plants called on «День подкормки», the only thing it changes; for the rest it's greyed out (see «Nothing disappears»).

## Plant pictures

A photo, or a drawn silhouette from `plantSvg(plant, mood)` in `shapes.js`:
- one of 16 shapes (leafy, trailing, succulent, palm…);
- one of six pot and tile color pairs (`.v0`–`.v5`, tiles `--t0`–`--t5`), kept per plant;
- a face on the pot showing the plant's mood, with pink cheeks.

## Icons and emoji

- **Icons:** Lucide 0.468.0 symbols in the sprite in `index.html`, used via `I('name')`. Add new ones from `lucide-static@0.468.0/icons/` (`house-heart` comes from 1.70.0, same ISC license). They're line glyphs in the text color, never ➕-style emoji.
- **Emoji:** only where they carry mood: quips, toasts, celebrations, confetti. Decorative emoji are `aria-hidden`.

## Type

Nunito (`fonts/`), weights 500–900. Headings and buttons are the heaviest (900). Sizes are in `rem`, so the iPhone text-size setting scales the whole app. Text people type (plant names, species, places, rooms) hyphenates instead of overflowing: render it with `typedHtml()`, which also marks long Latin words so they hyphenate. A chip with a typed label wraps only when it's wider than the row. App text stays `esc()`. Other text breaks long words only when they don't fit.

## Dark theme

It follows the system, or Telegram's theme in the mini app. Same meanings and layout: the ground turns deep plum (`#1a1524`), blobs and tiles become muted versions of the same hues, and text colors are re-picked to keep 7:1.

## Brand

- **Name:** Жунгли, a playful «джунгли».
- **Icon** (`app/icons/icon.svg`): a sprout in a smiling orange pot on a sun-yellow square with a pale sun circle.
- **Telegram welcome picture:** see [TELEGRAM.md](TELEGRAM.md).
