# The HuttonDesign System: TierBinder

> **You are reading `hutton-design-system.md`, "The HuttonDesign System."**
> This is TierBinder's brand and design system.
>
> How to build with it is in the `hutton-design` skill's `hutton-design-rules.md`.

This system records the tool as it is today. Where the code differs, it is tracked in issues and changes when that work is done: existing code is not rewritten to match.

**Version 1.16 · November 13, 2026 · Design owner: Alex Hutton · Size: small**

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
- The window is a working tool: a docked left sidebar headed by a 48px logo bar, and the board centered in its own darker workspace, which runs the window's full height, divided by 1px lines with no floating panels. From `b8` up the sidebar can slide away (the binder mark and a show button then float at the window's corners), and short messages (toasts) float at the top. Controls are 32px tall with 14px text (text buttons are just their words), and most stay quiet until hovered. Controls and popups use `radius-small`.
- Color is used by name through tokens (`bg-petrel-900`, `var(--color-storm-300)`), not raw hex.

## 3. Color

Petrel and storm are for the interface, and the tier colors are the brand's color. The look is set as `--tb-*` roles on `body` in `globals.css`.

| Name        | Hex       | Semantic roles | Used for                                                                                                                                                                                                                    |
| ----------- | --------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Petrel 50   | `#F2F5F6` |                | Section headings, the credits link and icon on hover, the sidebar button on hover, the color picker's handles                                                                                                               |
| Petrel 100  | `#E3E8EB` |                | Text, selected tool, links, default card tray (blank canvas)                                                                                                                                                                |
| Petrel 200  | `#CCD4D8` |                | Not used yet                                                                                                                                                                                                                |
| Petrel 300  | `#B3BEC4` |                | Not used yet                                                                                                                                                                                                                |
| Petrel 400  | `#94A2AA` |                | Muted text, the stroke on the card tray's swatch                                                                                                                                                                            |
| Petrel 500  | `#6C7D88` |                | Not used yet                                                                                                                                                                                                                |
| Petrel 600  | `#546470` |                | Search and clear icons at rest, scrollbar thumb on hover, an unticked checkbox's and a color swatch's edge on hover                                                                                                         |
| Petrel 700  | `#3E4B53` |                | Button, popup and field borders, color swatches' edges, option hover, scrollbar thumb                                                                                                                                       |
| Petrel 800  | `#2D373D` |                | Dividing lines, hover, skeleton shimmer                                                                                                                                                                                     |
| Petrel 850  | `#232B30` |                | Popups, card placeholders and skeletons, default card tray (tier list)                                                                                                                                                      |
| Petrel 900  | `#1B2125` |                | Sidebar, default lines between tiers                                                                                                                                                                                        |
| Petrel 950  | `#12171A` |                | Workspace, fields, text on main actions and checks on ticked boxes; at part strength the View backdrop, scroll shade and popup (and color picker handle, and flying card) shadow, the empty card tray's hint on light trays |
| Storm 100   | `#DCEAF1` |                | Not used yet                                                                                                                                                                                                                |
| Storm 200   | `#BFD7E4` |                | Main button hover, focus outline                                                                                                                                                                                            |
| Storm 300   | `#9CC0D4` |                | Main buttons, lit search icon, ticked checkboxes                                                                                                                                                                            |
| Storm 400   | `#78A5BD` |                | Top bar                                                                                                                                                                                                                     |
| Storm 600   | `#466E85` |                | Text field focus                                                                                                                                                                                                            |
| Storm 800   | `#2A4352` |                | Default board background (tier list)                                                                                                                                                                                        |
| Tier Goated | `#F0392B` |                | Default tier color. Board only                                                                                                                                                                                              |
| Tier Solid  | `#F78C1E` |                | Default tier color. Save & Share in the main nav                                                                                                                                                                            |
| Tier Mid    | `#FFCB2E` |                | Default tier color. Customize in the main nav                                                                                                                                                                               |
| Tier Fraud  | `#3CC65A` |                | Default tier color. Add Cards in the main nav                                                                                                                                                                               |

Board colors (tier colors, backgrounds, borders) are canvas colors that users can change. See Exceptions.

White (`#FFFFFF`, outside the palette, Alex's choice) is the swatch shown in the Add to picker while a split card is being made: a white card.

## 4. Typography

Fonts are loaded with `next/font` in `src/app/layout.tsx`. The controls use Figtree (`--font-figtree`), with `system-ui` and `sans-serif` as fallbacks. Canvas text uses Inter Black (900, `--font-inter`). Hex fields and bulk import use the device's monospace (`font-mono`). The next/font variables are not generated, because next/font sets them.

| Token          | Size | Weight | Used for                                                                                                    |
| -------------- | ---- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `text-field`   | 16px | 400    | Fields on phones                                                                                            |
| `text-body`    | 14px | 400    | Page text, and fields from `b7` up. Buttons at 500, main nav at 400 (600 selected), section headings at 600 |
| `text-caption` | 12px | 400    | Set codes and notes in the Sets popup, pool names, credits; on a 16px line                                  |

- Sizes are in `rem`, in the `@theme` block at the top of `globals.css`, because the token generator has no type scale yet. Tailwind utilities are `text-body` and so on.
- Text uses the font's normal line height (about 1.2 for Figtree), not Tailwind's 1.5, so a line takes about the room its letters do and spacing measures what it looks like. `text-caption` keeps its set 16px line.
- Sizes stay on even numbers. Fields, including bulk import, are 16px below `b7`, because iPhones zoom the page when a field under 16px is tapped.
- Weights: buttons 500; section headings, the selected dropdown option and small caption labels (a featured pool's name, the color picker's Board Colors and Hex) 600; the main nav 400, with the selected tab at 600. Each tab keeps its semibold width, so selecting one doesn't shift the others.
- Page text keeps Tailwind's 1.5 line height. Letter spacing is left at each font's default.
- Number fields use even-width digits (`tabular-nums`).

### Capitalization

TierBinder uses title case, Alex's choice for this project even though sentence case is the more common style in product interfaces today. The split follows Apple's Human Interface Guidelines:

- **Title case** for the visible names of controls and sections and for messages: section headings, main nav tabs, buttons, menu items, dropdown options, visible field labels ("Add a Card", "Save & Share", "Clear Board", "Make Split Card", "Board Type", "Tray Color"), and messages, toasts, empty states and confirmations ("No Cards Found", "That Tier Is Full (12 Cards)", "Clear the Board?"). Messages don't end in a period; a question keeps its question mark, and an ellipsis shows work under way ("Importing…"). A status shown in place of an option is a message ("Splitting Charizard"). Text in brackets follows the same rule ("(12 Cards)", "(12 per Tier)"). Each line of a multi-line message is its own message, and a supporting line under a message's heading is too ("For “Pikachu” in TWM"). Articles, coordinating conjunctions and prepositions of three letters or fewer stay lower case unless they're first or last, or start a clause after a colon or semicolon ("Add to Card Tray", "Only 4 Tiers: The Extra Tiers Were Left Out"); verbs, however short, are capitalized ("Is"); longer prepositions are capitalized ("From", "With", "Into"). "up to" counts as a preposition ("Pick up to 40 Sets").
- **Sentence case** for checkbox labels ("Show card tray under the board"), placeholders, the credits line and the credits popup's prose, tooltips, and screen reader labels and statuses (`aria-label`, hidden `role="status"` text, and a dropdown's hidden label, which is its tooltip: "Add to"). A visible label and its `aria-label` can differ in case; screen readers and the WCAG label-in-name check ignore case.
- Proper nouns and abbreviations keep their own spelling (TierBinder, TCGdex, PNG). Text the user writes, like tier names, is never recased.
- Card menu items are also its keys, so they're written in sentence case in code and title-cased where they're shown (`titleCase` in `text.ts`).

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

| Token           | Value  | Used for                                                                                  |
| --------------- | ------ | ----------------------------------------------------------------------------------------- |
| `radius-small`  | 4px    | Buttons, fields, popups                                                                   |
| `radius-medium` | 8px    | The card menu: its rows' `radius-small` plus the 4px around them; the card tray's corners |
| `radius-large`  | 16px   | Not used yet                                                                              |
| `radius-full`   | 9999px | Scrollbar thumbs                                                                          |

- The values come from the spacing scale, but radius keeps its own tokens.
- The split-card swatch, a card-shaped swatch smaller than the square ones, uses half of `radius-small` (2px), in step with its size.
- The names avoid Tailwind's `sm`, `md` and `lg`.

## 7. Iconography

- Icons and logos are SVGs in `public/`, with no icon library package.
- Icons are 16px (`--tb-icon`) with 1px lines, round caps and round joins. Draw a new icon on a 16-unit grid with 1-unit strokes, or start from Feather.
- Icons come from [Feather](https://feathericons.com) (MIT license), set to our style: copy the icon's SVG into `public/` under its Feather name, change its `width` and `height` to 16 and its `stroke-width` from 2 to 1.5 (1px on Feather's 24-unit grid at 16px), and change nothing else. Where it needs to follow the text color, use it as a CSS mask over `currentcolor` (see `.chevron` in `ui/Dropdown.module.css`). Konva draws the empty tray's info icon from Feather's paths, with the same 1.5 line (`ICON_LINE` in `canvas/CardTray.tsx`).
- An icon drawn at its text's size (the info icons, the featured pools' action icons) keeps its file's proportions, so its line is a little under 1px.
- One exception: the checkboxes' checkmarks (`check.svg`, `check-dark.svg`) are Feather's `check` with a heavier 3.5 stroke, in white or Petrel 950, since they're drawn as the checkbox's background image, which a mask can't color.
- The main nav's Add Cards icon (`add-card.svg`) is Alex's own, drawn on a 17-unit grid and set to 16px with a 1.06 line (1px).

## 8. Logo

- The logo is `public/tierbinder-combined-dark.svg`: a spiral-bound stack of sheets in the four tier colors, with a Petrel 900 outline, and the name set in Fraunces (weight 600, softness 50, -3.5% letter spacing) as outlines, so the font isn't loaded. Its name and outline are Petrel 900, so it needs a light background.
- It sits directly on the Storm 400 top bar at its full size, 114 × 25. Don't place it on dark surfaces like Petrel 900, where the outline and name disappear.
- For dark surfaces there's `public/tierbinder-combined-light.svg` (Alex's, 137 × 28): the same drawing in Petrel 50 lines on Petrel 900 sheets, without the tier colors. While the sidebar is hidden, its binder mark alone (cut at the mark's width, drawn at the top bar logo's 25px height) stands in for the top bar's logo; cutting it to the mark is allowed.

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
| `ease-slide`         | cubic-bezier(0.22, 1, 0.36, 1)                                                                                                                                                                                          |
| `ease-flight`        | cubic-bezier(0.65, 0, 0.35, 1)                                                                                                                                                                                          |
| `duration-flight`    | 500ms                                                                                                                                                                                                                   |

- A spring that goes 1.5% past (3% looked like too much live). `ease-slide` eases out like it without going past, for things that slide against the window's edge (the sidebar), where going past would open a gap. 450ms for things that move, with plain `ease-out` fades of about 120ms alongside. Use it for new TierBinder animations.
- Hover colors (buttons, the clear button) ease over `duration-hover`.
- Icons that turn (the sort arrow, Bulk Import's chevron) turn on the spring over `duration-move`. Bulk Import slides open below its button on the spring over `duration-drop`, fading in.
- Loading placeholders shimmer: a lighter band (Petrel 800 on 850) sweeps left to right every 1.5s (`--tb-shimmer`), and stops under reduced motion.
- Popups (menus, dropdowns, the Sets popup, the color picker) share `.tierbinder-menu`: stretch open, fold closed. Menus and dropdown lists hold their options as rounded rows (`radius-small`, 500 weight) inset 4px, 2px apart, lighting up in Petrel 700 on hover. Dropdowns open faster, over `duration-drop`, because people use them constantly, and their rows have 8px at each end, close to their swatch or name. The card tray's swatch always has a 1px Petrel 400 stroke inside it: its default color is a shade of the board, which sinks into the control behind it. The card menu goes left to right, dropdowns top to bottom.
- Cards added from the sidebar (a click on a search result, or a featured pool) fly in: a copy of each leaves its thumbnail and lands on its spot on the board or in the card tray, along a slight arc on `ease-flight` (easing in and out, without going past) over `duration-flight`, growing or shrinking to the card's size there, in the popup shadow, a pool's cards 40ms apart; those past its preview leave from the preview's thumbnails again in turn, so a big pool goes out in waves across the row, and each copy shows only once it leaves. The arc bows to one side of the straight line by 15% of the distance at its middle, toward where the card lands: down when the spot is lower than the thumbnail (the tray, beside the sidebar), up when it's higher (on a phone, where the board is above the pools); the card itself shows once it lands. On a phone, a result whose spot is scrolled off screen appears there at once, and a pool scrolls the card tray into view first, its cards flying up to it. Reduced motion: cards appear at once, a pool still scrolling the tray into view on a phone, at once.
- View (in the card menu) grows the card from the board to the middle of the window on the spring over `duration-move`, over a page dimmed with Petrel 950, and shrinks it back like a closing popup.
- Closing folds back over `duration-fold` on `ease-fold`, speeding up as it goes. The timers in `Editor.tsx` and `usePopup` (`ui/anchored.ts`: the dropdowns, the Sets popup and the color picker) wait for it.
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
- From `b8` up, Ctrl+\ (Cmd+\ on a Mac, as in Notion and Figma), or the sidebar button at the right end of the sidebar's foot (Feather's `sidebar`, muted until hovered, its tooltip naming the shortcut), hides the sidebar column, top bar included: it slides off the left edge on `ease-slide` over `duration-move` while the board grows to fill the window. While it's hidden, the same button sits at the window's bottom left, fading in once the sidebar has gone, and the light logo (`tierbinder-combined-light.svg`, Petrel 50 on Petrel 900, at the top bar logo's 25px height so the marks line up) fades in where the top bar's was, once the sidebar has gone with the colored one: only the binder mark, whenever the board leaves 8px around it. It brings the sidebar back, fading out as the top bar returns; it or the keys slide it back. Anything that needs the sidebar (Replace card, editing a tier name) brings it back. Reduced motion: it goes at once. Not on narrower screens, where the sidebar is under the board.

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

- Under the search field (Feather `search` at its start, and `x-circle` at its end to clear it while it has text), one row: the Sets button (Feather `filter`, then "Sets", the ticked set's name, or the first one's and how many more, as in "Delta Reign +2", in full when the row has room, else cut short with an ellipsis (Sets and the Add to picker stay on one line, their names shrinking, rather than wrapping), its tooltip naming every ticked set; a square clear half with Feather's `x`: while any sets are ticked it slides out of the Sets button on the spring over `duration-move`, the two in one box with one edge and a short line between them (60% of the height), each lighting up on its own and not shrinking when pressed; it unticks them all, closing the popup; with none ticked it's tucked away and Sets has the whole box (reduced motion: it fades); its tooltip "Clear sets", a 44px target on touch screens; it, the popup's Clear Sets and the no-results Clear Sets do the same thing), the Add to picker (the tier's color as a rounded swatch the size of Feather's square icon, and its name, no chevron), and at the right, while there's a search, the sort button (Feather `arrow-down`, turning to point up when reversed). Sets opens a popup like a dropdown, floating over the board: a "Search sets" field (with `x-circle` at its end to clear it while it has text, as the card search has) over a scrolling list of every set to tick (up to 40), the ticked boxes filled in their tier's colors in the order they were ticked, and Clear Sets while any is ticked. Changes rerun the current search once they settle. On touch screens its rows are 44px tall (`--tb-touch-target`), as are text buttons.
- Three sections, 16px apart, each a heading with its contents 8px under it: Add a Card (the search), Featured Card Pools and Advanced. Advanced holds Bulk Import: a text button (its words and a `chevron-right` 4px after them, brightening on hover) that slides the import open below it, the chevron turning down. Under its text box, one primary Import button: on a tier list, cards before the first `#` go in the card tray and each `#` group to a tier; on the blank canvas, all of them go on the canvas.
- A featured pool is a box in the field color (Petrel 950, 8px padding, small radius) with its name (12px semibold) over a row of six cards, 4px apart, always six columns so every pool's cards are the same size. Each card shimmers until its image loads, as search results do. Card-shaped placeholders in Petrel 850 fill a pool's row past its cards, and take the place of a card whose image doesn't load. In order: Best Decks of All Time previews SLG 53, SVI 86, CEC 156, FST 114, SIT 139 and TWM 130. Delta Reign previews DLR 84, 88, 11, 69, 47 and 33. Mega Evolution Cards previews MEG 104, PFL 13, MEG 77, MEG 86, PBL 65 and CRI 22. A pool holds more than it previews: Best Decks of All Time 14 cards, Mega Evolution Cards every Mega ex of its era (45). Delta Reign is a set's pool: its label reads "Filter" with Feather's `filter`, and clicking it lists the whole set in the search instead of adding cards. Each is a button that lights up in Petrel 800 under the pointer (where there is one) and Petrel 700 while pressed, and shows the usual focus ring. Its name sits at the left and "Add to Card Tray" (or "Filter") at the right, muted (Petrel 400, with Feather's `plus` at the text's size, 4px before it), brightening to Petrel 100 with the box under the pointer, wrapping under the name when the sidebar is narrow. Clicking one of the other pools adds the cards not already on the board or in the tray to the card tray. While all the cards a pool added are still in the tray, and have landed, it reads "Remove From Card Tray" (Feather's `minus`) instead, and clicking it flies them back out of the tray to their thumbnails, the way they came.
- Results are thumbnails 4px apart, filling their columns, with a shade fading in over their top once scrolled. While a search runs they're card-shaped placeholders in Petrel 850 with a lighter shimmer, and each thumbnail shimmers until it loads. A search that finds nothing says so under the search ("No Cards Found", what for and in which sets, and Search All Sets while sets are ticked). A failed search says why in the same place.
- A search with results (or none), or sets ticked, shows only Add a Card, with the results filling the sidebar. The pools and Advanced come back when the search field is emptied, the board is cleared or the page reloads.

### Search result menu

- Right-clicking a search result (or a long press on touch screens, where its rows are 44px tall) opens a menu at the pointer, like the card menu: View (the card large, growing from its thumbnail) and "Add to Tier" with Feather's `chevron-right` 4px after it (the menu is as wide as its rows), which opens a flyout when clicked (not on hover; clicking again closes it) to its right listing every Add to choice with its swatch, lined up with its row and 4px from the menu. It stays 8px inside the window: it opens upward from the pointer at the window's foot, and the flyout opens to the left or moves up when it wouldn't fit. The flyout's rows have the dropdowns' 8px ends, and it folds closed like the menus. Keys follow the WAI-ARIA menu pattern: arrows and Home/End move, right opens the flyout, left or Escape leave it, Tab or Escape close the menu back to the result.

### Making a split card

- While a split card is being made, the Add to picker shows a white card-shaped swatch (as tall as the tier swatches) and "Splitting <card name>" in place of the target, with no target selected; picking any target cancels it and adds there from then on. Screen readers are told what to do through a hidden status. Replacing a card still shows its message and Cancel.

### Toast

- Every message is a toast, never text on or under the board: a tier or the card tray is full, bulk import's progress and results, adding a featured pool (how many went in, how many were already on the board or in the tray, how many couldn't load, or "Couldn't Load This Pool"), copying the image. One message at the top of the window, centered, 16px down, as wide as its words up to the window less 16px each side; an import's results take a line each, listing at most 4 problems and then how many more. A popup box (`tierbinder-popup`) with 8px by 16px padding and 500-weight text. It drops in on the spring over `duration-drop`, stays 3 seconds (1.5 more for each line past the first, and "Importing…" until its result replaces it), then folds up and fades over `duration-fold`; reduced motion: it fades. Only one shows: a new message replaces it, and the same message again keeps it up without replaying its entrance. It's read out politely (`role="status"`).

### Card tray

- An optional box under the board, turned on in Customize (Card Tray: "Show card tray under the board", then "Tray Color"), for holding cards that aren't ranked yet. As wide as the board and as tall as its cards with 15px padding around them (a full-size row makes it about a tier tall), `space-4` (16px on screen) between the board and it, with `radius-medium` corners, in its own color: by default Petrel 850 on the tier list, a step darker than its Storm 800 board, or Petrel 100 on the white blank canvas. Empty, it says "Send Cards to Card Tray to Hold Them" in its middle, after Feather's `info` icon at the text's size and 4px before it: 14px Figtree, faint (45% white, or 60% Petrel 950 on a light tray), on screen only, never in the export, and not read out. Once a card has been in a tray, the hint stays hidden for the rest of the tab's session.
- Clear Card Tray empties the tray, keeping it on: a button under Tray Color in Customize while the tray is on and holds cards, confirmed on the page as Clear Board is ("Clear the Card Tray?", Yes, Cancel), or Clear Card Tray at the foot of a tray card's menu (while the tray holds more than that card), or (with a mouse only) right-clicking the tray's empty space, which opens the card menu with Hide Card Tray (turning it off, its cards kept, with a toast saying it can be turned on again in Customize) and, while it holds cards, Clear Card Tray; in either menu Clear Card Tray is a row with Feather's `chevron-right` that opens a flyout holding "Clear N Cards" beside it, as the search result menu's Add to row does: on a click, Enter or the right arrow, not on hover; a second click closes it, Escape or the left arrow goes back to the row; to the left when it wouldn't fit. On touch screens the card menu's rows are 44px tall.
- Up to 48 cards, each row filled left to right before the next: full size in one row up to 10, then shrinking to fit the row down to 75% (14 cards), then a second row at 75%, then both rows shrinking to fit. The tray grows and shrinks to hug them, and the board rescales to make room.
- A dragged card moves over the board and the tray, under the selection outline, then back into its place. A card dragged out of the tray grows to the board's card size as it crosses onto the board, and a board card dragged over the tray shrinks to the tray's, over `duration-drop` easing out, staying centered under the pointer.
- It acts like a tier: "Card Tray" is always the last Add to choice, even while the tray is off, and adding a card to it turns it on; cards drag in, out and within it, and the card menu opens upward on it, since it's at the board's foot.
- At every width: on phones it's under the board in the page, scaled with the board.
- Save & Share's "Include card tray in export" (off by default) puts it flush and square under the board in the image (2400×1690 with up to 10 cards; taller with two rows), so the graphic reads as one piece.

### Checkbox

- Every checkbox is `ui/Checkbox.tsx`, never the browser's own: a 16px box (Feather's icon size) with 4px corners in the fields' colors (Petrel 950, a Petrel 700 line), filled when ticked with the primary color (Storm 300) under a Petrel 950 check, or with a given color under whichever check reads on it (the Sets popup's tier colors). The whole row, box and words, is the label, 8px apart, with the box on the first line when the words wrap. Hovering an unticked box lightens its edge to Petrel 600; ticking is immediate; disabled, the whole row is at 50%; focus shows the usual ring. On touch screens each row is a 44px touch target (`--tb-touch-target`) that gives the extra height back as negative margin, so settings keep their 8px spacing (the Sets popup's rows take the full 44px).

### Credits

- At the foot of the sidebar under every tab, with no dividing line: one line of 12px muted text, trimmed to its capitals and baseline so its padding (16px above and below, 8px at the sides, lined up with the panel above, which has none below) centers the letters (about 40px tall), "Cards from TCGdex". TCGdex links to tcgdex.dev in a new tab (the text color, underlined). 4px after it, Feather's `info` icon at the text's size, in the text color, opens a popup like the dropdowns (lined up with the credits line and as wide as it, above it when there's no room below) with the full credits and "Pokémon is a trademark of Nintendo, Creatures, GAME FREAK and The Pokémon Company. TierBinder isn't affiliated with them." The link and icon brighten to Petrel 50 on hover over `duration-hover`, and the icon stays bright while its popup is open; on touch screens it has a 44px-tall touch target reaching right, not over the link. The popup closes when focus moves on past it. A stand-in until the credits get a better home.

### Scrollbars

- Thin, with a rounded Petrel 700 thumb (Petrel 600 on hover) and no track, on the page and every panel.

### Top bar

- The sidebar's header, not the page's: from `b8` up it heads the sidebar column, as wide as the sidebar including its edge line (the line runs down the sidebar only), and the workspace runs to the top of the window beside it. Below `b8` it stays at the top of the page, sticky with the status bar padding, and slides up out of the way (its own height, over `duration-drop` on `ease-slide`, the logo fading over `duration-fade`; under reduced motion it fades out in place instead) while the page scrolls down, coming back when it scrolls up 8px or more, reaches the top, or the logo has keyboard focus; the status bar's strip stays in its color, empty. It has no line under it. It holds the logo (a link home). The board type dropdown is above the board, and Export PNG and Copy PNG are in the Save & Share tab.

### Settings

- Section headings are 14px semibold in Petrel 50 (`--tb-heading`), a step brighter than the text under them. Rows put the label on the left and the value on the right.
- Colors are a 24px swatch before their hex field, with a 1px Petrel 700 line inside it (Petrel 600 on hover and while its picker is open), so a color close to the sidebar's still shows; on touch screens it takes taps 44px tall. The swatch opens our own picker (never the browser's), in a popup that opens and closes like a dropdown, with 16px padding and its parts 8px apart: a 200px saturation and brightness square, and under it a 12px hue bar, both with the controls' 4px corners. Their handles stay inside them (the hue bar's sideways), with the gradients starting and ending where the handles stop: a 16px Petrel 50 ring (Feather's icon size) filled with the color on the square, a hollow 16px-tall, 8px-wide Petrel 50 pill ring on the hue bar, the hue showing through it, each with a faint dark edge and the popup's shadow, ringed in the focus color for the keyboard. Under them, Board Colors (12px semibold, muted): the board's tier colors, background, border, card tray color and white, eight to a row (four on touch screens, so each is a 44px target), 4px apart, the one in use ringed in Petrel 50 with a faint dark edge inside, so it shows on white. A tier with no name is "Tier 2" and so on. The board colors are those of the moment it opened, so the field's starting color stays there to go back to. Last, Hex and the hex field again. Arrow keys move a focused handle. Escape, a press outside, or Tab past the last field closes it.

### Sidebar resize handle

- From `b8` up, the sidebar column's right edge (header included) is a resize handle (`ui/SidebarHandle.tsx`): an 8px strip centered on the 1px line, with the `col-resize` cursor.
- After resting on it for 150ms, or straight away while dragging, a 2px Storm 300 line with a soft Storm 300 glow fades in over `duration-hover`.
- Dragging is smooth, not stepped. The width shows in px beside the pointer while dragging. It's saved as a share of the window, so the board keeps its share when the window changes size. Double-click goes back to the default: just wide enough for the main nav with every label showing and 8px on each side (about 363px). It's measured from the nav, so it follows the labels and the font; 368px stands in until then.
- It follows the WAI-ARIA window splitter pattern: a focusable `separator` that reports its width. Left and right arrows move it 16px, or 64px with Shift, and show the readout.
- It's never narrower than 250px (`--tb-sidebar-min`), and never so wide that the workspace drops below `b5`, 512px (`--tb-workspace-min`), so the board stays at least 480px wide. The main area keeps its space, as in most editors with resizable panels. The minimum wins on a window too narrow for both. A drag past either limit stops there and is saved there. Ctrl+\ or Cmd+\, or the button at its foot, slides it away (see Layout).

### Main nav

- A radio bar (`ui/RadioBar.tsx`): Add Cards, Customize and Save & Share, in `tier-fraud`, `tier-mid` and `tier-solid`. Text is Figtree 14px at weight 400 (600 for the selected tab), and columns size to their labels. The bar hugs its tabs rather than filling the sidebar's width. Each label has a 16px icon before it, 4px away: TierBinder's own `add-card`, and Feather's `sliders` and `share` (set to 1px lines, as every icon is), stand-ins until Alex draws TierBinder's own.
- When the tabs don't fit the sidebar, they show icons with only the selected tab named, then only icons. Hidden labels are tooltips and stay for screen readers. The named-selected step is measured with the longest label, so switching tabs never changes the step.
- Labels fold closed and open on the same spring and `duration-move` as the block, so switching tabs feels like the color sliding over, as at full size. The block slides straight to where the selected name settles. Reduced motion: names fade only. Which one shows is measured from the real text widths, not set at breakpoints.
- The bar has 4px of padding inside, and 8px at its ends from `b3` up. Tabs are 2px apart (`space-1`).
- A colored block hugs the selected icon and word, with 8px of padding top and bottom and 8px at the sides (4px below `b3`, so the three tabs fit a small phone). It springs to the next word over `duration-move` and changes color over `duration-hover`.
- Reduced motion: the block moves straight away and only its color fades.

## 14. Exceptions

Places where the token rules do not apply. Keep raw values in named constants, matching a palette color when one exists.

| Where                                                                                                                                                                                                                                                                                                                                                                                      | Allowed                         | Why                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Canvas drawing: Konva boards                                                                                                                                                                                                                                                                                                                                                               | Named color and size constants  | Canvas drawing does not take CSS variables, and exported images must match the screen                        |
| User-chosen colors, including saved board colors                                                                                                                                                                                                                                                                                                                                           | Any value                       | They belong to the user's content, not the design system                                                     |
| Exported images                                                                                                                                                                                                                                                                                                                                                                            | Values the artwork needs        | They are images, not interface                                                                               |
| Sizes chosen by eye: search result thumbnails (at least 80px wide), the sidebar's minimum width (250px), the shimmer's 1.5s sweep, the 40ms between a featured pool's flying cards, the flight's 15% arc and the 800ms it waits at most for the page to scroll to the tray, the color picker's width (200px, react-colorful's own), its hue bar (12px) and that bar's handle (8px by 16px) | A chosen fixed size, named once | Alex picked them by looking at them; nothing in the layout derives them, and deriving them would add nothing |
| The sidebar's width once someone drags it                                                                                                                                                                                                                                                                                                                                                  | Any width, smoothly             | It's the user's choice, like their colors                                                                    |
| The card tray: its padding (15) and card gaps (a tenth of a card) in design pixels, and its gap and corners (16 and 8 on-screen pixels, matching `space-4` and `radius-medium`)                                                                                                                                                                                                            | Named canvas constants          | Canvas drawing can't read the tokens; the gap and corners stay the same on screen whatever the board's scale |
| `themeColor` in metadata                                                                                                                                                                                                                                                                                                                                                                   | Hex matching the top bar        | Browsers read it as a plain value                                                                            |

## 15. Changelog

- **November 13, 2026 · v1.16:** Icons are 16px with 1px lines: Feather's are set to that (16px, a 1.5 stroke on their 24 grid) in place of being copied unchanged at 2. The main nav's Add Cards icon is TierBinder's own (`add-card`) in place of Feather's `plus`; Customize and Save & Share keep Feather's `sliders` and `share` for now.
- **November 12, 2026 · v1.15:** Cards fly in: clicking a search result or a featured pool sends a copy of each card from its thumbnail to its spot on the board or in the card tray, along a slight arc toward where it lands (picked from a demo of six flights); added `ease-flight` and `duration-flight`. Featured card pools are buttons that add their cards to the card tray, labeled "Add to Card Tray" at the right with Feather's `plus`, in place of the chevron after the name; Delta Reign's filters the search to its set instead. Clear Card Tray empties the tray, from Customize, a tray card's menu, or the tray's own right-click menu (which can also hide the tray), and clicking a pool whose cards are all in the tray flies them back out. Clear Card Tray in a menu opens a flyout to confirm, as Add to does. While sets are ticked a Clear sets half (Feather's `x`) slides out of the Sets button and unticks them all. The Sets button names the ticked set ("Delta Reign +2") instead of its code.
- **November 12, 2026 · v1.14:** The color picker's handles stay inside its square and a slimmer hue bar, and it adds the board's colors and the hex field (chosen from four looks); added `--tb-hue-handle`, `--tb-hue-handle-height`, `--tb-handle-edge` and `--tb-handle-shadow`.
- **November 12, 2026 · v1.13:** Color swatches open our own color picker (react-colorful, restyled) in place of the browser's, and have a Petrel 700 edge; added `--tb-field-border-hover` and `--tb-picker-handle`.
- **November 12, 2026 · v1.12:** Every checkbox is the custom one the Sets popup used (`ui/Checkbox.tsx`), ticked in the primary color with a dark check, with a hover edge, and 44px touch targets on every touch screen that keep the settings' 8px spacing.
- **November 12, 2026 · v1.11:** On phones the top bar slides up while the page scrolls down and back as it scrolls up.
- **November 12, 2026 · v1.10:** The card tray shows on phones too, under the board. Bulk Import has one Import button again: on a tier list, cards before the first `#` go in the card tray, `#` groups to the tiers. The empty tray's hint says "Send Cards to Card Tray to Hold Them", since results can't be dragged on touch screens.
- **November 12, 2026 · v1.9:** Every message is a toast: bulk import's progress and results and copying's moved there from under the board. Toasts stay 1.5s longer for each line past the first, "Importing…" stays until its result replaces it, and an import lists at most 4 problems.
- **November 12, 2026 · v1.8:** Added Capitalization: title case for headings, tabs, buttons, menu items, dropdown options, field labels and messages (with no closing period), sentence case for checkbox labels, placeholders, tooltips and screen reader text. Labels and messages that were sentence case moved to title case.
- **November 11, 2026 · v1.7:** The card tray: an optional box under the board for unranked cards, up to 48, shrinking to fit, with its own color, from `b8` up, and optionally in the export. Ctrl+\ or Cmd+\, or a button at the sidebar's foot, slides the sidebar out and back from `b8` up, on the new `ease-slide`. Cards grow or shrink as they're dragged between the tray and the board. The tray hugs its cards: one row shrinking to 75%, then a second row. Dropdown rows have 8px at each end, the card tray's swatch has a light stroke, and an empty tray shows a faint hint. The blank canvas's tray defaults to Petrel 100. The credits line is trimmed to its letters. A new tier list's board now uses brand colors: Storm 800 background, Petrel 850 tray, Petrel 900 lines between tiers (they were `#1F3D4B` and `#16303C`, off the palette).
- **November 10, 2026 · v1.6:** Credits at the foot of the sidebar: one line with an info button that opens the full credits. Placeholders fill a featured pool's row past its cards, and its cards shimmer while they load.
- **November 10, 2026 · v1.5:** Card search gained the Sets filter and sort row, a clear button in the search field, no-results and error messages under the search, skeleton placeholders with a shimmer, and results that fill their columns 4px apart with no captions. Bulk import became a text button that slides open. The card menu and dropdown lists hold inset rounded rows, and View shows a card large over a dimmed page. Popups float over the board. Scrollbars are thin. New roles: `--tb-option-hover` (Petrel 700), `--tb-popup-shadow` and `--tb-scroll-shade` (Petrel 950), `--tb-scroll-thumb` (Petrel 700, 600 on hover), `--tb-skeleton` (Petrel 850) and `--tb-skeleton-shine` (Petrel 800), `--tb-view-backdrop` (Petrel 950), `--tb-touch-target` (44px), `--tb-view-height` and `--tb-shimmer`.
- **November 9, 2026 · v1.4:** The top bar became the sidebar's header: from `b8` up it sits above the main nav, as wide as the sidebar including its edge line, and the board's workspace runs the full height of the window. Removed the lines under the top bar and under the main nav, and the main nav has 8px above it, below it and at its sides, with the tab's content lined up with it. Text fields have a Petrel 700 border at rest, like buttons. Section headings went from 12px muted to 14px Petrel 50. Add Cards gained sections: Add a Card, Featured Card Pools (placeholders for now) and Advanced. Text went back to the font's normal line height from Tailwind's 1.5, and the main nav's block gained 4px top and bottom. The sidebar's default width became the nav's width with 8px each side, measured, instead of 368px chosen by eye. Text fields show focus with a Storm 600 edge instead of the focus ring, and the search field gained a search icon that lights up with it.
- **November 7, 2026 · v1.3:** The main layout change moved from `b7` to `b8`: below 896px the sidebar sits under the board. Breakpoints in CSS use `@variant` instead of raw widths. Added Consult best practices to the principles. The main nav hugs its tabs, in regular weight (400), with the selected tab semibold (600). The sidebar became resizable by dragging its edge or with the arrow keys, between 250px and the window less a 512px workspace, and the main nav names only the selected tab when it doesn't fit, in place of growing with the window. Added No magic numbers: layouts are responsive and sized by the layout, each fixed size is named once, sizes Alex chose by eye are allowed and listed in Exceptions, and real layout choices go to Alex. Component sizes are no longer raw values written in place ([#10](https://github.com/alexhutton28/tierbinder/issues/10)).
- **November 6, 2026 · v1.2:** Added a type scale: 16px for fields on phones, then 14 and 12px, up from 13px page text. The main nav went from 16px to 14px and gained stand-in Feather icons. Fields are 16px on phones, buttons are weight 500, and Figtree is now the chosen interface font ([#8](https://github.com/alexhutton28/tierbinder/issues/8)).
- **November 6, 2026 · v1.1:** New tier colors, chosen for stronger contrast with dark text and better red-green separation: Goated `#F0392B`, Solid `#F78C1E`, Mid `#FFCB2E`, Fraud `#3CC65A`. Added the logo to a Storm 400 top bar, moved Export PNG and Copy PNG to the Save & Share tab, and moved the board type dropdown above the board.
- **November 6, 2026 · v1.0:** TierBinder's own system, built from the tcgTierStack Page System and the spacing, radius and breakpoint choices in big-a-website's HuttonDesign System ([#72](https://github.com/alexhutton28/big-a-website/issues/72)).
