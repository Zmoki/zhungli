---
name: analytics
description: Жунгли analytics work end to end. Use for adding, renaming or reviewing track() events, the tracking plan (analytics/events.json), and PostHog charts and dashboards for this app.
---

# Жунгли analytics

The rules for events live in [ANALYTICS.md](../../../ANALYTICS.md): naming («Adding or changing an event»), every event and prop, and the dashboard list at the top. This skill is the workflow around them and what PostHog needs. Don't repeat ANALYTICS.md here; link to it.

PostHog: project 720394 (US cloud), through the PostHog MCP tools. Every chart and dashboard leaves out our own devices with the project's test account filter (`filterTestAccounts: true`).

## Reviewing an area

1. List the area's events from `analytics/events.json` (live and removed) and every `track()` call for them.
2. Walk the screen's code for actions that send nothing, and check real data in PostHog (counts, devices, prop values since 2026-11-08) before proposing anything.
3. Propose a table: now, new, why. Ask before building; the user decides the names.

## An event PR

1. A worktree from an up-to-date `main` (`.claude/worktrees/<name>`), its own branch.
2. Change the `track()` calls and `analytics/events.json` by ANALYTICS.md «Adding or changing an event» (`was`, `removed`). Edit the JSON as text so its hand formatting stays. A split or merge that needs a new prop can't be translated at ingest: say so in a `note`.
3. Bump the version as CLAUDE.md «Release» says, then run `node tools/events.js --write`, `node tools/events.js` and `node tools/texts.js`: all must report 0 problems.
4. Test in the browser: a temporary entry on a free port in the `.claude/launch.json` that `preview_start` reads (the session's working folder), `preview_start`, clear storage and the service worker, then read the `[stats]` lines in the console (`flushStats()` sends the batch at once). Check every new or renamed event and its props. Remove the launch entry after.
5. Commit, push, open the PR with a table of the changes and what was tested. Then the review (code-review high with fixes) and merge only when the user says so.

## After the merge

- Hide each old name in PostHog with a note: «Renamed to X in vNNN; older app versions are translated at ingest. Hidden.» If the note already records an earlier rename, keep it and add the new step. A name that never arrived has no definition: skip it.
- Update descriptions and tags of changed events from `node tools/events.js --posthog`. A new event gets its definition only when a phone first sends it.

## Charts

- Every chart that uses a renamed event counts the old and new names in the same row, bar or funnel step: an `IN (...)` list in SQL, a `GroupNode` with `operator: OR` in trends and funnels. Never a second series for the new name. Check the numbers are the same before and after.
- Start every chart on 2026-11-08 (`date_from`), never «last N days» or a comparison with the previous period.
- Several numbers per category (times, devices, plants): a SQL table, one row per category.
- Description: what is counted, then «Since 2026-11-08.» or «By week, since 2026-11-08.», then history: «Also counts older versions' X (before vNNN).» At most 400 characters.
- Keep only charts that sit on a dashboard; delete the rest. A chart can sit on two dashboards (`dashboards` on the insight is a full replacement: send every id).

## Dashboards

One dashboard per event prefix, with tile groups shown as sections (`group_display: sections`, a `group_key` per tile). The list is at the top of ANALYTICS.md; keep it current there. A new chart goes on its prefix's dashboard, in the matching section. «first run» stays simple on purpose (the user mostly looks at «Onboarding steps»): don't add tiles there without asking. Ask before creating a dashboard: the user didn't want one for Light and Room.

Layout: tiles 6 wide and 5 tall, two per row; each group starts on a new row; send every tile of the dashboard with a full `sm` box in one `dashboard-update`.

## PostHog tool notes

- `insight-update` takes `id` (the short id) with `query`, `description` and `dashboards` at the top level.
- Tile moves (`dashboard-transfer-tile`) and dashboard updates return the whole dashboard, often too big to read: hand a batch of moves to a helper agent with the exact tile ids, and check the result with `system.dashboard_tiles` in SQL. A move once answered 404 although it went through: check before retrying.
- `system.insights`, `system.dashboards` and `system.dashboard_tiles` can be queried with `execute-sql` to find charts that use an event (`match(toString(query), '...')`).
- PostHog adds new tiles on top: set the layout after adding several.
