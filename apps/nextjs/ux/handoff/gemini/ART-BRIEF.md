# Gemuzu art brief for Gemini

Generate these in the Gemini app, then save them under
`apps/nextjs/public/art/` with the exact file names below. Claude will wire
them in and check them in both themes and at every width.

## Shared style (paste this before each prompt)

> Style: flat, editorial illustration with a slightly industrial,
> retro-hardware feel, like a game cartridge, a console label or a
> technical diagram. Two-tone, mostly one ink colour with a single bright
> accent. Clean geometric shapes, a few confident lines and subtle grain at
> most. **No text, letters, numbers, logos or brand marks of any kind**
> (the app adds its own text). No people's faces. No real game characters,
> franchises or trademarks. No gradients that need blur, no glow halos, no
> photo realism. Lots of empty space around the subject.

Palette:

| Role | Dark theme | Light theme |
|---|---|---|
| Background | `#121411` (olive ink) | `#f4f3ed` (paper) |
| Main ink | `#f2f4eb` (paper) | `#20241c` (ink) |
| Muted lines | `#b6bcad` | `#596150` |
| Accent (use sparingly) | `#c8ed78` (lime) | `#426619` (olive green) |

Every illustration is needed in **two versions**, one drawn for the dark
background and one for the light background. Both use a **transparent
background** (PNG with alpha). If Gemini can't do transparency, use the
exact background colour from the table.

## 1. Empty-state illustrations (most visible)

These appear centred above the empty-state message, at about 320×213 on
screen (export 2×).

| File (dark / light) | Size | Subject |
|---|---|---|
| `empty-library-dark.png` / `empty-library-light.png` | 960×640 | An empty cartridge shelf or rack: a few empty slots, one slot with a faint lime outline as if waiting for the first game. |
| `empty-wishlist-dark.png` / `empty-wishlist-light.png` | 960×640 | A price tag hanging from a pin, with a small lime target or crosshair beside it, suggesting "watching for the right price". |
| `empty-updates-dark.png` / `empty-updates-light.png` | 960×640 | A quiet signal or antenna mast with two or three thin concentric arcs, one arc in lime, suggesting "listening for news". |
| `empty-deals-dark.png` / `empty-deals-light.png` | 960×640 | A magnifying glass over a small stack of blank cartridges, for "no deals match these filters". |

Prompt example (adapt the subject):

> [Shared style]. Subject: an empty game-cartridge shelf seen slightly from
> the front: five empty rectangular slots in a row, drawn with clean
> paper-coloured lines (#f2f4eb) on a transparent background, the third
> slot outlined in lime (#c8ed78) as if waiting for a cartridge. Wide
> composition, 3:2, generous margins, no text.

## 2. Fallback game art (for games with no artwork)

Used when Steam or Riot has no image for a game. The app prints the game's
title on top, so leave the **lower-middle area calm**.

| File | Size | Subject |
|---|---|---|
| `fallback-wide.png` | 1232×706 (2× of 616×353) | A game cartridge lying at a slight angle on a dark olive surface, with a blank lime label strip. Lots of empty dark space on the left half for the title. |
| `fallback-portrait.png` | 600×900 | The same cartridge, upright, label strip near the top, empty lower half. |

These sit on the dark card surface in both themes (the cards are dark), so
**one dark version** is enough. Use a background of `#1a1d18`, not
transparent.

## 3. Social share backgrounds (link previews)

When someone shares a Gemuzu link (Discord, iMessage, X), this is the image
shown. The app overlays the page title in its own font, so **leave the left
60% calm**.

| File | Size | Subject |
|---|---|---|
| `og-background.png` | 1200×630 | Three or four game cartridges fanned like a hand of cards on the right side, angled, with blank labels, one label in lime. Background `#121411` with a very faint dot grid. |

## Checklist before you hand them back

- [ ] No text, letters or logos anywhere (zoom in; AI art often hides fake lettering on labels).
- [ ] Exact sizes, PNG.
- [ ] Dark and light versions where asked.
- [ ] Lime used for one accent only, not as a fill everywhere.
- [ ] Saved to `apps/nextjs/public/art/` with the file names above.

Then tell Claude "art is in". It will wire up the empty states, fallback
cards and share image, check contrast and sizes, and report back.
