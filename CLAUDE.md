# Zhungli

Static PWA, vanilla JS, no build step. Deployed by Cloudflare Pages on push to `main` (https://zhungli.zmoki.xyz/). See README.md for what the app does.

## Rules

- **Language:** UI and catalog texts (`plants.js`) in Russian. Code, comments, commits, docs, issues and PostHog in English.
- **Tone:** the app and plant quips address the user with «вы», no gendered forms for the user. Catalog tips use infinitives («Поливать после…»).
- **Release:** on any change to app files, bump the version in `index.html` (`?v=` on every asset), `version.txt` and `CACHE` in `sw.js`. Phones compare `version.txt` and reload. Docs-only changes need no bump. Add user-facing changes to `changelog.js` (Russian, short); that lights the ✨ dot for existing users.
- **User data:** people keep real data in localStorage (`zhungli.v1`) and IndexedDB (`zhungli`/`photos`). Never reset it. A format change needs a migration in `prepare()` (see `migrateV1`) and a bump of `v`.
- **Catalog:** don't rename or remove catalog ids; saved plants point at them via `def`. Hide entries with `hidden: true` instead.
- **Accessibility:** WCAG AAA. Text 7:1 in both themes (use the color tokens; `--on-green` for text on `--green`), tap targets ≥ 44×44, labels tied to fields, decorative emoji `aria-hidden`, toasts go through `#live`.
- **Analytics:** add a row to `ANALYTICS.md` for every new `track()` call. No plant names, nicknames, notes or photos in events.
- **Ideas:** improvement ideas go to GitHub issues with the `idea` label.

## Run locally

```bash
python3 -m http.server 8765
```

On localhost stats only go to `console.debug('[stats]', …)`.
