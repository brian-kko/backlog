# Gemuzu task for Gemini: the Gemuzu card back (SVG code)

You were given this file as a task. Do exactly what it asks and reply only in the RETURN FORMAT at the end. Do not summarise the file.

## Context

Gemuzu is a web app for PC players: a game backlog, cross-store price watcher and patch-note digest. Its signature visual is a **hand of cards**: each page's games are shown as a fanned deck of game covers. When a game has no cover art, its card should show the **Gemuzu card back** instead, the way a playing card shows its back.

Colours. Use ONLY these CSS custom properties, so the art follows the app's light and dark themes:
- `var(--art-bg, #1a1d18)`: card surface
- `var(--art-ink, #f2f4eb)`: main lines
- `var(--art-muted, #b6bcad)`: pattern lines
- `var(--art-accent, #c8ed78)`: ONE small accent

## Write two SVGs

**1. `card-back-portrait.svg`**, `viewBox="0 0 600 900"` (2:3, like a game cover).

A modern card-back design:
- a full-bleed rect in `--art-bg`;
- a thin inset border, 24px from the edge with rounded corners (rx 20), in `--art-muted` at stroke-opacity 0.5;
- inside it, a subtle **geometric repeat**: concentric rounded rectangles, a fine diagonal lattice, or a dot grid, drawn in `--art-muted` at stroke-opacity 0.12–0.2, so it reads as texture, not noise;
- at the centre, a small emblem: three short horizontal bars stacked and left-aligned, like a menu glyph / stack of cards, about 72px wide, in `--art-ink`. The top bar is in `--art-accent`.

Leave the bottom third quieter (lower pattern opacity), because the app may print the game's title there.

**2. `card-back-wide.svg`**, `viewBox="0 0 1232 706"`.

The same design adapted to landscape:
- the border inset is the same;
- the emblem sits at about 70% across horizontally and 50% vertically;
- the **left 55% is quieter** for a title.

## Rules

- No text, letters, numbers or logos (the emblem is just three bars).
- No `<image>`, external references, `<filter>`, blur, `<foreignObject>` or scripts.
- Use a `<pattern>` for the repeat if you like; that's fine.
- No animation (these are static).
- Each file under 6 KB. Whole-number coordinates, hand-written, readable.

## RETURN FORMAT

Exactly two fenced code blocks, nothing else:

```svg
<!-- card-back-portrait.svg -->
<svg ...>...</svg>
```

```svg
<!-- card-back-wide.svg -->
<svg ...>...</svg>
```
