# Opus review: round 6

SCORE: 9.1/10
Categories: 1 9.1 · 2 8.8 · 3 9.1 · 4 9.1 · 5 8.9 · 6 9.3 · 7 9.4 · 8 9.3

(Weighted: 1.365 + 1.76 + 1.365 + 0.91 + 0.89 + 0.93 + 0.94 + 0.93 = 9.09, rounded to 9.1. Round 5 was 8.9.)

Gates: honesty P · a11y P · layout P · stability P · states P · touch P
- **honesty P:** "1 of 2 with a Steam price beat it" counts only games that have a live Steam price, and Under $15 says "No Steam prices to compare in these results". "save $5.95 (−19%)" is computed from live cents. In source, the free follow-up keeps the offer's own store and URL, and falls back to "Check availability" when the store is unknown (`game-ui.tsx` `FreePriceNotice`, `deal-cards.tsx` passes `offer`). The Wishlist says "History unavailable" when the history check fails, and the game page shows "Bought from: Not set".
- **a11y P:** 0 axe serious or critical issues across 98 captures, 25/25 keyboard stops show a visible focus ring, and heading structure passes. On touch viewports the back link's accessible name is still "←Back to Updates", with the arrow glyph read aloud (part of fix 3).
- **layout P (with a caveat):** no overflow at 390, 768, 840, 1024 or 1440, and the audit reports 0 clipped text. One defect gets past the audit: on phone-dark-deals the LEGO row title is cut mid-word, "LEGO Star Wars: The Skywalk", with no ellipsis (fix 4). It's a single row, and the full title is one tap away, so I'm passing the gate. It must not ship.
- **stability P:** 0 failed requests and 0 console errors outside the simulated outage and offline captures. The missing-art exemption is gone, and the worst CLS is 0.068 (desktop-dark-state-offline-wishlist). The art resolver achieves "no 404s" by returning a 96×64 olive plate, and that plate now shows up as visible blank art (fix 1).
- **states P:** loading, empty, offline, outage and error states are all present. The empty captures are now genuinely empty: Library 0 and Wishlist 0 in the nav, and no retained cards.
- **touch P:** 0 phone targets under 44 px.

## What improved

Round 6 fixed most of what I asked for in round 5:
- /deals edition rows are a real ledger at ≥ 960 px. Every price right-aligns to x=1017 at 1440 and x=713 at 1024. Laptop rows are one line, 81 px tall, and laptop-dark-deals dropped from 4116 px to 2939 px.
- The billboard price line reads "$25.54 at Fanatical", with Plex Mono for the price and Barlow for the store.
- Matched cards with Steam as the best price show one slab and the note "Steam has the best price".
- The deals denominator is honest.
- Wishlist cards say "at GameBillet · 9 stores compared". Offline, the page says "Reconnect to check prices" and the cards say "Checks when you're back online".
- Light patch heroes are readable: the hero is a dark surface in both themes.
- The hero title is deterministic (Cyberpunk shows its wordmark, Deadlock shows text), and the audit now checks it.
- Updates hides zero-count chips, puts chips and topics on one line, and 7.2.2 leads with "AMW-20 APEX: Decreased caliber from 60 to 20".

What keeps me under 9.5:
- The deals billboard, the most cinematic element in the app, now renders with no art at every viewport, and the deals masthead shows two blank cards.
- A single matched card stretches across the whole row or leaves half the row empty.
- The touch back-link fix never reached phones and tablets.
- Phone edition titles still truncate or clip.
- The Updates digest still leaks publisher prose and section headings for some patches.

## Round-5 blocking fixes: resolved / partial / not

| Fix | Status | Evidence |
|---|---|---|
| **Opus 1**: deals rows, column drift and the 1024 collapse | **Resolved** (nit left) | **desktop-dark-deals:** prices right-align at x=1017 and every row has two actions. LEGO shows "Buy ↗" and "Track ▾". The free row shows "Free" with "$3.99 −100%" underneath.<br>**laptop-dark-deals:** one-line rows at 81 px, and the page is 2939 px (target ≤ 3400).<br>Nit: Contractor's wider "Get free ↗" pushes its "Find on Steam" 36 px right of every other row's (x=1156 against x=1120). |
| **Opus 2**: billboard type, duplicated slabs, blank reserve, orphaned column | **Partial** | Done: the price line ("$25.54 at Fanatical"), the merged Steam slab, and removing the 40 px reserve.<br>Not done: the one remaining matched card (SULFUR) is stretched to 1168 px at 1440 and 976 px at 1024. At 840 and 768 it takes half the row and leaves a 404×490 px hole (fix 2). |
| **Opus 3**: game hero logo nondeterminism and back-link collision | **Partial** | The logo is evaluated after hydration, and the audit asserts the logo on Cyberpunk and none on Deadlock. Desktop, laptop and split have a 40 px gap (back link y≈93, eyebrow y≈147).<br>Phone and tablet still collide: about 8 px on phone-dark-game-owned (back link y≈128–137, eyebrow y≈145) and about 10 px on tablet. The arrow butts the word ("←Back") (fix 3). |
| **Opus 4**: wishlist local date and offline copy | **Resolved** | The card reads "at GameBillet · 9 stores compared" with no ISO date. Offline shows "Reconnect to check prices" (muted, not a button), "Checks when you're back online" and "Target $25.00 saved". Nit: the offline card now states the target twice ("Target $25.00 saved" sits 30 px above "Your target $25.00"). |
| **Opus 5**: zero chips, "other", prose leads, zero filter badges | **Partial** | Done: zero chips hidden, "changes" and "fixes" wording, chips and topics on one line, rail and filter show only "3 in 30 days".<br>7.2.2 is fixed. 7.2.1 still leads with "This hotfix aims to resolve one of the main crashes we have seen. Crash Fixes: … 🧠 Known Issues". 7.1.1 and 7.0.2 lead with the section heading "Crash Fixes:" (fix 5). |
| **Opus 6**: deals denominator | **Resolved** | desktop-dark-deals shows "1 of 2 with a Steam price beat it". Under $15 shows "No Steam prices to compare in these results". The divider reads "Other editions: no live Steam price to compare". |
| **astra 1**: free follow-up store | **Resolved** (source) | `DealActions` passes `offer={{store,url,source}}`. `TargetPrompt` skips verification when the source is known. `FreePriceNotice` only says "Get it free at {store}" with a real store and a URL, otherwise "Check availability". |
| **astra 2**: light patch hero contrast | **Resolved** | desktop-light-patch-deadlock: the hero is a dark #121411 surface with #f2f4eb title and metadata in both themes. |
| **astra 3**: art 404s, missing-art exemption, empty fixtures | **Resolved, with a regression** | 0 non-simulated failed requests. desktop-dark-state-empty-wishlist and empty-updates are truly empty.<br>Regression: the inline fallback plate is now visible as blank art (fix 1). |
| **astra 4**: digest from the full notes | **Partial** | It's server-side now (`steam-discovery.ts` `digestNews(cleanSteamText(item.contents), …, patch)`), and 7.2.2, the Deadlock posts and Elden Ring 1.17 lead with concrete changes. 7.2.1 falls back to prose because of a regex false positive (fix 5). |
| **astra 5**: wishlist offline and source line | **Resolved** | See Opus 4. Phone cards are about 405 px tall and buttons are 44 px. |

## BLOCKING FIXES

### 1. Steam art for newer games falls back to a blank olive plate: the deals billboard and masthead look broken
**Captures:** desktop-dark-deals, laptop-dark-deals, split-dark-deals, tablet-dark-deals, desktop-light-deals, phone-dark-deals, desktop-dark-state-deals-under-15

**Evidence:**
- **Billboard (desktop-dark-deals, y 590–870).** "Pro Basketball Manager 2027" has no artwork. The right 60% of the 1168×280 billboard (x≈650–1300) is a flat ink gradient with an upscaled pixel staircase at the bottom right. That staircase is the 96×64 `fallbackPng` from `api/art/[appId]/[kind]/route.ts`, stretched to the full card. The same happens at 1024, 840 and 768.
- **Phone.** The featured card's thumbnail is a dark 96×56 smear.
- **Deals masthead.** Two of the three collage covers are blank rounded olive cards (desktop-dark-deals x≈1110–1280, y≈145–275). In desktop-light-deals they're glaring near-black tiles on paper. Under $15 shows only the plate.
- **Root cause, verified live.** App 4411720 returns 404 for both `…/apps/4411720/library_hero.jpg` and `…/header.jpg`. Steam now serves newer apps' art from hashed paths, and appdetails gives `header_image = …/apps/4411720/3ea944e5…/header.jpg`. The resolver only tries unhashed paths.
- **Why the client can't recover.** The resolver always answers 200, so `MastheadHero`'s and the cover `<img>`'s `onError → hidden` never fire. The headline game on the flagship page is shown artless, as if it were broken.

**Fix:**
- **Resolve hashed art** (`apps/nextjs/src/app/api/art/[appId]/[kind]/route.ts`).
  - When every unhashed asset fails, fetch `https://store.steampowered.com/api/appdetails?appids={id}&filters=basic`.
  - Try `header_image` for `header` and `hero`, and `capsule_imagev5` → `header_image` for `capsule`.
  - Accept only `https://shared.akamai.steamstatic.com/` or `https://cdn.akamai.steamstatic.com/` URLs, with `redirect: "error"` kept.
  - Cache the resolved URL with the same 24 h TTL.
- **Make the plate detectable.** Keep the plate, but add an `X-Gemuzu-Art: fallback` header and keep its intrinsic size at exactly 96×64. Export `isFallbackArt = (img: HTMLImageElement) => img.naturalWidth === 96 && img.naturalHeight === 64` from `components/game-ui.tsx`.
- **Handle the plate in the client:**
  - `CoverMosaic` covers and `MastheadHero`: `onLoad` → if `isFallbackArt`, set `visibility:hidden`, as their `onError` already does. A masthead with 1 real cover beats 2 blank cards.
  - Billboard (`deal-cards.tsx` around line 303): `onLoad` → if `isFallbackArt`, switch `src` to `deal.thumb` (the ITAD banner the row art already uses). If that's empty too, add `.deal-featured.no-art`, which hides `.deal-art` and lets the eyebrow, title and price use the full width.
- **Audit:** on desktop-dark-deals and laptop-dark-deals, assert `.deal-featured .game-art.naturalWidth >= 460`, and that no visible `.cover-mosaic img` has `naturalWidth === 96`.

### 2. A single matched card is either stretched across the row or leaves half of it empty
**Captures:** desktop-dark-deals, laptop-dark-deals, desktop-light-deals, split-dark-deals, tablet-dark-deals

**Evidence:**
- **At 1440 (desktop-dark-deals y 891–1201) and at 1024:** `.deal-grid-pair > .deal-card:only-child { grid-column: 1 / -1 }` (deals.css around line 336) stretches SULFUR to 1168 px.
  - The "Best · Steam $28.78" slab is 894 px wide, so the price sits 750 px from its label.
  - "Buy at Steam ↗" is a 894×40 full-width bar.
  - Under the 240×112 art there's a 240×190 dead area.
  - The card is 310 px tall to say one price.
- **At 840 and 768 (split-dark-deals y 797–1287, tablet-dark-deals):** the pair layout only starts at 1024, so the card sits in a 2-column grid at 388 px wide, next to a 404×490 px empty hole. This is the mid-width cramping the owner treats as blocking.

**Fix** (`apps/nextjs/src/app/styles/deals.css`):
- **Start the pair layout at `(width >= 768px)`**, not 1024.
- **A lone card becomes a three-column strip.**
  - `.deal-grid-pair > .deal-card:only-child { display:grid; grid-template-columns: 240px minmax(0,1fr) 300px; align-items:center; }`
  - The art is 240×135.
  - The middle column holds the title, the store, "Steam has the best price" and "$49.98 −42%".
  - The right column holds the slab (`$28.78`), then `.deal-actions { flex-direction: row }` with auto-width "Buy at Steam ↗" and "Track ▾".
- **Targets:** card height ≤ 160 px and no element wider than 300 px in the ledger.
- **Narrower windows.** At 768–959 drop the right column below (`grid-template-columns: 200px minmax(0,1fr)`, with the ledger and actions spanning column 2).
- **Pairs.** Two cards keep `repeat(2, minmax(0,1fr))` from 768.

### 3. Touch back links still collide with the hero (phone and tablet) and lose the arrow gap
**Captures:** phone-dark-game-owned, phone-light-game-owned, tablet-dark-game-owned, phone-dark-patch-deadlock, phone-dark-state-outage-game

**Evidence:**
- **phone-dark-game-owned:** "←Back to Updates" ends at y≈137 and the "CYBERPUNK 2077" eyebrow starts at y≈145, an 8 px gap.
- **tablet-dark-game-owned:** about 10 px.
- **The arrow touches the word** ("←Back") on every phone and tablet back link, and the accessible name includes it.
- **Cause.** The coarse-pointer block in `apps/nextjs/src/app/styles.css` (lines 2174–2191) lists `.back-link` with `display:inline-block; padding-block:13px; margin-block:-13px`. That:
  - overrides `.hero-body .back-link { margin-block: 0 24px }` (around line 985);
  - removes the `inline-flex gap-1.5` between the arrow and the label.
- Desktop, laptop and split (fine pointer) are correct at 40 px.

**Fix:**
- Remove `.back-link` from that coarse-pointer list. `.back-link` is already `inline-flex`; raise `min-h-10` to `min-h-11` (44 px) in its base rule at line 259 instead.
- Add `aria-hidden="true"` to the arrow span in `components/back-link.tsx`.
- Target: a gap of ≥ 24 px between the back link and the eyebrow or H1 at 390 and 768, and the accessible name "Back to Updates".
- Extend the audit's back-link check to measure that gap on phone and tablet.

### 4. Phone edition rows: titles clipped or truncated at the edition name, and the price stranded under the art
**Captures:** phone-dark-deals, phone-light-deals, phone-dark-state-deals-under-15

**Evidence:**
- **Clipped LEGO title.** It's hard-clipped mid-word at the card edge, "LEGO Star Wars: The Skywalk", with no ellipsis (phone-dark-deals y≈2360). It's the only row whose title is a link, and the coarse rule `:is(h2, h3) > a { display:inline-block }` (styles.css line 2183) turns the link into a single box, so `text-overflow: ellipsis` on `.deal-title` can't apply.
- **Truncated edition names.** Every other row truncates exactly at the part that distinguishes it: "Need for Speed Heat Delu…", "Battlefield 2042 Elite Editi…", "Suicide Squad: Kill the Jus…". This was a round-5 nit and is still open.
- **Stranded price.** The price sits under the 120 px thumbnail (x≈48–110), leaving about 250 px empty to its right. Rows are about 193 px tall.

**Fix** (`apps/nextjs/src/app/styles/deals.css`, inside `@media (width < 640px)`):
- **Titles:**
  - `.deal-row .deal-title { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`
  - `.deal-row .deal-title > a { display: inline; }`. Inline padding still gives a 44 px hit area, as `p .text-link` does.
- **Price beside the title:**
  - `.deal-results .deal-row { grid-template-columns: 96px minmax(0,1fr) auto; }` with the art at 96×45.
  - `.deal-row-price { grid-column: 3; grid-row: 1; display: block; }`.
  - Actions span `1 / -1` on row 2.
- **Targets:** row height ≤ 150 px, and phone-dark-deals ≤ 4400 px (it's 5113 now).

### 5. Updates digest still leaks prose and section headings, and the patch reader counts "🧠 Known Issues" as a change
**Captures:** desktop-dark-updates, laptop-dark-updates, phone-dark-updates, desktop-light-updates, desktop-dark-patch-helldivers

**Evidence:**
- **7.2.1 leads with prose and headings:** "This hotfix aims to resolve one of the main crashes we have seen. Crash Fixes: Fixed a crash that would occur when another player joined or left the squad. 🧠 Known Issues".
  - **Cause:** `plannedChange` in `packages/validators/src/news-digest.ts` matches `\bwould\b`, so the real past-tense change "Fixed a crash that would occur…" is rejected. The code then falls back to the publisher excerpt.
- **A section heading is used as the subject.** 7.1.1 and 7.0.2 lead with "Crash Fixes: Fixed …", and "Crash Fixes" repeats the topic shown 30 px above.
- **"🧠 Known Issues" is parsed as a "↻ Change" row** under Misc in desktop-dark-patch-helldivers, which inflates "2 other changes".
- **A dangling separator on phone.** In phone-dark-updates (7.2.2), the topics wrap onto a new line that starts with a dangling "·".

**Fix:**
- **`news-digest.ts`:**
  - Accept a candidate when it starts with a past-tense change verb, before testing `plannedChange`: `if (/^(?:fixed|added|increased|decreased|reduced|removed|adjusted|improved|resolved|corrected|rebalanced)\b/i.test(sentence)) accept`.
  - Drop the subject prefix when the subject matches `/^(?:(?:crash|bug)\s+)?fix(?:es)?$|^known issues$|^misc(?:ellaneous)?$|^general$/i`.
- **`packages/validators/src/patch-notes.ts`:** treat a line matching `/^\W*known issues\b/i` as a section heading. Its bullets aren't changes, so exclude them from `summarizePatch` counts.
- **Tests** in `packages/validators/src/__tests__/`:
  - the 7.2.1 body must give "Fixed a crash that would occur when another player joined or left the squad.";
  - "Crash Fixes" must not be used as a subject;
  - Known Issues lines must not be counted.
- **Phone separator** (`apps/nextjs/src/app/styles/updates.css`): under 640 px, render the topics on their own line without the leading "·" separator.

## KEEP (must not regress)
- **Deals:**
  - the subgrid ledger (one price x, one action x, 81 px rows at 1024 and 1440);
  - "Buy ↗", "Get free ↗" and "Check price ↗" with full aria-labels;
  - exactly two actions per row;
  - "Free" with "$3.99 −100%";
  - "1 of 2 with a Steam price beat it" and "No Steam prices to compare in these results";
  - "$25.54 at Fanatical" with "save $5.95 (−19%)";
  - one slab plus "Steam has the best price";
  - URL filter state, "Under $15" correctness and "Reset filters".
- **Honesty:** the free follow-up keeps the offer's store, URL and source, with "Check availability" as the fallback; savings compared in cents; "History unavailable"; "Bought from: Not set"; "(unconfirmed)" launcher.
- **Wishlist:**
  - "at {store} · N stores compared";
  - "Reconnect to check prices" and "Checks when you're back online";
  - saved targets visible while loading;
  - cards ≤ 440 px on phone;
  - the 21–22 ms save acknowledgement.
- **Heroes:** the deterministic logo choice and its audit assertion; the reserved logo slot (CLS 0 on game pages); the 40 px back-link gap on fine pointers; dark patch heroes in both themes.
- **Updates:**
  - the server-side digest, so the full notes never reach the client;
  - no zero chips, with "fixes" and "changes" wording;
  - chips and topics on one line from 640 px;
  - rail and filter counts only above 0;
  - "AMW-20 APEX: …"-style subject leads.
- **Stability:** 0 non-simulated failed requests and no missing-art exemption; truly empty empty-state fixtures.
- **Unchanged from round 5:**
  - Barlow Condensed and Plex Mono, asserted by the audit;
  - the olive and lime palette;
  - Home's Play next spotlight with the numbered 01/02 queue;
  - masthead ghost words;
  - the patch reader's glance bar and value column;
  - the phone bottom nav;
  - boot behaviour;
  - transform/opacity-only motion that rests when idle.

## Nitpicks (not blocking)
- **desktop-dark-deals:** the "Find on Steam" column isn't one x on the Contractor row. Give `.deal-row .deal-buy` a `min-width: 112px`.
- **Offline wishlist (phone):** the offline fact is said 4 times (banner, summary, "Reconnect to check prices", card). The card also repeats the target ("Target $25.00 saved" above "Your target $25.00"). Replace the card line with nothing, or with "Prices unavailable".
- **The game page's Plays-on select** still renders "Steam(unconfirmed)" with no visible space (desktop-dark-game-owned y≈942), even though the source string has one. Check whether the select font is collapsing the space.
- **"Read on Steam↗"** still has no visible gap before the arrow on desktop and laptop Updates and on game news.
- **"← Back to game"** after game-to-game navigation should name the game.
- **Leftovers from round 5:**
  - Home eyebrow "2 games on your wishlist" duplicates the stat row;
  - Wishlist "0 of 2 at your price" duplicates "Nothing has hit your targets yet.";
  - "Total spent" has no caption;
  - the phone nav badges overlap their icons by about 4 px;
  - Dead Space still uses Steam's grey "No Image Available" placeholder (detect it like the fallback plate in fix 1).
- **Steam logo inset:** Steam's padded wordmark leaves the Cyberpunk logo about 30 px right of the content edge (x≈165 against 136 on desktop). Consider `object-position: left` with a −8% `margin-left`, or trim the transparent padding when evaluating.
- **desktop-dark-state-add-game-dialog:** the six result thumbnails are empty grey slots at capture time (phone shows them). Check that the dialog images aren't lazy-loaded behind the modal.
- **Updates tab badge:** "Patch notes 3" sits above 6 listed posts. The aria-label says "in 30 days", but sighted users don't get that qualifier.
