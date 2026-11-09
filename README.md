# Жунгли 🌿

A small PWA in Russian that shows a few plants to check each day and learns how fast each one dries out.

- Watering by checking, not by calendar: "dry → watered" or "still wet".
- At most N plants a day, no backlog or red overdue items.
- Plants come from the catalog or a generic type ("Succulent", "Flowering"…); the interval adjusts itself.
- Light: lux meter readings and tips on what to move.
- Room: temperature and humidity for each room, and smart home scenarios.

Data stays on the phone (localStorage + IndexedDB). Backup is in settings.

Anonymous stats (which buttons are tapped, no plant names, nicknames or photos) go to PostHog via `functions/ingest/batch.js`, without IP addresses. They can be turned off in settings. What users are told: `privacy.html`. Events: [ANALYTICS.md](ANALYTICS.md).

Catalog: `plants.js`. How it works: [plants](docs/plants.md), [tasks](docs/tasks.md), [Telegram](docs/telegram.md), [design](docs/design.md).

Release: bump `?v=` in `index.html` and the number in `version.txt`; the app on the phone reloads itself.

License: all rights reserved. You may read the code and open issues; copying, hosting or reusing it needs written permission. See [LICENSE](LICENSE).

Pull requests are open to collaborators only. Bugs and ideas are welcome as [issues](https://github.com/Zmoki/zhungli/issues).
