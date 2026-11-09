# Zhungli

Static PWA, vanilla JS, no build step. Deployed by Cloudflare Pages on push to `main` (https://zhungli.zmoki.xyz/). See README.md for what the app does.

## Rules

- **Language:** UI and catalog texts (`plants.js`) in Russian. Code, comments, commits, docs, issues and PostHog in English.
- **Tone:** the app and plant quips address the user with «вы», no gendered forms for the user. Catalog tips use infinitives («Поливать после…»).
- **Release:** on any change to app files, bump the version in `index.html` (`?v=` on every asset), `version.txt` and `CACHE` in `sw.js`. Phones compare `version.txt` and reload. Docs-only changes need no bump. Add user-facing changes to `changelog.js` (Russian, short); that lights the ✨ dot for existing users.
- **User data:** people keep real data in localStorage (`zhungli.v1`) and IndexedDB (`zhungli`/`photos`). Never reset it. A format change needs a migration in `prepare()` (see `migrateV1`) and a bump of `v`.
- **Catalog:** don't rename or remove catalog ids; saved plants point at them via `def`. Hide entries with `hidden: true` instead.
- **Accessibility:** WCAG AAA. Text 7:1 in both themes (use the color tokens; `--on-green` for text on `--green`), control borders 3:1 (`--edge`), icons as text glyphs in the text color (no ➕-style emoji), tap targets ≥ 44×44, text sizes in `rem` (1rem = 17px or the iPhone text-size setting, nothing under 14px except tab labels), layouts reflow instead of scrolling sideways, button text stays on one line (button rows wrap instead; keep labels short), labels tied to fields, decorative emoji `aria-hidden`, toasts go through `#live`.
- **Look:** cream ground with three soft blobs (sun, leaf, sky: `.blobs` in `index.html`), pastel on purpose so plain text on them keeps 7:1; glass (`--glass-bg`, `--glass-blur`) on floating layers and the few cards on «Сегодня»; long lists (plant grid, Light rows) are solid `--surface` cards without blur; cards use the quiet `--shadow-soft`, only floating layers get `--shadow`; bright fills (`--sun`, `--tangerine`, `--gum`, `--sky`, `--leafy`, `--plum`) always with dark `--on-color` text, chunky buttons with a darker rim and floor. Colors carry meaning: beige for common actions, settings and adding (`.btn.primary`, `.import-cta`, editable blocks), blue for watering (`.btn.water`), green for done/OK (`.btn.ok`), pink for the greenhouse and airing (`.btn.air`, `.gh`), red for deleting (`.btn.danger`), leaf green for the plant's own words (`.quip`). Status and greenhouse chips on plant pictures are white glass (`--glass-photo`) with the status color on the face and word (`--st-*`, 7:1 even over a black photo). Font: Nunito, self-hosted in `fonts/` (OFL). `prefers-reduced-transparency` turns glass solid.
- **Icons:** Lucide 0.468.0 symbols in the sprite in `index.html`, used via `I('name')`; add new ones from `lucide-static@0.468.0/icons/` (`house-heart` comes from 1.70.0, same ISC license). Plants without a photo use `plantSvg(plant, mood)` from `shapes.js`: a silhouette, a face on the pot for the mood, and one of six pot/tile color pairs (`.v0`–`.v5`) by id. Emoji only where they carry mood: quips, toasts, celebrations, confetti.
- **Analytics:** add a row to `ANALYTICS.md` for every new `track()` call, and update `privacy.html` if it sends a new kind of data. No plant names, nicknames, notes or photos in events.
- **Security headers:** `_headers` sets a strict CSP (no inline scripts or `style=""` attributes; dynamic sizes go through `data-l`/`data-w` and `applySizes()`). Keep securityheaders.com at A+.
- **Telegram mini app:** `/tg` (rewrite in `_redirects`, own CSP in `_headers`) runs the same app; `telegram.js` adds Telegram's theme, back button, haptics and CloudStorage sync: state in chunks, pulled at start and on every return, pushed only after real changes; newest wins; a device that never had plants never uploads; «Начать с чистого листа» clears the cloud copy. Photos sync as 400 px copies (index m0…/mn, pieces f_<id>_<i>, at most 800 pieces) after the plants are reconciled. Test with a fake Telegram before changing it. Bot: @ZhungliPlantsBot.
- **License:** all rights reserved (see LICENSE), not open source. Every served file starts with the copyright header (`/*! … */` in JS/CSS, `<!-- … -->` in HTML/SVG); add it to new files.
- **Ideas:** improvement ideas go to GitHub issues with the `idea` label.

## Run locally

```bash
python3 -m http.server 8765
```

On localhost stats only go to `console.debug('[stats]', …)`.
