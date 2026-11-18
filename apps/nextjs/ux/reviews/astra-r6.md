SCORE: 9.4/10  
Categories: 1 9.5 · 2 9.3 · 3 9.2 · 4 9.5 · 5 9.4 · 6 9.1 · 7 9.7 · 8 9.5

Weighted: **9.385 → 9.4**. No gate cap. Round 6 resolves most previous blockers, but four visible finish issues keep it below shipping approval.

Gates: honesty P · a11y P · layout P · stability P · states P · touch P

- **Honesty P:** Steam denominator now counts comparable offers; source inspection confirms free follow-ups preserve the actual store/URL and use “Check availability” when unknown.
- **A11y P:** Zero serious/critical axe findings; all 25 tested focus stops have indicators. A manual contrast problem remains below.
- **Layout P:** Zero reported overflow, clipped text or broken images. The 840px and 1024px layouts remain usable.
- **Stability P:** Zero non-simulated request/console failures; maximum CLS **0.068**. The missing-art exemption is removed.
- **States P:** Empty captures now contain zero collection items; loading preserves targets; offline and outage states provide appropriate recovery.
- **Touch P:** Zero reported phone targets below **44×44px**; inspected purchase, target-editing and navigation controls remain usable.

**Round-5 fixes — verification**

| Previous blocker | Status | Round-6 evidence |
|---|---|---|
| astra 1 — Free follow-up destination | **Resolved** | `deal-cards.tsx` passes store, URL and source into the prompt; unknown destination has neutral copy. Source-verified; follow-up interaction is not pictured. |
| astra 2 — Light patch heroes | **Resolved** | `desktop-light-patch-deadlock` and phone equivalent now use readable light text on a dark hero. |
| astra 3 — Art failures and empty fixtures | **Resolved** | No non-simulated failures; valid cached fallback; `state-empty-wishlist` and `state-empty-updates` are genuinely empty. Visual fallback quality remains a separate concern below. |
| astra 4 — Concrete Updates digest | **Partial** | 7.2.2 now identifies **AMW-20 APEX** and its change; 7.2.1 still falls back to introductory prose. |
| astra 5 — Wishlist recovery/source line | **Resolved** | Offline says “Reconnect to check prices”; phone source line wraps “at GameBillet · 9 stores compared” without truncation. |
| Opus 1 — Edition-row alignment | **Resolved** | Desktop/laptop prices align; rows are approximately **81px** high. Laptop Deals is **2939px**, below the requested 3400px. |
| Opus 2 — Billboard/matched-card hierarchy | **Partial** | Price/store typography and duplicate Steam slabs are fixed. Singleton matched-card composition remains unfinished, particularly at 840px. |
| Opus 3 — Logo consistency/back spacing | **Resolved** | Cyberpunk wordmark and Deadlock text treatment match the assertions; back links have clear separation. |
| Opus 4 — Dates/offline copy | **Resolved** | Local-date formatting confirmed in source; offline retry instructions are corrected in captures. |
| Opus 5 — Updates chips/digest | **Partial** | Zero-count chips and filter badges are removed; topics share the count line where space permits. Digest exception remains. |
| Opus 6 — Steam denominator | **Resolved** | Deals reads “1 of 2 with a Steam price beat it”; other editions explicitly lack a live Steam comparison. |

**BLOCKING FIXES**

1. **Give the wrapped game-page navigation a consistently readable surface.**

   In `split-dark-game-owned.png`, the dark band ends around **y40**, while the navigation’s second row sits around **y79** over bright yellow artwork. The “Updates” foreground is `#b6bcad`; adjacent artwork sampled at **(395,89)** is `#73710d`, approximately **2.63:1** contrast.

   At **640–1023px**, cover the complete approximately **100px** navigation height with a stable dark surface, or keep the hero scrim dark throughout that area before fading below it. Require **≥4.5:1** across every navigation label. This needs no blur or filter.

   File: [styles.css](/home/brian/projects/backlog/apps/nextjs/src/app/styles.css:945), including the wrapped-navigation rules near line 1847.

2. **Accept retrospective crash descriptions in the Updates digest.**

   `desktop-dark-updates`, `desktop-light-updates`, `laptop-dark-updates` and `phone-dark-updates` still show 7.2.1’s introduction followed by the fix and **“🧠 Known Issues.”** Phone truncates that paragraph.

   Source reproduction confirms the parser rejects this **76-character** completed change because it contains “would”:

   > Fixed a crash that would occur when another player joined or left the squad.

   Scope the planned-change exclusion to the proposed action, allowing retrospective clauses after “Fixed.” Display that sentence as the lead. Bound fallback excerpts to **≤140 characters**, and exclude subsequent section headings. Preserve rejection of genuinely planned or negated fixes.

   Files: [news-digest.ts](/home/brian/projects/backlog/packages/validators/src/news-digest.ts:36), [backlog-feed.tsx](/home/brian/projects/backlog/apps/nextjs/src/app/_components/backlog-feed.tsx:92).

3. **Finish the singleton matched-deal layout across intermediate widths.**

   In `split-dark-deals`, SULFUR occupies approximately **388×490px**, leaving an equally wide empty column beside it. At desktop/laptop it becomes a roughly **310px-high** full-width card, although its artwork is only **240×112px**; stacked, stretched actions dominate the remaining space.

   Apply a dedicated singleton layout from **768px**, spanning the available row. Use approximately **200–240px** artwork beside the title, one price ledger and an inline **Buy / Track** action group. Target **≤220px** height at 840, 1024 and 1440px with tracking closed. Keep phone controls at least 44px.

   Files: [deals.css](/home/brian/projects/backlog/apps/nextjs/src/app/styles/deals.css:305), [deal-cards.tsx](/home/brian/projects/backlog/apps/nextjs/src/components/deal-cards.tsx:256).

4. **Make missing promotional artwork an intentional composition.**

   `desktop-dark-deals`, `desktop-light-deals` and `laptop-dark-deals` show two blank olive masthead covers and an almost empty **280px-high** featured billboard. The resolver’s **96×64px** fallback prevents request failures, but enlarging it into the main promotional surface loses the cinematic identity.

   Preserve the successful-image fallback. Expose whether artwork is a fallback to the presentation layer: use verified offer artwork when available; otherwise hide empty masthead covers and render a deliberate typography-led featured treatment, approximately **180–220px** high. Keep the game title, price, Steam baseline and saving prominent.

   Files: [art route](/home/brian/projects/backlog/apps/nextjs/src/app/api/art/[appId]/[kind]/route.ts:19), [deal-cards.tsx](/home/brian/projects/backlog/apps/nextjs/src/components/deal-cards.tsx:303), [deals.css](/home/brian/projects/backlog/apps/nextjs/src/app/styles/deals.css:347).

**KEEP**

- Olive/paper identity, Barlow Condensed headings and Plex Mono prices.
- Existing Epic/PlayStation-inspired cinematic surfaces, Steam-style offer ledgers and Letterboxd-inspired cover compositions; Home’s numbered Play next selector is especially effective.
- Three-column laptop Library, two-column laptop Wishlist and comfortable split-width patch reading.
- Approximately **405px** phone Wishlist cards, complete source lines, preserved targets and immediate save acknowledgement.
- Honest Steam comparisons, explicit uncertainty, real free-offer destinations and Deadlock’s “No store is listing a price.”
- Readable patch heroes in both themes, numeric comparisons and automatic-classification disclosure.
- The 980ms skippable boot, reduced-motion precedence and ambient motion resting after inactivity.

Review used opened captures, supplied measurements and source checks, with independent visual/evidence support. The Impeccable detector could not run because its engine is unavailable. No files were changed; the workspace is read-only.