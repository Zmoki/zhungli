# Design

The core look and feel of Жунгли. Accessibility and tone rules are in [CLAUDE.md](CLAUDE.md); tokens and their values are in `style.css` `:root`.

## Character

- **Playful and calm.** Plants are characters: a face on the pot, their own words in green bubbles, emoji for mood (see below).
- **No guilt.** No red overdue items or backlog counters. A skipped plant waits until tomorrow. A finished day gets «Джунгли довольны!», a quiet one «Сегодня отдыхаем».
- **Short and warm text.** One idea per line, buttons of one or two words.

## Ground and layers

- **Ground:** plain cream (`--bg`) with three soft blobs: sun at the top right, leaf on the right, sky at the bottom left (`.blobs`). They're pastel on purpose, so plain text on top keeps 7:1.
- **Glass:** floating layers (tab bar, round icon buttons, sheets) and the cards on «Сегодня», Комната and the light tips use frosted glass (`--glass-bg`, `--glass-blur`). `prefers-reduced-transparency` turns it solid.
- **Solid cards:** long lists (plant grid, Light rows) are solid `--surface` cards without blur, so photos stand out and scrolling stays smooth.
- **Shadows:** cards get the quiet `--shadow-soft`; only floating layers get `--shadow`.
- **Shape:** big rounded corners (`--radius`, 26px) and round chips.

## Color means something

Bright flat fills always carry dark `--on-color` text. Each color has one job:

| Color | Token | Used for |
|---|---|---|
| Beige | `--beige` | Common actions, settings, adding (`.btn.primary`, `.import-cta`), editable blocks. |
| Blue | `--sky`, `--blue` for text | Watering (`.btn.water`) and the next check line on grid cards. |
| Green | `--leafy` | Done, OK (`.btn.ok`). |
| Pink | `--gum`, `--air` | Greenhouse and airing (`.btn.air`, the greenhouse badge). |
| Red | `--danger` | Deleting (`.btn.danger`). |
| Leaf green | `--quote` | The plant's own words (`.quip`). Never used for anything editable. |

Statuses have their own hues, the same in chips, filters and the Light tab tags:

| Status | Color | Face |
|---|---|---|
| суховато | orange (`--st-need`) | frown |
| темновато | plum (`--st-dim`) | meh |
| ярковато | sun (`--st-hot`) | annoyed |
| напоено | blue (`--st-watered`) | laugh |
| хорошо | green (`--st-fine`) | smile |
| в теплице | pink (`--st-gh`) | house-heart |
| how it grows, when not an ordinary pot | teal (`--st-grow`) | the way's icon: glass-water (в воде), fish (в аквариуме), grip (в керамзите), mountain (на минералке), tree-deciduous (на блоке), flask-round (в террариуме), cable (на фитиле), cylinder (с резервуаром) |

Status chips on pictures are white glass (`--glass-photo`) with the status color on the face and the word, so they keep 7:1 even over a black photo.

## Buttons

Chunky and tactile: a bright fill, a darker rim and a 4 px floor in the rim color. Pressed, the button drops onto its floor. Labels stay on one line; rows of buttons wrap instead. Checkboxes match: a chunky box on a floor, green with a dark check when ticked; their text reads like a chip's.

## Plant card

Top to bottom: the picture, the name, the plant's words right under it, short facts (check interval, light, temperature, medium, and a wick or reservoir if any), then watering. Below them three tabs: «Уход» (tips and notes, where the card always opens), «Настройки» (name, place, light, greenhouse, how it grows) and «История» (the last 4 weeks as dots, then the list; with no answers yet, the next 4 weeks with the planned checks dashed). A card opened right after adding one plant starts on «Настройки». Choices show all their options as chips, never in a dropdown.

## Plant pictures

A photo, or a drawn silhouette from `plantSvg(plant, mood)` in `shapes.js`:
- one of 16 shapes (leafy, trailing, succulent, palm…);
- one of six pot and tile color pairs (`.v0`–`.v5`, tiles `--t0`–`--t5`), kept per plant;
- a face on the pot showing the plant's mood, with pink cheeks.

## Icons and emoji

- **Icons:** Lucide 0.468.0 symbols in the sprite in `index.html`, used via `I('name')`. Add new ones from `lucide-static@0.468.0/icons/` (`house-heart` comes from 1.70.0, same ISC license). They're line glyphs in the text color, never ➕-style emoji.
- **Emoji:** only where they carry mood: quips, toasts, celebrations, confetti. Decorative emoji are `aria-hidden`.

## Type

Nunito (`fonts/`), weights 500–900. Headings and buttons are the heaviest (900). Sizes are in `rem`, so the iPhone text-size setting scales the whole app.

## Dark theme

It follows the system, or Telegram's theme in the mini app. Same meanings and layout: the ground turns deep plum (`#1a1524`), blobs and tiles become muted versions of the same hues, and text colors are re-picked to keep 7:1.

## Brand

- **Name:** Жунгли, a playful «джунгли».
- **Icon** (`icons/icon.svg`): a sprout in a smiling orange pot on a sun-yellow square with a pale sun circle.
- **Telegram welcome picture:** see [TELEGRAM.md](TELEGRAM.md).
