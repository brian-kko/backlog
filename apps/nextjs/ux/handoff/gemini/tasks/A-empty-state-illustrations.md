# Gemuzu task for Gemini: animated empty-state illustrations (SVG code)

You were given this file as a task. Do exactly what it asks and reply only in the RETURN FORMAT at the end. Do not summarise the file.

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