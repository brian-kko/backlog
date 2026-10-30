# CLAUDE.md — AI Agent Architecture & Context Rules for Backlog

## 1. Project Overview

**Backlog** is a cross-platform game price, live event, patch note, library spending tracker, and universal game launcher built inside a `create-t3-turbo` TypeScript monorepo (`pnpm` + Turborepo).

## 2. Hardware & Environment Constraints

- **Zero Local GPU Usage**: Never run GPU-accelerated tasks or heavy emulators locally.
- **Database**: Local development uses PostgreSQL 16 (`docker-compose.yml`) via `postgres.js` (`drizzle-orm/postgres-js`).
- **Environment Validation**: `@t3-oss/env-nextjs` validates environment variables. Never expose server secrets (`STEAM_API_KEY`, `ITAD_API_KEY`, `CRON_SECRET`) to the client with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

## 3. Strict Monorepo Package Boundaries

1. **`packages/validators` (`@acme/validators`)**:
   - Pure TypeScript functions and Zod v4 schemas ONLY.
   - Zero database, Next.js, or React imports.
   - Every exported parser/validator must have unit test coverage in `packages/validators/src/__tests__/`.
2. **`packages/db` (`@acme/db`)**:
   - Drizzle ORM PostgreSQL table definitions in `src/schema.ts` (`games`, `gameFeedItems`, `userBacklog`) and auth tables in `src/auth-schema.ts`.
3. **`packages/api` (`@acme/api`)**:
   - Shared tRPC v11 routers (`src/router/backlog.ts` registered in `src/root.ts`).
   - All public discovery routes (`getSteamFeed`, `searchDeals`, `getGamePrices`, `getGameDetails`) MUST use `publicProcedure` and work for unauthenticated Guest users out of the box.
4. **`apps/nextjs` (`@acme/nextjs`)**:
   - Multi-page Next.js App Router web application with a persistent top navigation bar (`src/components/navbar.tsx`).
   - Game launching uses `src/utils/launcher.ts` (checks for `window.__TAURI__` for the desktop companion app, falling back to `steam://rungameid/<steamAppId>`).

## 4. Multi-Page Route Structure & Required `data-testid` Selectors

Every route must work in **Guest Mode** (logged out) with live public data and graceful fallback/demo states, while unlocking personal database persistence when signed in:

- **Top Navbar (`src/components/navbar.tsx`)**:
  - Links: `data-testid="nav-home"` (`/`), `data-testid="nav-deals"` (`/deals`), `data-testid="nav-library"` (`/library`), `data-testid="nav-wishlist"` (`/wishlist`), `data-testid="nav-updates"` (`/updates`).
- **`/` (Dashboard Home)**:
  - Summary metric cards, Guest Mode banner, Top 4 Featured Deals preview, Latest Patch Notes preview, and "Jump Back In" quick-launch cards.
- **`/deals` (Store & Deal Explorer)**:
  - Loads live offers on initial mount (24 per page, with 12/24/60 selection), with a 12-game catalog fallback. Store, price, activation, and sorting controls query the provider; discount and ownership filters refine the current page. Filter state persists in the URL.
  - Search input (`data-testid="deal-search-input"`), store/price filter controls, deal cards with savings badge, `+ Wishlist`, `Mark Owned`, and link to `/game/[appId]`.
- **`/library` (Library, Spending Ledger & Game Launcher)**:
  - Spending analytics bar (Total Spent, Owned Count, Backlog Value, Cost-Per-Game).
  - Owned games grid/table with status filter (`All`, `Backlog`, `Playing`, `Completed`), `Launch Game` button (`steam://rungameid/<id>`), and `Export Backlog JSON` button (`data-testid="export-json-btn"`).
- **`/wishlist` (Price Watch & Alert Manager)**:
  - Tracked unowned games, target price vs. current best price comparison, alert status badge (`TARGET_MET`, `ALL_TIME_LOW`, `WAIT`), and notification toggles.
- **`/updates` (Patch Notes & Live Events Hub)**:
  - Quick-select game pills (Cyberpunk 2077 `1091500`, Elden Ring `1245620`, Helldivers 2 `553850`, Baldur's Gate 3 `1086940`).
  - Tab buttons (`data-testid="tab-patches"`, `data-testid="tab-events"`) rendering cleaned Steam news items.
- **`/game/[appId]` (Game Details & Launchpad)**:
  - Dynamic route displaying game header, `Launch in Steam` button (`data-testid="launch-game-btn"`), live price comparison, backlog status editor, and game-specific Patch Notes & Live Events tabs.

## 5. Verification Commands (Run Before Finishing Any Task)

- `pnpm --filter @acme/validators test`
- `pnpm typecheck`
- `pnpm --filter @acme/nextjs test:e2e`
