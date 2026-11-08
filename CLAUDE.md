# Zhungli

Static PWA, vanilla JS, no build step. Deployed by Cloudflare Pages on push to `main` (https://zhungli.zmoki.xyz/). See README.md for what the app does.

## Rules

- **Language:** UI and catalog texts (`plants.js`) in Russian. Code, comments, commits, docs, issues and PostHog in English.
- **Tone:** the app and plant quips address the user with «вы», no gendered forms for the user. Catalog tips use infinitives («Поливать после…»).
- **Release:** on any change to app files, bump the version in `index.html` (`?v=` on every asset), `version.txt` and `CACHE` in `sw.js`. Phones compare `version.txt` and reload. Docs-only changes need no bump. Add user-facing changes to `changelog.js` (Russian, short); that lights the ✨ dot for existing users.
- **User data:** people keep real data in localStorage (`zhungli.v1`) and IndexedDB (`zhungli`/`photos`). Never reset it. A format change needs a migration in `prepare()` (see `migrateV1`) and a bump of `v`.
- **Catalog:** don't rename or remove catalog ids; saved plants point at them via `def`. Hide entries with `hidden: true` instead.
- **Accessibility:** WCAG AAA. Text 7:1 in both themes (use the color tokens; `--on-green` for text on `--green`), control borders 3:1 (`--edge`), icons as text glyphs in the text color (no ➕-style emoji), tap targets ≥ 44×44, text sizes in `rem` (1rem = 17px or the iPhone text-size setting, nothing under 14px except tab labels), layouts reflow instead of scrolling sideways, labels tied to fields, decorative emoji `aria-hidden`, toasts go through `#live`.
- **Icons:** Lucide 0.468.0 symbols in the sprite in `index.html`, used via `I('name')`; add new ones from `lucide-static@0.468.0/icons/`. Plants without a photo use `plantSvg()` from `shapes.js`. Emoji only where they carry mood: quips, toasts, celebrations, confetti.
- **Analytics:** add a row to `ANALYTICS.md` for every new `track()` call, and update `privacy.html` if it sends a new kind of data. No plant names, nicknames, notes or photos in events.
- **Security headers:** `_headers` sets a strict CSP (no inline scripts or `style=""` attributes; dynamic sizes go through `data-l`/`data-w` and `applySizes()`). Keep securityheaders.com at A+.
- **Telegram mini app:** `/tg` (rewrite in `_redirects`, own CSP in `_headers`) runs the same app; `telegram.js` adds Telegram's theme, back button, haptics and CloudStorage sync (state in chunks, newest wins, an empty phone never overwrites). Bot: @ZhungliBot.
- **License:** all rights reserved (see LICENSE), not open source. Every served file starts with the copyright header (`/*! … */` in JS/CSS, `<!-- … -->` in HTML/SVG); add it to new files.
- **Ideas:** improvement ideas go to GitHub issues with the `idea` label.

## Run locally

```bash
python3 -m http.server 8765
```

On localhost stats only go to `console.debug('[stats]', …)`.
