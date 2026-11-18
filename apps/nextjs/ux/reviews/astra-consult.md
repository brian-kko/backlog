**Keep the full fan on Home.** Give each card a reason to be in the player’s hand. On Deals, show how many prices Gemuzu can actually compare with Steam. On Library, show where the player’s money sits across backlog states. On Wishlist, put the nearest buying decision in plain dollars. On Updates, show which games actually received patches.

| Page | Recommended masthead | The question it answers |
|---|---|---|
| Home | **Opening Hand** | Which of my games deserves attention, and why? |
| Deals | **Steam Match Board** | How much of this result set can I compare with Steam? |
| Library | **Backlog Ledger** | How much have I paid for games in each stage of my backlog? |
| Wishlist | **Target Sight** | Has anything reached my price? If not, what’s closest? |
| Updates | **Patch Calendar** | Which of my games changed in the last 30 days, and when? |

The strongest argument for keeping the fan on Library is the light-theme capture. The covers tucked behind the toolbar make a digital collection feel tangible. But the same three covers appear immediately below, in the same order. Home can put that interaction to better use by dealing across three otherwise separate sections. Deals already has a cinematic billboard, while Updates shows five masthead covers even though all three recent patches belong to Helldivers 2. Those are good places to give the space back to information. This follows the cross-store, personal-target, spending, and digest tests in section 0. [Product plan](/tmp/claude-1000/-home-brian-projects-backlog/9e515e27-0ffa-4a55-977b-022ecce751e6/scratchpad/council/consult/PLAN.md) · [Library on paper](/tmp/claude-1000/-home-brian-projects-backlog/9e515e27-0ffa-4a55-977b-022ecce751e6/scratchpad/council/consult/shots/desktop-light-library.png) · [Updates capture](/tmp/claude-1000/-home-brian-projects-backlog/9e515e27-0ffa-4a55-977b-022ecce751e6/scratchpad/council/consult/shots/desktop-dark-updates.png)

## Design rules for all ten concepts

- **Layout.** At 1440px, give the title and the instrument separate grid columns. At 1024px, reserve space for the instrument’s *transformed* bounds, including the spread of the hand. If the two columns cannot fit, use the 840px treatment. Let the first control start within 32px of the masthead content. This fixes the Home collision without bringing the tall desktop header to phones. [1024px Home capture](/tmp/claude-1000/-home-brian-projects-backlog/9e515e27-0ffa-4a55-977b-022ecce751e6/scratchpad/council/consult/shots/laptop-dark-dashboard.png)
- **Visual language.** Keep Barlow Condensed for page titles, Barlow for reasons and actions, and IBM Plex Mono for money. Carry the existing card radius and fine edge across all five. Use `#121411` and `#f4f3ed` for surfaces and ink, with `#c8ed78` on dark or `#426619` on paper for the active mark. Give every mark a label, shape, or pattern that survives without color.
- **Input and motion.** Use native links or buttons with fixed, non-overlapping hit areas of at least 44×44px. Expose linked covers in a named group in visual order, with title, reason, destination, and a visible focus ring. Decorative artwork has empty alt text. All proposed transitions use transform or opacity, run once per interaction, and become immediate under reduced motion. No ambient motion, filters, blur, or WebGL.
- **Data.** Mark sample-derived selections **Sample**, including in a mixed guest collection. Use current, same-currency, same-edition prices for Steam comparisons and compute differences in displayed minor units. A tie reads **Same price**. A saved quote carries its check date when available. Partial results say what was checked. Loading and failed checks never count as zero. The wireframes use R8 capture values where available, `{fields}` for runtime data, and schematic marks for graphics.

## Home

### 1. Opening Hand · Recommended

Deal up to three covers, one for a buying opportunity, one for a recent patch to an owned game, and one for a game marked Playing.

The new information is the **shortlist across activities**. Price watch, Play next, and What changed each rank their own content. The hand makes a selection across all three and explains it. Pick a verified target hit, then the newest dated owned-game patch, then a Playing game. Give a game only one card. If it qualifies twice, combine the reasons on that card. Never infer a play session from Playing status.

```text
 HOME                           ___      ____      ______
                                / /|    /   /|    |      |
 {front game}                  / / |   /   / |    | real |
 {reason for this card}       /_/  |  /___/  |    | cover|
                                                  |______|
 [Open {destination} >]                    {front reason}

 --------------------------------------------------------
 Price watch                           Play next
```

**Layout and interaction.** At 840px, use a shallow three-card hand beside a two-line caption. At 390px, show one small cover and up to three labeled reason links below the title. Hover or focus spreads the hand over 220ms and lifts the active cover 6px. Its caption names the game and reason. Each link opens the relevant wishlist entry, patch, or owned game. Touch activates in one tap. Reduced motion keeps the ring and changes the caption immediately.

**States.** Empty collection gets the existing **Add game** action. A populated collection with no qualifying signal gets a compact collection summary. While checking, show known local Playing cards and a quiet “Checking prices” or “Loading patches” line. A failed source leaves the other cards usable and names the unavailable source once.

**Effort M. Risk:** A refresh could move the card under the pointer. Keep the current order while the hand contains focus or hover, and use a stable title tie-break.

### 2. Quest Log

Use a two-entry objective list to connect games already paid for with recent changes to games the player is playing.

The first entry joins **Unplayed + recorded paid amount** and names the largest known purchase in that group. The second joins **Playing + dated official patch** and names the most recently patched Playing game. Home’s aggregate spending tile and general news list leave both of those connections for the player to make.

```text
 HOME                         QUEST LOG
                              <> Already paid for
 {known paid amount}             {unplayed game}       >
 in unplayed games
                              <> Changed while Playing
                                 {game} / {patch date} >

 --------------------------------------------------------
 Price watch                           Play next
```

**Layout and interaction.** At 840px, keep two compact objective rows in the right column. At 390px, show the first eligible objective as a full-width link and a plain-text link for the second. A hollow quest diamond moves 3px toward the focused or hovered row over 120ms. Reduced motion uses a static filled diamond. Each row opens its game or patch.

**States.** No eligible objective collapses the list. With no recorded amounts, offer **Record a purchase price** only if there is an owned game to edit. While news loads, the purchase objective works independently. On news failure, show “Patch check unavailable” in the second row and preserve the first.

**Effort S. Risk:** Calling a paid game an objective can feel like homework. Use factual wording such as “Already paid for” and leave the choice to play entirely with the owner.

## Deals

### 1. Steam Match Board · Recommended

A compact scoreboard divides the current results into games that beat Steam, games that match or cost more, and games without a comparison.

The R8 page says “1 of 1 with a Steam price beat it” above a list of 20 games. The missing fact at a glance is **how representative that win is**. Count once per grouped game or comparable edition in the loaded, filtered results. Compare its best eligible offer with its matched Steam price. The billboard below already gives the winning title, both prices, and the store. [Deals capture](/tmp/claude-1000/-home-brian-projects-backlog/9e515e27-0ffa-4a55-977b-022ecce751e6/scratchpad/council/consult/shots/desktop-dark-deals.png)

```text
 DEALS                         STEAM MATCH BOARD
                               -------------------------
 1 of 20 games compared         1   Below Steam       >
 in these results               0   Same or higher
                               19   No comparison     >
                               -------------------------
                               Current results / USD
 --------------------------------------------------------
 [Search deals]                         [Stores] [Filters]
```

**Layout and interaction.** At 840px, keep the three counts in a narrow column alongside the heading. At 390px, use two lines above search, “1 of 20 compared” and “1 below Steam · 19 without a comparison.” A nonempty category links to its results, revealing the group if needed. A selector underline moves in 140ms. Reduced motion places it immediately. Keep the numbers still during refresh.

**States.** With no matches for a search, offer **Reset filters**. With results but no Steam matches, say “No Steam comparison for these {N} games” and keep the offers. During checks, reserve the count column and label it “Checking Steam prices.” On failure, show the affected source. If cached results exist, show a dated **Saved results** board with past-tense labels.

**Effort M. Risk:** Mixing offers, games, and loaded pages would make the denominator misleading. Use the same grouped IDs the result list renders and recompute after filters or Load more. Store discount percentages never enter this calculation.

### 2. Comparison Cards

Lay out up to three landscape price cards, ranked by the verified dollar saving against Steam.

The added value is **the ordering among comparable alternatives**. A player can see the runner-up without scanning the list. Each card names the edition, store, store price, Steam price, and difference. Keep the landscape proportion of store art. In the captured singleton case, use a single horizontal ticket and let it replace the billboard’s duplicate price ledger.

```text
 DEALS                       +--------------------------+
                             | Pro Basketball Mgr 2027  |
 Best verified savings       | Fanatical        $25.54  |
 in these results            | Steam            $31.49  |
                             | Save              $5.95  |
                             +--------------------------+
                             {next matched card, if any}
 --------------------------------------------------------
 [Search deals]                         [Stores] [Filters]
```

**Layout and interaction.** At 1440px, additional tickets step behind the first with exposed labeled ends. At 840px, show the first ticket and plain links to runners-up. At 390px, use one horizontal price ticket and a “View {N} compared games” link when applicable. Hover or focus lifts a ticket 4px over 160ms. Reduced motion uses the ring alone. Activating a ticket opens the corresponding result.

**States.** No results gives the filter reset. Verified comparisons with no saving give “No checked offer below Steam.” Unmatched results give “Steam prices unavailable for comparison.” Loading uses one still ticket outline. Failure offers retry or an explicitly dated saved comparison.

**Effort M. Risk:** Sparse matches often leave just one ticket. This is the main reason to choose the Match Board. It still earns its space when the comparison coverage is poor.

## Library

### 1. Backlog Ledger · Recommended

Use three horizontal HUD bars to show **recorded money by backlog status**, with game counts alongside.

The existing chips count games. Spending & progress shows total spend, spend by store, and the unplayed subtotal. This header answers the missing cross-question, **“Where is the rest of my recorded spend?”** Group owned entries by status, sum entered payments in the same currency, and keep the count of games with missing payments. The captured guest library makes a particularly readable first impression. [Library capture](/tmp/claude-1000/-home-brian-projects-backlog/9e515e27-0ffa-4a55-977b-022ecce751e6/scratchpad/council/consult/shots/desktop-dark-library.png)

```text
 LIBRARY                       RECORDED SPEND       SAMPLE
                               ---------------------------
 $129.97 recorded              Playing    =====     $29.99
 across 3 games                Unplayed   =======   $39.99
                               Completed  ========== $59.99
                               1 game in each status
                               ---------------------------
 [All] [Playing] [Unplayed] [Completed]     [Cards / Table]
```

**Layout and interaction.** Use a shared linear scale for the bars, aligned zeroes, and right-aligned money. At 840px, shorten the rails and retain the amounts. At 390px, put the amounts beneath the three existing status controls and let those controls serve as the legend. Selecting a row applies the existing status filter. Keep the ledger scoped to the whole library so the comparison survives selection. Move a selection bracket in 140ms. Reduced motion makes it immediate.

**States.** Empty library gets **Add a game**. If some payments are missing, show “{N} prices unrecorded.” If all are missing, show status counts and **Record a price**. An entered zero is a known payment. During load, show still rails without fills. On collection failure, offer retry or label an available local copy as saved.

**Effort S. Risk:** A large bar can look like an achievement. Use neutral ink for all amounts and lime only for the selected filter. Label the scale **Recorded spend**. Split currencies if necessary.

### 2. Status Hand

Deal one representative cover for each populated status, with the status and recorded purchase amount visible on its exposed edge.

Each card answers **which title accounts for the largest known purchase in that status**. The current grid and filter counts do not make that comparison. Select the highest entered payment within each status, break ties by title, and disclose the selection rule. If a status has no recorded payments, show its count and “Price unrecorded.”

```text
 LIBRARY                         _____   _____   _____
                                /    /  /    /  |     |
 Largest recorded purchase     /PLAY/  /NEXT/   | DONE|
 in each backlog status       /____/  /____/    |_____|
                              $29.99  $39.99    $59.99
                              Playing Unplayed Completed

 --------------------------------------------------------
 [All] [Playing] [Unplayed] [Completed]     [Cards / Table]
```

**Layout and interaction.** At 840px, use three upright mini-cards with full status labels. At 390px, use 44px status rows with a cover thumbnail, title, and amount. A cover lifts 5px over 180ms on focus or hover. Reduced motion leaves it still. Activation filters the Library to that status and brings the represented game into view.

**States.** Omit absent statuses from the hand. An empty collection gets the existing add action. Loading uses one static card back. On collection failure, show retry or dated saved data. Failed art becomes a framed title with the status label intact.

**Effort M. Risk:** In the three-game guest library this repeats every cover in the first grid row. This is the strongest alternative if Library must own the signature, but the Ledger makes better use of that first screen.

## Wishlist

### 1. Target Sight · Recommended

Pick one watched game and attach a sight marker to the exact distance between its checked offer and the user’s target.

The wishlist already has per-game price gauges. What it lacks is **the result of comparing those decisions across games**. If any checked offer meets its target, lead with **At your price** and the greatest amount under target. Otherwise select the smallest positive absolute gap. Break ties by title. A separate history alert may retain its own label in the list. The header’s selection depends only on the user’s target and a checked price.

```text
 WISHLIST                      CLOSEST TO YOUR TARGET
                               Helldivers 2       Sample
 $7.99 above your target       |------------------o
                               $25.00 target      $32.99
                               GameBillet / $7 below Steam
                               Checked {time}
                               [View watched game >]
 --------------------------------------------------------
 [Find in wishlist]                         [Best to buy]
```

**Layout and interaction.** Treat the connector as a labeled gap between two prices. Its length is schematic. At 840px, retain the title, gap, store, and Steam comparison and drop the connector. At 390px, put “Helldivers 2 · $7.99 above your $25 target” directly above the existing check-time line, with the offer and source beneath. After an explicit price check or target edit, crossfade the changed result over 160ms. Reduced motion swaps it immediately. The game link focuses its wishlist entry.

**States.** Empty list gets **Add a game**. Games with no targets get **Set a target**. During refresh, retain the previous quote labeled **Last checked {time}**. If only some check successfully, say “Closest of {N} checked targets.” On failure, show the saved target, label any saved offer, and offer **Check again**. Use “Steam price unavailable” when applicable.

**Effort S. Risk:** “Closest” can sound like a prediction. Use present-tense price differences. A met target becomes “At target” or “$X under target,” including after the user edits their target.

### 2. Price-Tag Hand

Deal up to three landscape cards so the exposed price tags form a short buying queue.

The difference from the current “Best to buy” list is visible **distance between the leading choices**. In the sample capture, Helldivers 2 is $7.99 over its target and Hades is $14.99 over. Showing both tags lets the owner compare their own thresholds directly. Rank checked hits first, then positive gaps ascending. Keep unpriced and untargeted entries out of that ranking. [Wishlist capture](/tmp/claude-1000/-home-brian-projects-backlog/9e515e27-0ffa-4a55-977b-022ecce751e6/scratchpad/council/consult/shots/desktop-dark-wishlist.png)

```text
 WISHLIST                       +----------------------+
                                | Hades                |
 Nearest to your prices         | $14.99 above target  |
                              +----------------------+-+
                              | Helldivers 2         |
                              |  $7.99 above target  |
                              | {offer/store/Steam}  |
                              +----------------------+
 [Find in wishlist]                         [Best to buy]
```

**Layout and interaction.** At 840px, use two flush tickets with exposed text. At 390px, render the two leading title-and-gap links as compact rows. Focus or hover lifts the selected card 4px in 160ms and reveals the checked offer, store, and Steam comparison. Every gap is readable at rest. Touch opens the entry directly. Reduced motion uses instant selection.

**States.** Empty list gets **Add a game**. No eligible target gets **Set a target**, or “No checked prices” if targets exist. Loading shows still ticket edges. A failed check leaves a dated saved ticket outside the live ordering. Partial failure names the number unchecked.

**Effort M. Risk:** Long game names and three exposed tags compete for width. Drop the third card before truncating the price qualification. The quieter Target Sight also gives Home clearer ownership of the fan.

## Updates

### 1. Patch Calendar · Recommended

Give each recently active game a row in a 30-day pixel calendar. One marked day means that at least one official patch was posted for that game.

This exposes **activity concentration**. In the capture, the player follows several games, but all three patches in the period are for Helldivers 2. The feed is chronological, so it takes several rows to discover that. Use official post IDs, dates, game IDs, and read state. Count multiple posts on one date separately in the text total. Use an outlined cell for a posted day and a filled center for a day containing unread posts.

```text
 UPDATES                        LAST 30 DAYS       Today
                                |----------------------|
 3 patches, all for             Helldivers 2
 Helldivers 2                   ..o....o..........o.....
                                Oct 22 / Oct 29 / Nov 12
                                [Open latest patch >]

 --------------------------------------------------------
 [Patch notes] [Events & announcements]       [All games]
```

**Layout and interaction.** At 1440px, show up to three active game rows, ordered by most recent post, with a remaining-game count. At 840px, use one leading row and the total. At 390px, use the sentence, latest date, and a single link before the feed. The day cells are static artwork. Each 44px game row applies the existing game filter, with dates and counts available as text. The selection marker moves in 120ms or changes immediately with reduced motion. Switching to Events uses official event posts and an **Events** label.

**States.** With no followed games, offer **Add a game**. After a successful quiet period, say “No official patches in the last 30 days” for the checked scope. During load, show “Loading patch dates.” On partial failure, show returned activity and “Loaded {N} of {M} checked feeds.” On total failure, use “Patch feed unavailable” and retry. Scope counts to the fetched games, including the current 24-game limit.

**Effort M. Risk:** Blank cells can imply an entire collection was checked. Render a row of blanks only for a successfully checked feed. An unavailable feed gets a text status. A screen reader should hear one sentence per game, never 30 cells.

### 2. Unread Patch Stack

Stack dated patch cards by game and lead with the game carrying the most unread official patches.

This answers **where the reading queue is concentrated**. Group unread post IDs by game within the selected period, tie-break by newest post, and expose the date and counted changes for the front patch. The existing unread dot and chronological feed do not give that ranking.

```text
 UPDATES                       +------------------------+
                               | {older unread patch}   |
 {N} unread patches          +------------------------+ |
 across {G} games            | {game} / {patch date}  |-+
                             | {official patch title} |
                             | {fixes} fixes          |
                             | [Read patch >]         |
                             +------------------------+
 [Patch notes] [Events & announcements]       [All games]
```

**Layout and interaction.** At 840px, show one dated card and the remaining count. At 390px, use one row with game, unread count, and **Read patch**. When read state changes successfully, the front edge recedes 4px and fades over 160ms. Reduced motion swaps cards immediately. Opening a post uses the app’s existing read semantics. Merely previewing the card leaves it unread.

**States.** No followed games gets **Add a game**. A successfully loaded queue with no unread posts gets “You’re caught up for this period” and a latest-post link if available. Loading shows a single still outline. Failed or partial feeds get an explicit scope message. Missing change counts are omitted. On Events, the card shows event title and date.

**Effort M. Risk:** Removing the active card could lose keyboard focus. When returning from a reader, restore focus to the next stable queue link or the queue heading. The Calendar is my choice because it stays informative after everything is read.

## Four micro-moments

| Moment | Trigger and design | Guardrail |
|---|---|---|
| **Target reached seal** | After a successful in-app check takes a previously checked offer from above target to at or below the *same* target, stamp a small notched card seal beside “{Game} reached your {target} at {store}.” One 140ms scale-in. | Require two comparable observations and an unchanged target. A first observation gets the ordinary **At target** label. A saved quote, target edit, or app reload cannot trigger the celebration. Announce it once, politely. |
| **Completion notch** | When a player marks an owned game Completed, fill one notch on the existing completion meter and show “{X} of {Y} owned games completed.” Update the accessible value with the saved status. | Use actual status counts. Reversing the status restores the previous value. No streaks or XP currency. If saving fails, restore the meter and keep the status control focused. |
| **Save icon on purchase edits** | After the purchase editor confirms persistence, show a small save glyph beside “Recorded {amount} paid at {store}.” For a guest, add “On this device.” The glyph appears for 140ms and the text stays readable. | Wait for the actual write. Preserve a real zero, distinguish an omitted amount, and keep the seller separate from an assumed launcher. An error leaves the form values available. |
| **Reader bookmark** | On return from a patch reader, put a paper bookmark notch beside the originating feed row and restore focus there. A 120ms opacity change is enough. | Trigger on an actual reader visit. Keep the existing read/unread state authoritative. If a filter removed the row, return focus to the feed heading. No automatic jump to another patch. |

All four use instant feedback under reduced motion. Only the first has an achievement treatment. That makes it feel earned when it appears.

## Four ready-to-paste Gemini art briefs

Generate the reusable furniture. Keep game covers, amounts, bars, calendar cells, focus rings, and labels in the application, where they can respond to real data and either theme.

**1. Opening Hand card back** — for a selected game with missing artwork.

```text
Create a reversible playing-card back for Gemuzu, a PC game collection app.
Use flat vector linework, with two nested card edges and a small offset
corner cut that suggests a thumb can lift the card. Palette: olive ink
#121411 and paper #f4f3ed; one corner mark in #c8ed78 on dark or #426619
on light. SVG, exactly 160 x 224 px, viewBox 0 0 160 224.
no text, logos, real games, characters
Keep the central 70 percent quiet for an HTML game title. Give the outer
silhouette a 12 px radius. The design must still read at 48 x 67 px.
Return two standalone SVG code blocks, dark then light, with transparent
outer corners, paths and basic shapes only, no filters or embedded images.
```

**2. Target reached seal** — for a confirmed target crossing.

```text
Draw a small achievement seal shaped like the clipped corner of a playing
card, with a single precise alignment notch. Flat, economical vector;
slightly asymmetric so it reads as a price tag at small size. Palette:
#121411 and #f4f3ed, with one accent #c8ed78 on dark or #426619 on light.
SVG, exactly 32 x 32 px, viewBox 0 0 32 32.
no text, logos, real games, characters
Center the mark within a 24 x 24 px area, with 4 px quiet space on every
side. Keep the silhouette recognizable at 16 px. All copy sits outside
the asset. Return two standalone SVG code blocks, dark then light,
transparent background, solid fills and strokes, no filters.
```

**3. Empty Library card tray** — for the existing first-game action.

```text
Illustrate one shallow empty card tray with a single blank divider seen
at a slight angle. Flat paper-and-ink line illustration, the same rounded
corners as playing cards. Palette: #121411 and #f4f3ed with one small
registration mark in #c8ed78 on dark or #426619 on light. SVG, exactly
320 x 144 px, viewBox 0 0 320 144.
no text, logos, real games, characters
Place the tray in the right 55 percent, low in the frame. Keep the left
45 percent completely quiet for nearby HTML copy and the Add game button.
Use a transparent background. Return two standalone SVG code blocks,
dark then light. Simple paths, no perspective grid, gradients or filters.
```

**4. Patch-reader bookmark** — for the return-to-feed moment.

```text
Create a narrow paper bookmark folded over the top edge of a playing
card. Draw only the bookmark and a short length of card edge. Flat vector
line style. Palette: #121411 and #f4f3ed; use #c8ed78 on dark or #426619
on light for the folded tip only. SVG, exactly 24 x 32 px,
viewBox 0 0 24 32.
no text, logos, real games, characters
Put the fold in the upper third and leave a clear V notch at the bottom.
Leave 3 px clear around the silhouette. It must stay legible beside a
patch title without overlapping it. Return two standalone SVG code
blocks, dark then light, transparent background, no filters or shadows.
```

I’d build **Steam Match Board first**. The captured 1-of-20 result, the Under $15 result with no Steam comparisons, and the offline state give it three substantially different cases to prove against. Then build **Opening Hand** and test it at 1024px with the longest caption and keyboard focus on the leftmost card. Those two prototypes settle the central design decision: how Gemuzu shows the limits of its data, and where its signature interaction feels worth reaching for.