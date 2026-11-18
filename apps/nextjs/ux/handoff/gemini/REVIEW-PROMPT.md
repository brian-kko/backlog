# Gemini UI/UX review: Gemuzu, round 8

**How to use this (for Brian):**
1. Open the Gemini app and pick the strongest model.
2. Attach the 10 screenshots in `review/` (they are numbered).
3. Paste everything below the line as the message.
4. Save Gemini's reply as `apps/nextjs/ux/reviews/gemini-r8.md`, then tell
   Claude "gemini review is in".

---

You are a **third, independent reviewer** on a UI/UX council for Gemuzu, a
web app. Two other reviewers (Opus and astra) score it separately; you have
not seen their reviews, and that's intended. Your value is a fresh
perspective, so be demanding and specific. **9.5/10 means you'd ship it as
a polished, modern product without reservations.**

The attached screenshots are numbered:

1. Home (desktop 1440px, dark)
2. Deals (desktop, dark)
3. Library (desktop, dark)
4. Wishlist (desktop, dark)
5. Updates (desktop, dark)
6. A game page, for a game the user owns (desktop, dark)
7. Deals (desktop, light theme)
8. Deals at 1024px (a small laptop)
9. Library at 840px (a browser window snapped to half the screen)
10. Deals on a phone (390px)

Full-page captures are tall, so scroll through each one.

Below are the product brief and the scoring rubric the council uses,
followed by the owner's open questions.

# UI/UX council brief

Two reviewers (Opus and astra, the Codex `gpt-6.2-astra` model) score Gemuzu
independently against [`RUBRIC.md`](RUBRIC.md), using the latest audit
(`pnpm --filter @acme/nextjs ux:audit` → `ux/report/`). The work ships only
when **both** give **≥ 9.5/10**. Be demanding and specific; 9.5 means you'd
ship it as a polished modern product without reservations.

## Product and audience

Gemuzu (ゲームズ, "games") is a PC game backlog, cross-store price watcher and
patch-note digest (Next.js web app / installable PWA). It's for PC players who
buy across stores and want to know if a deal really beats Steam, who track a
realistic backlog, and who follow patches for games they own. It's
desktop-first and checked on phones and tablets. The audience includes casual
gamers, and they distrust template-looking UIs and oversold deals.

## Direction from the owner

- A **modern UI with a dynamic background**, inspired by a variety of popular
  sites and trending UI-design posts (Instagram/Dribbble): cinematic
  image-led heroes, big layered display type, numbered selectors, interactive
  elements. Score "Visual craft & identity" and "Interaction & motion" with
  that ambition in mind; safe but flat should not score 9.5.
- **Design system:**
  - olive ink/paper palette with a restrained lime accent
  - Barlow, Barlow Condensed for display and labels, IBM Plex Mono for prices
- **Brand moment:** a cartridge boot animation. A Gemuzu cart drops into a
  slot, the light turns lime, and it fades into the page. It runs under 1s,
  once per session, is skippable, never plays with reduced motion, and
  `?boot` replays it.

## Owner priorities for round 3 onward

- **Browsers that aren't full-screen.** Check the `split` (840 px, a window
  snapped to half a screen) and `laptop` (1024 px) captures as carefully as
  phone and desktop. Cramped mid-width layouts are blocking.
- **Free games.** Never show "$0.00". Free and free-to-play games should read
  as free ("Free", "Get it free at Steam", "Free right now; nothing to wait
  for"), and there's no target price to chase.
- **Look cooler.** Borrow specific UI elements from popular modern sites and
  apps where they make sense for gamers, and say which site each comes from.

## Hard constraints

- No WebGL, blur, backdrop-filter or filter effects; the owner's GPU is
  disabled. Motion is transform/opacity only, cheap in software rendering,
  and rests when idle. A perpetual animation that burns CPU is a defect.
- Pricing honesty:
  - saved prices are never shown as live
  - "lowest ever" only with live history
  - no unconfirmed purchase prices
  - Steam savings compared in cents
- Keep the `data-testid` selectors and the rules in `CLAUDE.md`.

## Owner decisions (don't re-request)

- The site was renamed from Backlog to **Gemuzu**. Internal identifiers (the
  `backlog-*` storage keys, the `userBacklog` table, `Backlog*` components)
  were kept deliberately.
- A **pointer-following background light was removed** because it disappeared
  behind elements and was distracting. The slow ambient drift stays.
- The owned-game collection form stays expanded. Prices come first in the
  layout instead.

## Review output format

```
SCORE: x.x/10
Categories: 1 x · 2 x · 3 x · 4 x · 5 x · 6 x · 7 x · 8 x
Gates: honesty P/F · a11y P/F · layout P/F · stability P/F · states P/F · touch P/F
  (one line of evidence each)
BLOCKING FIXES (max 6, most important first; each cites a screenshot or
  measurement and gives concrete values)
KEEP (what must not regress)
```

## Score history

| Round | astra | Opus | Notes                                                                                           |
| ----- | ----- | ---- | ----------------------------------------------------------------------------------------------- |
| 1     | 7.2   | 7.0  | Baseline; 5–6 gates failing                                                                     |
| 2     | 8.7   | 7.8  | Gates mostly pass; Opus asked for a bolder visual direction                                     |
| 3     | 8.7   | 8.4  | Mastheads, cinematic heroes, spotlight, Gemuzu rename, boot animation                           |
| 4     | 9.1   | 8.7  | Codex workers: masthead art, deals billboard, wishlist cards, updates, patch reader; gate fixes |
| 5     | 9.0 (9.2 capped) | 8.9 | All round-4 fixes in; astra capped by honesty (free follow-up store) and stability (art 404s) |
| 6     | 9.4   | 9.1  | All gates pass; open: hashed Steam art, singleton deal card, nav/back link over hero, digest "would" bug, phone edition rows |



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


## Owner question: should every page have the deck?

The owner likes the card deck but wants your judgement. Does a deck on every
page (Home, Deals, Library, Wishlist, Updates) give the app one consistent
identity, or does it feel repetitive or redundant? On each page, does it add
information or only decoration?

Give a verdict for each page: **keep the deck**, **keep it with a change**
(say what), or **replace it**. If you'd replace it, propose what that page's
masthead should show instead, using something only that page's data can say.
Examples: a price-drop timeline on Deals, a target-progress meter on
Wishlist, a patch-activity strip on Updates. Keep each proposal cheap: no
blur, filters or WebGL. This is advice for a later round, not a blocking
fix, unless the repetition keeps your score under 9.5.

## Owner request: quality of life and competitors' best features

Separately from the score, the owner wants Gemuzu to borrow the best ideas
from the sites and apps people already use for this. Compare against:
- **IsThereAnyDeal**: price history, waitlist alerts, bundles and store
  coverage;
- **GG.deals**: key-shop vs official split, price alerts, deal badges;
- **SteamDB**: lowest-price history, sales calendar, patch and depot
  tracking;
- **Backloggd / HowLongToBeat**: backlog states, time to beat, ratings,
  journaling;
- **Playnite / GOG Galaxy**: unified library across launchers, import,
  playtime;
- **Steam itself**: wishlist sort/filter, sale notifications, the Discovery
  Queue.

If you can browse the web (the Opus reviewer can), check their current
features and cite the pages you used.

Return a **ranked list of 6–10 proposals**. For each, give:
- what it is and where it comes from;
- why Gemuzu users want it, keeping section 0 of PLAN.md in mind ("if Steam
  already does it as well, it shouldn't lead");
- where it goes in Gemuzu (page and component);
- the data source, and whether it's free and public; we have Steam,
  CheapShark and ITAD keys, and Riot news;
- effort: S, M or L.

Separate **quality-of-life fixes** to existing flows (fewer clicks, better
defaults, keyboard shortcuts, remembered choices, undo, empty states) from
**new features**. Respect the hard constraints: honest pricing, no blur,
filters or WebGL, and every route working for guests.

## Owner priority: keep modernising the UI/UX

The owner wants Gemuzu to feel current, not just correct. Judge it against
the best 2025–26 product UI, e.g. Linear, Raycast, Arc, the Epic and
PlayStation stores, Letterboxd, and Apple's Game Center and TV apps. Name
**3–5 concrete modernisation moves**, each with:
- what looks or feels dated now (capture and element);
- the modern pattern to borrow and where it comes from;
- the exact change and file.

Patterns worth considering: command palette, bento layouts, view
transitions, skeletons that match the final layout, spatial or tactile
micro-interactions, typographic scale, density modes, sticky contextual
actions, toasts with undo. Keep within the constraints: transform/opacity
motion only, no blur, filters or WebGL, reduced motion respected, and
840px/1024px windows first-class. Mark each as blocking (keeps you under
9.5) or as a recommendation.


## Your output

1. **Score:** an overall score out of 10, and a score for each rubric
   category.
2. **Top 5 blocking issues:** what keeps it under 9.5, each with the
   screenshot number, the element, what's wrong, and the exact fix.
3. **Deck verdict for each page:** keep, change or replace.
4. **Quality of life and competitor features:** a ranked list, as asked
   above.
5. **Modernisation:** 3–5 moves, as asked above.
6. **Keep:** what's working and must not regress.

Be concrete: name the screenshot, the element and the fix. Skip generic
advice.
