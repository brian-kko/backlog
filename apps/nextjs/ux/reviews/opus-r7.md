# Opus review: round 7

SCORE: 9.2/10
Categories: 1 9.3 · 2 9.1 · 3 9.2 · 4 9.2 · 5 9.4 · 6 8.9 · 7 9.3 · 8 9.4

(Weighted: 1.395 + 1.82 + 1.38 + 0.92 + 0.94 + 0.89 + 0.93 + 0.94 = 9.215, rounded to 9.2. Round 6 was 9.1.)

Gates: honesty P · a11y P · layout P · stability P · states P · touch P
- **honesty P:** "1 of 2 with a Steam price beat it" and "save $5.95 (−19%)" come from live cents. Under $15 says "No Steam prices to compare in these results". Wishlist reads "$7.00 less than Steam" and "at GameBillet · 9 stores compared". The game page shows "Bought from: Not set" and "Steam (unconfirmed)". Deadlock keeps "No store is listing a price".
- **a11y P:** 0 axe serious or critical issues across 98 captures, 25/25 focus stops visible, heading structure passes. axe can't measure text over images, though, and that's where this round's a11y problem is (fix 1).
- **layout P:** 0 overflow at 390, 768, 840, 1024 and 1440, 0 clipped text, 0 broken images. The LEGO phone row now ends in an ellipsis ("LEGO Star Wars: The Skywalker Sa…") instead of a hard clip.
- **stability P:** 0 non-simulated console errors or failed requests. The worst CLS is 0.086 (laptop-dark-deals) and every page is under 0.1.
- **states P:** loading ("Checking prices…", "Comparing stores…"), empty, offline ("Deals need a connection" with Open wishlist and Open library) and outage states all render. phone-dark-state-outage-game resolves to "Steam news didn't load" with Try again. The desktop capture was taken while the request was still retrying (see nits).
- **touch P:** 0 phone targets under 44 px. Phone edition-row buttons are 44 px, and back links keep a ~48 px gap to the eyebrow.

## What improved

- **Art.** The deals billboard has real art (Pro Basketball Manager 2027 resolves through appdetails), and the phone featured thumbnail shows it too. Fallback plates no longer appear in mastheads (deals and Under $15 show no blank tiles).
- **Singleton card.** SULFUR is a strip about 145 px tall at 1440 and 1024 and about 148 px at 840. The 404×490 px hole is gone.
- **Chrome.** At 840 and 768 the nav sits on a solid surface down to y≈100 over the Cyberpunk hero. Touch back links have about 48 px of clearance on phone, and the arrow keeps its gap.
- **Digest.** 7.2.1 leads with "Fixed a crash that would occur when another player joined or left the squad", and 7.1.1 no longer starts with "Crash Fixes:". The patch reader doesn't count Known Issues, and phone topics wrap with no dangling "·".
- **Owner asks:**
  - Every desktop masthead title sits at y≈165–220.
  - The nav is 68 px tall on wide screens.
  - The hover fan (mastheads.css) is transform-only and gated on `(hover:hover) and (pointer:fine) and (min-width:1024px) and (prefers-reduced-motion:no-preference)`.
- **Phone deals:** the page is 4177 px (target ≤ 4400). Rows are about 141 px, with the price beside a two-line title.

## Round-6 blocking fixes: resolved / partial / not

| Fix | Status | Evidence |
|---|---|---|
| **Opus 1**: hashed Steam art, blank billboard and masthead | **Resolved** (new craft issue) | **desktop-dark-deals:** the billboard (y 598–816) shows real art, and the masthead has no blank covers. desktop-dark-state-deals-under-15 shows no plate.<br>New issue: the art is the 460×215 `header_image`, which has the game's wordmark baked in, stretched 2.54× to 1168 px (fix 2). |
| **Opus 2**: singleton matched card | **Resolved** (hierarchy residue) | At 1440, 1024 and 840 it's a single strip of about 145–148 px. The struck "$49.98 −42%" is detached from the price it qualifies (fix 4). |
| **Opus 3**: touch back link | **Resolved** | phone-dark-game-owned: the back link is at y≈96 and the eyebrow at y≈152. Arrow gap and accessible name are correct (audit: "← Back to Updates", arrow aria-hidden in source). Its contrast over the art is a separate problem (fix 1). |
| **Opus 4**: phone edition rows | **Resolved** | phone-dark-deals: two-line clamped titles with an ellipsis, the price at x≈280–361 beside the title, rows about 141 px, page 4177 px. |
| **Opus 5**: digest prose, headings, Known Issues, phone "·" | **Resolved** | desktop-dark-updates: 7.2.1, 7.1.1 and 7.0.2 all lead with concrete "Fixed …" lines. desktop-dark-patch-helldivers: Misc shows only "Removed two music tracks". phone-dark-updates: topics sit on their own line with no leading "·". |
| **astra 1**: wrapped nav surface at 640–1023 | **Resolved at 640–1023** | split-dark-game-owned and tablet-dark-game-owned: a solid band to y≈100. The same contrast failure still happens at ≥1024 and in the back link at every width (fix 1). |
| **astra 2**: retrospective "would" | **Resolved** | See Opus 5. |
| **astra 3**: singleton layout from 768 | **Resolved** | See Opus 2. |
| **astra 4**: intentional missing-art composition | **Resolved** (source) | `deal-cards.tsx` `onMissing → noArt`, and `.deal-featured.no-art` in deals.css lines 680–704. Mastheads hide plates. Not pictured, because the art resolved this round. |

## BLOCKING FIXES

### 1. Text over game art falls below AA: the hero nav (≥1024), the back link (all widths) and the Home "Playing" label
**Captures:** desktop-dark-game-owned, laptop-dark-game-owned, desktop-light-game-owned, phone-dark-game-owned, phone-light-game-owned, desktop-dark-state-outage-game, desktop-dark-dashboard, desktop-light-dashboard, split-dark-dashboard

**Evidence** (sampled from the PNGs):
- **Nav labels at ≥1024.** The 640–1023 surface fix doesn't apply above 1023, so the nav still sits on the yellow Cyberpunk hero.
  - desktop-dark-game-owned: "Updates" (`--muted-foreground` #b6bcad, 14 px) at x 612–667, y≈37 sits on #53530d–#6c6b0d, about **2.9–4.1:1**.
  - laptop-dark-game-owned: "Updates" at x 500–555 sits on #5c5c0d–#757309, about **2.6–3.6:1**.
  - "Sign in with Discord" (#f2f4eb) sits on #68670b–#88860a, about 3.5–5:1, and its border is barely visible.
- **Back link.**
  - phone-dark-game-owned: "← Back to Updates" (#c3c9ba, 15 px) at y≈86–106 sits on #6a690b–#8a880a under "Updates", about **2.3–3.3:1**.
  - desktop: on #525214–#67650b, about 3.3–4.7:1.
  - Light theme matches dark, because the hero tokens are dark.
- **Cause.** The `.hero-backdrop::after` top fade (styles.css about lines 958–962) goes from 82% at 0 to transparent at 120 px, so it's only about 57% opaque at the nav's text line (y≈37) and about 20% at the back link (y≈96).
- **Home spotlight.** The `.spotlight-status` "PLAYING" label (12 px #d8f08a, styles.css lines 1240–1244) sits on #8d8a07–#9c9908 at 1440 and #949508–#a5a507 at 840, about **2.2–2.6:1**. The `.spotlight-art::after` scrim is only 55% at the middle of the card.

**Fix:**
- **Hero scrim** (`apps/nextjs/src/app/styles.css`, `.hero-backdrop::after`). Replace the first gradient with:
  `linear-gradient(to bottom, color-mix(in srgb, var(--background) 92%, transparent) 0, color-mix(in srgb, var(--background) 85%, transparent) calc(var(--nav-h) + 56px), transparent calc(var(--nav-h) + 160px))`.
  - Over pure #f0f000 art that composites to about #33330e behind the nav and back link, which gives about 6.5:1 for #b6bcad and 7.5:1 for #c3c9ba.
  - The face and logo below y≈220 stay bright.
  - Don't use blur, filter or text-shadow.
- **Spotlight label.** Make `.spotlight-status` a chip: `width:auto; display:inline-block; padding:2px 6px; border-radius:4px; background:#121411; color:#d8f08a` (about 13:1). Or deepen `.spotlight-art::after` to `#121411 6%, color-mix(in srgb,#121411 78%,transparent) 50%, color-mix(in srgb,#121411 30%,transparent) 85%, transparent`, and require the label to reach ≥ 4.5:1.
- **Audit** (`ux:audit`). On every game page and on Home, sample the screenshot pixels inside the bounding boxes of `.site-nav .nav-link`, `.back-link` and `.spotlight-status`, and assert that the minimum glyph-to-background contrast is ≥ 4.5:1. axe can't check this case.

### 2. The billboard uses a stretched header capsule whose baked-in wordmark ghosts behind the title; lone masthead covers sit off-centre
**Captures:** desktop-dark-deals, desktop-light-deals, laptop-dark-deals, split-dark-deals, desktop-dark-wishlist, desktop-light-wishlist

**Evidence:**
- **Wrong source art.** `/api/art/4411720/hero` finds no `library_hero.jpg` and falls back to appdetails `header_image` (460×215). In `route.ts`, `appdetailsArtUrls` uses `header_image` for both `header` and `hero`.
- **Stretched and soft.** The billboard covers 1168×218 with it, a 2.54× upscale that's visibly soft.
- **Ghost title.** The capsule's own "PRO BASKETBALL MANAGER 2027" logo is cropped to "RO BASKETBALL / AGER 2027" and sits right behind the H3 "Pro Basketball Manager 2027" (x 161–570, y 665–700). At 840 (split-dark-deals, y 520–660), the ghost "BASKETBALL / NAGER 2027" runs into the "Buy at Fanatical" column. The headline game is effectively titled twice.
- **Lone covers.** On desktop-dark-wishlist, Hades is the only cover (`CoverMosaic` uses `appIds.slice(1,4)`). It sits in the right-hand slot (x≈1185–1285) and leaves the centre of the art panel empty. Library at 1024 shows the same with 2 covers.

**Fix:**
- **Prefer logo-free art for `hero`** (`apps/nextjs/src/app/api/art/[appId]/[kind]/route.ts`).
  - For `hero`, call appdetails without `filters=basic` and try, in order, `screenshots[0].path_full` (1920×1080, no logo), then `background_raw`, then `header_image`.
  - Keep the same host allowlist, `redirect:"error"` and the 24 h cache. `header` keeps `header_image`.
- **Don't stretch narrow art** (`deal-cards.tsx`, the billboard `GameArt` `onLoad`). If the art's `naturalWidth < 0.8 × the card width`, add `.art-inset`.
  - In `deals.css`: `.deal-featured.art-inset > .deal-art { left:auto; right:0; width:min(460px,45%); }`.
  - Keep the existing left ink gradient over it, so a small capsule sits at its native size beside the copy instead of being blown up behind it.
- **Centre lone covers** (`mastheads.css`). A single cover takes the centre slot: `.cover-mosaic-track:has(img:only-child) img { transform: rotate(-4deg); margin-inline:auto }`. Two covers take slots 1–2, centred.
- **Audit.** Assert that the billboard image `naturalWidth ≥ 0.8 × clientWidth`, or that `.art-inset` is set.

### 3. Patch counts disagree between Updates and the reader, and context notes are labelled "Change"
**Captures:** desktop-dark-updates, phone-dark-updates, desktop-dark-patch-helldivers, desktop-light-patch-helldivers

**Evidence:**
- **The counts don't match.** desktop-dark-updates shows 7.2.2 as "▼1 nerf · ▲3 buffs · ↻6 changes" (y≈793). The reader for the same patch (desktop-dark-patch-helldivers, y≈503) says "1 nerf change · 3 buff changes · 2 other changes · 4 fixes". `PatchSummary` in `backlog-feed.tsx` (lines 35–44) folds fixes into "changes" whenever there's a buff or nerf, so a click from "6 changes" lands on "2 other changes".
- **A note gets a "Change" chip.** In the reader, "The correct values are" (y≈1217) carries "↻ Change". It's classified as `note`, but `patch-reader.tsx` line 72 maps `note → { label: "Change", icon: "↻" }`.
- **Context counted as a change.** "The Bushwacker changes in the previous patch were calculated incorrectly" is context, but `adjustedPattern` (`chang\w*`) counts it as one of the "2 other changes".

**Fix:**
- **Feed chips** (`backlog-feed.tsx` `PatchSummary`). Always show fixes as their own chip, "✓ N fixes" (data-kind="fix", the same icon the reader uses). Make "↻ N changes" = adjusted + new + removed. The feed and the reader legend then use the same four words and numbers.
- **Note label** (`patch-reader.tsx`). Set `note: { label: "Note", icon: "·" }`, styled muted by the existing `[data-kind="note"]` rule (styles.css about line 1489).
- **Classifier** (`packages/validators/src/patch-notes.ts` `classifyChange`). Return `"note"` for lines ending in ":", and for lines that mention `/\b(previous|last) (patch|update)\b/` without a leading change verb.
- **Tests** in `packages/validators/src/__tests__/`:
  - the 7.2.2 fixture gives counts {nerf 1, buff 3, adjusted+removed 1, fix 4};
  - "The correct values are:" → `note`;
  - feed-chip totals equal the reader legend totals.

### 4. Singleton strip: the was-price sits far from the price it qualifies
**Captures:** desktop-dark-deals, desktop-light-deals, laptop-dark-deals, split-dark-deals, tablet-dark-deals

**Evidence:**
- **At 1440** (desktop-dark-deals, SULFUR strip, y 838–981), "$49.98 −42%" is at x≈389, y≈947, in the title column. The price it qualifies, "$28.78", is at x≈1200–1283, y≈874, about 810 px to the right, in another column. It reads as a property of the title.
- **At 840** (split-dark-deals, y 735–883), the was-price "$49.98 −42%" is at x≈585, y≈811, alone above "Buy at Steam". The slab "$28.78" is in the other column (x 237–537).
- **Cause.** `deals.css` puts `.deal-price-meta` in `grid-column: 2; grid-row: 2` (line 343) at 768–959, and in `grid-column: 1; grid-row: 3` (line 450) at ≥960.
- **Comparison.** The featured billboard and the phone cards keep the price and was-price together.

**Fix** (`apps/nextjs/src/app/styles/deals.css`, the `:only-child` rules):
- Put `.deal-price-meta` in the ledger's column, directly under the slab, at every width:
  - ≥960: `grid-column: 2; grid-row: 3`;
  - 768–959: `grid-column: 1; grid-row: 4`.
- Merge it onto the note line, so it reads "Steam has the best price · ~~$49.98~~ −42%".
- The ≥960 title column then holds only the title and store. Centre them vertically and keep the strip ≤ 150 px tall.

## KEEP (must not regress)
- **Deals:**
  - the subgrid ledger: prices right-aligned at x=1017 (1440) and about 81 px rows at 1024 and 1440;
  - two actions per row, with "Buy ↗", "Get free ↗" and "Find on Steam" carrying full aria-labels;
  - "Free" with "$3.99 −100%";
  - "1 of 2 with a Steam price beat it" and "No Steam prices to compare in these results";
  - "$25.54 at Fanatical", "save $5.95 (−19%)", one slab plus "Steam has the best price";
  - the compact singleton strip of 145–148 px;
  - phone rows of about 141 px with the price beside the title and a 2-line clamp;
  - URL filter state, "Under $15" correctness and "Reset filters".
- **Art:** the appdetails hashed-art resolver; `isFallbackArt` and `X-Gemuzu-Art: fallback`; mastheads that hide plates; the `.no-art` billboard path; 0 non-simulated failed requests.
- **Chrome:** the solid nav surface at 640–1023; touch back links with ≥ 24 px clearance and an aria-hidden arrow; the 68 px wide-screen nav; top-aligned masthead titles; the hover fan (transform-only, fine pointer, reduced-motion off).
- **Updates:**
  - the server-side digest that leads with concrete "Fixed …" lines and drops generic subjects;
  - Known Issues excluded from counts;
  - excerpts ≤ 140 chars;
  - phone topics on their own line with no dangling separator;
  - no zero chips;
  - rail and filter "3 in 30 days".
- **Honesty:** the free follow-up keeps the offer's store, URL and source; savings in cents; "History unavailable"; "Bought from: Not set"; "(unconfirmed)" launcher; Deadlock's "No store is listing a price".
- **Wishlist:** "at {store} · N stores compared"; offline "Reconnect to check prices"; targets visible while loading; phone cards ≤ 440 px; the 18–22 ms save acknowledgement.
- **Unchanged:**
  - Barlow Condensed and Plex Mono, asserted by the audit;
  - the olive and lime palette;
  - Home's numbered 01/02 Play next;
  - masthead ghost words;
  - the patch reader's glance bar and value column;
  - dark patch heroes in both themes;
  - the phone bottom nav;
  - boot behaviour;
  - ambient motion that rests when idle.

## Nitpicks (not blocking)
- **Hover fan timing:** the transition is 320 ms. The rubric says ≤ 300 ms, so use 280 ms (mastheads.css).
- **Add game dialog:** all six result thumbnails are empty grey slots on both desktop-dark-state-add-game-dialog and phone-dark-state-add-game-dialog. Phone showed them in round 6. Pass `loading="eager"` to the `<Image>` in `add-game.tsx` line 61, and show the title's initials in `.search-result-art` until the image loads.
- **desktop-dark-state-outage-game:** the capture still shows "Loading Steam news…" while `getSteamFeed` retries; the phone capture reaches the error card. Use `retry: 1` for `getSteamFeed`, or have the audit wait for the alert.
- **Leftovers from earlier rounds:**
  - Contractor's "Find on Steam" sits 36 px right of the column (x 1156–1288 against 1120–1252). Give `.deal-row .deal-buy` a `min-width: 112px`.
  - Dead Space still uses Steam's grey "No Image Available" tile in the ledger.
  - "Read on Steam↗" has no gap before the arrow on desktop Updates.
  - The desktop select renders "Steam(unconfirmed)" with no visible space.
  - Phone nav badges overlap the Library and Wishlist icons by about 4 px.
  - Home's eyebrow "2 games on your wishlist" duplicates the stat row.
  - "Total spent" has no caption.
  - The Cyberpunk wordmark is inset about 30 px from the content edge.
- **Updates leads:** trailing punctuation is inconsistent (7.2.1 and 7.0.2 have no full stop; 7.1.1 and 7.2.3 do). Normalise it in `digestNews`.
- **Under $15:** with no Steam-matched cards above, the divider still says "Other editions: no live Steam price to compare". When it's the only group, say "No live Steam price to compare for these editions".
- **Patch hero:** the version appears twice ("7.2.2 PATCH NOTES" above "Devoid of Liberty: 7.2.2").
- **Tab badges:** game-page tabs show a "0" badge ("Patch notes 0"), even though Updates hides zero counts.
