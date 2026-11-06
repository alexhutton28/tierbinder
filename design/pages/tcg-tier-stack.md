# Page System: tcgTierStack

> The hidden graphics tool at `/tcg-tier-stack`. Adds to `design/hutton-design-system.md` and wins on this page.

**Version 1.2 · November 5, 2026 · Size: small · Scope: `.tier-stack-page`**

## Feel

- Professional but fun and friendly, with smooth transitions and rounded borders.
- A real design tool that feels smooth and satisfying to use.
- The look, from Alex's mood board: dark (petrel and storm), Figtree as a stand-in for Google Sans Rounded, and smooth motion throughout.
- The window is a working tool: a 48px top bar, a docked left sidebar and the board centered in its own darker workspace, divided by 1px lines with no floating panels. Controls are 32px tall with 13px text, and most stay quiet until hovered. Storm blue marks main actions, and the tier colors mark the main nav. Controls and popups use `radius-small`.

## Color

The interface's palette. The look is set as `--ts-*` roles on `body:has(.tier-stack-page)` in `globals.css`.

| Name        | Hex       | Semantic roles | Used for                                         |
| ----------- | --------- | -------------- | ------------------------------------------------ |
| Petrel 50   | `#F2F5F6` |                | Not used yet                                     |
| Petrel 100  | `#E3E8EB` |                | Text, selected tool                              |
| Petrel 200  | `#CCD4D8` |                | Not used yet                                     |
| Petrel 300  | `#B3BEC4` |                | Not used yet                                     |
| Petrel 400  | `#94A2AA` |                | Muted text                                       |
| Petrel 500  | `#6C7D88` |                | Not used yet                                     |
| Petrel 600  | `#546470` |                | Not used yet                                     |
| Petrel 700  | `#3E4B53` |                | Button and popup borders                         |
| Petrel 800  | `#2D373D` |                | Dividing lines, hover                            |
| Petrel 850  | `#232B30` |                | Popups                                           |
| Petrel 900  | `#1B2125` |                | Top bar, sidebar                                 |
| Petrel 950  | `#12171A` |                | Workspace, fields, text on main actions          |
| Storm 100   | `#DCEAF1` |                | Not used yet                                     |
| Storm 200   | `#BFD7E4` |                | Main button hover, focus outline                 |
| Storm 300   | `#9CC0D4` |                | Main buttons                                     |
| Storm 400   | `#78A5BD` |                | Not used yet                                     |
| Storm 600   | `#466E85` |                | Not used yet                                     |
| Storm 800   | `#2A4352` |                | Not used yet                                     |
| Tier Goated | `#D9532B` |                | Default tier color. Board only                   |
| Tier Solid  | `#F0912F` |                | Default tier color. Save & Share in the main nav |
| Tier Mid    | `#F5C95B` |                | Default tier color. Customize in the main nav    |
| Tier Fraud  | `#7CC05A` |                | Default tier color. Add Cards in the main nav    |

Board colors (tier colors, backgrounds, borders) are canvas colors that users can change. See Exceptions in the HuttonDesign System.

## Typography

Canvas text uses Inter Black (900), loaded in this route's `layout.tsx` as `--font-inter`. The controls use Figtree, loaded in the same `layout.tsx` as `--font-figtree`.

## Motion

| Token                | Value                                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ease-spring`        | linear(0, 0.032, 0.109, 0.212, 0.326, 0.439, 0.545, 0.641, 0.725, 0.795, 0.853, 0.899, 0.935, 0.962, 0.982, 0.996, 1.005, 1.011, 1.014, 1.015, 1.015, 1.014, 1.012, 1.011, 1.009, 1.007, 1.006, 1.005, 1.003, 1.002, 1) |
| `duration-move`      | 450ms                                                                                                                                                                                                                   |
| `duration-drop`      | 300ms                                                                                                                                                                                                                   |
| `duration-hover`     | 200ms                                                                                                                                                                                                                   |
| `duration-fade`      | 120ms                                                                                                                                                                                                                   |
| `duration-fold`      | 180ms                                                                                                                                                                                                                   |
| `duration-fold-fade` | 110ms                                                                                                                                                                                                                   |
| `ease-fold`          | cubic-bezier(0.4, 0, 1, 1)                                                                                                                                                                                              |

- A spring that goes 1.5% past (3% looked like too much live). 450ms for things that move, with plain `ease-out` fades of about 120ms alongside. Use it for new tcgTierStack animations.
- Button hover colors ease over `duration-hover`.
- Popups share `.tier-stack-menu`: stretch open, fold closed. Dropdowns open faster, over `duration-drop`, because people use them constantly. The card menu goes left to right, dropdowns top to bottom.
- Closing folds back over `duration-fold` on `ease-fold`, speeding up as it goes. The timers in `Editor.tsx` and `ui/Dropdown.tsx` wait for it.
- Reduced motion: fades only, closing over `duration-fold-fade`.

## Components

### Top bar

- Replaces the site header on this page, and is sticky with the same status bar padding. It holds the tool's name (a link home), the board type, Copy PNG and Export PNG. Copy PNG hides on phones, and stays in the Save & Share tab.

### Settings

- Section headings are 12px and muted. Rows put the label on the left and the value on the right.
- Color pickers are plain 24px swatches, next to their hex field.

### Main nav

- A radio bar (`ui/RadioBar.tsx`): Add Cards, Customize and Save & Share, in `tier-fraud`, `tier-mid` and `tier-solid`. Text is Figtree 16px at weight 600, and columns size to their labels.
- A colored block hugs the selected word, with 4px of padding top and bottom and 8px at the sides. It springs to the next word over `duration-move` and changes color over `duration-hover`.
- Reduced motion: the block moves straight away and only its color fades.

## Changelog

- **November 5, 2026 · v1.2:** Docked window built on Soft Panels: top bar, left sidebar and workspace divided by 1px lines, 32px controls with 13px text, and the main nav radio bar in the tier colors. Panels no longer float, so `radius-medium` is unused here.
- **November 5, 2026 · v1.1:** Soft Panels look built: dark interface, Figtree, and the four default tier colors added to the palette ([#37](https://github.com/alexhutton28/big-a-website/issues/37)).
- **November 4, 2026 · v1.0:** Feel added by Alex; full popup motion recorded.
- **November 4, 2026 · v0.1:** Initial draft, recorded from the page as it is.
