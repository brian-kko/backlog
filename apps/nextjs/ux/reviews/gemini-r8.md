# Gemini review, round 8

Pasted by the owner from the Gemini app (task E in `ux/handoff/gemini/`).
The text is kept as returned; only this header was added.

SCORE: 9.0/10 (categories: value 9.2, craft 9.1, hierarchy 8.9, interaction 9.2, responsive 8.3, a11y 9.0, honesty 9.4, states 8.6)

Blocking:
1. Deals rows 5–6 (Dead Space, LEGO): missing cover art shows overflowing title text across rows and over Buy (desktop, light, 1024, phone). Fix: overflow hidden, fallback art or monogram tile, alt="" on decorative row thumbnails.
2. Phone Deals: the 4th preset chip "Activates on Steam" is clipped at the right edge with no scroll affordance. Fix: wrap chips below 640px, or a horizontal scroller with an edge fade and right padding.
3. Deals eyebrow "1 of 1 with a Steam price beat it" reads as an ungrammatical template. Fix: "1 deal beats Steam" / "{n} of {m} deals beat Steam" / "0 deals beat Steam right now".
4. Library at 840px: the deck is hidden below 1024px, leaving about a 400×150 void beside the title. Fix: a compact 3-card deck down to 768px; single column below that.
5. (important) A free row's "Get free ↗" is wider than "Buy ↗", pushing "Free" out of the price column; give the primary row button min-width 96px. In Library, "Paid $29.99 · plays on Steam (unconfirmed)" reads as if the price were unconfirmed; reorder to "Steam (unconfirmed) · Paid $29.99".

Deck verdicts: home keep · deals change (fan the top 3–4 live Steam-beating deals with a discount pill on the front card) · library replace (backlog balance bar plus a spine shelf) · wishlist change (closest-to-target card in front with a "$7.99 away" pill) · updates replace (a 30-day patch pulse strip).

QoL:
- an inline target popover with presets;
- an undo toast for Remove and "I own this";
- one-tap launcher confirm chips;
- URL-persisted filters, sort and view on every list;
- an expandable "9 stores compared" drawer;
- keyboard navigation (j/k, w, ?);
- bulk/Steam-profile import replacing the samples;
- an actionable zero-patch fallback.

Competitor features:
1. official vs key-shop split (GG.deals);
2. historical low + 90-day sparkline (ITAD/SteamDB);
3. time to beat / hours budget (HLTB/Backloggd);
4. Steam library + wishlist import (ITAD/Playnite);
5. bundle and free-giveaway detector (ITAD/GG.deals);
6. sale cadence + next-sale countdown (SteamDB);
7. depot build bumps + ProtonDB pill (SteamDB/ProtonDB);
8. a private backlog note (Backloggd).

Modernisation: a ⌘K command palette; bento metric tiles with spend gauges; a sticky contextual action bar on scroll; layout-matched skeletons + cover-art fallback cards (blocking for art resilience).

Keep: the palette, condensed type + Plex Mono prices, the wishlist price-position gauge, the patch taxonomy + games rail, honest free/baseline copy, sample onboarding + JSON backup, and the phone tab bar.
