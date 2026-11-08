# Жунгли 🌿

A small PWA in Russian that shows a few plants to check each day and learns how fast each one dries out.

- Watering by checking, not by calendar: "dry → watered" or "still wet".
- At most N plants a day, no backlog or red overdue items.
- Plants come from the catalog or a generic type ("Succulent", "Flowering"…); the interval adjusts itself.
- Light: lux meter readings and tips on what to move.
- Room: temperature, humidity and smart home scenarios.

Data stays on the phone (localStorage + IndexedDB). Backup is in settings.

Anonymous stats (which buttons are tapped, no plant names, nicknames or photos) go to PostHog via `functions/ingest/batch.js`. They can be turned off in settings.

Catalog: `plants.js`.

Release: bump `?v=` in `index.html` and the number in `version.txt`; the app on the phone reloads itself.
