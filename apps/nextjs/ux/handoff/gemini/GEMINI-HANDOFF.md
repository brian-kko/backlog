# Gemini handoff: Gemuzu art, animation and UI review

This is one file with everything for Gemini. Each **Task** below is a
self-contained message: paste it into a **new Gemini chat**, attach the
files it names, and save what comes back exactly as its **Return** section
says. When you're done, tell Claude which tasks are in; it will wire them
up, check both themes and every width, and report back.

**Never paste `.env` contents, API keys or tokens into Gemini.**

| # | Task | Gemini mode | You attach | You save to |
|---|---|---|---|---|
| A | Empty-state illustrations (animated SVG) | Strongest text/code model | nothing | `apps/nextjs/public/art/empty-*.svg` + `motion.md` |
| B | Fallback game cards | Image generation | nothing | `apps/nextjs/public/art/fallback-*.png` |
| C | Share-image background | Image generation | nothing | `apps/nextjs/public/art/og-background.png` |
| D | Cartridge mascot (optional) | Strongest text/code model | nothing | `apps/nextjs/public/art/cartridge.svg` |
| E | Independent UI/UX review | Strongest model with image input | the 10 PNGs in `review/` | `apps/nextjs/ux/reviews/gemini-r8.md` |

Order: **E first** (it doesn't depend on anything), then **A**, then
**B/C**, and D if you like it.

---

## Shared context (already included in every task below)

Gemuzu (ゲームズ, "games") is a PC game backlog, cross-store price watcher
and patch-note digest. Visual identity:

- **Olive ink / paper palette with one lime accent.** It feels like retro
  game hardware (cartridges, console labels, technical diagrams), drawn
  with editorial restraint.
- **Type:** Barlow Condensed (display, uppercase), Barlow (body), IBM Plex
  Mono (prices).
- **Motion:** transform and opacity only. No blur, filters or WebGL, nothing
  that loops forever at high intensity, and everything stops under
  `prefers-reduced-motion`.

| Token | Dark theme | Light theme | Use |
|---|---|---|---|
| `--background` | `#121411` | `#f4f3ed` | page |
| `--card` | `#1a1d18` | `#ffffff` | panels |
| `--foreground` | `#f2f4eb` | `#20241c` | main ink |
| `--muted-foreground` | `#b6bcad` | `#596150` | secondary lines |
| `--border` | `#2c3227` | `#d9dccf` | hairlines |
| `--signal` | `#c8ed78` | `#426619` | the one accent |

---

## Task A: empty-state illustrations (animated SVG)

**Paste this whole block into a new chat:**

````
You are an illustrator who writes production SVG by hand. Create 4 small
illustrations for empty states in a web app called Gemuzu (a PC game
backlog and price tracker). They sit centred above a short message like
"Your library is empty" at about 280×187 CSS pixels.

STYLE
- Flat line illustration with a retro game-hardware feel (cartridges,
  console labels, technical diagrams). Confident 2px strokes, rounded caps
  and joins, a few filled shapes and lots of empty space.
- Exactly three colour roles, and NO hard-coded colours. Use these CSS
  custom properties so the art follows the app's light/dark theme:
    ink    -> var(--art-ink, currentColor)   main lines and shapes
    muted  -> var(--art-muted, #b6bcad)      secondary lines and details
    accent -> var(--art-accent, #c8ed78)     ONE small highlight per image
  Fills that should read as "background-ish" use the ink colour at
  fill-opacity 0.08–0.15 (not a new colour).
- Absolutely NO text, letters, numbers, logos, brand marks, faces or real
  game characters.

TECHNICAL RULES (strict)
- One self-contained <svg> per illustration: viewBox="0 0 300 200", no
  width/height attributes, role="img" plus a <title> describing it (the app
  may hide it from screen readers; that's fine).
- No <image>, no external references, no <filter>, no blur, no masks with
  feGaussianBlur, no <foreignObject>, no scripts.
- Group the parts that animate in <g> elements with class names given
  below. Put transform-box: fill-box and a sensible transform-origin on
  each animated group, inside a <style> in the SVG.
- Animation lives in that same <style> as CSS @keyframes using ONLY
  transform and opacity. Gentle and slow: 2.4–4s, ease-in-out, infinite
  alternate, with small amplitudes (≤ 6px translate, ≤ 6° rotate, opacity
  between 0.35 and 1).
- Include this block so motion stops for users who ask:
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
- Keep each file under 6 KB. Round coordinates to whole numbers.
  Hand-written, readable paths; no auto-traced noise.

THE FOUR ILLUSTRATIONS

1. empty-library.svg: "Your shelf is ready."
   A cartridge shelf seen from the front: a long base line, 5 vertical
   slots (rounded rectangles, about 28×52) in a row on the shelf. Slots
   1, 2, 4 and 5 are drawn in muted outline. Slot 3 is outlined in accent
   and empty. Above slot 3, a single cartridge (a rounded rectangle with a
   notch at the top and a small label rectangle) hovers about 10px up, in
   ink.
   Animation: group .cart bobs down 4px and back (3s); group .slot-glow
   (slot 3's outline) fades opacity 0.5→1 in sync.

2. empty-wishlist.svg: "Watching for the right price."
   A price tag (a rotated rounded rectangle with a punched hole and a short
   string to a pin at the top) in ink, with three horizontal muted lines on
   the tag standing in for text (NOT actual text). To its lower right, a
   small accent crosshair or target: a circle, two short ticks and a dot.
   Animation: group .tag swings ±4° around the pin (3.2s); group .target
   pulses scale 0.94→1 with opacity 0.6→1 (2.4s).

3. empty-updates.svg: "Listening for patch notes."
   A slim antenna mast in ink on a small base, with three concentric arcs
   radiating to the right. The two inner arcs are muted, the outer arc is
   accent. Below the base, two muted horizontal dashes stand in for a
   document.
   Animation: groups .arc1, .arc2 and .arc3 fade opacity 0.35→1 one after
   another (2.4s, delays 0s, 0.3s, 0.6s), like a signal going out.

4. empty-deals.svg: "No deals match these filters."
   A magnifying glass in ink (a circle lens, a short thick handle at 45°)
   over a small stack of 3 blank cartridges in muted outline. Inside the
   lens, one cartridge label shows a tiny accent tick mark.
   Animation: group .lens drifts in a small left-right sweep (translateX
   −6px→6px, 3.6s).

RETURN FORMAT (exactly this, nothing else):
- Four fenced code blocks, each starting with a comment line naming the
  file, e.g.
  ```svg
  <!-- empty-library.svg -->
  <svg ...>...</svg>
  ```
- Then one fenced ```markdown block titled motion.md: a table with columns
  file | group class | keyframes name | duration | what it does.
- No other commentary.
````

**Return.** Save each SVG block as its own file, named as in its first
comment line, into `apps/nextjs/public/art/`. Save the markdown block as
`apps/nextjs/public/art/motion.md`.

**Check before you hand it back:**
- Open each `.svg` in a browser: it animates gently and has no text or
  letters.
- Search the files: there's no `filter` and no `#` hex colour outside the
  `var()` fallbacks.

**Good:**
- a calm, readable silhouette at 280px wide;
- one small lime accent;
- motion you notice only if you look for it.

**Bad:**
- busy detail or tiny strokes that vanish at small size;
- several accent colours;
- bouncy or fast motion;
- fake lettering on labels.

---

## Task B: fallback game cards (image generation)

Shown when Steam or Riot has no artwork for a game. The app writes the
game's title over the image, so **the left/lower area must stay calm and
dark**. Ask for each image separately.

**Prompt B1 (wide card):**

```
Create a 1232×706 pixel image (16:9-ish landscape).

Subject: a single retro game cartridge lying at a slight angle on a matte
dark olive surface, seen from above at about 30 degrees. The cartridge is
dark charcoal plastic with subtle moulded ridges and a blank,
slightly-worn lime-green label strip (#c8ed78) across its top third. Soft,
directional studio light from the top right with gentle falloff, no glow
halos and no lens flare.

Composition: the cartridge sits in the RIGHT 45% of the frame. The left
55% is empty, even, dark olive (#1a1d18 to #121411) with a very faint
grain, because text will be placed there.

Style: clean product photography meets editorial illustration, muted
colours, high detail but calm.

Strictly NO text, letters, numbers, logos, brand marks or symbols anywhere,
including on the label (the label must be blank). No hands, no people, no
other objects.
```

**Prompt B2 (portrait card):** use the same prompt, with these changes:
- Size: `600×900 pixels (2:3 portrait)`.
- Composition: `the cartridge stands upright in the TOP 55% of the frame,
  centred, label facing the viewer; the bottom 45% is empty dark olive for
  text`.

**Return:** PNG, at exactly those sizes. Save as
`apps/nextjs/public/art/fallback-wide.png` and
`apps/nextjs/public/art/fallback-portrait.png`.

**Check before you hand it back:**
- Zoom in on the label: it must have no fake text.
- The calm area really is calm (no props or bright spots).
- If the size is off, regenerate rather than crop the subject.

---

## Task C: share-image background (image generation)

Used for link previews (Discord, iMessage, X). The app draws the page
title in its own font on the **left 55%**.

**Prompt C:**

```
Create a 1200×630 pixel image.

Subject: four retro game cartridges fanned out like a hand of playing
cards, held at a slight angle (the whole fan tilted about −8 degrees),
on the RIGHT 45% of the frame. The cartridges are dark charcoal plastic
with blank labels; exactly ONE label is lime green (#c8ed78), the others
are pale paper (#f2f4eb). Gentle soft shadows under the fan.

Background: deep olive ink (#121411) with a very faint, regular dot grid
(tiny dots every ~24px, about 5% brighter than the background), fading out
towards the edges. A soft, low-contrast olive-lime glow sits behind the
fan only (no bloom or blur haze over the cartridges).

The LEFT 55% must be clean background (just the faint dot grid), since text
will go there.

Style: modern, minimal, premium product key art; matte, not glossy.

Strictly NO text, letters, numbers, logos or symbols anywhere, including
on the labels. No people.
```

**Return:** a PNG at exactly 1200×630, saved as
`apps/nextjs/public/art/og-background.png`.

---

## Task D (optional): cartridge mascot SVG

A small reusable cartridge drawing for loading states and the 404 page.

```
Write one hand-made SVG of a retro game cartridge, viewBox="0 0 120 150",
using the same colour rules as before: var(--art-ink, currentColor) for
the body outline and details, var(--art-muted, #b6bcad) for ridges, and
var(--art-accent, #c8ed78) for a blank label rectangle. Include: a rounded
body, a notched top edge, 5 ridge lines near the bottom, the blank label
on the upper half, and a tiny connector edge with 8 teeth at the bottom.

Group classes: .body, .label, .teeth.

Animation in an internal <style>, transform/opacity only: .label fades
opacity 0.7→1 (2.8s alternate), and the whole <svg> gets a class "insert"
whose keyframes translate it 0→6px down and back (1.6s), to be triggered
by the app, so define the keyframes but do NOT apply them by default.
Include the prefers-reduced-motion block. Under 4 KB. No text, filters or
blur.

Return ONLY one fenced ```svg block starting with <!-- cartridge.svg -->.
```

**Return:** save the block as `apps/nextjs/public/art/cartridge.svg`.

---

## Task E: independent UI/UX review

**Attach:** the 10 screenshots in `apps/nextjs/ux/handoff/gemini/review/`,
in number order. They're regenerated by each audit; ask Claude for fresh
ones if the UI changed.

**Paste:** the whole of `apps/nextjs/ux/handoff/gemini/REVIEW-PROMPT.md`
below its first line.

Then **add this return format** to the end of your message:

````
RETURN FORMAT: reply with exactly these sections, in this order, as markdown:

## Score
`SCORE: x.x/10` on its own line, then one line per rubric category:
`- <category name>: x.x — <one-sentence reason>`

## Blocking issues
Numbered 1–5, most important first. Each:
- **Screenshot:** <number and name>
- **Element:** <what, and where on the screen>
- **Problem:** <what's wrong, with any measurement you can estimate>
- **Fix:** <the exact change: layout, size, colour (hex), copy, behaviour>
- **Severity:** blocking | important | polish

## Deck verdicts
A table with columns page | verdict (keep / change / replace) | why |
replacement idea if any, with one row each for Home, Deals, Library,
Wishlist and Updates.

## Quality of life
A numbered list (6–10). Each: the change, where, why, and effort S/M/L.

## Competitor features
A ranked table with columns rank | feature | from (site/app) | where in
Gemuzu | data source | effort S/M/L | why it beats doing it in Steam.

## Modernisation
3–5 items. Each: what feels dated (screenshot and element), the modern
pattern (and who does it well), and the exact change.

## Keep
A bullet list of what works and must not regress.

## Machine summary
One fenced ```json block:
{"score": 0.0, "blocking": [{"screenshot": 0, "title": "", "fix": ""}],
 "deck": {"home": "", "deals": "", "library": "", "wishlist": "", "updates": ""}}
````

**Return:** save Gemini's full reply as
`apps/nextjs/ux/reviews/gemini-r8.md`, then tell Claude "gemini review is
in".

---

## What Claude does with each return

- **A:**
  - put the SVGs inline in each page's empty state, mapping `--art-*` to
    the theme tokens;
  - check contrast in both themes and that reduced motion stops the
    animation;
  - keep the illustrations out of the screen-reader tree.
- **B:** use them as the art fallback before the text placeholder, with the
  title laid over the calm area.
- **C:** build `opengraph-image` routes that draw each page's title over the
  background with `next/og`.
- **D:** add it to the loading and 404 states, and use the "insert"
  animation when a game is added.
- **E:** merge it with the astra and Opus reviews, de-duplicate, and turn the
  agreed blocking fixes into the next round's tasks.
