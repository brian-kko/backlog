# Backlog — Product Plan & Roadmap

> **Project**: Backlog — a PC game backlog, price watcher and patch-note digest that works across stores.
> **Architecture**: `create-t3-turbo` monorepo (`pnpm` + Turborepo).
> **Stack**: TypeScript, Next.js App Router (installable PWA), Tailwind CSS v4, tRPC v11, Drizzle ORM, PostgreSQL 16 (Docker locally, Neon in production), Better Auth, Vitest, Playwright, GitHub Actions. Tauri v2 desktop companion later.

---

## 0. Why Backlog instead of just Steam?

Steam already has a library, a launcher, per-game news and a wishlist that emails you about Steam sales. Backlog only earns a place next to it by doing what Steam structurally won't:

| Backlog does                                                                                    | Steam doesn't                                                                |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Compares 14 PC stores and always shows the saving against Steam ("$7.30 less than Steam").      | Only shows Steam's own price.                                                |
| Lets you set the price you'd pay and flags games at that target or their lowest ever price.     | Only notifies on Steam discounts, with no target price.                      |
| Tracks progress (Unplayed / Playing / Completed) and what you paid, per store.                  | Shows playtime, but no backlog status or spending ledger across stores.      |
| Answers "how much have I spent, and how much is paid for but never played?"                     | Spending is buried in account history, Steam purchases only.                 |
| One official patch-note and event digest for *your* games, without store promotions or merch.   | News is per game or mixed into the activity feed alongside promotions.       |
| (Roadmap) Games from GOG, Epic, Humble keys and other launchers in the same library.            | Steam games only.                                                            |

**Design rules that follow from this**

- Every price surface states where the number came from (live comparison, Steam only, or saved) and how it compares with Steam.
- Nothing is invented on the user's behalf: no assumed purchase prices, no invented targets, and assumptions (like "Steam (assumed)" launcher) are shown and editable.
- Launching is a convenience, not the product: it's shown only for owned games that run in Steam, and hidden on touch devices.
- Guests get the full product with sample data they can clear or keep; signing in moves their games to an account without overwriting anything.

---

## 1. Pages (`apps/nextjs`)

### Global

- **Navbar** (`src/components/navbar.tsx`): wordmark, `Dashboard` / `Deals` / `Library` / `Wishlist` / `Updates` (`data-testid="nav-*"`), library and wishlist counts (the wishlist badge switches to the price-alert count when alerts exist), an unread dot on Updates, **Add game**, theme menu, **Sign in with Discord**. "Desktop Connected" appears only inside the Tauri companion. Phones get a bottom tab bar.
- **Add game dialog** (`src/components/add-game.tsx`): one shared dialog that searches any Steam game (`backlog.searchGames`). Adding asks follow-ups in place: a target price for wishlist games; paid amount, "Bought from" and "Plays on" for owned games.
- **Guest mode**: sample games are tagged per item, with "Keep" / "Keep them" / "Clear sample games". After sign-in, a prompt moves browser games to the account (`backlog.importGuestItems`, existing account games are left unchanged).
- **PWA**: manifest, icons, versioned service worker that precaches the app shell, offline banner, install button (or iOS instructions).

### `/` Dashboard

Metrics (Playing now, Unplayed with amount paid, Price alerts, Total spent), **Price watch** (wishlist games ranked by alerts, with target gap and Steam saving), **Play next** (playing first, then unplayed, with Play / Mark as playing), **What changed** (latest patch or event per followed game, "New" since the last read).

### `/deals`

Cross-store offers from CheapShark. Quick presets (Under $15, 50%+ off, Activates on Steam), store picker, More filters (maximum price, minimum discount, hide games I already own: on by default). Results group one card per game with "+N stores", show a "Steam $X · save $Y" line, and load more in batches (12/24/60) so filters apply across everything loaded. "Worth buying from your wishlist" strip above results. Outages and saved offers are labelled with their snapshot date. Search input: `data-testid="deal-search-input"`.

### `/library`

Status filter chips with counts (All, Playing, Unplayed, Completed; also `?status=`), search and sort, Cards or a sortable Table (remembered). Cards: one-tap status, "Paid $X at Store · launcher" with Edit (amount, Bought from, Plays on), Launch for Steam games, View game, Remove with Undo. **Spending & progress**: total spent with per-store breakdown, paid-for-never-played, completed x of y, average paid. **Backup & restore** (`data-testid="export-json-btn"`, Import JSON).

### `/wishlist`

Summary ("N games worth buying now", games that couldn't be checked), "Prices checked … · Check prices now". Cards: alert state (Lowest ever / Target met / Waiting for a drop / Price unavailable), best price with source and store count, lowest ever (or "Lowest recorded" for saved data), target gap and Steam saving, target with Edit, **Buy at <store>**, I own this, View game, Remove.

### `/updates`

"All my games" (up to 24 prioritized games: playing, unplayed, wishlisted, completed) or one game (`?game=`). Tabs `data-testid="tab-patches"` / `"tab-events"`, date groups with older posts folded, "New" markers with "Mark all as read", community posts optional per game. Promotions, merch and sequel cross-posts are filtered out.

### `/game/[appId]`

Back link, hero (title and description de-shouted), **Launch in Steam** (`data-testid="launch-game-btn"`) for owned Steam games, otherwise **Buy for $X at Store** for games you don't own. Prices across stores with Steam pinned as the baseline. Collection editor (library or wishlist, status, paid, bought from, plays on, target price). Owned games put the editor first and collapse the comparison. Patch notes and events.

---

## 2. Milestones

- [x] **M0**: monorepo, Docker Postgres, Drizzle, Vitest, Playwright, CI.
- [x] **M1**: `backlogRouter` and validators.
- [x] **M2 / M2.5**: multi-page app, live deals, Steam news, `steam://` launcher, usability pass ([review](docs/usability-review.md)).
- [x] **M2.6: Product and UX council pass** ([summary](docs/ux-council-2026-11.md)). Both reviewers reached 9.5 after 10 rounds: astra 6.7 → 9.5, Opus 6.4 → 9.5. Removed the Expo app, `apps/tanstack-start`, template Post code, the companion badge, fake notification toggles, invented targets and redundant filters. Added any-game search, the merged news digest, Steam-baseline pricing everywhere, price confidence states, Bought from / Plays on, spending insight, per-item samples with guest-to-account transfer, and the PWA.
- [ ] **M3: Accounts and import**
  - Steam OpenID linking plus `GetOwnedGames` import (owned games and playtime). Public-profile import by SteamID or vanity URL also works for guests.
  - "Cost per hour" once playtime exists.
  - Google sign-in alongside Discord.
- [ ] **M4: Alerts that reach you**
  - Cron price poller (`/api/cron/sync-backlog`, protected by `CRON_SECRET`) storing price snapshots, which gives Backlog its own price history and dated "lowest ever".
  - Delivery by web push (PWA), email digest and an optional Discord webhook. Per-game notification preferences come back here, now that they would actually work.
  - Weekly "since your last visit" digest of patches and price drops.
- [ ] **M5: Beyond Steam**
  - Library entries without a Steam AppID (GOG, Epic, itch.io, console or manual); schema change from `steamAppId`-keyed items to an internal game ID plus optional store IDs.
  - IsThereAnyDeal (`ITAD_API_KEY`) for wider store coverage, regional prices and better history.
  - Collection-wide news batching beyond 24 games.
- [ ] **M6: Desktop companion (Tauri v2, `apps/desktop`)**: detect installed games (Steam `.vdf`, GOG, Epic), launch non-Steam games, track playtime locally.

**Cut:** Expo mobile app (replaced by the installable PWA).

---

## 3. Data notes

- `user_backlog.purchase_store` is the seller (13 known stores or `other`); `user_backlog.platform` is the launcher (`steam`, `gog`, `epic`, `ubisoft`, `other`). An unset platform is inferred from the seller (key sellers mean Steam) and shown as "(assumed)". Migration: `packages/db/migrations/0002_backlog_purchase_store.sql`.
- `games` and `game_feed_items` are reserved for the M4 poller cache.
