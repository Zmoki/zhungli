# Zhungli

Static PWA, vanilla JS, no build step. Deployed by Cloudflare Pages on push to `main` (https://zhungli.zmoki.xyz/). Pages serves only `app/` (its build output directory), so the app's files go there and docs, tools and the tracking plan stay out of it. Other paths get `app/404.html`. `functions/` stays at the repo root, where Pages looks for it. See README.md for what the app does.

## Rules

- **Language:** UI and catalog texts (`plants.js`) in Russian, except English and Latin names on a card's `alt` line. Code, comments, commits, docs, issues and PostHog in English. No long dashes «—» in UI or catalog texts: they read as book typography in an app. Rephrase with a colon, comma, period, parentheses or two sentences instead of swapping in another dash. A lone «—» for an empty value (no reading yet) is fine.
- **Tone:** the app and plant quips address the user with «вы», no gendered forms for the user. Catalog tips use infinitives («Поливать после…»).
- **Text check:** `node tools/texts.js` checks every Russian text in the scripts, «Что нового», the catalog, `index.html`, `privacy.html` and the manifest against these rules and DESIGN.md (long dashes, «ты», «;», «субстрат», straight quotes, sentences over 25 words). Run it after changing texts; it should report 0 problems. `--html FILE` also writes a page with every UI text by screen, to read through.
- **Code:** scripts load in order from `index.html`: data (`plants`, `shapes`, `changelog`), then `core` → `stats` → `state` → `views` → `plant` → `add` → `settings` → `stories` → `app`, then `telegram`. Code that runs at load may only use what earlier files define. Taps go through `ACTS` (by `data-act`): add a handler in the file that owns the screen. A new script only needs a `<script>` in `index.html`: `sw.js` reads the `?v=` files from it.
- **Release:** on any change to app files, bump the version in `index.html` (`?v=` on every asset), `version.txt` and `CACHE` in `sw.js`. Phones compare `version.txt` and reload. Docs-only changes need no bump. Add user-facing changes to `changelog.js` (Russian, short); that lights the ✨ dot for existing users.
- **User data:** people keep real data in localStorage (`zhungli.v1`) and IndexedDB (`zhungli`/`photos`). Never reset it. A format change needs a migration in `prepare()` (see `migrateV1`) and a bump of `v`.
- **Catalog:** a card's id is its zhungli-content slug, frozen once added (exceptions in the `plants.js` header); `plantIds` link it to the content plants, `tone` pins its pot color, and `SHAPE_BY_ID` in `shapes.js` its drawing (a new card gets all three). Linked cards' titles and second lines come from the content: change them there and run `node tools/names.js --write` (`node tools/names.js` checks). Saved plants point at catalog ids via `def` (the oldest by their own id). Rename or remove an id only with a migration in `prepare()` that moves its saved plants to the new card (see `migrateCardIds`), never to an id another card had; to retire a card without one, hide it with `hidden: true`.
- **Accessibility:** WCAG AAA, plus the W3C COGA guidance for cognitive accessibility (https://www.w3.org/TR/coga-usable/; not a conformance standard). Text 7:1 in both themes (use the color tokens; `--on-green` for text on `--green`), control borders 3:1 (`--edge`), tap targets ≥ 44×44, text sizes in `rem` (1rem = 17px or the iPhone text-size setting, nothing under 14px except tab labels), layouts reflow instead of scrolling sideways, button text stays on one line (button rows wrap instead; keep labels short), labels tied to fields, toasts and other announcements go through `announce()` (`#live`, or `#sheet-live` while a sheet is open).
- **Look:** follow [DESIGN.md](DESIGN.md), including icons and emoji.
- **Analytics:** every `track()` call and its props go in the tracking plan `analytics/events.json`; follow «Adding or changing an event» in `ANALYTICS.md`, and `node tools/events.js` must report 0 problems before the PR. The `analytics` skill (`.claude/skills/analytics/`) has the PR flow and the PostHog side. Update `privacy.html` if an event sends a new kind of data. Any `privacy.html` change also gets a `changelog.js` entry. No plant names, nicknames, notes or photos in events.
- **Security headers:** `_headers` sets a strict CSP (no inline scripts or `style=""` attributes; dynamic sizes are set through the CSSOM, never markup: `data-l`/`data-w` and `applySizes()`, or `el.style` as for plant card heights in `render()`). Keep securityheaders.com at A+.
- **Telegram mini app:** see [TELEGRAM.md](TELEGRAM.md). Test sync with a fake Telegram before changing it. When bot texts change in BotFather, update the snapshot there.
- **License:** all rights reserved (see LICENSE), not open source. Every served file starts with the copyright header (`/*! … */` in JS/CSS, `<!-- … -->` in HTML/SVG); add it to new files.
- **Ideas:** improvement ideas go to GitHub issues with the `idea` label.
- **Git:** every change goes in its own PR, branched from an up-to-date `main`. Never base a branch on another PR's branch; for parallel work use a git worktree. If two open PRs bump the version, the later one updates its bump after the first is merged. Squash-merge only when asked, then delete the branch.
- **Docs:** [PLANTS.md](PLANTS.md), [TASKS.md](TASKS.md), [TELEGRAM.md](TELEGRAM.md), [DESIGN.md](DESIGN.md), [TAGS.md](TAGS.md). Update them with the behavior they describe. Keep each fact in one place: don't repeat docs content here or in README. Images go in `images/` (app icons stay in `app/icons/`).

## Run locally

```bash
python3 -m http.server 8765 -d app
```

On localhost stats only go to `console.debug('[stats]', …)`.
