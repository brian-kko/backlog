SCORE: 9.0/10  
Categories: 1 9.3 · 2 9.4 · 3 9.1 · 4 9.5 · 5 9.5 · 6 8.8 · 7 9.0 · 8 9.2

Weighted score: **9.2**, capped at **9.0** by hard-gate failures. The visual improvement is substantial; round 5 is not ready to ship.

Gates: honesty F · a11y P · layout P · stability F · states P · touch P

- **Honesty F:** Source tracing finds a live, non-Steam free offer can produce “Get it free at Steam” after wishlisting; the originating offer’s store and URL are lost.
- **A11y P:** The stated automated gate passes: zero serious/critical axe findings and 25 visible focus stops. Manual inspection nevertheless finds blocking contrast failures on light-theme patch heroes.
- **Layout P:** Zero reported overflow or clipping. The 840px and 1024px captures have comfortable controls, readable cards and sensible artwork placement.
- **Stability F:** Four non-simulated image 404s appear in `desktop-dark-state-deals-under-15` and `desktop-dark-state-deals-no-results`. The audit excludes these, but the rubric does not. Maximum CLS is a good **0.070**.
- **States P:** Loading, outage and offline treatments retain useful content and recovery paths; empty branches exist in source. However, the “empty Wishlist/Updates” captures contain a retained game and do not verify those empty states.
- **Touch P:** Zero reported targets below 44×44px; phone navigation, purchase actions and target editing remain usable.

**Round-4 fixes — verification**

| Fix | Status | Evidence |
|---|---|---|
| astra 1 — Free-game flows | **Partial** | Contractor’s Deals CTA correctly says “Get it free at Epic Games Store”; target suppression exists in source. The post-wishlist prompt can still name the wrong store; see fix 1. |
| astra 2 — Unknown Wishlist prices | **Resolved** | Offline/outage captures show “Prices unavailable” and “History unavailable”; loading retains `$25.00` and `$10.00` targets. |
| astra 3 — Patch comparisons | **Partial** | Scorn and Radiant Daggers parse cleanly; split-width values appear once. Desktop still repeats values in both sentence and comparison column—a remaining nonblocking redundancy. |
| astra 4 — Updates digest | **Partial** | First entry has useful topics and a concrete fix. Version 7.2.2 still leads with “INCOMING TRANSMISSION…”; see fix 4. |
| astra 5 — Wishlist density | **Resolved** | `phone-dark-wishlist`: approximately **405px per card**, below the 440px target; desktop cards approximately **387px**. |
| astra 6 — Home LCP | **Resolved** | Home measurements are **68–148ms** across the audited viewports/themes. |
| Opus 1 — Fonts | **Resolved** | Computed-font assertions pass; condensed headings and monospaced prices visibly render. |
| Opus 2 — Deals hierarchy | **Resolved substantively** | Featured saving has a clear rationale, unmatched editions are compact rows, phone ribbons preserve artwork, free CTA is corrected. Desktop height is **3210px**. Phone is **5449px**, but contains 21 games versus the previous 18; that alone is not a blocker. |
| Opus 3 — Wishlist uncertainty/freshness | **Partial** | Unknown counts/history are corrected. Offline still offers “Check prices now”; repeated ISO freshness remains truncated. |
| Opus 4 — Updates counts/chips | **Resolved** | Masthead, patch tab and Helldivers rail agree on **3** recent patches; “in 30 days” is spaced correctly; classification chips appear. |
| Opus 5 — Mastheads | **Resolved** | Laptop artwork is present, page words fade rather than abruptly clip, and text remains separate from artwork. |
| Opus 6 — Patch accuracy | **Resolved** | Scorn `1.2x → 1.3x`; Radiant Daggers `30m → 25m`; Sand Blast has a Change chip without a malformed comparison; fear buildup is Buff; automatic sorting is disclosed. |

**BLOCKING FIXES**

1. **Preserve the actual store in the free-game follow-up.**  
   `desktop-dark-deals.png` demonstrates the correct Epic free CTA, but the follow-up branch is not captured. Source tracing shows `TrackActions` passes `bestPrice=0, saved=false` into `TargetPrompt`; verification is skipped, `checkedPrices` remains undefined, and `FreePriceNotice` defaults to Steam. This is a source-confirmed conditional defect, not an observed screenshot interaction.

   Pass the verified **store, offer URL and source** through the prompt, or resolve them before claiming a destination. A non-Steam giveaway must retain **“Get it free at {actual store}”**; an unknown destination should say **“Check availability”**. Add captured checks for live non-Steam free, Steam free and cached-zero flows, with no target input or `$0.00`.

   Files: [game-ui.tsx](/home/brian/projects/backlog/apps/nextjs/src/components/game-ui.tsx:115), [deal-cards.tsx](/home/brian/projects/backlog/apps/nextjs/src/components/deal-cards.tsx:403).

2. **Restore readable light-theme patch heroes.**  
   In `desktop-light-patch-deadlock.png`, the **1168×220px** hero at approximately **x136, y146** puts dark text over dark grey artwork. Sampled background `#626260` against title `#20241c` gives approximately **2.58:1**; metadata `#596150` gives approximately **1.06:1**. The phone equivalent has the same problem. Helldivers’ light hero is also inconsistent.

   Give patch heroes explicit local dark-surface tokens: title `#f2f4eb`, metadata `#c3c9ba`, and a dark gradient **above the artwork and below the copy**. Require **≥4.5:1** for metadata/links and **≥3:1** for large headings throughout the text area. Preserve the 220px compact hero and use no filters.

   Files: [patch.css](/home/brian/projects/backlog/apps/nextjs/src/app/styles/patch.css:17), [styles.css](/home/brian/projects/backlog/apps/nextjs/src/app/styles.css:1476).

3. **Make the stability result match the rubric.**  
   The report records **three 404s** in `desktop-dark-state-deals-under-15` and **one** in `desktop-dark-state-deals-no-results`, involving Steam app `785847`. `unexplainedErrors()` subtracts missing-art failures before scoring stability. A successful visual fallback does not satisfy the separate no-failed-requests gate.

   Resolve missing artwork before issuing browser image requests—for example, through a cached server-side resolver returning a valid fallback image. Target **zero non-simulated browser request failures**, and remove the blanket missing-art exemption.

   Also repair state-fixture isolation: `desktop-dark-state-empty-wishlist` still contains **one Helldivers card**, and `state-empty-updates` contains its feed. Assert **zero collection items** before taking genuinely empty captures.

   Files: [game-ui.tsx](/home/brian/projects/backlog/apps/nextjs/src/components/game-ui.tsx:623), [audit.spec.ts](/home/brian/projects/backlog/apps/nextjs/ux/audit.spec.ts:81).

4. **Extract Updates’ lead from actual changes before truncating the source.**  
   `desktop-dark-updates.png`, `laptop-dark-updates.png` and their light equivalents still present version **7.2.2** as a publisher introduction and problem statement. Yet `desktop-light-patch-helldivers.png` already contains concrete changes, including **“Increased demolition strength to 30.”** This is available information, not a case requiring an invented summary.

   Compute the digest server-side from the full source or parsed changes, returning **at most two topics and one ≤140-character change line**. Include the subject, such as **“AMW-20 APEX: Increased demolition strength to 30.”** Keep full notes server-side and use introductory excerpts only when no reliable change exists.

   Files: [news-digest.ts](/home/brian/projects/backlog/packages/validators/src/news-digest.ts:37), [backlog-feed.tsx](/home/brian/projects/backlog/apps/nextjs/src/app/_components/backlog-feed.tsx:80), collection-feed API serialization.

5. **Finish Wishlist’s offline recovery and source line.**  
   `desktop-dark-state-offline-wishlist.png` offers **“Check prices now”**, **“Try checking again in a moment”** and **“Your target is saved; try checking again”** while explicitly offline. In `phone-dark-wishlist.png`, the source line truncates to **“Checked 2026-11-18 · 9 store…”**, concealing useful comparison coverage behind repeated freshness.

   Offline: replace refresh with **“Reconnect to check prices”**, and use **“Your target is saved; prices refresh when you reconnect.”** Live: keep freshness once at page level; use **“at GameBillet · 9 stores compared”** within the card, wrapping if necessary. Preserve **≤440px** phone cards and **≥44px** actions.

   File: [wishlist/page.tsx](/home/brian/projects/backlog/apps/nextjs/src/app/wishlist/page.tsx:64).

**KEEP**

- The olive/paper palette, actual Barlow Condensed/Plex Mono rendering, cinematic artwork and numbered Play next selector.
- The sale-hero direction referenced from Epic/PlayStation, Steam-style compact offer rows and Letterboxd-style masthead fades. These now support a distinctive product.
- Comfortable 840px/1024px layouts, three-column laptop Library and compact Wishlist geometry.
- Live Steam comparisons in cents, unmatched-edition separation, saved-target preservation and restrained purchase emphasis while waiting.
- Prices before the expanded collection editor; explicit sample and unconfirmed-purchase labels.
- The 980ms cartridge boot, reduced-motion precedence, 44px Skip, and ambient drift resting after inactivity.
- Deadlock’s honest **“No store is listing a price.”**

Review used the supplied audit, opened captures and source inspection. The workspace is read-only; hand-off files were not modified.