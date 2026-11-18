# Opus review: round 8

SCORE: 9.0/10 (9.2 before the cap; the layout gate fails)
Categories: 1 9.2 · 2 9.0 · 3 9.1 · 4 9.2 · 5 9.1 · 6 9.3 · 7 9.4 · 8 9.3

(Weighted: 1.38 + 1.80 + 1.365 + 0.92 + 0.91 + 0.93 + 0.94 + 0.93 = 9.175, which rounds to 9.2. A hard gate fails, so the score is capped at 9.0. Round 7 scored 9.2 uncapped.)

Gates: honesty P · a11y P · layout **F** · stability P · states P · touch P
- **honesty P:**
  - Billboard: "$25.54 at Fanatical · Steam $31.49 · save $5.95 (−19%)", from live cents.
  - Under $15: "No Steam prices to compare in these results".
  - Wishlist: "History unavailable" during the outage.
  - Game page: "Bought from: Not set" and "Steam (unconfirmed)".
  - Deadlock still reads "No store is listing a price".
- **a11y P:**
  - axe: 0 serious or critical issues across 98 captures; 25/25 focus stops are visible.
  - Last round's contrast failure is fixed. Pixels sampled behind the hero nav on desktop-dark-game-owned at (640,45) and (700,37) are #25270f, about 8:1 for #b6bcad. The back link sits on #1c1d10–#212310, and the spotlight "PLAYING" label is now a #121411 chip.
- **layout F:** placeholder titles overflow their tiles and run over other text and buttons.
  - In desktop/laptop/split/phone-dark-deals and desktop-dark-state-deals-under-15, the Dead Space and LEGO rows show the full game title as alt-style placeholder text.
  - That text spills out of the 120×56 tile (96×45 on phone) into the neighbouring row and over the "Buy ↗" button.
  - laptop-dark-dashboard: the deck covers "14" in the Home description.
  - The audit's clipped-text check misses both, because neither element clips.
- **stability P:**
  - 0 non-simulated console errors or failed requests.
  - Worst CLS is 0.091 (desktop-dark-state-deals-under-15 and -no-results), under the limit but with only 0.009 to spare.
- **states P:** loading, empty, offline and outage states all render, with next steps. desktop-dark-state-outage-game now resolves to "Steam news didn't load. Try again".
- **touch P:** 0 phone targets under 44 px.

## What improved
- **Contrast over art is fixed everywhere I sampled:** the ≥1024 nav, the back link on every width, and the Home spotlight label.
- **Deals billboard:**
  - It uses logo-free store-page art (a stadium background), so there's no ghost wordmark behind the H3.
  - It no longer stretches at 1168 px.
- **Updates and the patch reader now agree.**
  - The 7.2.2 feed chips read "▼1 nerf · ▲3 buffs · ↻1 change · ✓4 fixes".
  - The reader shows "1 nerf change · 3 buff changes · 1 other change · 4 fixes", and "9 changes across 5 items" adds up.
  - "The Bushwacker changes in the previous patch…" and "The correct values are" are labelled **Note** and aren't counted.
- **Add game dialog:** every result thumbnail loads (the r7 nit).
- **The deck itself is well built.**
  - Fixed hit areas mean a pointer sweep visits each card in order.
  - Motion is transform-only, 260 ms, with a lime ring on the active card.
  - The deck is gated on fine pointer and reduced motion, and `aria-hidden` with `tabIndex=-1` links.
  - The ambient drift is paused unless `data-ambient-live` is set.

## Previous blocking fixes: resolved / partial / not

| Fix | Status | Round-8 evidence |
|---|---|---|
| **astra r6-1**: wrapped nav surface at 640–1023 | **Resolved** | split-dark-game-owned: at (395,89), where astra measured 2.63:1, the background is now #121411, giving ≥ 9:1 for the nav labels. |
| **astra r6-2**: retrospective "would" in the digest | **Resolved** | desktop-dark-updates 7.2.1 leads with "Fixed a crash that would occur when another player joined or left the squad". |
| **astra r6-3**: singleton matched card from 768 | **Resolved** (source; not pictured) | This round's data has no matched singleton strip. Source: in deals.css lines 310–376, `.deal-price-meta` is in column 1 row 3, directly under the ledger, and actions are in column 2 rows 2–4. |
| **astra r6-4**: intentional missing-art composition | **Partial** | The billboard and mastheads are resolved. **Row-level** missing art is now a regression: `isFallbackArt` rejects Steam's "No Image Available" plate, which leaves the `.artwork-placeholder` text tile, and its title overflows (blocking fix 1). |
| **Opus r7-1**: text over game art below AA | **Resolved** | desktop/laptop/light game-owned: nav and back-link backgrounds are #1c1d10–#282a0f. Home's "PLAYING" is a dark chip. |
| **Opus r7-2**: billboard capsule stretch, ghost wordmark, lone covers | **Resolved** | desktop-dark-deals billboard: store-page background art and no baked title. desktop-dark-wishlist: the 2-card hand is centred. |
| **Opus r7-3**: feed and reader counts; note label | **Resolved** | See "What improved". |
| **Opus r7-4**: singleton was-price detached | **Resolved** (source; not pictured) | Same CSS as astra r6-3: the was-price sits under the slab. |
| r7 nits | **Mixed** | **Fixed:** add-game thumbnails; outage-game resolves to an error card; the deck uses 260 ms.<br>**Still open:** the masthead art drift is still 320 ms (mastheads.css:121); "Read on Steam↗" has no gap; "Steam(unconfirmed)" has no space in the select; "Patch notes 0" badge on the game page; the Under $15 divider still says "Other editions"; the patch hero shows the version twice; Contractor's "Find on Steam" is 36 px out of column; phone nav badges overlap their icons; Home's eyebrow "2 games on your wishlist" repeats the counts line. |

## BLOCKING FIXES

### 1. Missing-art placeholder text overflows deal rows (layout gate)
**Captures:** desktop-dark-deals (Dead Space y≈1190–1250, LEGO y≈1265–1345), laptop-dark-deals, split-dark-deals, phone-dark-deals, phone-light-deals, desktop-dark-state-deals-under-15.

**Evidence:**
- **The tile overflows.** `GameArt` falls back to `<div class="game-art artwork-placeholder"><span>{title}</span></div>` (game-ui.tsx:581).
- **Why it overflows.** `.artwork-placeholder` (styles.css:496) is `p-4 text-sm` and has no overflow rule. The 120×56 tile (96×45 on phone) can't hold "LEGO Star Wars: The Skywalker Saga Galactic Edition".
- **Desktop result.** The text renders on 6 lines and spills about 40 px above and below the tile. "LEGO Star" overprints "Edition" from the Dead Space tile.
- **Phone result.** "Edition", "LEGO" and "Galactic Edition" print over the "Buy ↗" buttons of both rows. The ghost text crosses two row dividers.

**Fix:**
- **Contain the tile.** Set `.artwork-placeholder { overflow: hidden; }` everywhere.
- **Compact tiles use a monogram.** Below 160 px wide, the placeholder shows a monogram instead of the title: the first letters of the first two words ("DS", "LS"), in Barlow Condensed 600, 20 px, `--muted-foreground` on `--muted`.
  - Keep `role="img"` and `aria-label={title}`. The title is already in the row.
  - Implementation: add a `compact` prop to `GameArt`, passed from `DealRow`, the Price-watch rows and `.search-result-art`. Or use CSS: `.deal-row-art .artwork-placeholder span { display: none }` plus `::after { content: attr(data-mono) }`.
- **Audit.** Add a containment check to `ux:audit`: for every `.artwork-placeholder` and every text-bearing element with `overflow: visible` inside `.deal-row`, `scrollHeight ≤ clientHeight + 1` and `scrollWidth ≤ clientWidth + 1`.

### 2. At 1024 the Home deck covers the description
**Capture:** laptop-dark-dashboard. The description's first line ends "with prices from 1|4" at x≈622–632, y≈237. The Cyberpunk card's left edge starts at x≈627 and covers the "4".

**Cause:**
- `.page-heading:has(.is-deck) { padding-right: 344px }` reserves the art box, but the hand is rotated −6° and fanned, and `.deck-fade` extends 200 px left of the art box.
- So at 1024–1199 the outermost card reaches about 30 px into the text column. Home has the longest description, so only Home collides. Updates clears by about 30 px.

**Fix** (mastheads.css):
- At `(min-width:1024px) and (max-width:1199px)`, set `.page-heading:has(.is-deck) .page-heading-content { max-width: calc(100% - var(--mosaic-w) - 64px); }`. That's about 568 px at 1024, so Home's description wraps to 3 lines and never reaches x 600.
- Or move the hand right: set `--deck-x: 0.46` in that range.
- **Audit:** at 1024, 1200 and 1440, assert that the bounding box of `.page-heading-content` doesn't intersect `.cover-deck .deck-card`.

### 3. The deck repeats across pages and leaves a dead band in each masthead
**Captures:** desktop-dark-dashboard, desktop-dark-updates, desktop-dark-library, desktop-dark-deals, laptop-dark-deals, desktop-light-library.

**Evidence:**
- **Home and Updates show the same hand.** Both decks are the same 5 cards in the same order (Cyberpunk, Elden Ring, Hades, Helldivers 2, BG3), because both use `following`. 4 of those 5 games have no patch in the Updates window.
- **Library repeats its cards.** Library's 3-card hand shows the same three key arts that start 75 px below it in the grid, so each piece of art appears twice in the first screen.
- **Deals crops landscape art.** Deals' hand is landscape store art cropped into portrait cards, showing "DELU", "BA" and "DIGIT" fragments. All five are offers with **no** Steam comparison, so the hand advertises exactly the rows that can't answer the product question.
- **The deck sets the masthead height.** The text column then has a dead band of about 90–100 px between the description and the next control:
  - Library: description at y≈255 → "Showing sample games" at y≈345;
  - Deals: y≈250 → search at y≈344;
  - Wishlist: y≈280 → y≈345.
- **Verdict.** On three of five pages the deck is decoration that repeats something nearby. The "one consistent identity" turns into "the same picture again".

**Fix** (minimum to clear 9.5; see DECK VERDICTS for the full proposal):
- **Updates:** replace the hand with a 30-day patch-activity strip.
- **Deals:** replace it with a numbered "beats Steam" podium.
- **Library:** keep the hand, but encode status with opacity:
  - completed: 1.0, with a lime ✓ corner tag;
  - playing: lifted 12 px, with a ring;
  - unplayed: 0.55.
- **Home:** keep the hand, but give each card a state tag ("PLAYING", "−$7.00 vs Steam", "NEW 7.2.3").
- **Rule:** no two pages may render the same ordered set.
- **Dead band:** cap it at ≤ 32 px. Let the page's first control rise beside the art (`.page-heading:has(.is-deck) ~ :first-of-type { margin-top: -64px }` at ≥ 1024, already above the deck in paint order). Or shorten the deck's reserved height to the title block's height.
- **Files:** game-ui.tsx (`CoverDeck`, `PageHeading`: add a `masthead` slot), mastheads.css, app/updates/page.tsx, app/deals/page.tsx, app/page.tsx, app/library/page.tsx.

### 4. Most of the default Deals list can't answer "does it beat Steam?"
**Captures:**
- desktop-dark-deals: the eyebrow reads "1 of 1 with a Steam price beat it". 19 of 20 rows sit under "Other editions: no live Steam price to compare".
- desktop-dark-state-deals-under-15: 0 of 20 rows are comparable.

**Why it matters:**
- The page's description promises a comparison "not just Steam". After the billboard, the list looks like any CheapShark mirror: Epic deluxe editions with a "Find on Steam" button.
- PLAN.md §0 makes this comparison the product's first row.
- The "1 of 1" stat is technically honest but reads as a sweep.

**Fix (cheap now; ITAD matching is in the competitor list):**
- **Ranking** (`packages/api/src/steam-discovery.ts` `fetchDealsWithStatus`, `app/deals/page.tsx`). For the default "All deals" view, fetch a 60-offer batch and rank offers with a live Steam comparison first, by saving in cents. The rest keep the existing divider.
- **Eyebrow:** "6 of 9 with a Steam price beat it · 11 more without a Steam match".
- **Divider copy** when no matched group sits above it: "No live Steam price to compare for these editions". This also fixes the r7 nit.
- **Promote the "Activates on Steam" preset** to the first chip after "All deals", with its count, because every result in that view can be compared.
- **Test:** the default view at 1440 shows ≥ 3 Steam-compared cards above the divider whenever the batch contains them.

## KEEP
- **Honesty:**
  - live-cents savings, "save $5.95 (−19%)", "Steam matches the best price";
  - "History unavailable" and "Couldn't check";
  - "Bought from: Not set" and "(unconfirmed)";
  - free reads "Free" with "$3.99 −100%";
  - Deadlock's "No store is listing a price".
- **Contrast fixes:** the hero top scrim behind the nav and back link (#1c1d10–#282a0f sampled), the solid nav band at 640–1023, and the spotlight status chip.
- **Deck mechanics:** fixed hit areas; transform-only motion at 260 ms; the hover/pointer/width/reduced-motion gate; `aria-hidden` with keyboard parity in the page; fallback covers dropped rather than shown blank.
- **Ambient background:** paused unless active, no blur or filter, and phone reduced to one still field.
- **Patch reader:** the feed and reader use the same four buckets and numbers; Note rows; the 60 → 20 value column; the glance bar; "sorted automatically".
- **Updates feed:** "Fixed …" leads, ≤ 140-character excerpts, date groups, "3 in 30 days" in the rail.
- **Deals:** the subgrid ledger with aligned prices, about 80 px rows at 1440, two actions per row, URL filter state, the 2-column store menu, "Reset filters", and phone rows with the price beside the title.
- **Wishlist cards:** the lowest/target/now track with legend, "at GameBillet · 9 stores compared", targets kept while loading and during outages, and save acknowledgement in 27–29 ms.
- **Unchanged:** Home's numbered 01/02 Play next, the Library table view, the phone bottom tab bar, the boot behaviour, Barlow Condensed with Plex Mono (asserted), and the olive/lime palette.

## Nitpicks (not blocking)
- **Updates topics repeat the chips.** "✓ 4 fixes · Crash fixes · Bug fixes" says fixes three ways. Drop topics that only restate a fix bucket. The separator after the chips renders as a baseline "." rather than "·" (desktop-dark-updates x≈387, y≈768).
- **Wishlist outage card says it five times:** "Couldn't check · Try checking again in a moment", "Your target is saved; try checking again", "History unavailable", "Price track unavailable" and "Store unavailable" (desktop-dark-state-outage-wishlist). Collapse to one line: "Prices didn't load. Your $25.00 target is saved." Keep "I own this".
- **Light theme:** the sampled aurora renders as grey smudges (#e9e8e0 on #f4f3ed at desktop-light-library (60,300)). In light mode, clamp the sampled tint's lightness ≥ 70%, or use the lime tint only.
- **Phone Home metrics** stack as three rows of about 85 px each (phone-dark-dashboard y 1447–1705). Use a 3-up row of 24 px numbers.
- **Library deck "slides under the toolbar":** at 1440 the hand's foot is faded so far that the toolbar seems to cut it. That's fine, but it adds 90 px of masthead (see fix 3).
- **CLS 0.091** on Under $15 and No results: reserve the "Reset filters" button slot.
- **Leftovers:**
  - "Read on Steam↗" needs a gap before the arrow;
  - "Steam(unconfirmed)" needs a space;
  - hide the "Patch notes 0" badge;
  - the patch hero shows the version twice;
  - Contractor's "Find on Steam" sits 36 px out of column (give `.deal-row .deal-buy` `min-width: 112px`);
  - phone nav badges overlap their icons by 4 px;
  - the masthead art drift is 320 ms (use 280 ms).
- **LEGO row:** its action is a quiet "Track ▾" while its neighbours have outlined "Find on Steam" buttons, so the action column is inconsistent. Give `TrackToggle` the secondary-button style in compact rows.

## DECK VERDICTS

The deck is the most "Gemuzu" element the app has, and it should stay the identity. It earns that only where the hand **is** the page's data. Use it on the collection pages (Home, Library, Wishlist). Use data mastheads built in the same card frame (12 px radius, the −6° hold, the lime active ring) on the feed pages (Deals, Updates). That keeps one visual language without repeating the same picture.

| Page | Verdict | Why / what |
|---|---|---|
| **Home** | **Keep, with a change** | Home is the hub, so a hand of "your games" belongs here, but today it's the same hand as Updates.<br>**Change:** make it the **"up next" hand**, at most 5 cards, ordered: price alerts → playing → games with a patch since your last visit. Each card gets a Plex Mono corner tag from data already on the page: `PLAYING`, `−$7.00 vs Steam`, `TARGET MET`, `NEW 7.2.3`.<br>The hover tooltip becomes the tag's sentence.<br>Fix the 1024 overlap (fix 2). |
| **Deals** | **Replace** | Today: cropped landscape store art ("DELU", "BA", "DIGIT") from offers that mostly have no Steam comparison. It's decoration that points the wrong way.<br>**Replace with a "Beats Steam" podium:** three numbered tiles 01/02/03 (the owner's numbered-selector direction) for the biggest live savings vs Steam. Each tile has a 150×225 capsule, "−$5.95" in Plex Mono 28 px and "vs Steam $31.49 · Fanatical".<br>Under the tiles, a one-line meter: "▮▮▮▯▯▯ 3 of 9 beat Steam".<br>Hide it when nothing is comparable and show the "Activates on Steam" shortcut instead. |
| **Library** | **Keep, with a change** | The hand of your games is literal here, but it duplicates the three cards below.<br>**Change:** let the hand show **progress**:<br>- completed cards at full opacity with a lime ✓ tag;<br>- the Playing card pre-lifted 12 px with the ring;<br>- unplayed cards at `opacity: .55` (no filter);<br>- a final "+N" card when there are more than 7.<br>Order: playing → unplayed → completed, so the hand reads as "the pile left to play". Cut the 90 px dead band (fix 3). |
| **Wishlist** | **Keep, with a change** | Covers suit a wishlist (it's a shopping shelf), but the hand says nothing about price.<br>**Change:** turn it into a **price-tag hand**, sorted by gap to target. Each card carries a tag: `TARGET MET` (lime), `$7.99 to go` (neutral) or `FREE`.<br>Add to the stat line: "Steam Winter Sale starts Dec 17 (in 29 days)", from the public Steamworks calendar. It's framed as a date, not a price prediction. |
| **Updates** | **Replace** | Today it's the identical 5-card hand from Home, and 4 of the 5 games have no patches in the window.<br>**Replace with a patch-activity strip:**<br>- 30 day-columns at 8 × 48 px, with today on the right;<br>- each patch is a tick whose height is its change count (9 for 7.2.2), coloured by bucket (nerf red, buff green, change amber, fix grey) and stacked;<br>- one cover thumb per game with activity, at the left of its row (rows = games, at most 4);<br>- clicking a tick scrolls to that entry.<br>It's static SVG or CSS grid with no motion, and it shows something only Updates can say: who is patching, and how hard. |

The repetition is part of why category 2 sits at 9.0. The minimum is in fix 3.

## QUALITY OF LIFE (existing flows)

1. **Make "Find on Steam" answer in place.**
   - Today it opens the Add game dialog with the title as the query, and the user has to pick a match.
   - Instead, resolve the best Steam match server-side (`searchGames`, exact normalised title, same edition words). Show "Steam $69.99 · save $63.00" inline in the row, labelled "matched by title" until the user confirms.
   - Fall back to the dialog only when there's no exact match. Ties to competitor item 1.
2. **Keyboard layer.**
   - "/" already opens Add game. Add `g d / g l / g w / g u` to switch pages, `j/k` to move through Deals and Updates rows, `o` to open the store, `w` to wishlist and `?` for a shortcut sheet.
   - Show `kbd` hints in menus and tooltips, as the "/" hint already does.
   - Files: navbar.tsx, plus a new `use-shortcuts.ts`.
3. **Remember choices.** Remember Deals Sort/Show/Stores and Wishlist sort per browser (try/catch localStorage). Keep the URL as the source when present. Library already remembers Cards/Table.
4. **Outage and offline:**
   - Collapse the 5 wishlist failure lines into 1 (see nitpicks).
   - On offline Deals, disable search and presets with "Reconnect to search deals" instead of leaving live-looking controls.
5. **Optimistic "I own this" with an Undo toast.** Moving a wishlist game to the library should toast "Moved Hades to your library · Undo" (5 s), matching the existing removal Undo. Today the card simply disappears.
6. **Updates:**
   - Per-game unread counts in the "Your games" rail.
   - A sticky "Mark all as read" in the tab row on scroll.
   - On phone, the 3-row game chip block (phone-dark-updates y 299–447) becomes a single horizontally scrolling row with an edge fade.
7. **Phone details:**
   - Library status chips get an edge fade so "Complet…" reads as scrollable.
   - Home metrics move to a 3-up row.
   - Nav badges sit offset +6 px from their icons.

## COMPETITOR FEATURES (ranked)

Sources: direct fetches of isthereanydeal.com, gg.deals, steamdb.info and docs.isthereanydeal.com returned **403**, so the feature details below come from search results (cited) plus the public pages that did load. API endpoint names for ITAD come from its published v2 docs as I know them. Check them against the docs before building.

1. **Edition-aware Steam matching and wider store coverage.** *(IsThereAnyDeal)*
   - **What:** ITAD treats each edition as a game with prices across stores, including Steam. Look up an offer's title (ITAD `games/lookup` → `games/prices`) and get that edition's Steam price.
   - **Why:** it turns about 19/20 "no live Steam price" rows into real "save $X vs Steam" rows. That's §0's first line, and Steam can't do it.
   - **Where:** `packages/api/src/steam-discovery.ts` (new `itad.ts`), `DealRow` in deal-cards.tsx, and the game page price panel.
   - **Data:** ITAD API v2. We have `ITAD_API_KEY`; it's free for apps with attribution. Server-only.
   - **Effort:** M.
2. **Target alerts that reach you.** *(ITAD Waitlist notifications; GG.deals alerts)*
   - **What:** a push or email when a wishlist game hits your target or a dated low.
   - **Why:**
     - GG.deals now *requires* a target price for alerts. It dropped "any price drop" in Oct 2025, which validates Gemuzu's target-first model.
     - Steam's July 2026 wishlist added per-category sale notifications, so "on sale" alone is no longer a differentiator. Lead with "your price, any store".
   - **Where:** M4 (cron poller `/api/cron/sync-backlog` + web push from the PWA), a wishlist card toggle, and Home's Price watch.
   - **Data:** CheapShark and ITAD (prices); our own snapshots.
   - **Effort:** L (M without email).
3. **Dated price history with 3- and 12-month lows.** *(GG.deals: 3-month, 12-month and all-time lows per store; SteamDB price history and "lowest recorded"; ITAD history)*
   - **What:** a 12-month sparkline on the game page and a "Lowest in 12 months: $25.57 (Jun 2026, GameBillet)" line on wishlist cards.
   - **Why:** it answers "wait or buy" honestly. The pricing rule allows "lowest ever" only with live history, and ITAD supplies dated lows.
   - **Where:** game-hub.tsx price panel, the wishlist track, and `price-ui.tsx`.
   - **Data:** ITAD history and store-low endpoints (key); CheapShark `cheapestPriceEver` (with date, free).
   - **Effort:** M.
   - **Note:** Valve is reported to be preparing a 30-day Steam price history. Lead with cross-store and 12-month history, which Steam won't show.
4. **Steam library and wishlist import with playtime.** *(Playnite, GOG Galaxy 2.0: unified library and imported playtime)*
   - **What:** import owned games, playtime and the wishlist from a public SteamID or vanity URL.
   - **Why:**
     - It removes the biggest setup chore.
     - Playtime enables "cost per hour" (M3) and auto-status: 0 min means Unplayed, recent playtime means Playing, always shown as "(from Steam playtime)".
     - Steam has the data but no backlog or spending layer.
   - **Where:** Library empty state, Add game dialog "Import from Steam", and the `backlog.importSteamProfile` publicProcedure (guests too).
   - **Data:** Steam Web API `GetOwnedGames` and `GetWishlist` (`STEAM_API_KEY`, free; public profiles only).
   - **Effort:** M.
5. **Sale-calendar awareness.** *(SteamDB sales calendar; Valve's Steamworks upcoming-events page)*
   - **What:** on WAIT cards and Home Price watch: "Steam Winter Sale: Dec 17 – Jan 4 (in 29 days)".
   - **Why:** "Waiting for a drop" becomes a date. Phrase it as a date, never a predicted price.
   - **Where:** wishlist WAIT state, Home price watch, and the Deals eyebrow during a sale.
   - **Data:** the public Steamworks calendar, hand-maintained as a typed constant in `packages/validators` with tests.
   - **Effort:** S.
6. **Bundles that contain your games.** *(IsThereAnyDeal bundles)*
   - **What:** "In Humble Choice (Nov): $11.99 for 8 games, ends Dec 2".
   - **Why:** a bundle often beats every single-store price, and Steam never shows bundles from other stores.
   - **Where:** a wishlist card secondary line and a game page "Also in a bundle" row.
   - **Data:** ITAD bundles endpoint (key).
   - **Effort:** M.
7. **Time to beat.** *(HowLongToBeat)*
   - **What:** "~25 h main story" on Library cards and Play next, and a "Short ones first" sort.
   - **Why:** it helps you plan a realistic backlog. Steam shows playtime but never "how long to finish".
   - **Data:**
     - HLTB has **no public API**: it licenses data through TollBit, and community scrapers break its ToS, so don't use it.
     - Use IGDB's time-to-beat data instead (free with a Twitch client ID). Label it "IGDB estimate".
   - **Where:** library page sort, `collection.ts`, and the Play next list.
   - **Effort:** M.
8. **"Shelved / Abandoned" status, a rating and a one-line note.** *(Backloggd: Played/Playing/Backlog/Wishlist, plus Completed/Abandoned/Retired/Shelved, 5-star ratings and a journal)*
   - **Why:** a realistic backlog needs an honest "I'm not finishing this" state, which also clears it out of "paid, never played". Steam has nothing like it.
   - **Where:**
     - `completionStatus` enum: add `shelved` (validators, db migration, library status chips);
     - an optional 1–5 rating and a note on Completed, in backlog-editor.tsx.
   - **Data:** our own DB.
   - **Effort:** S–M.
9. **Official vs key-reseller split.** *(GG.deals: "Official stores" vs "Keyshops" price fields)*
   - **What:** a store-menu toggle, "Official stores only" vs "Include authorised key sellers", and a seller-type badge ("Steam key" vs "Epic account") on every row.
   - **Why:** the audience distrusts grey markets. CheapShark's stores are authorised, but key sellers still deserve a distinct label.
   - **Where:** the Deals store menu and `StoreLine` in deal-cards.tsx.
   - **Data:** CheapShark's store list (free).
   - **Effort:** S.
10. **Not recommended now:**
    - **Discovery Queue:** Steam's own queue does it as well (§0).
    - **SteamDB-style depot tracking:** there's no public HTTP API, and PICS needs a Steam client session.

**Pages used:**
- [ITAD welcome](https://isthereanydeal.com/welcome/)
- [ITAD API docs repository](https://github.com/IsThereAnyDeal/API)
- [GG.deals price alerts](https://gg.deals/alerts/pc/)
- [SteamDB vs ITAD vs GG.deals (2026)](https://tech-insider.org/steamdb-vs-isthereanydeal-vs-gg-deals-2026/)
- [SteamDB sales history](https://www.steamdb.info/sales/history)
- [PC Gamer: Valve 30-day price history](https://www.pcgamer.com/hardware/valve-could-be-prepping-to-roll-out-30-day-steam-price-tracking-in-the-us-making-it-harder-for-publishers-to-mess-with-discounts/)
- [Steamworks upcoming events](https://partner.steamgames.com/doc/marketing/upcoming_events) (fetched: Winter Sale Dec 17 2026 – Jan 4 2027)
- [PCGamesN: Steam wishlist categories, July 2026](https://www.pcgamesn.com/steam/wishlist-categories-gifting-changes-july-2026)
- [About Backloggd](https://backloggd.com/about/)
- [Backloggd changelog 1.13.3](https://backloggd.com/changelog/1_13_3)
- [HLTB on TollBit](https://tollbit.com/marketplace/how-long-to-beat/)
- [Unofficial howlongtobeat npm package](https://npmjs.com/package/howlongtobeat)
- [PC Gamer on Playnite](https://www.pcgamer.com/playnite-pc-launcher/)
- [GOG Galaxy](https://www.gog.com/galaxy)
- [CheapShark API docs](https://apidocs.cheapshark.com/)

## MODERNISATION

1. **Data mastheads in the deck's frame (bento masthead).** *(Apple TV / Game Center "up next" shelves; Linear's insight tiles)* **Blocking, via fix 3.**
   - **Dated now:** the same hand on Home and Updates, and the 90–100 px dead band in the text column (desktop-dark-library y 255–345).
   - **Change:** give `PageHeading` a `masthead` slot. Deals gets the podium, Updates the activity strip, and Home, Library and Wishlist get tagged hands.
   - **Constraints:** the same 12 px radius, −6° hold and lime active ring; transform/opacity only.
   - **Files:** game-ui.tsx, mastheads.css.
2. **Command palette.** *(Raycast and Linear ⌘K; Arc's command bar)* **Recommendation.**
   - **Dated now:** "/" only opens Add game (desktop-dark-state-add-game-dialog). Jumping to a game you own takes nav → Library → find → View game.
   - **Change:** ⌘K / Ctrl-K opens one list grouped into "Your games" (local, instant), "Go to" (pages), "Actions" ("Set target…", "Mark all as read", "Check prices now") and "Add from Steam" (`searchGames`).
   - **Behaviour:** reuses the add-game dialog shell. Opacity 120 ms; no motion with reduced motion.
   - **Files:** new `components/command-palette.tsx`, navbar.tsx.
3. **Shared-element view transitions from cover to hero.** *(Apple TV app; the PlayStation Store's tile-to-page zoom; Arc)* **Recommendation.**
   - **Dated now:** clicking a deck card, Library card or Play next row hard-cuts to the game hero.
   - **Change:** use the View Transitions API (Next 16 `unstable_ViewTransition`, or `document.startViewTransition` around `router.push`). Set `view-transition-name: art-{appId}` on the source art and on `.hero-backdrop`, so the cover scales into the hero.
   - **Constraints:** ≤ 280 ms; snapshots animate transform and opacity only; disabled under `prefers-reduced-motion`.
   - **Files:** game-ui.tsx (`GameArt`, deck card), `app/game/[appId]/game-hub.tsx`, styles.css `::view-transition-*`.
4. **Skeletons that match the final layout.** *(Linear, the Epic Games Store)* **Recommendation.**
   - **Dated now:** desktop-dark-state-loading-dashboard shows "–" in the price column, "…" for Price alerts and a text line "Loading Steam news…".
   - **Change:** reserve the real shapes, as static `--muted` blocks (no shimmer):
     - a 72×22 price slab and a 56×14 store line per Price-watch row;
     - a 24 px number block for the alert count;
     - two 3-line feed-entry skeletons for "What changed".
   - Add a single opacity pulse of 1.2 s that stops after 2 cycles, so nothing animates forever.
   - **Files:** app/page.tsx, `price-ui.tsx`, `backlog-feed.tsx`.
5. **Sticky contextual buy bar on phone.** *(PlayStation App and Epic mobile store bottom bars)* **Recommendation.**
   - **Dated now:** on phone-dark-game-outside-collection and phone-dark-deals, the primary price/action scrolls away. On the game page you have to scroll back to the price panel to buy.
   - **Change:** once the price panel leaves the viewport, a 56 px bar above the tab bar reads "$25.54 at Fanatical · save $5.95 · Buy ↗". It enters with transform/opacity at 200 ms and is hidden for owned games.
   - **Files:** `game-hub.tsx`, chrome.css.
