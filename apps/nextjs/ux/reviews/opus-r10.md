# Opus review: round 10

SCORE: 9.0/10 (9.1 weighted, capped at 9.0 by the pricing-honesty gate)
Categories: 1 9.5 · 2 9.1 · 3 8.9 · 4 9.1 · 5 9.0 · 6 9.0 · 7 9.0 · 8 9.2

(Weighted: 1.425 + 1.82 + 1.335 + 0.91 + 0.90 + 0.90 + 0.90 + 0.92 = 9.11, which rounds to 9.1; the cap brings it to 9.0. Round 9 was 9.3 with no cap.)

Gates: honesty **F** · a11y P · layout P · stability P · states P · touch P
- **honesty F** (source; the captures are fresh, so they don't show it):
  - Steam *edition* prices come from `appdetails.package_groups`, and both the package and the match cache live for **24 h**: `matchTtlMs = 24 * 60 * 60 * 1000` (packages/api/src/edition-match.ts:29). The package cache is set at :110–112, and the title cache inherits that expiry at :178.
  - Base-game Steam prices use the 5-minute `jsonCache` (steam-discovery.ts:25). Edition comparisons can therefore be up to a day old.
  - The page still says "Prices checked just now · USD", because `PricesChecked` uses the client query's `dataUpdatedAt` (deals/page.tsx:656–657).
  - This affects 9 of the 20 "Beats Steam" cards in desktop-dark-deals, every one labelled "Steam edition", including the billboard's "save $95.00 (−95%)".
  - Steam sales flip daily at 10am PT. A Deluxe edition that drops to −75% on Steam would keep showing "save $95.00" for up to 24 h. That's a saved price presented as live, which the gate forbids.
  - Everything else holds:
    - offline and outage cards show "—" with no saving (desktop-dark-state-offline-wishlist, outage-wishlist);
    - unknown spend reads "— · Add what you paid" (desktop-dark-state-empty-dashboard);
    - alert reasons read "Lowest ever · $X above your target" (price-ui.tsx:309);
    - Riot titles are excluded from price queries (price-ui.tsx:154);
    - "Steam has the best price" and "same price" are handled cent-safe.
- **a11y P:**
  - axe: 0 serious or critical issues across 98 captures; 25/25 focus stops are visible.
  - Manual failures that axe can't see are in fixes 2 and 4: the light-theme billboard button is illegible, and the radar adds 23 tab stops.
- **layout P:**
  - No overflow and no clipped text.
  - Watch item: the billboard's buttons sit on top of its inset art at 768, 840, 1024 and 1440 (fix 2).
- **stability P:**
  - 0 non-simulated console errors or failed requests.
  - Worst CLS is 0.092 (desktop-dark-state-deals-under-15 and -no-results), 0.008 under the gate.
  - desktop-dark-deals LCP is **3,416 ms**, which is the 4 s "Comparing with Steam…" grace (deals/page.tsx:357). Every other Deals capture is 228–468 ms.
- **states P:**
  - Offline Deals collapses its masthead and offers "Open wishlist / Open library".
  - Empty Library, Wishlist and Updates collapse their mastheads and show their art.
  - The outage Wishlist is now one line per card.
  - The defects are in fixes 5 and 6: the game-page outage notice sits below the fold, and the chart's sparse state is never shown.
- **touch P:** 0 phone targets under 44 px.

## Previous blocking fixes: resolved / partial / not

| Fix | Status | Round-10 evidence |
|---|---|---|
| **Opus r9-1**: Deals leads with offers that can't answer "beats Steam?" | **Resolved** | "20 of 23 deals beat Steam" in the default view, and Under $15 is "24 of 24" (it was 0 of 20). The list reads "24 games from 60 offers".<br>The divider now reads "Other editions: no live Steam price to compare" only below matched cards.<br>Desktop Track is now as wide as Buy. Phone still cramps it (nits). |
| **Opus r9-2**: the Deals deck shows cropped logos and is an empty group | **Superseded** | Owner decision: the Price Radar replaced the deck. Its new execution problems are in fix 4. |
| **Opus r9-3**: masthead band with no deck | **Mostly resolved** | Gap from the description to the first control:<br>- empty Library: about 50 px;<br>- empty Updates: about 50 px;<br>- empty Wishlist: 271 → 320;<br>- offline Deals: 245 → 294.<br>**Still open:**<br>- empty Home: 271 → 376 (desktop-dark-state-empty-dashboard);<br>- Deals no-results: an empty radar ("No Steam prices to compare in these results") keeps a 140 px band;<br>- live Deals: 245 → 387, because the radar plus its caption is about 200 px tall. |
| **Opus r9-4**: outage states repeat themselves | **Partial** | The Wishlist outage is clean: "—", then "Prices didn't load · your $25.00 target is saved", the target, and one action.<br>Game page: one consolidated notice, but at y≈1170–1243, **below the 900 px fold** (desktop-dark-state-outage-game). The left-column void (y≈740–1140) remains. See fix 6. |
| **Opus r9-5**: art snaps at the end; empty Home had no art | **Resolved** | art.css:65–118: every loop starts and ends on its rest pose, with no `alternate` (only `ea-bob` keeps it, and it rests correctly). Empty Home shows the card art in Price watch. |
| **Opus r9-6**: copy and alignment leftovers | **Mostly resolved** | **Resolved:**<br>- the Deals stat is hidden offline and with no results;<br>- the wishlist "at GameBillet · 9 stores compared" is centred on the price;<br>- "Patch notes 0" is gone;<br>- the Home eyebrow reads "No price alerts right now".<br>**Not resolved:**<br>- "Steam(unconfirmed)" still renders with no visible space in the desktop and 840 selects (desktop-dark-game-owned x≈772, y≈946). The source now builds one string (backlog-editor.tsx:234), so Barlow's narrow space is to blame; change the copy (nits).<br>- Phone nav badges still butt against their icons. |
| **astra r9-1**: price status through offline and failure | **Resolved** (LCP partial) | The offline Wishlist shows "—" and "Checks when you're back online". There is no saving on any offline or outage capture. The Deals cold LCP is 3.4 s (fix 3). |
| **astra r9-2**: unknown spend | **Resolved** | Empty Home: "— · Add what you paid". Library: "per game, 3 purchases recorded". |
| **astra r9-3**: alert reasons | **Resolved** (source) | price-ui.tsx:309, and the masthead counts say "price alert" (wishlist/page.tsx:498–505). |
| **astra r9-4**: Riot everywhere | **Resolved** (source) | `isRiotGame` filter in the shared hook (price-ui.tsx:154). No Riot capture this round. |
| **astra r9-5**: Deals hand and first results | **Resolved / superseded** | The ranking pool is 60. The phone LEGO row now shows the full "Galactic Edition". The hand is replaced by the radar. |
| **astra r9-6**: 150 ms colour transition | **Resolved** | No `transition-colors` remains in styles.css. |

## What improved
- **Deals finally answers the product question on the first screen.**
  - "20 of 23 deals beat Steam", a billboard with "Steam edition $99.99 · save $95.00 (−95%)", and a "Beats Steam −$X" ribbon on every comparable card.
  - It holds in Under $15 (24 of 24). This is the biggest round-on-round value gain since round 3.
- **Edition matching makes the comparison honest about editions.** "Steam edition" compares Deluxe to Deluxe, not Deluxe to the base game.
- **Outage and offline states stopped repeating themselves on Wishlist.** Each card gets one line and keeps its target.
- **Unknown spend is unknown.** "—" with "Add what you paid" replaces a fake $0.00.
- **Empty mastheads collapse, and the empty-state art now comes to rest cleanly.**

## BLOCKING FIXES

### 1. Steam edition prices are cached for 24 h but shown as "checked just now" (honesty gate)
**Evidence:**
- edition-match.ts:29 sets `matchTtlMs` to 24 h; :110–112 caches packages for it, and :178 gives title matches the same expiry.
- deals/page.tsx:656 labels the whole list "Prices checked just now".
- desktop-dark-deals has 9 "Steam edition" comparisons, including the billboard's "save $95.00".

**Fix:**
- **Separate the match from the price.** Cache the *mapping* (normalised title → `steamAppId` + `packageId`) for 24 h. Re-read the *price* through `fetchJson` with the same 5-minute TTL as base games (`cacheTtlMs`).
  - Concretely: store `{ steamAppId, packageId }` in `titleCache`.
  - On each request, call `fetchSteamPackages` with a 5-minute `packageCache` TTL and look up `packageId`.
- **Add `checkedAt` (epoch ms) to `SteamMatchSchema`.** On the client:
  - If `Date.now() - checkedAt > 15 min`, render the Steam row as "Steam edition $99.99 · checked 3 h ago" with **no** "save" and **no** ribbon. The radar skips that dot.
  - That matches the rule for saved catalog prices.
- **Test** (validators or api): advance a fake clock 6 minutes and assert that a second `addSteamEditionMatches` call refetches appdetails. A match older than 15 minutes must produce no `gap`.

### 2. The billboard collides with its own art and fails contrast in light theme
**Evidence:**
- **Stray placeholder glyph.** A placeholder image glyph floats beside the title: laptop-dark-deals x≈512, y≈719; desktop-dark-deals x≈720, y≈720; desktop-light-deals x≈720, y≈720.
  - Cause: `.game-art` paints the placeholder glyph as a centred background (styles.css:484–496).
  - In `.art-inset` the `<img>` still fills the whole billboard with `object-fit: contain; object-position: right` (deals.css:537–540), so the glyph shows through the gradient.
- **Buttons over the art.** "Buy at WinGameStore" and "Find it on Steam to track" sit on the inset art at 768 (x 513–719 over art from 592), 840 (585–790 over 664), 1024 and 1440 (1073–1279 over 1152).
- **Illegible in light theme.** In desktop-light-deals the secondary button's text is dark olive on the near-black billboard, about 1.5:1 ("Find it on …" at x 1090, y 730 is unreadable). axe misses it because the background is an image plus a gradient.

**Fix:**
- **Glyph:** `.deal-featured > .deal-art .game-art { background-image: none; background-color: transparent; }`. The billboard already handles missing art through `.no-art`.
- **Layout:** with `.art-inset`, lay the billboard out as `grid-template-columns: minmax(0,1fr) auto var(--inset-w)`.
  - Set `--inset-w` from `onArtLoad` (`image.naturalWidth * card.clientHeight / image.naturalHeight`, capped at 200 px).
  - The actions then sit left of the art, with a 24 px gutter. Below 1024, drop the inset art behind the gradient at 30% opacity instead of beside it.
- **Contrast:** the billboard is always dark, so scope dark tokens to it: `.deal-featured { color-scheme: dark; --foreground: <dark-theme fg>; --border: <dark-theme border>; }`.
  - Its outline button then gets the light text (≥ 7:1 on the ink).
  - Add an audit check that the billboard's secondary button reaches contrast ≥ 4.5 in desktop-light-deals.

### 3. Deals became a long, repetitive card wall that doesn't scan
**Evidence:**
- **Page length.** 24 deals take **5,640 px** at 1440 (8 rows of ≈560 px cards), **7,404 px** at 840, and **10,515 px** at 390 (≈425 px per deal, about 13 phone screens).
  - In round 9 the same 24 offers were mostly 72 px ledger rows. Now that most offers match, every one of them gets the tall card.
- **Each card says things two or three times** (desktop-dark-deals, first row):
  - the saving: "Beats Steam −$84.99" ribbon plus "save $84.99";
  - the Steam price: "Steam edition $99.99" plus struck "$99.99 −85%";
  - the store: "Ubisoft Store" subtitle, "Best · Ubisoft Store", and "Buy at Ubisoft Store".
- **Prices don't line up.** Steam's own offers have no Steam row, so their price box drops 52 px. In the last full row, Pro Basketball's $25.54 sits at y≈4519 while Just Cause 2's $1.49 sits at y≈4571.
  - Dungeon Siege is orphaned alone in row 8, with two empty columns.
- **The eyebrow counts Steam's own sales.** "20 of 23 deals beat Steam" includes 3 Steam offers that can't beat Steam.

**Fix** (deal-cards.tsx:317–400, deals.css:16–19):
- **Keep the billboard and the first 3 matched cards (one row).** Render the remaining matched groups as a **comparison ledger**, one row per game, ≤ 72 px at ≥ 768:
  `120×56 art | title / store | offer $ (Plex, right) | Steam $ (muted, right) | save $X (lime, right) | Buy 104 px + Track 112 px`.
  - Target: 24 deals in ≤ 2,400 px at 1440.
- **On phone, use a compact row**, ≤ 170 px per deal:
  - 96×45 art and a 2-line title;
  - one Plex line, "$4.99 WinGameStore · Steam $99.99";
  - "save $95.00" in lime;
  - Buy at full width, with "Track ▾" as a 44 px trailing icon button.
- **Remove the repeats:**
  - keep the ribbon only on the 3 top cards;
  - drop the struck normal price when it equals the Steam baseline (±1 cent);
  - drop the "Best · Store" label (the store is already in the subtitle).
- **Move Steam's own sales** ("Steam has the best price") to a trailing group headed "On sale at Steam". The eyebrow becomes "20 of 20 store deals beat Steam".
- **Shorten the reveal grace** from 4,000 ms to 1,500 ms. Show the ledger with reserved Steam cells that read "Checking Steam…". Target: cold LCP < 2.5 s on desktop-dark-deals.

### 4. The Price Radar is decorative: angle means nothing, labels are tiny, and it adds 23 tab stops
**Evidence:**
- **Angle carries no data.** Dots are spaced evenly by list index (`angle = (index + 0.5) / dots.length`, price-radar.tsx:114–116).
- **Everything piles up on the rim.** 20 of 23 deals save 85–95%, so they sit at radius 56–63 of 66 on a linear 0–100% scale (:57). The radar reads as a dotted ring with two grey dots in the middle (desktop-dark-deals x 1100–1230, y 157–285).
- **Unreadable labels.** Ring labels are 9 viewBox units (radar-chart.css:57): about 9 px at 1440 and **about 6.5 px at 840** (split-dark-deals). "−75%" collides with the top dot (desktop x≈1172–1190, y≈160–170).
- **Shape-only states.** Hollow (title match), ringed (biggest saving) and grey (tie) dots have no legend.
- **Keyboard cost.** Every dot is `tabIndex={0}` (:136), so a keyboard user tabs through 23 dots before reaching the search box.
- **Inconsistent counts.** The caption "23 of 24 offers compared with Steam" disagrees with the eyebrow "20 of 23 deals beat Steam" and the list's "24 games from 60 offers".
- **Empty radar.** No-results still draws empty rings (desktop-dark-state-deals-no-results).

**Fix** (keep the radar, as the owner decided; fix its execution):
- **Give angle a meaning.** Assign one sector per store (the top 5 stores by count, plus "Other"), with 11 px HTML labels outside the SVG rim. Order dots within a sector by saving.
- **Spread the radius** so the useful band is readable: rings at **50 / 75 / 90%**, with `r = 66 * (fraction ** 2)`.
- **Move ring labels to HTML** at 11 px, placed beside the vertical axis away from dots.
- **Add a one-line legend under the plot:** "● beats Steam · ○ matched by title · ◎ biggest saving · • same as Steam".
- **Roving tabindex:** one tab stop for the figure, and Arrow keys move between dots; set the others to `tabIndex={-1}`. Name the figure "Price Radar: 20 deals below Steam, use arrow keys".
- **Unify the caption** with the eyebrow: "20 beat Steam · 3 Steam sales · 1 can't compare".
- **Hide the radar** (and collapse the masthead) when `comparisons.length === 0`.
- **At 768–1023**, render the radar at a minimum of 200 px plot width, or hide it below 900 px rather than shrinking the text.

### 5. The Wishlist arrow chart draws an empty 90-day frame instead of its sparse state
**Evidence:**
- **An empty frame.** desktop-dark-wishlist, split-dark-wishlist and phone-dark-wishlist show the axis "Aug 22 → Nov 19", the dashed target, and one arrowhead at the top right (desktop x≈1283, y≈181). There is no line and no "Tracking since … · 1 price observed".
  - Cause: `drawChart = points.length >= 2` (price-chart.tsx:402) is true when both points fall on the same day (today's snapshot plus today's check).
  - The 30d / 90d / 365d toggles change nothing.
- **Offline and outage.** The chart area says "Current prices unavailable" under live-looking period buttons. The page then says the same thing four more times:
  - the eyebrow "Prices unavailable";
  - the status line;
  - each card's "Checks when you're back online";
  - the floating toast (desktop-dark-state-offline-wishlist).
- **Draw time.** The line draws in 600 ms (radar-chart.css:302), against the rubric's ≤ 300 ms.

**Fix:**
- **Gate the chart on real history.** `drawChart` requires ≥ 2 observations on **distinct days inside the selected period**.
- **Otherwise render the sparse state:**
  - a single "today" marker with "$32.99 today · GameBillet · $7.99 above your $25.00 target";
  - then "Tracking since Nov 19 · 1 price observed".
  - Mark the period buttons `aria-disabled="true"` with the hint "More history needed".
- **When prices fail or the browser is offline**, hide the visual (`.page-heading-visual` gets `hidden`). The eyebrow and the cards already carry the message.
- **Draw time:** set `price-chart-draw` to 280 ms.

### 6. Outage and state leftovers: notice below the fold, and a lime "I own this" from a class bug
**Game outage** (desktop-dark-state-outage-game):
- The only explanation and retry ("Steam isn't responding … Try again") renders at y≈1170–1243 (game-hub.tsx:628–640), **below the 900 px fold**.
- The visible page shows "Couldn't check store prices" and "News couldn't be loaded" with no reason and no action.
- The hero keeps a 140 px hole where the description failed (y≈270–410).

**Fix (game page):** render the consolidated message **inside the price card's existing slot**. It is already reserved, so there is no CLS:
- "Steam isn't responding. Prices, details and news will load when it does." with one "Try again" button.
- The news section reads only "Waiting for Steam".
- Delete the bottom `<aside>`.

**Class bug** (wishlist/page.tsx:283):
- `` className={`action secondary${!offer && !pending ? "col-span-full" : ""}`} `` has no space, so it produces `action secondarycol-span-full`. The button loses `secondary`, and **"I own this" becomes the lime primary action** on every outage and offline card (desktop-dark-state-outage-wishlist y 716–763; offline-wishlist).
- The accent ends up telling a user with no prices to mark the game owned.

**Fix (class bug):**
- Change to `` `action secondary${!offer && !pending ? " col-span-full" : ""}` `` (or use `cn`).
- Add an e2e assertion that the own button never has the primary class.

## KEEP
- **Honesty:**
  - "Beats Steam −$X" only from cent-safe live comparisons;
  - "Steam edition" labelling, so editions never compare against a base game;
  - "Steam has the best price" and "same price";
  - "—" with "Add what you paid";
  - "Lowest ever · $X above your target";
  - offline and outage cards with no saving;
  - Riot excluded from prices and launch.
- **Deals:**
  - ranking a 60-offer pool, with comparable offers first;
  - the billboard as the single biggest Steam saving;
  - the right-aligned Plex price column (in rows);
  - "Reset filters"; URL state;
  - the phone preset scroller with its fade;
  - the stat hidden in non-data states.
- **Wishlist:**
  - the one-line outage card;
  - the centred source line;
  - the track legend;
  - targets kept through every state.
- **States:**
  - collapsed mastheads on empty pages;
  - empty-state art that ends on its rest pose and stays still under reduced motion;
  - the floating offline toast;
  - "Open wishlist / Open library" on offline Deals.
- **Everything else:**
  - the game page's price-first grid with patch notes in the left column;
  - the Updates glance chips and "Fixed …" leads;
  - Home's 01/02 Play next;
  - the deck on Home and Library (keyboard ring, compact 768–1023 hand);
  - Barlow Condensed with Plex Mono;
  - the olive/lime palette;
  - instant colour changes everywhere.

## Nitpicks (not blocking)
- **"Steam(unconfirmed)":** Barlow's space before "(" is about 1 px in the select. Use "Steam · not confirmed" in backlog-editor.tsx:234, game-ui.tsx:409 and library/page.tsx:123.
- **Edition actions:** edition cards say "Find it on Steam to track" even when `steamMatch.steamAppId` is known. Offer "+ Wishlist" for the matched Steam app instead.
- **Phone LEGO row** (phone-dark-deals y≈9,960–10,200):
  - "Track ▾" is squeezed to 46 px with its text touching the border;
  - the store line breaks as "Steam price / ⏎ / unavailable · Retry" with a blank line between;
  - "Retry" implies a failure when it's simply no match. Use "No Steam match".
- **Home:**
  - Play next shows Cyberpunk twice: the hero card plus row 01. Start the numbered list at the next game.
  - The empty Home masthead still has a 105 px band.
  - Nav badges read "0" when empty; hide them.
- **Game page:** "Lowest ever $17.99" can now carry its date ("· Mar 2025 (CheapShark)"), as the Wishlist chart does.
- **Masthead chart title:** "Helldivers 2 · $7.99 above your target" leaves "target" as an orphan on the second line at 1440 and 840. Add `text-wrap: balance`.
- **Updates:** the "✓ fixes" chips use the same warm border as nerfs. Give fixes a neutral or teal border, so red means only "costly".
- **840 game page:** the left column is empty under the price card from y≈916 to 1208.
- **CLS watch:** 0.092 on Under $15 and no-results, close to the 0.1 gate.
