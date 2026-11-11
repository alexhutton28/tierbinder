# The HuttonDesign System: TierBinder

> **You are reading `hutton-design-system.md`, "The HuttonDesign System."**
> This is TierBinder's brand and design system.
>
> How to build with it is in the `hutton-design` skill's `hutton-design-rules.md`.

This system records the tool as it is today. Where the code differs, it is tracked in issues and changes when that work is done: existing code is not rewritten to match.

**Version 1.5 · November 10, 2026 · Design owner: Alex Hutton · Size: small**

## 1. Rule tiers

**Locked (never change)**

- Logos: the files in `public/` are used as they are, never redrawn or recolored.
- Typefaces: Figtree and Inter.
- The palette. New colors need Alex's approval.

**Standard (follow as written)**
Spacing scale, type scale, radius values, breakpoints and motion.

**Open (can grow)**
Semantic tokens that map onto existing palette colors and spacing steps, recorded in the Changelog.

## 2. Principles

- Make unique designs. Take inspiration from anywhere, but stay out of the AI-generated style. Every element earns its place: taglines, very round corners, eyebrow headers and drop shadows are fine sometimes, when the design calls for them, but they are never defaults.
- Give every design element thought. Nothing looks or behaves a certain way just because of what it is: each component gets real care for its looks, usability and motion, and still works with a keyboard, a screen reader, touch and reduced motion.
- Consult best practices. Before building a feature that has an established pattern (a resize handle, a menu, tabs, a dialog, drag and drop), look up how it's usually done: the WAI-ARIA Authoring Practices, platform guidelines, and well-known tools. Follow the convention unless there's a reason not to, and say which one was followed and where it was left.
- Use color. Do not go monochromatic. Alex has a habit of sticking to one color, so use more of the palette and flag it when one color takes over.
- Professional but fun and friendly, with smooth transitions and rounded borders.
- A real design tool that feels smooth and satisfying to use.
- Dark interface in petrel and storm. Storm blue marks main actions, and the tier colors mark the main nav.
- The window is a working tool: a docked left sidebar headed by a 48px logo bar, and the board centered in its own darker workspace, which runs the window's full height, divided by 1px lines with no floating panels. Controls are 32px tall with 14px text (text buttons are just their words), and most stay quiet until hovered. Controls and popups use `radius-small`.
- Color is used by name through tokens (`bg-petrel-900`, `var(--color-storm-300)`), not raw hex.

## 3. Color

Petrel and storm are for the interface, and the tier colors are the brand's color. The look is set as `--tb-*` roles on `body` in `globals.css`.

| Name        | Hex       | Semantic roles | Used for                                                                                                   |
| ----------- | --------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| Petrel 50   | `#F2F5F6` |                | Section headings                                                                                           |
| Petrel 100  | `#E3E8EB` |                | Text, selected tool                                                                                        |
| Petrel 200  | `#CCD4D8` |                | Not used yet                                                                                               |
| Petrel 300  | `#B3BEC4` |                | Not used yet                                                                                               |
| Petrel 400  | `#94A2AA` |                | Muted text                                                                                                 |
| Petrel 500  | `#6C7D88` |                | Not used yet                                                                                               |
| Petrel 600  | `#546470` |                | Search and clear icons at rest, scrollbar thumb on hover                                                   |
| Petrel 700  | `#3E4B53` |                | Button, popup and field borders, option hover, scrollbar thumb                                             |
| Petrel 800  | `#2D373D` |                | Dividing lines, hover, skeleton shimmer                                                                    |
| Petrel 850  | `#232B30` |                | Popups, card placeholders and skeletons                                                                    |
| Petrel 900  | `#1B2125` |                | Sidebar                                                                                                    |
| Petrel 950  | `#12171A` |                | Workspace, fields, text on main actions; at part strength the View backdrop, scroll shade and popup shadow |
| Storm 100   | `#DCEAF1` |                | Not used yet                                                                                               |
| Storm 200   | `#BFD7E4` |                | Main button hover, focus outline                                                                           |
| Storm 300   | `#9CC0D4` |                | Main buttons, lit search icon                                                                              |
| Storm 400   | `#78A5BD` |                | Top bar                                                                                                    |
| Storm 600   | `#466E85` |                | Text field focus                                                                                           |
| Storm 800   | `#2A4352` |                | Not used yet                                                                                               |
| Tier Goated | `#F0392B` |                | Default tier color. Board only                                                                             |
| Tier Solid  | `#F78C1E` |                | Default tier color. Save & Share in the main nav                                                           |
| Tier Mid    | `#FFCB2E` |                | Default tier color. Customize in the main nav                                                              |
| Tier Fraud  | `#3CC65A` |                | Default tier color. Add Cards in the main nav                                                              |

Board colors (tier colors, backgrounds, borders) are canvas colors that users can change. See Exceptions.

## 4. Typography

Fonts are loaded with `next/font` in `src/app/layout.tsx`. The controls use Figtree (`--font-figtree`), with `system-ui` and `sans-serif` as fallbacks. Canvas text uses Inter Black (900, `--font-inter`). Hex fields and bulk import use the device's monospace (`font-mono`). The next/font variables are not generated, because next/font sets them.

| Token          | Size | Weight | Used for                                                                                                    |
| -------------- | ---- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `text-field`   | 16px | 400    | Fields on phones                                                                                            |
| `text-body`    | 14px | 400    | Page text, and fields from `b7` up. Buttons at 500, main nav at 400 (600 selected), section headings at 600 |
| `text-caption` | 12px | 400    | Set codes and notes in the Sets popup, on a 16px line                                                       |

- Sizes are in `rem`, in the `@theme` block at the top of `globals.css`, because the token generator has no type scale yet. Tailwind utilities are `text-body` and so on.
- Text uses the font's normal line height (about 1.2 for Figtree), not Tailwind's 1.5, so a line takes about the room its letters do and spacing measures what it looks like. `text-caption` keeps its set 16px line.
- Sizes stay on even numbers. Fields, including bulk import, are 16px below `b7`, because iPhones zoom the page when a field under 16px is tapped.
- Weights: buttons 500; section headings and the selected dropdown option 600; the main nav 400, with the selected tab at 600. Each tab keeps its semibold width, so selecting one doesn't shift the others.
- Page text keeps Tailwind's 1.5 line height. Letter spacing is left at each font's default.
- Number fields use even-width digits (`tabular-nums`).

## 5. Spacing

Seven steps, from 2px to 128px, the HuttonDesign default. Tailwind's numbered spacing utilities use these values, so `p-4` is 16px.

| Token          | Value |
| -------------- | ----- |
| `space-1`      | 2px   |
| `space-2`      | 4px   |
| `space-3`      | 8px   |
| `space-4`      | 16px  |
| `space-5`      | 32px  |
| `space-6`      | 64px  |
| `space-7`      | 128px |
| `space-button` | 12px  |

- `space-button` is the one exception to the steps: the side padding of buttons, where 8px is too tight and 16px too wide. It is for buttons only.
- Padding, margins, gaps and offsets use a step, in classes (`gap-3`) and in CSS (`var(--spacing-3)`). A size between steps rounds to the nearest one; there are no arbitrary spacing values such as `mt-[12px]`.
- Widths and heights are component sizes, not spacing. Each one is named once and reused (see No magic numbers in section 12), and most should come from the layout instead of a fixed number.
- An offset that has to equal a component size uses that size's name, not a copy of its value.
- Shadow offsets and animation distances belong to the shadow or the motion, not the spacing scale.

## 6. Border radius

| Token           | Value  | Used for                                                         |
| --------------- | ------ | ---------------------------------------------------------------- |
| `radius-small`  | 4px    | Buttons, fields, popups                                          |
| `radius-medium` | 8px    | The card menu: its rows' `radius-small` plus the 4px around them |
| `radius-large`  | 16px   | Not used yet                                                     |
| `radius-full`   | 9999px | Scrollbar thumbs                                                 |

- The values come from the spacing scale, but radius keeps its own tokens.
- The names avoid Tailwind's `sm`, `md` and `lg`.

## 7. Iconography

- Icons and logos are SVGs in `public/`, with no icon library package.
- Icons come from [Feather](https://feathericons.com) (MIT license). Copy the icon's SVG into `public/` under its Feather name, unchanged. Where it needs to follow the text color, use it as a CSS mask over `currentcolor` (see `.chevron` in `ui/Dropdown.module.css`).
- One exception: the Sets popup's checkmarks (`check.svg`, `check-dark.svg`) are Feather's `check` with a heavier 3.5 stroke, in white or Petrel 950, since they're drawn as the checkbox's background image, which a mask can't color.

## 8. Logo

- The logo is `public/tierbinder-combined-dark.svg`: a spiral-bound stack of sheets in the four tier colors, with a Petrel 900 outline, and the name set in Fraunces (weight 600, softness 50, -3.5% letter spacing) as outlines, so the font isn't loaded. Its name and outline are Petrel 900, so it needs a light background.
- It sits directly on the Storm 400 top bar at its full size, 114 × 25. Don't place it on dark surfaces like Petrel 900, where the outline and name disappear.

## 9. Imagery and visuals

- No favicon or share image yet.

## 10. Interaction behavior

### Hover

- Tailwind's `hover:` variant applies only on devices that can hover.
- Hover that must work everywhere uses plain `:hover` in CSS.

### Focus

- `.tierbinder-page :focus-visible` draws a 2px `--tb-focus` outline, 2px out.
- Text fields (`.tierbinder-field`) are focused on every click, so they get a quieter sign instead: their 1px edge turns Storm 600, fading in over `duration-fade`.
- The search field has a 16px Feather `search` icon inside it, 8px from the left, in Petrel 600 (`--tb-icon-rest`). The text starts 8px past the icon's ink (not its 16px box, which Feather leaves room in). The search field is taller than other controls: 8px of padding above and below its text sets its height (35px, or 37px on phones), and the Search button beside it matches. It turns Storm 300 (`--tb-icon-lit`) with the edge.

## 11. Motion

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

- A spring that goes 1.5% past (3% looked like too much live). 450ms for things that move, with plain `ease-out` fades of about 120ms alongside. Use it for new TierBinder animations.
- Hover colors (buttons, the clear button) ease over `duration-hover`.
- Icons that turn (the sort arrow, Bulk import's chevron) turn on the spring over `duration-move`. Bulk import slides open below its button on the spring over `duration-drop`, fading in.
- Loading placeholders shimmer: a lighter band (Petrel 800 on 850) sweeps left to right every 1.5s (`--tb-shimmer`), and stops under reduced motion.
- Popups share `.tierbinder-menu`: stretch open, fold closed. Menus and dropdown lists hold their options as rounded rows (`radius-small`, 500 weight) inset 4px, 2px apart, lighting up in Petrel 700 on hover. Dropdowns open faster, over `duration-drop`, because people use them constantly. The card menu goes left to right, dropdowns top to bottom.
- View (in the card menu) grows the card from the board to the middle of the window on the spring over `duration-move`, over a page dimmed with Petrel 950, and shrinks it back like a closing popup.
- Closing folds back over `duration-fold` on `ease-fold`, speeding up as it goes. The timers in `Editor.tsx`, `ui/Dropdown.tsx` and `ui/SearchFilters.tsx` wait for it.
- Reduced motion: fades only, closing over `duration-fold-fade`.
- Every animation respects `prefers-reduced-motion`.
- New UI elements, animations and visual options start as a few different options, each published as an Artifact or shown side by side. Alex picks one, it gets refined from there, and then it is built.

## 12. Responsive behavior

### Breakpoints

Code uses the `b` names: `b8:` in classes and `@variant b8` in CSS, never a raw width. The rest of the grid is available but unused.

| Breakpoint | Name          | Width  | Purpose                                                 |
| ---------- | ------------- | ------ | ------------------------------------------------------- |
| `b3`       | Phone         | 384px  | Standard and larger phones                              |
| `b5`       | Large phone   | 512px  | Large phones                                            |
| `b6`       | Small tablet  | 640px  | Same as `sm`                                            |
| `b7`       | Tablet        | 768px  | Fields drop to 14px text; below it, touch rows are 44px |
| `b8`       | Large tablet  | 896px  | The main layout change: sidebar beside the board        |
| `b10`      | Desktop       | 1024px | Standard desktop                                        |
| `b11`      | Laptop        | 1152px | Small laptops                                           |
| `b12`      | Wide          | 1280px | Larger displays                                         |
| `b14`      | Large desktop | 1408px | Large desktop displays                                  |
| `b15`      | Extra wide    | 1536px | Very large displays                                     |

### Layout

- `html` and `body` do not scroll. The page gives itself a scroll container.
- On phones the top bar is sticky at the top of the page and tints the iOS status bar. Respect `env(safe-area-inset-*)`.

### No magic numbers: build responsive layouts

Treat responsive design as a boon, not a limitation. Each window size is a chance to use the space better (more result columns in a wider sidebar, a bigger board on a big screen), not only a desktop layout squeezed down.

- **Let the layout size things.** Use flex and grid (`fr`, `repeat(auto-fill, minmax(…))`), `aspect-ratio`, `min()`, `max()` and `clamp()`, container queries and their units (`cqw`, `cqh`), and `%` or `dvh`, so sizes follow the content and the space.
- **No magic numbers.** A number worked out from other sizes (`calc(100dvh - 192px)` for "the bars above and below", `389px` for "3 rows", `x - 40` for "half the image") is never written as its result. Either the layout makes it unnecessary, or it is written as the calculation of the named sizes it comes from.
- **Every fixed size has one name.** A size the design really fixes (the top bar, a control's height, a swatch) is a `--tb-*` size on `body` in `globals.css`, or a constant in TypeScript, and every place that size appears uses the name. A size that the canvas code and CSS share comes from the TypeScript constant as a CSS variable, never a copy.
- **Ask when the layout has a real choice.** What grows, what wraps or stacks, where a size stops growing, what moves at a breakpoint: present Alex with the options (side by side where it helps) instead of picking one.
- **Sizes chosen by eye are fair.** Some sizes are a judgment, not a result of the layout: a thumbnail that reads well, a sidebar width that feels right. They're allowed when Alex chose them, they're named once like any fixed size, and they're listed in Exceptions with what they are. A size that could be worked out from others never counts as chosen by eye.
- Spacing still uses the spacing steps (section 5), and canvas drawing follows Exceptions.

## 13. Components

### Add Cards

- Under the search field (Feather `search` at its start, and `x-circle` at its end to clear it while it has text), one row: the Sets button (Feather `filter`, then "Sets", the ticked set's code, or the first one's and how many more, as in "TWM +2"), the Add to picker (the tier's color as a rounded swatch the size of Feather's square icon, and its name, no chevron), and at the right, while there's a search, the sort button (Feather `arrow-down`, turning to point up when reversed). Sets opens a popup like a dropdown, floating over the board: a "Search sets" field over a scrolling list of every set to tick (up to 40), the ticked boxes filled in their tier's colors in the order they were ticked, and Clear sets while any is ticked. Changes rerun the current search once they settle. On phones (touch, under `b7`) its rows are 44px tall (`--tb-touch-target`), as are text buttons on touch screens.
- Three sections, 16px apart, each a heading with its contents 8px under it: Add a Card (the search), Featured Card Pools and Advanced. Advanced holds Bulk import: a text button (its words and a `chevron-right` 4px after them, brightening on hover) that slides the import open below it, the chevron turning down.
- A featured pool is a box in the field color (Petrel 950, 8px padding, small radius) with its name (12px semibold, then Feather's `chevron-right` at the text's size, 4px after it) over a row of six cards, 4px apart, always six columns so every pool's cards are the same size. A pool with no cards yet shows card-shaped placeholders in Petrel 850. In order: Best Decks of All Time previews SLG 53, SVI 86, CEC 156, FST 114, SIT 139 and TWM 130. Delta Reign previews DLR 84, 88, 11, 69, 47 and 33. Mega Evolution Cards previews MEG 104, PFL 13, MEG 77, MEG 86, PBL 65 and CRI 22. They don't open yet.
- Results are thumbnails 4px apart, filling their columns, with a shade fading in over their top once scrolled. While a search runs they're card-shaped placeholders in Petrel 850 with a lighter shimmer, and each thumbnail shimmers until it loads. A search that finds nothing says so under the search ("No cards found", what for and in which sets, and Search all sets while sets are ticked). A failed search says why in the same place.
- A search with results (or none), or sets ticked, shows only Add a Card, with the results filling the sidebar. The pools and Advanced come back when the search field is emptied, the board is cleared or the page reloads.

### Scrollbars

- Thin, with a rounded Petrel 700 thumb (Petrel 600 on hover) and no track, on the page and every panel.

### Top bar

- The sidebar's header, not the page's: from `b8` up it heads the sidebar column, as wide as the sidebar including its edge line (the line runs down the sidebar only), and the workspace runs to the top of the window beside it. Below `b8` it stays at the top of the page, sticky with the status bar padding. It has no line under it. It holds the logo (a link home). The board type dropdown is above the board, and Export PNG and Copy PNG are in the Save & Share tab.

### Settings

- Section headings are 14px semibold in Petrel 50 (`--tb-heading`), a step brighter than the text under them. Rows put the label on the left and the value on the right.
- Color pickers are plain 24px swatches, next to their hex field.

### Sidebar resize handle

- From `b8` up, the sidebar column's right edge (header included) is a resize handle (`ui/SidebarHandle.tsx`): an 8px strip centered on the 1px line, with the `col-resize` cursor.
- After resting on it for 150ms, or straight away while dragging, a 2px Storm 300 line with a soft Storm 300 glow fades in over `duration-hover`.
- Dragging is smooth, not stepped. The width shows in px beside the pointer while dragging. It's saved as a share of the window, so the board keeps its share when the window changes size. Double-click goes back to the default: just wide enough for the main nav with every label showing and 8px on each side (about 363px). It's measured from the nav, so it follows the labels and the font; 368px stands in until then.
- It follows the WAI-ARIA window splitter pattern: a focusable `separator` that reports its width. Left and right arrows move it 16px, or 64px with Shift, and show the readout.
- It's never narrower than 250px (`--tb-sidebar-min`), and never so wide that the workspace drops below `b5`, 512px (`--tb-workspace-min`), so the board stays at least 480px wide. The main area keeps its space, as in most editors with resizable panels. The minimum wins on a window too narrow for both. A drag past either limit stops there and is saved there. No collapse yet.

### Main nav

- A radio bar (`ui/RadioBar.tsx`): Add Cards, Customize and Save & Share, in `tier-fraud`, `tier-mid` and `tier-solid`. Text is Figtree 14px at weight 400 (600 for the selected tab), and columns size to their labels. The bar hugs its tabs rather than filling the sidebar's width. Each label has a 16px Feather icon before it, 4px away: `plus`, `sliders` and `share`. These are stand-ins until Alex draws TierBinder's own.
- When the tabs don't fit the sidebar, they show icons with only the selected tab named, then only icons. Hidden labels are tooltips and stay for screen readers. The named-selected step is measured with the longest label, so switching tabs never changes the step.
- Labels fold closed and open on the same spring and `duration-move` as the block, so switching tabs feels like the color sliding over, as at full size. The block slides straight to where the selected name settles. Reduced motion: names fade only. Which one shows is measured from the real text widths, not set at breakpoints.
- The bar has 4px of padding inside, and 8px at its ends from `b3` up. Tabs are 2px apart (`space-1`).
- A colored block hugs the selected icon and word, with 8px of padding top and bottom and 8px at the sides (4px below `b3`, so the three tabs fit a small phone). It springs to the next word over `duration-move` and changes color over `duration-hover`.
- Reduced motion: the block moves straight away and only its color fades.

## 14. Exceptions

Places where the token rules do not apply. Keep raw values in named constants, matching a palette color when one exists.

| Where                                                                                                                             | Allowed                         | Why                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Canvas drawing: Konva boards                                                                                                      | Named color and size constants  | Canvas drawing does not take CSS variables, and exported images must match the screen                        |
| User-chosen colors, including saved board colors                                                                                  | Any value                       | They belong to the user's content, not the design system                                                     |
| Exported images                                                                                                                   | Values the artwork needs        | They are images, not interface                                                                               |
| Sizes chosen by eye: search result thumbnails (at least 80px wide), the sidebar's minimum width (250px), the shimmer's 1.5s sweep | A chosen fixed size, named once | Alex picked them by looking at them; nothing in the layout derives them, and deriving them would add nothing |
| The sidebar's width once someone drags it                                                                                         | Any width, smoothly             | It's the user's choice, like their colors                                                                    |
| `themeColor` in metadata                                                                                                          | Hex matching the top bar        | Browsers read it as a plain value                                                                            |

## 15. Changelog

- **November 10, 2026 · v1.5:** Card search gained the Sets filter and sort row, a clear button in the search field, no-results and error messages under the search, skeleton placeholders with a shimmer, and results that fill their columns 4px apart with no captions. Bulk import became a text button that slides open. The card menu and dropdown lists hold inset rounded rows, and View shows a card large over a dimmed page. Popups float over the board. Scrollbars are thin. New roles: `--tb-option-hover` (Petrel 700), `--tb-popup-shadow` and `--tb-scroll-shade` (Petrel 950), `--tb-scroll-thumb` (Petrel 700, 600 on hover), `--tb-skeleton` (Petrel 850) and `--tb-skeleton-shine` (Petrel 800), `--tb-view-backdrop` (Petrel 950), `--tb-touch-target` (44px), `--tb-view-height` and `--tb-shimmer`.
- **November 9, 2026 · v1.4:** The top bar became the sidebar's header: from `b8` up it sits above the main nav, as wide as the sidebar including its edge line, and the board's workspace runs the full height of the window. Removed the lines under the top bar and under the main nav, and the main nav has 8px above it, below it and at its sides, with the tab's content lined up with it. Text fields have a Petrel 700 border at rest, like buttons. Section headings went from 12px muted to 14px Petrel 50. Add Cards gained sections: Add a Card, Featured Card Pools (placeholders for now) and Advanced. Text went back to the font's normal line height from Tailwind's 1.5, and the main nav's block gained 4px top and bottom. The sidebar's default width became the nav's width with 8px each side, measured, instead of 368px chosen by eye. Text fields show focus with a Storm 600 edge instead of the focus ring, and the search field gained a search icon that lights up with it.
- **November 7, 2026 · v1.3:** The main layout change moved from `b7` to `b8`: below 896px the sidebar sits under the board. Breakpoints in CSS use `@variant` instead of raw widths. Added Consult best practices to the principles. The main nav hugs its tabs, in regular weight (400), with the selected tab semibold (600). The sidebar became resizable by dragging its edge or with the arrow keys, between 250px and the window less a 512px workspace, and the main nav names only the selected tab when it doesn't fit, in place of growing with the window. Added No magic numbers: layouts are responsive and sized by the layout, each fixed size is named once, sizes Alex chose by eye are allowed and listed in Exceptions, and real layout choices go to Alex. Component sizes are no longer raw values written in place ([#10](https://github.com/alexhutton28/tierbinder/issues/10)).
- **November 6, 2026 · v1.2:** Added a type scale: 16px for fields on phones, then 14 and 12px, up from 13px page text. The main nav went from 16px to 14px and gained stand-in Feather icons. Fields are 16px on phones, buttons are weight 500, and Figtree is now the chosen interface font ([#8](https://github.com/alexhutton28/tierbinder/issues/8)).
- **November 6, 2026 · v1.1:** New tier colors, chosen for stronger contrast with dark text and better red-green separation: Goated `#F0392B`, Solid `#F78C1E`, Mid `#FFCB2E`, Fraud `#3CC65A`. Added the logo to a Storm 400 top bar, moved Export PNG and Copy PNG to the Save & Share tab, and moved the board type dropdown above the board.
- **November 6, 2026 · v1.0:** TierBinder's own system, built from the tcgTierStack Page System and the spacing, radius and breakpoint choices in big-a-website's HuttonDesign System ([#72](https://github.com/alexhutton28/big-a-website/issues/72)).
