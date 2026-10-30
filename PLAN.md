# Backlog — Master Project Plan & Detailed Page Specification

> **Project**: Backlog — Cross-Platform Game Price, Patch Note, Live Event, Library Spending & Universal Launcher Ecosystem
> **Architecture**: `create-t3-turbo` Monorepo (`pnpm` + Turborepo)
> **Tech Stack**: TypeScript, Next.js 15/16 (App Router), React Native (Expo SDK 52 + NativeWind v4), Tauri v2 (Future Rust PC Companion), Tailwind CSS, tRPC v11, Drizzle ORM, PostgreSQL 16 (Docker local / Neon Serverless prod), Better Auth, Vitest, Playwright, GitHub Actions CI/CD.

---

## 1. Detailed Multi-Page Architecture & Feature Specification (`apps/nextjs`)

### Global Component: Persistent Top Navbar (`apps/nextjs/src/components/navbar.tsx`)

- **Left**: Brand logo (`Backlog`) linking to `/` (`data-testid="nav-home"`).
- **Center Navigation Links**:
  1. `Dashboard` (`/`, `data-testid="nav-home"`)
  2. `Deals` (`/deals`, `data-testid="nav-deals"`)
  3. `Library` (`/library`, `data-testid="nav-library"`)
  4. `Wishlist` (`/wishlist`, `data-testid="nav-wishlist"`)
  5. `Updates` (`/updates`, `data-testid="nav-updates"`)
- **Right Controls**:
  - **PC Companion Status Badge**: Shows `"PC Companion: Web URI Mode"` (or `"Desktop Connected"` if `window.__TAURI__` is detected) explaining that the desktop app unlocks local `.vdf` auto-detection, standalone `.exe` launching, and live playtime tracking.
  - **Auth Button**: Shows `"Sign in"` when logged out or User Profile / `"Sync Steam"` when logged in.

---

### Page 1: Dashboard Home (`apps/nextjs/src/app/page.tsx` — Route: `/`)

**Purpose**: High-level executive command center that never feels overcrowded.

- **Section 1 — Guest / Sync Banner**:
  - If logged out: Clean callout banner explaining Guest Mode with quick CTA to explore live sales or sign in to sync Steam.
- **Section 2 — 4 KPI Summary Cards**:
  - `Total Spent ($)`: Sum of `amountPaid` across owned games.
  - `Owned Library`: Count of owned games (`isOwned: true`).
  - `Wishlist Alerts`: Count of tracked unowned games (`isOwned: false`).
  - `Estimated Value`: Total current value of tracked games.
- **Section 3 — Jump Back In (Quick Launch Row)**:
  - Displays 3–4 highlighted games (user's owned games or featured defaults like _Cyberpunk 2077_, _Elden Ring_, _Helldivers 2_) with a 1-click **`Launch in Steam`** button (`steam://rungameid/<appId>`) and a **`Details`** link to `/game/[appId]`.
- **Section 4 — Split Preview Grid (2 Columns)**:
  - **Left Column (`Top Live Deals`)**: Top 4 live deals from `api.backlog.searchDeals` with a `"View All Deals ->"` link to `/deals`.
  - **Right Column (`Latest Game Updates`)**: Latest 4 patch notes/events from `api.backlog.getSteamFeed` with a `"View All Updates ->"` link to `/updates`.

---

### Page 2: Store & Deal Explorer (`apps/nextjs/src/app/deals/page.tsx` — Route: `/deals`)

**Purpose**: Full-featured public deal discovery engine that loads live sales immediately without requiring a search query first.

- **Section 1 — Search & Filter Bar**:
  - Search input (`data-testid="deal-search-input"`) + Search button.
  - Quick filter pills: `All Deals`, `Under $15`, `50%+ Off`, `Steam Redeemable`.
- **Section 2 — Live Deals Grid**:
  - On initial load, fetches 24 offers across stores from CheapShark, with 12/24/60 page-size selection and a 12-game catalog fallback. Store, price, and Steam activation filters stack; sort, view, and filter state persist in the URL. Discount and hide-owned filters refine the current page.
  - Each Deal Card displays:
    - Game thumbnail (`thumb`) and title.
    - Current best price (`$29.99`), normal price strikethrough (`$59.99`), and green discount percentage badge (`-50%`).
    - **Action Buttons**:
      - `Inspect Game` (links to `/game/[steamAppId]`).
      - `+ Wishlist` (saves/tracks target price).
      - `Mark Owned` (records game in library).

---

### Page 3: Library, Spending Ledger & Launcher (`apps/nextjs/src/app/library/page.tsx` — Route: `/library`)

**Purpose**: Personal collection manager, spending tracker, backup utility, and game launcher.

- **Section 1 — Library Toolbar & Backup Controls**:
  - Filter tabs: `All Games`, `Backlog (Unplayed)`, `Playing`, `Completed`.
  - Backup buttons: **`Export Backlog JSON`** (`data-testid="export-json-btn"`, triggers download of `BacklogExportSchema` JSON) and **`Import JSON`**.
- **Section 2 — Owned Games Grid / Ledger**:
  - If user has owned games in DB, renders them; if in Guest Mode with 0 DB items, renders a realistic starter demo library (e.g., _Cyberpunk 2077_, _Elden Ring_, _Baldur's Gate 3_) clearly labeled `"Starter Demo Library (Sign in to sync your Steam account)"` so guests and Playwright tests can immediately test launching and JSON export.
  - Each Library Card shows:
    - Title, App ID, Completion Status badge, and `Amount Paid ($)`.
    - **`Launch Game`** button calling `launchGame(steamAppId)` (`href="steam://rungameid/<steamAppId>"`).
    - **`Game Hub`** button linking to `/game/[steamAppId]`.

---

### Page 4: Wishlist & Price Watch (`apps/nextjs/src/app/wishlist/page.tsx` — Route: `/wishlist`)

**Purpose**: Dedicated price-target tracker and alert configurator.

- **Section 1 — Alert Summary Header**:
  - Shows how many wishlisted games currently meet their target price (`TARGET_MET` or `ALL_TIME_LOW` via `evaluateDealAlert`).
- **Section 2 — Wishlist Watch Cards**:
  - Displays wishlisted games (or guest demo watchlist items if logged out) with:
    - `Current Best Price ($)` vs. `Your Target Price ($)` vs. `Historical Low ($)`.
    - Smart status badge computed by `evaluateDealAlert` (`🔥 All-Time Low`, `✅ Target Met`, or `⏳ Waiting for Drop`).
    - Toggle switches for `Notify on Patch Notes` and `Notify on Live Events`.
    - Links to `/game/[steamAppId]` and store deal page.

---

### Page 5: Updates & Live Events Hub (`apps/nextjs/src/app/updates/page.tsx` — Route: `/updates`)

**Purpose**: Clean, distraction-free reader for BBCode-stripped Steam Patch Notes and Live In-Game Events.

- **Section 1 — Game Selector Bar**:
  - Quick-select game pills (`Cyberpunk 2077 [1091500]`, `Elden Ring [1245620]`, `Helldivers 2 [553850]`, `Baldur's Gate 3 [1086940]`, `Counter-Strike 2 [730]`) + custom Steam AppID input so any game can be inspected immediately.
- **Section 2 — Category Tabs**:
  - `Patch Notes` tab button (`data-testid="tab-patches"`) showing update count.
  - `Live Events & Announcements` tab button (`data-testid="tab-events"`) showing event count.
- **Section 3 — Clean Feed Cards**:
  - Displays each news item's title, relative/formatted publish date, cleaned summary text (stripped of `[h1]`, `[b]`, `[url]`, `[img]` tags via `classifyAndCleanSteamNews`), category badge, and `"Read Full Post on Steam ->"` external link.

---

### Page 6: Dynamic Game Hub (`apps/nextjs/src/app/game/[appId]/page.tsx` — Route: `/game/[appId]`)

**Purpose**: Single-game drill-down page combining price data, launching, backlog tracking, and news.

- **Section 1 — Game Hero Header**:
  - Displays Game Title, Steam AppID badge, and Steam header image (`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`).
  - Primary Action: **`Launch in Steam`** button (`data-testid="launch-game-btn"`, `steam://rungameid/${appId}`).
- **Section 2 — Best Price & Backlog Status Box**:
  - Shows current cheapest deal from `api.backlog.getGameDetails` (or `searchDeals`) and buttons to add/update in Library or Wishlist.
- **Section 3 — Game-Specific Patch Notes & Events**:
  - Renders the live `patchNotes` and `events` specifically for `params.appId` via `api.backlog.getSteamFeed`.

---

## 2. Milestone Execution Checklist

- [x] **Milestone 0**: Monorepo initialization, Docker Postgres, Drizzle schema, Vitest, Playwright, CI workflow.
- [x] **Milestone 1**: Initial `backlogRouter` and validators.
- [x] **Milestone 2**: Initial single-page dashboard prototype.
- [x] **Milestone 2.5**: Multi-page Navbar Architecture (`/`, `/deals`, `/library`, `/wishlist`, `/updates`, `/game/[appId]`), Live Featured Deals on default load, broadened Steam news classification with fallback, and `steam://` Game Launcher utility.
- [x] **Milestone 2.5 usability pass**: Readability and artwork framing, store-aware stacked deal filters, paging and views, collection search/sorting, reliable Game Hub editing, removal with Undo, official-news controls, and lighter price queries. See [usability review](docs/usability-review.md).
- [ ] **Milestone 3**: Google/Discord OAuth + Steam OpenID 2.0 account linking & `GetOwnedGames` sync.
- [ ] **Milestone 4**: Automated 4-hour cron poller (`/api/cron/sync-backlog`) & Discord Webhook alerts.
- [ ] **Milestone 5**: Expo mobile companion (`apps/expo`) & Tauri v2 desktop companion (`apps/desktop`).
