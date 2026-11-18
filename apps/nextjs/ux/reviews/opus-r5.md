# Opus review: round 5

SCORE: 8.9/10
Categories: 1 9.0 · 2 8.8 · 3 8.8 · 4 9.0 · 5 8.8 · 6 9.3 · 7 8.9 · 8 9.1

(Weighted: 1.35 + 1.76 + 1.32 + 0.90 + 0.88 + 0.93 + 0.89 + 0.91 = 8.94, rounded to 8.9. Round 4 was 8.7.)

Gates: honesty P · a11y P · layout P · stability P · states P · touch P
- **honesty P:** savings come only from live prices in cents ("Beats Steam −$5.95", "save $14.08 (−35%)"). Wishlist says "Lowest ever" only with history and "History unavailable" when the check failed. Purchase store is "Not set". Two softer trust problems are left: the deals denominator and the UTC date (fixes 4 and 6). Neither is a false claim, so the gate passes.
- **a11y P:** 0 axe serious/critical issues across 98 captures. 25/25 keyboard stops show focus. Heading structure passes. The back link's accessible name includes the arrow glyph ("←Back to Updates" at tablet and phone); that's a nit.
- **layout P:** no overflow at 390, 768, 840, 1024 or 1440, and 0 clipped text. The game-hero back link sits on top of the eyebrow (fix 3), but it isn't clipped.
- **stability P:** max CLS is 0.07 (split-dark-wishlist). Home LCP is now 68–148 ms on every viewport (it was about 3.2 s). One caveat: desktop-dark-state-deals-under-15 makes 3 failed requests (404s for `/_next/image` Steam art for app 785847) outside a simulated outage. The audit files them as "missing art, fallback shown", so I'm passing the gate, but see the nits.
- **states P:** loading wishlist keeps saved targets ($25.00/$10.00) and only skeletons remote values. Offline, outage and empty states all exist and name a next step. The offline wishlist copy isn't offline-aware (fix 4).
- **touch P:** 0 phone targets under 44 px. The bottom thumb nav and the phone "Track ▾" disclosure are fine.

## What improved

Round 5 fixed the biggest structural problem: the type system finally renders. Barlow Condensed mastheads ("HOME", "DEALS"), Plex Mono prices and condensed section labels make the app look like one designed product, and the audit now asserts it. The patch reader is accurate: Scorn shows "1.2x → 1.3x" and Radiant Daggers "30m → 25m", Sand Blast gets "↻ Change" with no value, and the caption says "sorted automatically". The deals billboard leads with "BIGGEST SAVING VS STEAM" and "save $14.08 (−35%)". Unmatched editions are now compact rows (desktop deals 5211 → 3210 px). Free CTAs read "Get it free at Epic Games Store". Wishlist cards are compact (phone card about 405 px). Home LCP is fixed, and the mastheads have art and a fitted page word at 1024.

What keeps me under 9.5 is finish, not structure:
- /deals rows don't hold a column, and they collapse badly at 1024.
- The billboard price line reads "$25.91at Green Man Gaming".
- The game hero randomly swaps between wordmark, emblem and text, and collides with the back link.
- Wishlist freshness is a UTC ISO date that is a day ahead of the user's own date.
- Updates shows chips for "0 nerfs · 0 buffs".

Each of these is the kind of thing a demanding user notices in the first minute.

## Round-4 blocking fixes: resolved / partial / not

**Opus**
- **[Opus 1] Fonts: resolved.**
  - The audit asserts the price is "IBM Plex Mono" and the H1 is "Barlow Condensed" on deals and wishlist at all viewports.
  - In desktop-dark-dashboard, "HOME" is condensed and the metric values are mono.
- **[Opus 2] /deals: partial.**
  - (a) Billboard eyebrow, −% and auto-width buttons are done, with no dead band. But the price line reads "$25.91at Green Man Gaming" (fix 2).
  - (b) Compact rows are done, and desktop is 3210 px (target ≤ 3600). Phone is 5449 px against the ≤ 5200 target, which is close. The rows' price column drifts, and the rows wrap at 1024 (fix 1).
  - (c) Free CTA is done.
  - (d) The phone ribbon is now an inline badge (phone-dark-deals): done.
- **[Opus 3] Wishlist degraded states: partial.**
  - Done: "Prices unavailable", "History unavailable" and "Price track unavailable".
  - Not done:
    - the card source line still says "Checked 2026-11-18 · 9 stores comp…" (ISO, UTC and truncated);
    - "Check prices now" is still offered while offline;
    - offline cards say "Try checking again in a moment" (fix 4).
- **[Opus 4] Updates counts: resolved, with a regression in (c).**
  - Done: chips and rail follow the tab, the label is "in 30 days", and the spacing is fixed.
  - The patch summary renders zero-count chips (fix 5).
- **[Opus 5] Mastheads: resolved.**
  - The word fits and fades. There's art at 1024 (laptop-dark-library, laptop-dark-wishlist).
  - The Home stat row no longer collides with the art.
  - A faint hard top edge remains at about y 97 (nit).
- **[Opus 6] Patch parser: resolved.** All three Deadlock lines are correct, every row has a chip, and the caption is present (desktop-dark-patch-deadlock).

**astra**
- **[astra 1] Free games in the target flow: resolved.** Confirmed in source: "Free right now; nothing to wait for" in `price-ui.tsx` and `game-ui.tsx`, and the target field is `hidden={free}`.
- **[astra 2] Wishlist unknowns: resolved.** "Prices unavailable" in the masthead, "History unavailable", and saved targets visible while loading (desktop-dark-state-loading-wishlist).
- **[astra 3] Patch comparisons: resolved.** Numeric values only; phone shows each value once, inline (phone-dark-patch-deadlock).
- **[astra 4] Digest layer: partial.**
  - 7.2.3 now leads with "Crash fixes · Cosmetics" and a concrete line.
  - But these still lead with publisher prose: 7.2.2 ("INCOMING TRANSMISSION FROM SUPER EARTH HIGH COMMAND."), 7.0.2 ("Attention Helldivers, Captain Morris here…") and Elden Ring 1.17 ("Patch 1.17 has been released…"). See fix 5.
- **[astra 5] Wishlist padding: resolved.** Phone card is about 405 px (target ≤ 440).
- **[astra 6] Home LCP: resolved.** 68–148 ms. Library state captures still show 3244 ms (nit).
- **Round-4 nits:**
  - Done: the laptop library is 3-up, the phone metrics stack, the empty-dashboard "—" plus "Add what you paid", one "Reset filters" name, and "USD" said once.
  - The Deadlock "Free on Steam" nit is won't-fix (owner decision; not re-requested).

## BLOCKING FIXES

### 1. /deals edition rows: the price column drifts, and rows collapse at 1024
**Captures:** desktop-dark-deals, desktop-dark-state-deals-under-15, laptop-dark-deals

**Evidence:**
- **The price column has no fixed position (desktop-dark-deals).** Each `.deal-row` is its own grid with `auto` price and action columns, so the price moves with the button widths:
  - right edge at x=891 for most Epic rows;
  - 910 for the WinGameStore rows;
  - 938 for GameBillet (KOF XIV);
  - 841 for Contractor ("Get it free at…");
  - 847 for LEGO Star Wars (3 buttons).
  - A ledger whose prices don't line up defeats the point of a compact list.
- **Mixed actions.** The LEGO row (it has a `steamAppId` but no Steam price) shows "+ Wishlist" and "I own this", while every other row shows "+ Find on Steam".
- **Laptop collapse (laptop-dark-deals, 1024).** Below the 1100 px breakpoint the actions wrap under the title, so each row is 133 px tall instead of 81 px, with about 350 px of empty space beside the actions. The page is 4116 px tall, against 3210 px at 1440. That's the mid-width cramping the owner asked us to treat as blocking.

**Fix** (`apps/nextjs/src/app/styles/deals.css`, `apps/nextjs/src/components/deal-cards.tsx`):
- **Shared columns.** Make the rows one table:
  - `.deal-edition-list { display:grid; grid-template-columns: 120px minmax(0,1fr) max-content max-content; }`
  - `.deal-row { grid-column: 1 / -1; grid-template-columns: subgrid; }`
  - Do this at `(width >= 960px)`, replacing the 1100 breakpoint. Below 960 keep today's wrapped layout.
  - Every price then right-aligns to one x, and every action group starts at one x.
- **Shorter row CTAs**, so 1024 fits on one line:
  - Visible label "Buy ↗" (or "Get free ↗" or "Check price ↗").
  - `aria-label="Buy at {store} (opens store)"`.
  - The store is already printed under the title.
  - Target: a row height of ≤ 84 px at 1024 and 1440. laptop-dark-deals should come in at ≤ 3400 px.
- **Exactly two actions per row.**
  - `steamAppId` present: Buy plus the existing collapsed `TrackToggle` ("Track ▾").
  - Otherwise: Buy plus "Find on Steam" (drop the leading "+": this opens search, it doesn't add anything).
- **Free row.** Drop the extra "Free · Epic Games Store" ledger label. Show "Free" in the price slot and "$3.99 −100%" under it, the same shape as every other row. The store currently appears 3 times in that row.

### 2. Billboard and matched cards: unfinished type and duplicated facts
**Captures:** desktop-dark-deals, laptop-dark-deals, split-dark-deals, tablet-dark-deals, desktop-light-deals

**Evidence:**
- **The billboard price line runs together as "$25.91at Green Man Gaming".**
  - `.deal-ledger > .price-link` is a flex row with `gap: 6px`, so the space text node collapses.
  - `.price-link-cue` sets the store in Plex Mono at 40px. The store name ends up wider than the title (about 605 px against 440 px for "Ashes of the Singularity II") and reads as one token.
- **Matched cards repeat the price** (SULFUR): "Best · Steam $28.78" and then "Steam $28.78 same price", two 56–70 px slabs saying one fact.
- **Matched cards have about 40 px of blank space** between the store line and the ledger (the `.deal-heading { min-height: 72px }` reserve).
- **Orphaned grid space.** With only 2 matched cards, the 3-column grid leaves a 380 × 560 px empty third column at 1440 (x 925–1304), and the same at 1024 (x 685–1000).

**Fix** (`apps/nextjs/src/app/styles/deals.css`, `apps/nextjs/src/components/deal-cards.tsx`):
- **Billboard price line.**
  - `.deal-results .deal-featured .price-link-cue`: `font-family: var(--font-sans); font-size: 20px; line-height: 28px; font-weight: 500; color: color-mix(in oklab, var(--deal-art-text) 72%, transparent)`.
  - On `.deal-ledger > .price-link`, set `column-gap: 12px`.
  - Result: "$25.91" in 40px Plex Mono, then "at Green Man Gaming" in 20px Barlow, both on one baseline.
- **Merge the slabs when the best store is Steam** (`deal.storeId === "1"`): render a single slab, "Best · Steam $28.78", with a one-line note "Steam has the best price". Drop the second slab.
- **Remove the blank reserve.** Change `.deal-heading` `min-height` from 72px to 0. To keep the ledgers aligned, make `.deal-content` a grid with `grid-template-rows: auto 1fr auto auto` so the ledger sits at the bottom.
- **Fill the row when there are only 1–2 matched cards (≥ 1024px).** Render them as horizontal cards: 240 × 112 art on the left, ledger and actions on the right, `grid-template-columns: repeat(2, minmax(0,1fr))`. This is the Steam "Special Offers" pair-row pattern. With 3 or more cards, keep the vertical cards.

### 3. Game hero: the title randomly switches between wordmark, emblem and text, and the back link collides with it
**Captures:**
- desktop-dark-game-outside-collection, phone-dark-game-outside-collection and laptop-dark-game-outside-collection;
- desktop-dark-game-owned, laptop-dark-game-owned, split-dark-game-owned and desktop-light-game-owned;
- desktop-dark-state-outage-game.

**Evidence:**
- **Deadlock.**
  - desktop and phone: the H1 is a 160 × 160 circular emblem, and the name only appears as the 13px lime eyebrow "DEADLOCK".
  - laptop (correctly): a 64px condensed "DEADLOCK".
- **Cyberpunk.**
  - desktop-dark: a text H1.
  - laptop, split, desktop-light and the outage capture: the yellow wordmark.
- **Why it's nondeterministic.** `HeroTitle` only evaluates the logo in the `<img onLoad>` handler. When the image finishes before hydration (it's cached, or comes from the SSR markup), onLoad never fires, so the "square emblem → text" rule is skipped.
- **The back link collides in logo mode.** `.hero-body .back-link` is `absolute; top: 72px` with `-mb-3`. "← Back to Updates" ends at about y 103 and the "CYBERPUNK 2077" eyebrow starts at about y 107. That 4 px gap makes them read as one block (laptop-dark-game-owned, desktop-dark-game-outside-collection: "← Back to game / DEADLOCK").

**Fix** (`apps/nextjs/src/app/game/[appId]/game-hub.tsx`, `apps/nextjs/src/app/styles.css` around lines 979–1015):
- **Evaluate after hydration too.**
  - Add `const ref = useRef<HTMLImageElement>(null)` and a `useEffect` that runs `if (img.complete) img.naturalWidth ? evaluate(img) : setMode("text")`.
  - Share `evaluate` with `onLoad`.
  - Raise the threshold to `naturalWidth < naturalHeight * 2.5`, so near-square or emblem logos always fall back to text.
- **Spacing.**
  - Take the back link out of absolute positioning in the hero: `.hero-body .back-link { position: static; margin-bottom: 24px }`, and drop `-mb-3` there.
  - Reduce `.hero-title` `min-height` by the link's 40px so the hero height (and CLS) stays the same.
  - Target: a gap of ≥ 24px between the back link and the eyebrow or H1 at every viewport.
- **Test.** Add an audit assertion on desktop and laptop: `.hero-title` has `has-logo` for Cyberpunk and doesn't for Deadlock.

### 4. Wishlist freshness and offline copy: UTC date, repeated freshness, retry offered offline
**Captures:** desktop-dark-wishlist, phone-dark-wishlist, split-dark-wishlist, desktop-dark-state-offline-wishlist, phone-dark-state-offline-wishlist

**Evidence:**
- **A future date.**
  - Every card says "Checked 2026-11-18 · …", but the audit ran at 2026-11-17 local (00:56Z on the 18th).
  - `checkedOn = prices.verifiedAt.slice(0, 10)` in `components/price-ui.tsx:170` is the UTC date, so a US user in the evening sees tomorrow's date.
- **Repeated and truncated.** The ISO format repeats the page-level "Prices checked just now" and is cut off: "9 stores comp…" at 1440 and "9 store…" at 390.
- **Offline.**
  - The banner says "You're offline", but the page still offers "Check prices now".
  - Each card says "Couldn't check / Try checking again in a moment / No live Steam comparison / Your target is saved; try checking again." That's four lines for one fact, and the advice is wrong while offline.

**Fix** (`apps/nextjs/src/components/price-ui.tsx`, `apps/nextjs/src/app/wishlist/page.tsx`, and `game/[appId]/game-hub.tsx:412`):
- **Dates in local time.** `checkedOn = new Date(verifiedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })`. Use it everywhere `checkedOn` is shown.
- **Live card freshness.** "9 stores compared" only. The header already says when.
- **Saved catalog.** "Saved Nov 17 · last known price".
- **Offline** (the page already computes `offline`):
  - Replace the "Check prices now" button with muted text: "Reconnect to check prices".
  - Card freshness: "Checks when you're back online".
  - Hide the "No live Steam comparison" line when there's no offer.
  - Decision line: "Target $25.00 saved".
  - Result: no more than 2 status lines per card.

### 5. Updates: zero-count chips, the vague "other", and prose that still leads
**Captures:** desktop-dark-updates, laptop-dark-updates, phone-dark-updates, desktop-light-updates, desktop-dark-game-outside-collection

**Evidence:**
- **Zero-count chips.**
  - 7.2.3 shows "▼ 0 nerfs · ▲ 0 buffs · ↻ 6 other" and 7.0.2 shows "▼ 0 nerfs · ▲ 0 buffs · ↻ 3 other".
  - The red-outlined "0 nerfs" chip pulls the eye to nothing, and "6 other" doesn't say what changed.
- **Two chip rows.** The count chips and the topic pills ("Crash fixes", "Cosmetics") stack as two rows of differently bordered chips, adding about 32 px per entry.
- **Prose still leads** on 7.2.2 ("INCOMING TRANSMISSION FROM SUPER EARTH HIGH COMMAND."), 7.0.2 ("Attention Helldivers, Captain Morris here…") and Elden Ring 1.17.
- **Zero badges in the filters.** The laptop and phone game filter chips show four "[0]" badges and one "[3]".

**Fix** (`apps/nextjs/src/app/_components/backlog-feed.tsx` `PatchSummary`, `apps/nextjs/src/app/styles/updates.css`, `packages/validators/src/news-digest.ts` plus a test):
- **Count chips.**
  - Render only the kinds with a count above 0.
  - If nerf + buff is 0, render one neutral chip: "↻ 6 fixes" when fixes are the majority, otherwise "↻ 6 changes".
  - Rename "other" to "changes".
- **One line.** Put the counts and the topics on a single line: the chips, then `·`, then the topics as 13px muted plain text (no borders).
- **Fallback lead.** When `digestNews` returns no `line`, drop a leading greeting or all-caps sentence before using the excerpt. Treat a first sentence as one to skip when it matches `/^(greetings|hello|hey|attention)\b/i` or more than 60% of its letters are uppercase. Add both Helldivers openers as tests in `packages/validators/src/__tests__/`.
- **Filter and rail counts.** Show nothing for 0 (`aria-label` keeps "0 in 30 days"), and only show the number when it's above 0.

### 6. Deals denominator overstates the comparison
**Captures:** desktop-dark-deals, desktop-dark-state-deals-under-15

**Evidence:**
- The masthead says "2 of 21 beat Steam's own price", but only 3 of the 21 games have a live Steam price at all.
- Under $15 says "0 of 20 beat Steam's own price" when only 1 of 20 has a Steam app, and that one (LEGO) has no Steam price.
- The divider says "no Steam match to compare", but LEGO *is* matched; it just has no live Steam price.
- The product test is "does this beat Steam". A denominator that counts games we never compared reads as a comparison we didn't make.

**Fix** (`apps/nextjs/src/app/deals/page.tsx` around lines 265–286, `apps/nextjs/src/components/deal-cards.tsx`):
- **Stat.** `comparable = groups.filter(g => steamGap(g.deal, baseline(g)) != null).length`. Then:
  - "2 of 3 with a Steam price beat it" when `comparable > 0`;
  - "No Steam prices to compare in these results" when it's 0.
- **Divider.** "Other editions: no live Steam price to compare".

## KEEP (must not regress)
- **Type and palette:** Barlow Condensed display and section labels, Plex Mono prices, the font audit assertion, the olive and lime palette, and the restrained use of `--signal`.
- **Home:** fast LCP (≤ 150 ms), the Play next spotlight with the numbered 01/02 queue and lime rail, the one-line What changed with the wishlist-patches link, the stacked phone metrics, and the empty "—" plus "Add what you paid".
- **Deals:**
  - the "BIGGEST SAVING VS STEAM" billboard with "save $X (−N%)";
  - "Beats Steam −$X" only from live cents;
  - compact edition rows under a divider;
  - "Get it free at {store}";
  - the inline phone ribbon;
  - filter state in the URL, "Under $15" correctness, and one "Reset filters".
- **Wishlist:**
  - "Prices unavailable", "History unavailable" and "Price track unavailable";
  - saved targets visible while loading;
  - compact cards (≤ 440 px on phone);
  - the 28px mono price first, then one decision line;
  - the target/lowest pair and the lowest/target/now track;
  - the filled Buy only at target, lowest or free;
  - the 21–24 ms save acknowledgement.
- **Patch reader:**
  - number-only value column using the last from/to match;
  - a chip on every row, with "↻ Change" as the fallback;
  - "buildup" counted as costly;
  - the "sorted automatically" caption and the glance bar with ▼/▲/↻ glyphs;
  - each value shown once on phone;
  - "Back to patch notes".
- **Updates:** counts follow the tab and say "in 30 days"; topic labels plus a concrete line when one exists; date groups; chips at 840–1199 and the rail from 1200.
- **Mastheads:** the page word sized to fit with an edge fade, art from 1024, and the mono eyebrow stat.
- **Game page:** prices before the collection editor, Steam as the "baseline" row, "Bought from: Not set", "(unconfirmed)" launcher, the outage message in the hero slot, and the named back link.
- **States and other behaviour:**
  - "Deals need a connection" with wishlist and library exits;
  - offline reload keeps the theme with 0 hydration errors;
  - the Add game dialog (focused, `/`, "Free on Steam", "Steam price not listed", Escape closes);
  - boot runs under 1 s, is skippable, and reduced motion wins;
  - transform/opacity-only motion that rests when idle;
  - the phone bottom nav.

## Nitpicks (not blocking)
- **desktop-dark-dashboard:** the eyebrow "2 games on your wishlist" repeats "2 on your wishlist" in the stat row directly below. Use "2 waiting for a drop" (or the price-alert count) instead.
- **desktop-dark-wishlist:** the masthead "0 of 2 at your price" and the summary "Nothing has hit your targets yet." say the same thing 250 px apart. Drop the summary sentence when the eyebrow covers it.
- **desktop-dark-game-owned:** the Plays on select reads "Steam(unconfirmed)", with no space.
- **Back links:** the accessible name is "←Back to Updates" at tablet and phone, so the arrow glyph isn't `aria-hidden`. After a game → game navigation the label is "← Back to game"; name the game instead ("← Back to Cyberpunk 2077").
- **"Read on Steam↗":** has no visible space before the arrow on desktop (updates, game news).
- **phone-dark-deals:** edition titles truncate exactly where the edition name is ("Need for Speed Heat Delu…"). Allow 2 lines (`-webkit-line-clamp: 2`) under 640px.
- **Dead Space Digital Deluxe:** uses Steam's grey "No Image Available" placeholder. Detect it and use Gemuzu's own fallback art.
- **Failed image requests:** desktop-dark-state-deals-under-15 makes 3 404 requests for art of app 785847. Use `appdetails.header_image` or skip `library_hero` for apps without one, so non-simulated captures make 0 failed requests.
- **Masthead art (desktop-dark-dashboard):** a faint hard top edge remains at y≈97. In the patch hero, the Deadlock emblem is cut in half at the bottom-right edge.
- **Patch value column at 1440:** the value sits about 350 px from the end of its sentence. Cap `.patch-row` at 960px, or move the column next to the text.
- **Metric tiles (dashboard, library):** "Total spent" has no caption while its neighbours do, so its value floats. Add "across 3 purchases".
- **Phone bottom nav:** the count badges overlap the Library and Wishlist icons by about 4 px.
- **Library state captures:** desktop-dark-state-library-table and library-playing record an LCP of 3244 ms. Check whether that's an audit artifact (boot overlay) or real.
- **Sort order:** "Best deals" puts Contractor (−100%, free) after several −88% rows. Either sort free games first or explain the sort.
