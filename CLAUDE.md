# CLAUDE.md — AI Agent Architecture & Context Rules for Backlog

## 1. Project Overview

**Backlog** is a PC game backlog, cross-store price watcher, spending tracker and patch-note digest, built inside a `create-t3-turbo` TypeScript monorepo (`pnpm` + Turborepo). It is a web app (installable PWA); a Tauri desktop companion is on the roadmap. The Expo app was cut.

## 2. Hardware & Environment Constraints

- **Zero Local GPU Usage**: Never run GPU-accelerated tasks or heavy emulators locally.
- **Database**: Local development uses PostgreSQL 16 (`docker-compose.yml`) via `postgres.js` (`drizzle-orm/postgres-js`).
- **Environment Validation**: `@t3-oss/env-nextjs` validates environment variables. Never expose server secrets (`STEAM_API_KEY`, `ITAD_API_KEY`, `CRON_SECRET`) to the client with `NEXT_PUBLIC_`.

## 3. Strict Monorepo Package Boundaries

1. **`packages/validators` (`@acme/validators`)**:
   - Pure TypeScript functions and Zod v4 schemas ONLY.
   - Zero database, Next.js, or React imports.
   - Every exported parser/validator must have unit test coverage in `packages/validators/src/__tests__/`.
2. **`packages/db` (`@acme/db`)**:
   - Drizzle ORM PostgreSQL table definitions in `src/schema.ts` (`games`, `gameFeedItems`, `userBacklog` incl. `purchaseStore` seller and `platform` launcher) and auth tables in `src/auth-schema.ts`. SQL migrations in `migrations/`.
3. **`packages/api` (`@acme/api`)**:
   - Shared tRPC v11 routers (`src/router/backlog.ts` registered in `src/root.ts`).
   - All public discovery routes (`getSteamFeed`, `getCollectionFeed`, `searchDeals`, `searchGames`, `getGamePrices`, `getSteamPrices`, `getGameDetails`) MUST use `publicProcedure` and work for unauthenticated Guest users out of the box.
4. **`apps/nextjs` (`@acme/nextjs`)**:
   - Multi-page Next.js App Router web application with a persistent top navigation bar (`src/components/navbar.tsx`).
   - Game launching uses `src/utils/launcher.ts` (checks for `window.__TAURI__` for the desktop companion app, falling back to `steam://rungameid/<steamAppId>`). Launch is gated by `canLaunch()` in `src/components/collection.ts` (owned and plays on Steam) and hidden on touch devices.
   - Installable PWA: `src/app/manifest.ts`, `public/sw.js` (versioned per build via `NEXT_PUBLIC_BUILD_ID`), `src/components/pwa.tsx`.

## 4. Multi-Page Route Structure & Required `data-testid` Selectors

Product intent, page specs and roadmap live in `PLAN.md`. Its section 0, "Why Backlog instead of just Steam?", is the test for every feature: if Steam already does it as well, it shouldn't lead. Every route must work in **Guest Mode** (logged out) with live public data and honest fallback states (offline, saved catalog data, partial outages), and persist to the database when signed in.

- **Top Navbar (`src/components/navbar.tsx`)**: `data-testid="nav-home"` (`/`), `"nav-deals"`, `"nav-library"`, `"nav-wishlist"`, `"nav-updates"`. The shared Add game dialog is provided by `AddGameProvider` (`src/components/add-game.tsx`); open it with `useAddGame()(query)`; don't mount extra dialogs.
- **`/` (Dashboard)**: metrics, guest/sample banner, Price watch, Play next, What changed.
- **`/deals`**: search input `data-testid="deal-search-input"`, presets, store picker, More filters, batched Load more (12/24/60), one card per game with Steam comparison, `+ Wishlist` / `I own this`. Filter state persists in the URL.
- **`/library`**: status filters (All, Playing, Unplayed, Completed), Cards/Table, Launch only for owned games that run in Steam (`steam://rungameid/<id>`), `Export Backlog JSON` (`data-testid="export-json-btn"`), spending & progress metrics.
- **`/wishlist`**: price-watch cards with alert state (`data-alert-state` of `TARGET_MET`, `ALL_TIME_LOW`, `WAIT`, `UNKNOWN`), target editing, Buy at store.
- **`/updates`**: collection game filter (`?game=`), tabs `data-testid="tab-patches"` / `"tab-events"`, Mark all as read.
- **`/game/[appId]`**: `Launch in Steam` (`data-testid="launch-game-btn"`) only for owned Steam games, prices across stores with Steam as baseline, collection editor, game news.

Pricing rules: never present saved catalog prices as live, never claim "lowest ever" without live history, never record a purchase price the user didn't confirm.

## 5. Verification Commands (Run Before Finishing Any Task)

- `pnpm --filter @acme/validators test`
- `pnpm typecheck`
- `pnpm --filter @acme/nextjs test:e2e`
