# Gemuzu task for Gemini: cartridge mascot (SVG code)

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