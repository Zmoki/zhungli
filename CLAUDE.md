# Zhungli

Static PWA, vanilla JS, no build step. Deployed by Cloudflare Pages on push to `main` (https://zhungli.zmoki.xyz/). See README.md for what the app does.

## Rules

- **Language:** UI and catalog texts (`plants.js`) in Russian. Code, comments, commits, docs, issues and PostHog in English.
- **Tone:** the app and plant quips address the user with «вы», no gendered forms for the user. Catalog tips use infinitives («Поливать после…»).
- **Code:** app scripts load in order from `index.html`: `core` → `stats` → `state` → `views` → `plant` → `add` → `settings` → `app`. Code that runs at load may only use what earlier files define. Taps go through `ACTS` (by `data-act`): add a handler in the file that owns the screen. A new script only needs a `<script>` in `index.html`: `sw.js` reads the `?v=` files from it.
- **Release:** on any change to app files, bump the version in `index.html` (`?v=` on every asset), `version.txt` and `CACHE` in `sw.js`. Phones compare `version.txt` and reload. Docs-only changes need no bump. Add user-facing changes to `changelog.js` (Russian, short); that lights the ✨ dot for existing users.
- **User data:** people keep real data in localStorage (`zhungli.v1`) and IndexedDB (`zhungli`/`photos`). Never reset it. A format change needs a migration in `prepare()` (see `migrateV1`) and a bump of `v`.
- **Catalog:** don't rename or remove catalog ids; saved plants point at them via `def`. Hide entries with `hidden: true` instead.
- **Accessibility:** WCAG AAA. Text 7:1 in both themes (use the color tokens; `--on-green` for text on `--green`), control borders 3:1 (`--edge`), tap targets ≥ 44×44, text sizes in `rem` (1rem = 17px or the iPhone text-size setting, nothing under 14px except tab labels), layouts reflow instead of scrolling sideways, button text stays on one line (button rows wrap instead; keep labels short), labels tied to fields, toasts go through `#live`.
- **Look:** follow [DESIGN.md](DESIGN.md), including icons and emoji.
- **Analytics:** add a row to `ANALYTICS.md` for every new `track()` call, and update `privacy.html` if it sends a new kind of data. Any `privacy.html` change also gets a `changelog.js` entry. No plant names, nicknames, notes or photos in events.
- **Security headers:** `_headers` sets a strict CSP (no inline scripts or `style=""` attributes; dynamic sizes go through `data-l`/`data-w` and `applySizes()`). Keep securityheaders.com at A+.
- **Telegram mini app:** see [TELEGRAM.md](TELEGRAM.md). Test sync with a fake Telegram before changing it. When bot texts change in BotFather, update the snapshot there.
- **License:** all rights reserved (see LICENSE), not open source. Every served file starts with the copyright header (`/*! … */` in JS/CSS, `<!-- … -->` in HTML/SVG); add it to new files.
- **Ideas:** improvement ideas go to GitHub issues with the `idea` label.
- **Git:** every change goes in its own PR, branched from an up-to-date `main`. Never base a branch on another PR's branch; for parallel work use a git worktree. If two open PRs bump the version, the later one updates its bump after the first is merged. Squash-merge only when asked, then delete the branch.
- **Docs:** [PLANTS.md](PLANTS.md), [TASKS.md](TASKS.md), [TELEGRAM.md](TELEGRAM.md), [DESIGN.md](DESIGN.md). Update them with the behavior they describe. Keep each fact in one place: don't repeat docs content here or in README. Images go in `images/` (app icons stay in `icons/`).

## Run locally

```bash
python3 -m http.server 8765
```

On localhost stats only go to `console.debug('[stats]', …)`.
