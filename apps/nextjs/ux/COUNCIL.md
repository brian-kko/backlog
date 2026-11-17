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

**Still open (round-4 blocking fixes not yet done)**

- **Wishlist** (astra 2 + 5, Opus 3): "Prices unavailable" instead of
  "0 of 2"; "History unavailable"; saved targets visible while loading; cards
  ≤ 440 px on phones; no "Check prices now" while offline; source line without
  an ISO date. _A worker was running when this was written:
  branch `codex/wishlist`._
- **Deals** (Opus 2):
  - billboard eyebrow "Biggest saving vs Steam" and bigger saving numbers;
  - unmatched editions shown as compact rows (desktop page ≤ 3600 px tall,
    phone ≤ 5200 px);
  - free CTA "Get it free at {store}";
  - on phones, the "Beats Steam" ribbon as an inline badge.
- **Updates** (Opus 4):
  - chip and rail counts follow the active tab, labelled "in 30 days", with
    the missing space fixed;
  - a nerf/buff summary on patch rows via `summarizePatch`.
- **Mastheads** (Opus 5):
  - fit the page word inside the art region, faded rather than clipped;
  - fade the top edge of the hero art;
  - show art from 1024 px, with a 280 px region.
- **Patch classifier** (Opus 6):
  - use the last "from X to Y" match;
  - strip a trailing parenthetical;
  - treat "buildup" as a costly stat;
  - every row gets a chip;
  - a short caption saying the glance is sorted automatically.
- **Nits**:
  - library grid `auto-fill minmax(296px,1fr)`;
  - Home masthead stat;
  - phone metric rail stacks under 480 px;
  - empty Home metrics show "—";
  - a single "Reset filters" name;
  - Deadlock free-to-play reads "Free on Steam".
- **Audit additions:**
  - assert the computed font families of the price and h1;
  - assert every detail page shows a back control.
