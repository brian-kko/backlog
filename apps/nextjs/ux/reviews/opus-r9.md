# Opus review: round 9

SCORE: 9.3/10 (no gate fails, so no cap)
Categories: 1 9.2 · 2 9.1 · 3 9.2 · 4 9.3 · 5 9.3 · 6 9.4 · 7 9.4 · 8 9.3

(Weighted: 1.38 + 1.82 + 1.38 + 0.93 + 0.93 + 0.94 + 0.94 + 0.93 = 9.25, which rounds to 9.3. Round 8 was 9.2 before its cap.)

Gates: honesty P · a11y P · layout P · stability P · states P · touch P
- **honesty P:**
  - The billboard reads "$25.54 at Fanatical · Steam $31.49 · save $5.95 (−19%)".
  - The game ledger now shows a saving only when `compareToSteam(...).kind === "cheaper"`, using `savingCents` (game-hub.tsx:158–172). A zero historical low goes through `price()`, so it reads "Free".
  - Elsewhere: "Bought from: Not set", "Steam (unconfirmed)", and Deadlock's "No store is listing a price".
  - Riot titles get no target controls (`canSetTarget = !riot && !free`, backlog-editor.tsx:45–47) and no Steam launch (`canLaunch`, collection.ts:20–25).
- **a11y P:**
  - axe: 0 serious or critical issues across 98 captures; 25/25 focus stops are visible.
  - Each Steam card in the deck is now a named `Link` inside `role="group"`. `:focus-visible` lifts the card and draws its ring; with reduced motion the ring shows without the lift (mastheads.css:268–292).
- **layout P:**
  - Missing-art rows now show one image glyph inside a 120×56 tile (96×45 on phone), with no text escaping. Checked in desktop, laptop, split, tablet, phone and light Deals, and in Under $15.
  - laptop-dark-dashboard: the description wraps at x≈585, and the leftmost card starts at x≈660.
  - No horizontal overflow and no clipped text.
- **stability P:**
  - 0 non-simulated console errors or failed requests.
  - Worst CLS is 0.068 (laptop-dark-deals), down from 0.091.
  - Watch item: desktop-dark-deals has an LCP of **5,872 ms**, while every other Deals capture is 440–504 ms. It is probably the cold first capture, but confirm that it doesn't come from the billboard's `priority` hero.
- **states P:**
  - Illustrated empty states exist for Library, Wishlist, Updates and Deals no-results, each with a next step.
  - Offline Deals offers "Open wishlist / Open library".
  - The outage game page resolves to retry cards.
- **touch P:** 0 phone targets under 44 px. The preset chips scroll, with an end fade.

## Previous blocking fixes: resolved / partial / not

| Fix | Status | Round-9 evidence |
|---|---|---|
| **Opus r8-1**: placeholder text overflows deal rows | **Resolved** | Dead Space and LEGO show a centred glyph tile at every width (phone-dark-deals y≈1640/1780, split y≈1430/1565, desktop y≈1220/1300). |
| **Opus r8-2**: the 1024 deck covers Home's description | **Resolved** | laptop-dark-dashboard: the 2-line description ends at x≈585, and the hand starts at x≈660. |
| **Opus r8-3**: the deck repeats; dead band in the masthead | **Deferred (owner decision)** | Home and Updates still show the same 5-card hand in the same order (desktop-dark-dashboard vs desktop-dark-updates). Library 1440 still has a 100 px band (description y≈245 → "Showing sample games" y≈345). Not scored against, per the owner's decision. The execution defects are in fixes 2 and 3. |
| **Opus r8-4**: the default Deals list can't answer "beats Steam?" | **Partial** | The stat copy is fixed ("1 deal beats Steam", "No Steam prices to compare").<br>But "comparable first" is only a `.sort` *within* the matched group (deal-cards.tsx:240–244), over one 24-offer batch (deals/page.tsx:220–233). The default view is still 1 of 20 comparable, and Under $15 is 0 of 20.<br>"Other editions: …" still heads the list when nothing sits above it (desktop-dark-state-deals-under-15 y≈609). |
| **astra r8-1**: missing-art thumbnails | **Resolved** | As Opus r8-1. Row heights are unchanged. |
| **astra r8-2**: cents-safe ledger; zero low reads "Free" | **Resolved (source)** | game-hub.tsx:158–172 and 455–459. The captures don't exercise the boundary. |
| **astra r8-3**: Riot editor, Wishlist and launcher | **Resolved (source)** | `canLaunch` excludes Riot. The editor's `canSetTarget` and Wishlist's Riot branch (wishlist/page.tsx:370–381) skip price watching. No Riot capture this round. |
| **astra r8-4**: keyboard and screen-reader deck | **Resolved** | game-ui.tsx:934–944 and mastheads.css:268–292.<br>Caveat: on Deals every card is offer art, so the cards are `<span aria-hidden>`, and the deck is an **empty** named group ("Deals games"). That's in fix 2. |
| **astra r8-5**: instant colour; drift ≤ 260 ms | **Resolved** | `transition-colors` is gone from nav, back link, pills, tabs and the spotlight. The drift is 250 ms (mastheads.css:121).<br>One leftover: styles.css:476 (`.game-card`) still has `transition-colors`. |
| **Gemini 1**: row overflow | **Resolved** | As above. |
| **Gemini 2**: phone chip clipped with no hint | **Resolved** | phone-dark-deals: "Activates on" fades at the right edge, and the row scrolls. |
| **Gemini 3**: ungrammatical stat | **Resolved** | "1 deal beats Steam". |
| **Gemini 4**: 840 Library void | **Resolved** | split-dark-library shows a 3-card compact deck at 110×165. |
| **Gemini 5**: free-row alignment; Library meta | **Resolved** | The Contractor "Free" right edge sits at x≈1013, like its neighbours. "Get free ↗" and "Buy ↗" share 104 px. Library reads "Steam (unconfirmed) · Paid $29.99". |
| r8 nits | **Mostly open** | **Still open:**<br>- "Steam(unconfirmed)" with no space in the desktop select (zoomed desktop-dark-game-owned x 770, y 946; phone renders the space);<br>- the "Patch notes 0" badge;<br>- the patch hero shows "7.2.2" twice;<br>- nav badges overlap their icons on phone;<br>- Home's eyebrow "2 games on your wishlist" repeats the counts line;<br>- the Wishlist outage card repeats itself;<br>- phone Home metrics stack;<br>- LEGO's quiet "Track ▾" breaks the action column. |

## What improved
- **Deals is finally clean at every width.** Glyph tiles, aligned price and action columns, an honest stat line, and phone chips that read as scrollable.
- **The deck is now a real control.** It's keyboard-reachable with the same ring and lift as hover, and it stays still under reduced motion. At 768–1023 the compact hand makes the 840 mastheads feel designed rather than emptied.
- **The new empty-state line art fits the brand.** The card shelf, price tag with reticle, broadcast mast and row-scanner lens are drawn in the theme tokens, `aria-hidden`, and capped at 4 cycles. This is the first time the empty states feel as designed as the happy path.
- **Library meta now puts the launcher first.** "Steam (unconfirmed) · Paid $29.99" no longer reads as an unconfirmed price.

## BLOCKING FIXES

### 1. Deals still leads with offers that can't answer "does it beat Steam?" (r8-4 partial)
**Captures:**
- desktop-dark-deals: 1 billboard, then 19 rows under "Other editions: no live Steam price to compare" (y≈838).
- desktop-dark-state-deals-under-15: 0 of 20 comparable, and the divider still says "Other editions" with nothing above it (y≈609).
- The "Sort: Best deals" list is CheapShark's order, so the −100% free row sits between −88% and −85%.

**Cause:**
- The round-9 change sorts only the already-matched groups (deal-cards.tsx:240–244).
- The page ranks one 24-offer batch (`pageSize: filters.pageSize`, deals/page.tsx:220–233), so there are rarely any comparable offers to promote.

**Fix:** cheap now; ITAD edition matching, the owner's next feature 1, is the real cure.
- **Rank a wider batch.**
  - In the default view (no query, no store filter, sort "deals"), request the first batch at `pageSize: 60`.
  - Order the groups as: live-Steam-comparable by `savingCents` desc → other offers with `steamAppId` → the rest. Then slice to the "Show" count.
  - Steam prices are already fetched for up to 60 ids (page.tsx:289–299).
- **Point to the comparable view when there's too little to compare.**
  - If fewer than 3 matched groups render, insert one row above the divider: "Only 1 of these 20 has a Steam price to compare. **Show deals that activate on Steam (N) →**". It sets `steamOnly`; N comes from the loaded batch where `steamRedeemable`.
  - Hide that row when `filters.steamOnly` is already on.
- **Divider copy** (deal-cards.tsx:276): when `!featured && matched.length === 0`, read "No live Steam price to compare for these editions". Keep "Other editions: …" only when something sits above.
- **Action column:**
  - In compact rows, give `TrackToggle`'s trigger `action secondary deal-find` styling with a min-width of 112 px, so LEGO's "Track ▾" matches "Find on Steam".
  - The row has a Steam app but no Steam price, so say so in its store line: "Epic Games Store · Steam price unavailable".
- **Test:**
  - With a fixture batch of 60 offers containing ≥ 3 comparable offers, the 1440 default view shows ≥ 3 Steam-compared cards above the divider.
  - Under $15 never renders "Other editions" without a group above it.

### 2. The Deals deck shows cropped logos and is an empty, inert group
**Captures:**
- desktop-dark-deals and laptop-dark-deals: the hand shows "DELU", "BA" and "DIGIT" slivers of landscape store banners cropped into 2:3 cards.
- split-dark-deals and tablet-dark-deals: the **front** card reads "OGWAR / LEGACY", a landscape banner with both ends cut off (zoomed split x 620–840, y 120–320).
- The billboard game (Pro Basketball Manager 2027), the one row that beats Steam, isn't in the hand.

**Problems:**
- On Deals none of the cards are links (`<span aria-hidden>`), while on every other page they are.
- The `role="group" aria-label="Deals games"` wrapper therefore announces a group with nothing in it.

**Fix** (deals/page.tsx:339–347, game-ui.tsx:860–950):
- **Build the Deals hand in priority order:** featured → matched → other groups with a `steamAppId` (portrait `coverArt`). Use offer art only after those.
- **Reject landscape offer art.** In the existing `onLoad`/ref checks, treat `card.steamAppId == null && image.naturalWidth > image.naturalHeight * 0.9` like `tooSmall`.
- **Render no deck when fewer than 3 cards survive.** The masthead then collapses (see fix 3).
- **Only add `role="group"`** when at least one card is a link.
- **Result:** the hand becomes the games you can actually compare, and every card opens the game page.

### 3. The masthead reserves deck space when there's no deck
**Captures, and the gap from the end of the description to the first control:**
- desktop-dark-state-empty-library: y≈255 → 350 (95 px);
- desktop-dark-state-empty-wishlist: 271 → 349;
- desktop-dark-state-empty-dashboard: 280 → 376;
- desktop-dark-state-empty-updates: 280 → 349;
- desktop-dark-state-deals-no-results: 255 → 349;
- desktop-dark-state-offline-deals: 310 → 406.

In every one of these the right 392 px of the masthead is empty.

**Cause:** mastheads.css:75–112 applies `min-height: 216px` and `padding-right: 304px` (392 px at ≥ 1200) to **every** `.page-heading`, not just `.has-deck`.

**Fix:**
- Move `min-height` and the right padding into `.page-heading.has-deck` at ≥ 1024 and ≥ 1200.
- Plain headings get `padding: 24px 0 8px`, with `.page-heading-content { max-width: 720px }`.
- **Target:** at most 40 px from the description to the first control when there's no deck.
- **Audit:** at 1440, when `.cover-deck` is absent, assert that `.page-heading` height ≤ title block height + 48 px.

### 4. Outage states say the same thing several times
**Capture desktop-dark-state-outage-wishlist** (per card):
- "Couldn't check · Try checking again in a moment"
- "Your target is saved; try checking again"
- "History unavailable"
- "Price track unavailable"
- "Store unavailable" (a disabled pseudo-button)
- the page line "Couldn't check prices for 2 games. Your targets are saved."

That's six messages for one fact.

**Fix** (wishlist/page.tsx, price-ui.tsx): when `prices` errored, the card body becomes:
- the big price slot "—";
- one line: "Prices didn't load · your $25.00 target is saved";
- "Your target $25.00 · Edit target";
- the "I own this" button full width.

Drop the history column, the track, the "Store unavailable" box and the second "try again". The page-level "Check prices now" stays as the single retry.

**Capture desktop-dark-state-outage-game:**
- There are three separate retries: the hero "Steam details didn't load. Try again", the price card "Try again · Steam store page ↗", and the news card "Try again".
- "Steam store page" appears twice.
- The left column is empty from y≈657 to y≈1140.

**Fix** (game-hub.tsx):
- When ≥ 2 of `getGameDetails`, `getGamePrices` and `getSteamFeed` fail, show **one** banner under the hero: "Steam isn't responding. Prices, details and news will load when it does." It has one "Try again" that refetches all three.
- The price card keeps "Couldn't check store prices" with no link.
- On ≥ 1024, move the patch-notes section into the left column under the price card (`grid-row: span 2` on the editor), so the 480 px void closes.

### 5. Empty-state animations end with a visible snap; empty Home got no art
**Source** (art.css:18–96): every loop uses `animation-direction: alternate` with `animation-iteration-count: 4`, so the 4th (reversed) pass ends on the `from` keyframe. With no `fill-mode`, each element then jumps to its base pose:
- `ea-swing` jumps from −4° to 0°;
- `ea-sweep` jumps from −6 px to 0;
- `ea-pulse` jumps from scale 0.94 / opacity 0.6 to 1;
- `ea-signal` and `ea-glow` jump from opacity 0.35 or 0.5 to 1.

The snap lands 9.6–14.4 s after load, the moment the art is meant to "rest". It's the kind of hitch the rubric's "motion is purposeful" bar exists for.

**Fix:**
- Write each loop so the rest pose is both ends, and run it one way, 3 times:
  - `@keyframes ea-swing { 0%,100% { transform: none } 25% { transform: rotate(-4deg) } 75% { transform: rotate(4deg) } }`
  - `ea-sweep` uses ±6 px the same way.
  - `ea-pulse`, `ea-signal` and `ea-glow` use `0%,100% { opacity: 1; transform: none } 50% { … }`.
- Remove `alternate`. Keep `ea-bob` as is; it already rests correctly.

**Home** (desktop-dark-state-empty-dashboard):
- It's the first screen after "Clear sample games". It is the only empty page with no illustration: three text-only panels, with "0" for Price alerts beside "—" for the other two.
- Fix: put the Library card-shelf art above Play next's empty copy at 160 px wide, and show "—" with "Set a target on a wishlist game" under Price alerts.

### 6. Copy and alignment leftovers a demanding user notices
- **Deals stat line in non-data states.**
  - Offline (desktop-dark-state-offline-deals y≈197) and no-results (desktop-dark-state-deals-no-results y≈140) both claim "No Steam prices to compare", which is a statement about data that never loaded.
  - In the deals/page.tsx `stat`, render `null` when `offline || deals.isError || groups.length === 0`.
- **Wishlist price row.**
  - "at GameBillet · 9 stores compared" sits on the first line of a 40 px slot, about 10 px above the centre of the $32.99 price (desktop-dark-wishlist y≈566 vs the price's centre at ≈576; the same on every card at every width).
  - Set `.watch-card .watch-source { display: flex; align-items: center; }` (wishlist.css:68).
- **"Steam(unconfirmed)"** has no space in the desktop select (desktop-dark-game-owned x≈772, y≈946; phone is fine).
  - In backlog-editor.tsx:233–236, render one string: `` {`${platformNames[defaultPlatform(item.purchaseStore, steamAppId)]} (unconfirmed)`} ``.
  - Passing `steamAppId` also matches the Library meta.
- **Game page:** hide the tab count when it's 0. desktop-dark-game-owned shows "Patch notes 0" next to an empty-state card that already says so.
- **Phone nav badges** overlap their icons: the Library "|||\" glyph touches the "3", and the heart touches the "2" (phone tab bar, every capture). Offset the badge to `left: calc(50% + 10px)`.
- **Home eyebrow:** "2 games on your wishlist" repeats "2 on your wishlist" two lines below. Use a stat the counts don't carry, e.g. "Nothing at your price yet" or "1 patch in 30 days".

## KEEP
- **Honesty:**
  - "1 deal beats Steam" and the other three stat phrasings;
  - live-cents savings, "save $5.95 (−19%)", and the cents-safe ledger;
  - "Free" with "$3.99 −100%" and "Get free ↗";
  - Deadlock's "No store is listing a price";
  - "Bought from: Not set" and "(unconfirmed)";
  - "History unavailable"; targets kept through loading and outages.
- **Deals:**
  - the glyph placeholder tiles;
  - the 104 px shared row-action width;
  - the right-aligned Plex Mono price column;
  - the billboard with logo-free arena art;
  - the scrolling phone presets with the end fade;
  - "Reset filters"; URL filter state.
- **The deck:**
  - fixed hit areas;
  - the focus ring and lift on the card;
  - 260 ms transform-only motion;
  - still under reduced motion;
  - the compact 3–4-card hand at 768–1023;
  - the 1024 Home clearance;
  - Library's hand tucking under its toolbar.
- **Empty-state art:** the line style, theme tokens, `aria-hidden`, finite cycles, and none under reduced motion.
- **Motion:** instant colour on nav, tabs, pills and the back link; the 250 ms masthead drift; the ambient field paused when idle.
- **Everything else:**
  - the patch reader's glance bar and Note rows;
  - the Updates feed's "Fixed …" leads and bucket chips;
  - the Wishlist track legend;
  - Home's numbered 01/02 Play next;
  - the phone tab bar;
  - the boot behaviour;
  - Barlow Condensed with Plex Mono;
  - the olive/lime palette.

## Nitpicks (not blocking)
- The patch hero shows "7.2.2" and then "Devoid of Liberty: 7.2.2". Drop the version from the subtitle when it matches the big number.
- The phone Updates game filter is still 3 rows of chips (phone-dark-updates y 279–417). Use a single scrolling row with the same end fade as Deals.
- Phone Home metrics stack into three 85 px rows. Use a 3-up row of 24 px numbers.
- Elden Ring's library card art crops the logo at the top edge (desktop-dark-library y≈456). Use `object-position: center 30%` for header art with the logo at the top.
- styles.css:476 still has `transition-colors` on `.game-card`.
- No-results copy wraps to leave "now." as an orphan at 1440. Add `text-wrap: balance` on `.empty-state p`.
