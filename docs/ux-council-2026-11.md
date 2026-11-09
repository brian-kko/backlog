# UX council pass (M2.6), November 2026

Two independent reviewers scored the app each round against the same brief, and the work continued until both gave 9.5/10. **Outcome: both reached 9.5 in round 10 with no blockers.** The reviewers are **astra** (Codex `gpt-6-astra`) and **Opus** (a Claude Opus subagent). Scored dimensions: information architecture, visual design, interaction, mobile, accessibility, copy, feature fit, and **value vs. Steam** (the owner's question: why use this over just Steam?).

| Round | astra | Opus | Focus of the round                                                                                          |
| ----- | ----- | ---- | ----------------------------------------------------------------------------------------------------------- |
| 0     | 6.7   | 6.4  | Baseline review                                                                                             |
| 1     | 7.7   | 7.7  | Removals, add-any-game, merged news, dashboard reframe, light mode, PWA basics                               |
| 2     | 8.4   | 8.2  | Price confidence states, Steam baseline, purchase store, news classifier, library editing, offline shell     |
| 3     | 8.6   | 8.6  | Steam price competes for cheapest, Bought from / Plays on split, cleaner text, date groups, owned-first game page |
| 4     | 9.0   | 8.8  | Price-history provenance, no assumed purchases, deals availability, Steam line on deals, shared dialog, explicit read state |
| 5     | 9.2   | 9.1  | Provenance in follow-ups, moved-to-library panel, mobile buy cue and Track toggle, quiet samples, "(assumed)" launcher, 30-day "What changed" |
| 6     | 9.3   | 9.4  | Stale dev-server CSS found and fixed, type-based search filter, safe sample conversion, essential mobile notes |
| 7     | 9.4   | 9.4  | Full-width Plays on, aligned deal cards, consolidated CSS, page-owned wishlist move, coverage notes, "Read on Steam" |
| 8     | 9.4   | 9.5  | Untracked-note spacing, one link per post, transaction guards, focus restore, saving status, slow-save e2e |
| 9     | 9.4   | 9.5  | Overlapping detail writes, always-mounted focus target |
| 10    | 9.5   | 9.5  | Per-field failure tracking; no blockers from either reviewer |

## Decisions made with the owner

- Cut the Expo app and `apps/tanstack-start`; keep the Tauri desktop companion for later; make the web app an installable PWA.
- Build "Add any game" and the collection news digest now; Steam import and alert delivery stay on the roadmap.
- Treat "why not just Steam?" as a scored criterion (see `PLAN.md` §0).

## Removed

Template Post code, the Expo auth plugin, the "PC Companion: Web URI Mode" badge, the floating theme toggle, the Updates featured pills with AppIDs and the custom AppID form, the "Estimated Value" and "Backlog Value" metrics, wishlist/game notification toggles (no delivery yet), invented 20%-below targets, the "On sale only" checkbox, the deals Grid/List toggle, duplicate disabled "Owned" buttons, per-card cached-offer lines, and automatically recording a deal's price as a purchase.

## Added

- Shared "Add game" dialog (Steam search, no soundtracks or demos), with target-price and purchase-details follow-ups.
- News digest across your games: tags/title classification, promotion and sequel filtering, readable summaries, date groups, "New" markers with "Mark all as read", unread dot.
- Pricing: price confidence states, Steam baseline everywhere ("$X less than Steam"), a batched Steam comparison on deal cards, live-history-only "lowest ever", and outage and snapshot labelling.
- Collection: Bought from (13 sellers) and Plays on (launcher) with visible "(assumed)", launch only for Steam games, one-tap status, sortable remembered table, spending and "paid for, never played".
- Guests: per-item samples (Clear / Keep), editing a sample makes it yours, transfer to an account without overwriting.
- PWA (manifest, icons, versioned precaching service worker, offline states, install prompt or iOS hint), mobile bottom tabs, theme-aware forms, 3:1 control borders, skip link.

## Left for later (reviewer suggestions outside current scope)

- Denser mobile deal rows (smaller thumbnails).
- A "since your last visit" summary line on the dashboard, which pairs with M4 alert delivery.
- Collection-wide news batching beyond 24 games (M5).
- Dated "lowest ever" from Backlog's own price history (M4 poller).

## Verification at completion

- `pnpm --filter @acme/validators test`: 96 passed.
- `pnpm typecheck`: 12/12 tasks.
- `pnpm --filter @acme/nextjs test:e2e`: 34/34, run repeatedly. Coverage includes phone/desktop deal layouts, a forced store outage, and slow, failing and overlapping saves with focus return.
- App source is lint-clean (the remaining lint errors are in older e2e specs; the last commit had 91 in total).
- Note: the dev server's CSS hot reload occasionally dropped `styles.css` edits. Restart `pnpm dev` if styles look stale.
