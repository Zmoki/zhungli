# Plant tags

Every tag the app shows about a plant: when it shows, how it looks and what its bubble says. The words tag, badge and chip are in [DESIGN.md](DESIGN.md#tags-badges-chips).

`tagsOf()` in `plant.js` builds a plant's tags. Grid badges (`plantBadges` in `views.js`) and the Plants filter (`filterKinds`) use the same list, so they show the same tags in the same order.

A tag's key is the same everywhere: the `data-tag` attribute, `plant_tag_opened` `tag` and `plants_filtered` `status` in [analytics/events.json](analytics/events.json).

## Where tags show

| Place | Looks like | Which tags |
|---|---|---|
| Plant card, the row under the quote | tag: icon and word; a tap opens a bubble | all of the plant's tags, at most 2 ways |
| Grid card, over the picture | badge: icon in a white circle; the word is its `title` and for screen readers | the same as the plant card, in two columns up from the bottom corners: the plant group on the left (a second column beside it when the picture is full, 5 badges on a phone), safety on the right, so the pet paw is always in the bottom right corner |
| Plants tab «Фильтр» sheet (6 or more plants) | chip: icon, word and count, in sections «Как сейчас», «Как растёт», «Безопасность» | one chip per key that any plant has; ways also when the name says them. The chosen one shows in the «Фильтр» field under the search |
| Catalog row in «Добавить» | badge in the corner of the picture: only «опасно» or «безопасно» | when pets are on in «Настройки» |

The Light tab and the plant card's light row show a colored word (`.light-tag`: темновато, ярковато, отлично). It's not a tag: no icon, no bubble.

## All tags, in order

Two groups, the same order in the plant card, the Plants filter and the grid's badge columns (bottom up): the plant (how it is now, rest, how it grows, greenhouse) on the left, safety on the right. The pet paw («опасно» or «безопасно») starts the safety group, so on grid cards it's always in the bottom right corner.

| # | Group | Key | Word | Icon | Color | Shows when | Bubble |
|---|---|---|---|---|---|---|---|
| 1 | plant | `need` | суховато, or the way's word: мутновато (в воде), пустовато (фитиль, резервуар, поддон), неясно (автополив) | frown | orange `--st-need` | a check is due today or overdue; not on the first check day before any answer, never in an aquarium | the word: today's watering task |
| 2 | plant | `watered` | напоено | laugh | blue `--st-watered` | watered today (not on drip) | «Напоено»: the next check |
| 3 | plant | `dim` | темновато | meh | plum `--st-dim` | the light reading is under the plant's range | «Темновато»: lux here and lux needed |
| 4 | plant | `hot` | ярковато | annoyed | sun `--st-hot` | the light reading is over the range | «Ярковато»: lux here and lux needed |
| 5 | plant | `fine` | хорошо | smile | green `--st-fine` | none of 1–4 | «Хорошо»: no watering yet and the next check, or «Первая проверка сегодня» with the task |
| 6 | plant | `rest` | отдыхает | moon | grey `--st-rest` | in rest | «Покой с …»: what rest changes, no feeding |
| 7 | plant | ways | see below | the way's icon | teal `--st-grow` | see below | the way's `tagHint`, else its `hint` |
| 8 | plant | `greenhouse` | в теплице | house-heart | fuchsia `--st-gh` | greenhouse on | «В теплице»: daily airing |
| 9 | safety | `pets` | опасно (screen readers: «опасно для питомцев») | paw-toxic | red `--st-danger` | pets on, toxic for cats and dogs per ASPCA | «Ядовито для кошек и собак»: the card's pets note, then call a vet |
| 10 | safety | `pets_safe` | безопасно (screen readers: «безопасно для питомцев») | paw-print | green | pets on, safe per ASPCA | «Безопасно для кошек и собак»: «По базе ASPCA.» |
| 11 | safety | `sap` | едкий сок | triangle-alert | red | the catalog card has `toxic` | «Едкий сок»: sap hurts skin (and mucous membranes), work in gloves |
| 12 | safety | `new` | на карантине | biohazard | red | bought less than `NEW_DAYS` ago | «На карантине до …»: keep apart; while settling, also don't move, prune or repot |

`need` and `watered` never show together, nor `dim` and `hot`. The pot's face on a grid card is one of 1–5: a due check first, then wrong light, then the rest (`mood()`).

## Ways

Every way of growing but «Сверху» has a tag. The data is `badge: [icon, word]` on `MEDIA` and `WATERING` in `state.js`.

| Key | Chosen in | Word | Icon |
|---|---|---|---|
| `soil` | «В чём растёт» (`MEDIA`) | в грунте | shovel |
| `dry` | «В чём растёт» (`MEDIA`) | в грунте для суккулентов | droplet-off |
| `bark_mix` | «В чём растёт» (`MEDIA`) | в смеси с корой | blend |
| `peat` | «В чём растёт» (`MEDIA`) | в торфе | brick-wall |
| `sphagnum` | «В чём растёт» (`MEDIA`) | в сфагнуме | leaf |
| `bark` | «В чём растёт» (`MEDIA`) | в коре | layers |
| `coco` | «В чём растёт» (`MEDIA`) | в кокосе | tree-palm |
| `mineral` | «В чём растёт» (`MEDIA`) | в минеральной смеси | mountain |
| `leca` | «В чём растёт» (`MEDIA`) | в керамзите | grip |
| `water` | «В чём растёт» (`MEDIA`) | в воде | glass-water |
| `mount` | «В чём растёт» (`MEDIA`) | на блоке | tree-deciduous |
| `terrarium` | «В чём растёт» (`MEDIA`) | в террариуме | flask-round |
| `aquarium` | «В чём растёт» (`MEDIA`) | в аквариуме | fish |
| `soak` | «Как поливаю» (`WATERING`) | полив погружением | waves |
| `bottom` | «Как поливаю» (`WATERING`) | полив снизу | arrow-up-from-line |
| `wick` | «Как поливаю» (`WATERING`) | на фитиле | cable |
| `reservoir` | «Как поливаю» (`WATERING`) | с резервуаром | cylinder |
| `tray` | «Как поливаю» (`WATERING`) | в поддоне | droplets |
| `drip` | «Как поливаю» (`WATERING`) | на автополиве | timer |

A plant gets up to two way tags, medium first. Left out:

- the watering that comes with the medium (`leca` on `reservoir`);
- the card's own medium on a `noBadge` card (tillandsia);
- in the card and on grid badges only: a way the plant's name or species already says, with «в» or «на» («Орхидея на коре»). The filter still has it.
