# UI/UX council brief

Two reviewers (Opus and astra, the Codex `gpt-6-astra` model) score Gemuzu
independently against [`RUBRIC.md`](RUBRIC.md), using the latest audit
(`pnpm --filter @acme/nextjs ux:audit` → `ux/report/`). The work ships only
when **both** give **≥ 9.5/10**. Be demanding and specific; 9.5 means you'd
ship it as a polished modern product without reservations.

## Product and audience

Gemuzu (ゲームズ, "games") is a PC game backlog, cross-store price watcher and
patch-note digest (Next.js web app / installable PWA). It's for PC players who
buy across stores and want to know if a deal really beats Steam, who track a
realistic backlog, and who follow patches for games they own. It's
desktop-first and checked on phones and tablets. The audience includes casual
gamers, and they distrust template-looking UIs and oversold deals.

## Direction from the owner

- A **modern UI with a dynamic background**, inspired by a variety of popular
  sites and trending UI-design posts (Instagram/Dribbble): cinematic
  image-led heroes, big layered display type, numbered selectors, interactive
  elements. Score "Visual craft & identity" and "Interaction & motion" with
  that ambition in mind; safe but flat should not score 9.5.
- **Design system:**
  - olive ink/paper palette with a restrained lime accent
  - Barlow, Barlow Condensed for display and labels, IBM Plex Mono for prices
- **Brand moment:** a cartridge boot animation. A Gemuzu cart drops into a
  slot, the light turns lime, and it fades into the page. It runs under 1s,
  once per session, is skippable, never plays with reduced motion, and
  `?boot` replays it.

## Owner priorities for round 3 onward

- **Browsers that aren't full-screen.** Check the `split` (840 px, a window
  snapped to half a screen) and `laptop` (1024 px) captures as carefully as
  phone and desktop. Cramped mid-width layouts are blocking.
- **Free games.** Never show "$0.00". Free and free-to-play games should read
  as free ("Free", "Get it free at Steam", "Free right now; nothing to wait
  for"), and there's no target price to chase.
- **Look cooler.** Borrow specific UI elements from popular modern sites and
  apps where they make sense for gamers, and say which site each comes from.

## Hard constraints

- No WebGL, blur, backdrop-filter or filter effects; the owner's GPU is
  disabled. Motion is transform/opacity only, cheap in software rendering,
  and rests when idle. A perpetual animation that burns CPU is a defect.
- Pricing honesty:
  - saved prices are never shown as live
  - "lowest ever" only with live history
  - no unconfirmed purchase prices
  - Steam savings compared in cents
- Keep the `data-testid` selectors and the rules in `CLAUDE.md`.

## Owner decisions (don't re-request)

- The site was renamed from Backlog to **Gemuzu**. Internal identifiers (the
  `backlog-*` storage keys, the `userBacklog` table, `Backlog*` components)
  were kept deliberately.
- A **pointer-following background light was removed** because it disappeared
  behind elements and was distracting. The slow ambient drift stays.
- The owned-game collection form stays expanded. Prices come first in the
  layout instead.

## Review output format

```
SCORE: x.x/10
Categories: 1 x · 2 x · 3 x · 4 x · 5 x · 6 x · 7 x · 8 x
Gates: honesty P/F · a11y P/F · layout P/F · stability P/F · states P/F · touch P/F
  (one line of evidence each)
BLOCKING FIXES (max 6, most important first; each cites a screenshot or
  measurement and gives concrete values)
KEEP (what must not regress)
```

## Score history

| Round | astra | Opus | Notes                                                                                           |
| ----- | ----- | ---- | ----------------------------------------------------------------------------------------------- |
| 1     | 7.2   | 7.0  | Baseline; 5–6 gates failing                                                                     |
| 2     | 8.7   | 7.8  | Gates mostly pass; Opus asked for a bolder visual direction                                     |
| 3     | 8.7   | 8.4  | Mastheads, cinematic heroes, spotlight, Gemuzu rename, boot animation                           |
| 4     | 9.1   | 8.7  | Codex workers: masthead art, deals billboard, wishlist cards, updates, patch reader; gate fixes |
| 5     | 9.0 (9.2 capped) | 8.9 | All round-4 fixes in; astra capped by honesty (free follow-up store) and stability (art 404s) |
| 6     | 9.4   | 9.1  | All gates pass; open: hashed Steam art, singleton deal card, nav/back link over hero, digest "would" bug, phone edition rows |

## Status and open items

This section is the hand-off between sessions. Update it whenever a round ends
or a fix lands, so a fresh context can resume without the conversation.

**How to resume a round**

1. `pnpm --filter @acme/nextjs ux:audit` (production build, writes `ux/report/`).
2. Send `ux/report` + this file + `RUBRIC.md` to both reviewers:
   - astra: `codex exec -m gpt-6-astra -s read-only` with the key screenshots
     attached via `-i`;
   - Opus: a subagent that reads the files.
3. Turn blocking fixes into tasks and send them to `gpt-6.1-sol` workers. Each
   worker gets its own git worktree, `ux/WORKER.md` plus a task spec, and
   strict file ownership. Merge their branches after review, then run the
   verification commands in `CLAUDE.md`.

**Done after the round-4 reviews (in round 5)**

- Fonts: the next/font variables moved to `<html>`, so Barlow Condensed and
  IBM Plex Mono now actually render (Opus fix 1).
- Home LCP: the hero art goes through the image optimizer (about 3.2 s → about
  0.2 s) (astra fix 6).
- Free games no longer get a target prompt anywhere (astra fix 1).
- Patch "old → new" values only appear for clean numbers and show once at
  narrow widths (astra fix 3).
- Updates entries lead with topics and one concrete change line from
  `digestNews`, never invented (astra fix 4).
- The history-aware `BackLink` ("Back to Updates") is used on game and patch
  pages.
- "Dashboard" is renamed "Home".
- Wishlist (astra 2 + 5, Opus 3): "Prices unavailable", "History unavailable",
  saved targets visible while loading, compact cards (merged from `codex/wishlist`).
- PR 7 (`feat/ui-council-2`) is merged to main. `feat/ui-council-5` holds the
  wishlist work and still needs its own PR.
- Round-5 workers (deals, updates, mastheads, patch-classifier,
  audit-additions) are merged into `feat/ui-council-5`:
  - deals: the featured deal leads with the Steam saving; unmatched editions
    are compact rows; free CTAs read "Get it free at"; the phone ribbon is
    an inline badge.
  - updates: counts follow the tab and say "in 30 days"; patch rows show
    nerf/buff counts. The API computes `patchCounts`, so the full notes
    never reach the client.
  - mastheads: the page word fits and fades; the art starts at 1024px; the
    Home and Library nits are done.
  - patch reader: the last from/to match is used; values must be numeric;
    "buildup" counts as costly; every row has a chip; the glance caption
    says "sorted automatically".
  - audit: asserts the fonts render and that detail pages have a back link.
- Deadlock "Free on Steam" (nit) is **won't fix**: Steam's appdetails
  reports `is_free: false` (invite-only), so the honest "No store is listing
  a price" stays.

**Round 5 (2026-11-17):** astra 9.0 (9.2 weighted, capped by gates), Opus 8.9.
Full reviews: `ux/reviews/opus-r5.md`, `ux/reviews/astra-r5.md`. PR 8 merged.

**Round-6 workers merged** into `feat/ui-council-6`: deals, heroes,
wishlist, updates, art-audit (each covers its round-5 blocking fixes; see
`ux/reviews/*-r5.md`). Checks pass: validators (154 tests), typecheck,
e2e (61).

**Round 6 (2026-11-17): astra 9.4, Opus 9.1, every gate passes.** Reviews:
`ux/reviews/astra-r6.md`, `ux/reviews/opus-r6.md`. Round-7 workers (specs in
`../gemuzu-wt/specs7/`, worktrees `../gemuzu-wt/<task>`, branches
`codex/<task>`):

- `art`: resolve hashed Steam art via appdetails; hide fallback covers in
  the masthead (astra 4, Opus 1, resolver and masthead side).
- `deal-layout`: singleton matched card from 768px, phone edition rows,
  billboard without art (astra 3 + 4 billboard side, Opus 1 billboard side,
  Opus 2, Opus 4).
- `chrome`: readable wrapped nav over game heroes at 640–1023px, touch back-link
  spacing and arrow (astra 1, Opus 3).
- `digest`: "Fixed … would occur" leads, no generic subjects, Known Issues
  aren't changes, bounded fallback excerpt, phone topic separator (astra 2,
  Opus 5).

`isFallbackArt`, `GameArt onMissing` (game-ui.tsx) and the `X-Gemuzu-Art: fallback` header were
added before the workers branched. Workers launched 2026-11-17 (outputs in
`../gemuzu-wt/specs7/out-<task>.md`). Next: merge workers, verify, re-audit,
round-7 reviews.
