# UI/UX council brief

Two reviewers (Opus and astra, the Codex `gpt-6.2-astra` model) score Gemuzu
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
| 7     | —     | 9.2  | astra hit the Codex limit; Opus: AA over art, billboard art, patch counts, singleton was-price |
| 8     | 9.0 (9.31 capped) | 9.0 (9.2 capped) | Deck everywhere, Riot games, aurora; capped by Deals placeholder overflow (both), deck a11y, −$0.00 ledger, Riot editor (astra) |
| 9     | 9.0 (9.32 capped) | 9.3 | All audit gates pass; astra caps on stale offline savings and unknown spend; both flag Deals ranking/deck, Riot leftovers, transitions |

## Status and open items

This section is the hand-off between sessions. Update it whenever a round ends
or a fix lands, so a fresh context can resume without the conversation.

**How to resume a round**

1. `pnpm --filter @acme/nextjs ux:audit` (production build, writes `ux/report/`).
2. Send `ux/report` + this file + `RUBRIC.md` to both reviewers:
   - astra: `codex exec -m gpt-6.2-astra -s read-only` with the key screenshots
     attached via `-i`;
   - Opus: a subagent that reads the files.
3. Turn blocking fixes into tasks and send them to `gpt-6.2-sol` workers. Each
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

**Round 7 (2026-11-17): all four workers are merged.** Also landed, at the
owner's request: top-aligned mastheads, a 68px nav on wide screens, and the
cover fan on hover. Checks: validators 190, typecheck, e2e 71/71, and the
audit with every gate passing. The astra and Opus round-7 reviews are
running (packet `council/r7` in the session scratchpad). Next: save the
reviews as `ux/reviews/*-r7.md`, then dispatch their blocking fixes.

**Codex usage limit hit again (2026-11-17).** The astra round-7 review failed
before writing anything; Codex resets at 2026-11-18 02:59. To resume, rerun
astra on `council/r7`:
`codex exec -m gpt-6.2-astra -s read-only --skip-git-repo-check -o ../astra-r7.md - < prompt.md`
from the `r7` folder. Rebuild the packet first if the scratchpad was cleared.

**Round 8 (2026-11-18): astra 6.2 9.0 (9.31 capped), Opus 9.0 (9.2 capped).**
Reviews: `ux/reviews/astra-r8.md` and `ux/reviews/opus-r8.md` (with deck
verdicts, QoL, competitor features and modernisation lists). Round-9 workers
on `gpt-6.2-sol` (specs in `../gemuzu-wt/specs9/`):
- `r9-fixes`: Deals placeholder overflow, cents-safe game ledger, instant
  colour changes, Steam-comparable deals first.
- `r9-riot`: Riot games get no target controls and no Steam launch.

The masthead deck (keyboard access, the 1024px overlap, and the per-page
verdicts) waits for the owner's per-page decision.

**Owner decision (2026-11-18): the deck stays on every page for now.** A
deck on every page may be redundant, but it stays until per-page
alternatives are designed and agreed. The candidates are in the round-8
reviews:
- an "up next" hand with tags for Home;
- progress tags for Library;
- price tags for Wishlist;
- Steam-saving pills or a podium for Deals;
- a 30-day patch-activity strip for Updates.

Round-9 work merged: `r9-riot` and `r9-fixes` (79/79 e2e). Running:
`r9-polish`:
- deck keyboard and screen-reader access;
- the deck no longer overlapping text at 1024px;
- a compact deck at 768–1023px;
- the phone chip scroll hint;
- Deals stat copy;
- free-row alignment;
- Library launcher-first meta.

Gemini review: `ux/reviews/gemini-r8.md` (9.0).

## Resume here (session ended 2026-11-18)

State: `feat/ui-council-6` is pushed with no PR yet. Round 9's `r9-riot`,
`r9-fixes` and `r9-polish` are merged, and the full e2e suite passes (85
tests). The round-9 audit and reviews haven't run yet.

Next, in order:
1. **Wire in the Gemini art** (in `apps/nextjs/public/art/`, from
   `ux/handoff/gemini/`):
   - Show the empty-state SVGs inline on the empty Library, Wishlist,
     Updates and Deals pages. Map `--art-ink`, `--art-muted` and
     `--art-accent` to the theme tokens; the art is decorative
     (`aria-hidden`).
   - Tweaks: crop the Wishlist and Updates viewBoxes so the art is centred;
     replace Deals' ✓ with a neutral dash; turn Library's hovering cartridge
     into a card; make the cartridge label an outline with a light tint.
   - The cartridge appears only in the boot and loading moments (brand
     motif: cards lead; see the Gemini README).
   - Fallback and share art: prefer the v2 outputs if the owner ran
     `tasks/B-card-back-v2.md` and `tasks/C-share-background-v2.md` (raw
     files in `ux/handoff/gemini/reviews/`, gitignored). Otherwise use
     `fallback-*.webp` and `og-background.jpg`.
2. **Masthead concepts:** astra's design consult is in
   `ux/reviews/astra-consult.md`. The owner picks a concept per page; the
   deck stays on every page until then.
3. **Round 9:** `pnpm --filter @acme/nextjs ux:audit`, then reviews from
   astra (`gpt-6.2-astra`), Opus (a subagent) and optionally Gemini (task E
   with fresh screenshots).
4. **Open the PR** for `feat/ui-council-6` → main and merge when CI is
   green.

Housekeeping:
- The poller workflow is disabled on GitHub (it never worked: no
  deployment, secrets or endpoint). A local edit to `cron-poller.yml` is
  deliberately uncommitted.
- Codex needs CLI 0.170.0 or later for the 6.2 models.
- Worktrees `r9-*` and branches `codex/r9-*` can be removed (they're
  merged).

**Owner's next features (2026-11-18):**
1. **Edition matching:** ITAD lookup gives editions a Steam comparison.
2. **Price history:** a 90-day sparkline and dated 3- and 12-month lows,
   from ITAD plus our own snapshots.
3. **Steam import:** owned games, playtime and wishlist from a public
   profile.
4. **Patch alerts:** keyword watch on parsed patch notes; delivery needs
   the site deployed with a scheduled job.

Masthead concepts are still being explored (astra's consult plus a
brainstorm). The deck stays until a direction is chosen.

**Masthead decisions (owner, 2026-11-18):**
- **Home:** leave the card deck as it is for now.
- **Deals:** **Price Radar**. Each dot is a matched deal; its distance from
  the centre is how far it's below Steam (verified, cent-safe comparisons
  only); lime marks a dated 12-month low once price history exists; hover or
  focus names the game. It gets richer as edition matching lands.
- **Library:** keep the current card system (the tucked hand).
- **Wishlist:** a **dynamic arrow price chart**. It shows the price history
  of the closest-to-target game over a selectable period (30 days, 90 days
  or 12 months) as a stepped line that jumps up or down at each recorded
  price change and ends in an arrowhead at today's checked price. The target
  is a dashed line, and each step's date and store show on hover or focus.
  The line draws left to right once (transform/opacity only, instant under
  reduced motion). It shows only observed prices with their dates; gaps
  read "no data", never interpolated. It needs price history; until then
  the chart says how many observations exist.
- **Updates:** undecided (candidates: Patch Calendar, Watchlist Pings,
  Signal Meter).

Sequencing: the Radar and the arrow chart lean on price history and edition
matching, so build those data features first (or alongside), then the two
mastheads.

**Round 9 (2026-11-18): astra 6.2 9.0 (9.32 capped), Opus 9.3 (no cap).**
Reviews: `ux/reviews/astra-r9.md` and `ux/reviews/opus-r9.md`. The owner
asked to review the fix list before any jobs are sent.

**Round 10 workers (2026-11-18), on `gpt-6.2-sol`, specs in
`../gemuzu-wt/specs10/`:**
- `r10-price`: offline/stale price honesty, unknown spend, alert reasons,
  Riot price exclusion, outage de-duplication, Deals ranking pool, copy.
- `r10-polish`: Riot launcher everywhere, card transition, empty masthead
  band, art end-state and a Home illustration, copy.
- `r10-data`: `price_snapshots` table with daily snapshots, dated
  CheapShark low, the `getPriceHistory` route, and Steam title-based edition
  matching (`steamMatch`).

**IsThereAnyDeal is NOT used.** Its API terms forbid competing apps
("MUST NOT make an app that could be considered a competition to
IsThereAnyDeal"). Price history comes from our own snapshots plus
CheapShark's dated low; edition matching uses Steam's store search.

Next: a masthead worker (`r10-mastheads`: Deals Price Radar and the Wishlist
arrow chart) once `r10-data` merges.

**Round 10 merged (2026-11-18):** `r10-price`, `r10-polish`, `r10-data`
and `r10-mastheads`.
- **Deals:** the Price Radar replaces the deck. It spans 0–100% below Steam,
  with rings at 25%, 50% and 75%.
- **Wishlist:** the arrow price chart replaces the deck. It's sparse ("1
  price observed") until snapshots accumulate.
- **Local database:** Postgres runs via `docker compose up -d postgres`;
  `0003_price_snapshots.sql` is applied by hand (the project has no migrate
  script, only `db:push`).
- **Tests:** e2e 98/99; "compact masthead decks clear the heading" is a
  load flake that passes alone.

Follow-ups:
- **Edition matching:** title search rarely matches editions (2 of 40).
  Match against the base game's `package_groups` in Steam appdetails
  instead.
- **Updates masthead:** still undecided.
- **Next:** the round-10 audit and reviews.
- **Later features:** Steam import, then patch alerts (which need a
  deployment and scheduled job).

