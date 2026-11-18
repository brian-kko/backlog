# Masthead review (round 7, feat/ui-council-6)

## 1. Ghost page word: remove it
It reads as a rendering mistake, not as depth.
- **It repeats the H1.** The same word sits about 700px to the left at full contrast. A page title shown twice in one band of the screen is redundant.
- **It's cropped by its own mask.** `linear-gradient(to right, transparent, #000 35%)` wipes out the first glyph, so the word reads "IBRARY", "EALS" or "IOME" (dark-1440-library, around x1050–1300 and y265–340). At 1024 the 280px box crops it further.
- **The art covers it.** The covers, the deck and the hero sit on top of 40–60% of the word, so what shows looks like stray letter fragments.
- **Its size changes from page to page.** `344px / (chars × 0.5)` gives DEALS/HOME 128px, LIBRARY/UPDATES 98px and WISHLIST 86px, so the masthead feels slightly different on every page.
- **In light theme** it's a grey smudge on paper (light-1440-deals) that looks like a ghosting artifact.

**Replace it with** a contact shadow under the covers and the deck. This grounds them on a "table", and it's the real fix for the bottom-right gap the word was filling.

## 2. Masthead art
- **Edges:** there are no hard edges now. The `closest-side` radial mask works. But the result is a centred oval "cameo" (x≈950–1304, y≈90–345 at 1440), and its right edge fades at the container edge instead of carrying on toward the viewport edge.
- **Light theme:** at 0.22 opacity the hero turns into a milky pink or yellow wash (Deals and Wishlist). On paper it should read as ink.
- **Library hero:** Cyberpunk's yellow makes a highlighter-like blob at x≈1000–1060, y≈140–300 that competes with the lime accent.
- **Empty areas:** below the description there's a dead band at x136–800, y≈260–340 on Deals, Library and Wishlist. `min-height: 240px` is sized for Home's content. The covers sit high (y≈150–290) while the box runs to y≈340, so its bottom 50px held only the ghost word.
- **Balance:** there's a gap of about 200px between the title block (ends x≈750) and the art (starts x≈950), which is fine. Both blocks are vertically centred, so the overall balance is good once the dead band is removed.

## 3. Library deck
- **At rest:** it reads as a stack more than a hand. With origin `50% 120%` and a 20px spread at 5deg, the hidden cards show only ~28px slivers (one yellow bar, "ELD") and there is no arc.
- **On hover:** the fan works and the middle card lifts. But the lifted card stays tilted, the lift is small, and the shadow doesn't change.

Tuning:
```css
.deck-card { transform-origin: 50% 220%;          /* real arc: outer cards drop */
  transform: translateX(calc(var(--o)*var(--spread))) rotate(calc(var(--o)*var(--tilt)))
             translateY(var(--lift,0px)) scale(var(--pop,1));
  box-shadow: 0 1px 2px rgb(0 0 0/.4), 0 6px 16px rgb(0 0 0/.3); }
.cover-deck { --spread: 14px; --tilt: 6deg; }                 /* ≈37px per card at rest */
.cover-deck:hover { --spread: 12px; --tilt: 8deg; }           /* 5 cards ≈260px, fits 280 */
@media (min-width:1200px){ .cover-deck:hover { --spread: 22px; --tilt: 10deg; } }
.deck-card:hover { --lift: -28px; --pop: 1.06; }
.deck-card::after { content:""; position:absolute; inset:0; border-radius:8px; z-index:-1;
  box-shadow: 0 18px 32px rgb(0 0 0/.45); opacity:0; transition: opacity 260ms; }
.deck-card:hover::after { opacity:1; }
:root:not(.dark) .deck-card { box-shadow: 0 1px 2px rgb(30 36 14/.25), 0 6px 14px rgb(30 36 14/.18); }
```
Count: show 5 cards when the collection has 5 (`deck.slice(0, 5)`). Three cards don't read as a hand.

## 4. Ranked changes
1. **Remove the ghost word and add a contact shadow.** In `game-ui.tsx`, delete the `<span className="cover-mosaic-word">` lines (756 and 813) and the `--word-chars` style (881). In `mastheads.css`, delete the `.cover-mosaic-word` rules (65–78, 160–162, 184–186 and its hover rule), the hover selector at 203, and both `--masthead-word-opacity` declarations. Then add:
   `.cover-mosaic-track::after, .cover-deck::before { content:""; position:absolute; left:50%; bottom:-16px; width:220px; height:28px; translate:-50% 0; z-index:-1; background: radial-gradient(closest-side, rgb(0 0 0/.45), transparent); }` and `:root:not(.dark) …{ background: radial-gradient(closest-side, rgb(30 36 14/.2), transparent); }`
2. **Tighten the band and centre the art.** In `mastheads.css` at ≥1024px, set `.page-heading { min-height: 216px }` and `.cover-mosaic { height: 216px }`. Set `.cover-mosaic-track { top: 50%; translate: 0 -50% }`, and change `.cover-deck`'s `bottom: 40px` to `bottom: 46px`.
3. **Deck tuning** from section 3 (`mastheads.css`), plus `slice(0, 5)` at the call site.
4. **Ink the art in light theme and shift the mask off-centre.** Use `:root:not(.dark) .cover-mosaic-hero { mix-blend-mode: multiply; --masthead-hero-opacity: .3 }` and `mask-image: radial-gradient(ellipse 62% 72% at 58% 48%, #000 35%, rgb(0 0 0/.45) 65%, transparent 100%)`. This uses opacity and compositing only, with no filter.
