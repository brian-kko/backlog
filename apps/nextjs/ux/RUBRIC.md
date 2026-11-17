# Backlog UI/UX review rubric

Reviewers (the council) score Backlog against this rubric using the audit
report (`pnpm --filter @acme/nextjs ux:audit`, output in `ux/report/`): its
screenshots, automated measurements and interaction checks. A round passes
only when **every reviewer** gives **≥ 9.5 / 10** and no hard gate fails.

## Who it's for

PC players who buy across stores (Steam, GOG, Epic, Humble, Fanatical, key
shops) and want to know, at a glance, whether a deal actually beats Steam;
who track a backlog they'll realistically play; and who follow patches for the
games they own. Desktop-first, but checked on phones (couch browsing, quick
price checks). Gamers notice generic SaaS/AI-template styling and distrust
pages that oversell deals.

**The product test (PLAN.md §0):** every screen should make clear why you'd use
Backlog instead of just Steam: cross-store prices against a Steam baseline,
your own target prices, and one digest of what changed in your games.

## Hard gates (any failure caps the overall score at 9.0)

1. **Pricing honesty.** Saved catalog prices are never presented as live; "lowest
   ever" only with live history; no purchase price the user didn't confirm; a
   "save $X vs Steam" claim only from live prices, compared in cents.
2. **Accessibility.** No axe-core `critical` or `serious` violations on any audited
   page; every interactive element has an accessible name; a visible focus
   indicator on keyboard focus.
3. **Layout integrity.** No horizontal page scroll at 390, 768 or 1440 px; no
   clipped/overlapping text; no broken images.
4. **Stability.** No console errors or failed requests outside of deliberately
   simulated outages; CLS < 0.1 on every page.
5. **States.** Loading, empty, offline and error states exist and say what to do
   next, with no blank panels and no spinners that never resolve.
6. **Touch.** On phones, interactive targets are ≥ 44×44 px; links inside
   running text are exempt, as WCAG 2.5.8 allows.

## Weighted categories (score each 0–10, then weight)

| #   | Category                             | Weight | A 10 looks like                                                                                                                                                                           |
| --- | ------------------------------------ | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Value clarity & audience fit         |    15% | Within 5 seconds on any page it's obvious what Backlog adds over Steam; copy is plain, specific, gamer-literate, never salesy.                                                            |
| 2   | Visual craft & identity              |    20% | A distinctive, coherent look that could only be Backlog: confident typography, consistent spacing rhythm, restrained colour with meaning, artwork used well; nothing reads as a template. |
| 3   | Information hierarchy & scannability |    15% | The one thing each card/page is for leads; prices, deltas and states scan in a column; no repeated facts; secondary detail is quieter.                                                    |
| 4   | Interaction & motion                 |    10% | Every action gives immediate feedback; motion is purposeful, quick (≤ 300 ms), transform/opacity only, honours reduced motion; keyboard shortcuts are discoverable.                       |
| 5   | Responsive & mobile                  |    10% | Phone layouts are designed, not squeezed: thumb-reachable navigation, readable ledgers, no cramped controls; tablet is not an afterthought.                                               |
| 6   | Accessibility                        |    10% | Beyond the gate: logical headings and landmarks, meaningful link text, contrast comfortably above AA, state is never colour-only.                                                         |
| 7   | Trust & data honesty                 |    10% | Every number says where it came from and how fresh it is; uncertainty is shown, not hidden; outages degrade gracefully.                                                                   |
| 8   | States & resilience                  |    10% | Empty, loading, offline, partial-outage and error states are as designed as the happy path and guide the next step.                                                                       |

**Overall = Σ(category × weight)**, rounded to one decimal, then capped at 9.0
if any hard gate fails.

### Calibration

- **9.5+**: ship it as a polished modern product without reservations; only
  nitpicks remain.
- **9.0**: strong, with one or two issues a demanding user would notice.
- **8.0**: good but visibly unfinished in places.
- **≤ 7**: a structural problem (hierarchy, honesty, broken state) remains.

## What each review must contain

1. `SCORE: x.x/10` and the per-category scores.
2. Hard-gate status (pass/fail each, with evidence from the report).
3. At most 6 blocking fixes, most important first, each tied to a screenshot
   or measurement and with concrete values (sizes, copy, colours).
4. KEEP: what must not regress.

Constraints for fixes: no WebGL, blur, backdrop filters or heavy effects
(the main user's GPU is disabled); transform/opacity motion only; keep the
`data-testid` selectors and pricing rules in `CLAUDE.md`.
