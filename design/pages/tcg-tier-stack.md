# Page System: tcgTierStack

> The hidden graphics tool at `/tcg-tier-stack`. Adds to `design/hutton-design-system.md` and wins on this page. Styling is deliberately minimal for now.

**Version 1.0 · November 4, 2026 · Size: small · Scope: `.tier-stack-page`**

## Feel

- Professional but fun and friendly, with smooth transitions and rounded borders.
- A real design tool that feels smooth and satisfying to use.
- Planned look, from Alex's mood board: dark (petrel and storm), Figtree as a stand-in for Google Sans Rounded, everything a bit rounded, the four default tier colors as accents, and smooth motion throughout. Not built yet. New visuals start as a side-by-side demo.

## Color

Colors for the planned dark theme.

| Name       | Hex       | Semantic roles | Used for                                             |
| ---------- | --------- | -------------- | ---------------------------------------------------- |
| Petrel 50  | `#F2F5F6` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 100 | `#E3E8EB` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 200 | `#CCD4D8` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 300 | `#B3BEC4` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 400 | `#94A2AA` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 500 | `#6C7D88` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 600 | `#546470` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 700 | `#3E4B53` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 800 | `#2D373D` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 850 | `#232B30` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 900 | `#1B2125` |                | Not used yet. Planned for surfaces, borders and text |
| Petrel 950 | `#12171A` |                | Not used yet. Planned for surfaces, borders and text |
| Storm 100  | `#DCEAF1` |                | Not used yet. Planned as the accent                  |
| Storm 200  | `#BFD7E4` |                | Not used yet. Planned as the accent                  |
| Storm 300  | `#9CC0D4` |                | Not used yet. Planned as the accent                  |
| Storm 400  | `#78A5BD` |                | Not used yet. Planned as the accent                  |
| Storm 600  | `#466E85` |                | Not used yet. Planned as the accent                  |
| Storm 800  | `#2A4352` |                | Not used yet. Planned as the accent                  |

Board colors (tier colors, backgrounds, borders) are canvas colors that users can change. See Exceptions in the HuttonDesign System.

## Typography

Canvas text uses Inter Black (900), loaded in this route's `layout.tsx` as `--font-inter`. The controls use Lato, the site default.

## Motion

| Token                | Value                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ease-spring`        | linear(0, 0.032, 0.109, 0.212, 0.326, 0.439, 0.545, 0.641, 0.725, 0.795, 0.853, 0.899, 0.935, 0.962, 0.982, 0.996, 1.005, 1.011, 1.014, 1.015, 1.015, 1.014, 1.012, 1.011, 1.009, 1.007, 1.006, 1.005, 1.003, 1.002, 1) |
| `duration-move`      | 450ms                                                                                                                                                                                                                   |
| `duration-fade`      | 120ms                                                                                                                                                                                                                   |
| `duration-fold`      | 180ms                                                                                                                                                                                                                   |
| `duration-fold-fade` | 110ms                                                                                                                                                                                                                   |
| `ease-fold`          | cubic-bezier(0.4, 0, 1, 1)                                                                                                                                                                                              |

- A spring that goes 1.5% past (3% looked like too much live). 450ms for things that move, with plain `ease-out` fades of about 120ms alongside. Use it for new tcgTierStack animations.
- Popups share `.tier-stack-menu`: stretch open, fold closed. The card menu goes left to right, dropdowns top to bottom.
- Closing folds back over `duration-fold` on `ease-fold`, speeding up as it goes. The timers in `Editor.tsx` and `ui/Dropdown.tsx` wait for it.
- Reduced motion: fades only, closing over `duration-fold-fade`.

## Changelog

- **November 4, 2026 · v1.0:** Feel added by Alex; full popup motion recorded.
- **November 4, 2026 · v0.1:** Initial draft, recorded from the page as it is.
