# The HuttonDesign System: TierBinder

> **You are reading `hutton-design-system.md`, "The HuttonDesign System."**
> This is TierBinder's brand and design system.
>
> How to build with it is in the `hutton-design` skill's `hutton-design-rules.md`.

This system records the tool as it is today. Where the code differs, it is tracked in issues and changes when that work is done: existing code is not rewritten to match.

**Version 1.3 · November 7, 2026 · Design owner: Alex Hutton · Size: small**

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
- The window is a working tool: a 48px top bar, a docked left sidebar and the board centered in its own darker workspace, divided by 1px lines with no floating panels. Controls are 32px tall with 14px text, and most stay quiet until hovered. Controls and popups use `radius-small`.
- Color is used by name through tokens (`bg-petrel-900`, `var(--color-storm-300)`), not raw hex.

## 3. Color

Petrel and storm are for the interface, and the tier colors are the brand's color. The look is set as `--tb-*` roles on `body` in `globals.css`.

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
| Petrel 900  | `#1B2125` |                | Sidebar                                          |
| Petrel 950  | `#12171A` |                | Workspace, fields, text on main actions          |
| Storm 100   | `#DCEAF1` |                | Not used yet                                     |
| Storm 200   | `#BFD7E4` |                | Main button hover, focus outline                 |
| Storm 300   | `#9CC0D4` |                | Main buttons                                     |
| Storm 400   | `#78A5BD` |                | Top bar                                          |
| Storm 600   | `#466E85` |                | Not used yet                                     |
| Storm 800   | `#2A4352` |                | Not used yet                                     |
| Tier Goated | `#F0392B` |                | Default tier color. Board only                   |
| Tier Solid  | `#F78C1E` |                | Default tier color. Save & Share in the main nav |
| Tier Mid    | `#FFCB2E` |                | Default tier color. Customize in the main nav    |
| Tier Fraud  | `#3CC65A` |                | Default tier color. Add Cards in the main nav    |

Board colors (tier colors, backgrounds, borders) are canvas colors that users can change. See Exceptions.

## 4. Typography

Fonts are loaded with `next/font` in `src/app/layout.tsx`. The controls use Figtree (`--font-figtree`), with `system-ui` and `sans-serif` as fallbacks. Canvas text uses Inter Black (900, `--font-inter`). Hex fields and bulk import use the device's monospace (`font-mono`). The next/font variables are not generated, because next/font sets them.

| Token          | Size | Weight | Used for                                                            |
| -------------- | ---- | ------ | ------------------------------------------------------------------- |
| `text-field`   | 16px | 400    | Fields on phones                                                    |
| `text-body`    | 14px | 400    | Page text, and fields from `b7` up. Buttons at 500, main nav at 600 |
| `text-caption` | 12px | 400    | Search result captions, on a 16px line. Section headings at 600     |

- Sizes are in `rem`, in the `@theme` block at the top of `globals.css`, because the token generator has no type scale yet. Tailwind utilities are `text-body` and so on.
- Sizes stay on even numbers. Fields, including bulk import, are 16px below `b7`, because iPhones zoom the page when a field under 16px is tapped.
- Weights: buttons 500; section headings, the main nav and the selected dropdown option 600.
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

| Token           | Value  | Used for                |
| --------------- | ------ | ----------------------- |
| `radius-small`  | 4px    | Buttons, fields, popups |
| `radius-medium` | 8px    | Not used yet            |
| `radius-large`  | 16px   | Not used yet            |
| `radius-full`   | 9999px | Not used yet            |

- The values come from the spacing scale, but radius keeps its own tokens.
- The names avoid Tailwind's `sm`, `md` and `lg`.

## 7. Iconography

- Icons and logos are SVGs in `public/`, with no icon library package.
- Icons come from [Feather](https://feathericons.com) (MIT license). Copy the icon's SVG into `public/` under its Feather name, unchanged. Where it needs to follow the text color, use it as a CSS mask over `currentcolor` (see `.tierbinder-chevron`).

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
- Button hover colors ease over `duration-hover`.
- Popups share `.tierbinder-menu`: stretch open, fold closed. Dropdowns open faster, over `duration-drop`, because people use them constantly. The card menu goes left to right, dropdowns top to bottom.
- Closing folds back over `duration-fold` on `ease-fold`, speeding up as it goes. The timers in `Editor.tsx` and `ui/Dropdown.tsx` wait for it.
- Reduced motion: fades only, closing over `duration-fold-fade`.
- Every animation respects `prefers-reduced-motion`.
- New UI elements, animations and visual options start as a few different options, each published as an Artifact or shown side by side. Alex picks one, it gets refined from there, and then it is built.

## 12. Responsive behavior

### Breakpoints

Code uses the `b` names: `b8:` in classes and `@variant b8` in CSS, never a raw width. The rest of the grid is available but unused.

| Breakpoint | Name          | Width  | Purpose                                          |
| ---------- | ------------- | ------ | ------------------------------------------------ |
| `b3`       | Phone         | 384px  | Standard and larger phones                       |
| `b5`       | Large phone   | 512px  | Large phones                                     |
| `b6`       | Small tablet  | 640px  | Same as `sm`                                     |
| `b7`       | Tablet        | 768px  | Fields drop to 14px text                         |
| `b8`       | Large tablet  | 896px  | The main layout change: sidebar beside the board |
| `b10`      | Desktop       | 1024px | Standard desktop                                 |
| `b11`      | Laptop        | 1152px | Small laptops                                    |
| `b12`      | Wide          | 1280px | Larger displays                                  |
| `b14`      | Large desktop | 1408px | Large desktop displays                           |
| `b15`      | Extra wide    | 1536px | Very large displays                              |

### Layout

- `html` and `body` do not scroll. The page gives itself a scroll container.
- The sticky top bar tints the iOS status bar. Respect `env(safe-area-inset-*)`.

### No magic numbers: build responsive layouts

Treat responsive design as a boon, not a limitation. Each window size is a chance to use the space better (more result columns in a wider sidebar, a bigger board on a big screen), not only a desktop layout squeezed down.

- **Let the layout size things.** Use flex and grid (`fr`, `repeat(auto-fill, minmax(…))`), `aspect-ratio`, `min()`, `max()` and `clamp()`, container queries and their units (`cqw`, `cqh`), and `%` or `dvh`, so sizes follow the content and the space.
- **No magic numbers.** A number worked out from other sizes (`calc(100dvh - 192px)` for "the bars above and below", `389px` for "3 rows", `x - 40` for "half the image") is never written as its result. Either the layout makes it unnecessary, or it is written as the calculation of the named sizes it comes from.
- **Every fixed size has one name.** A size the design really fixes (the top bar, a control's height, a swatch) is a `--tb-*` size on `body` in `globals.css`, or a constant in TypeScript, and every place that size appears uses the name. A size that the canvas code and CSS share comes from the TypeScript constant as a CSS variable, never a copy.
- **Ask when the layout has a real choice.** What grows, what wraps or stacks, where a size stops growing, what moves at a breakpoint: present Alex with the options (side by side where it helps) instead of picking one.
- Spacing still uses the spacing steps (section 5), and canvas drawing follows Exceptions.

## 13. Components

### Top bar

- Sticky with the same status bar padding. It holds the logo (a link home). The board type dropdown is above the board, and Export PNG and Copy PNG are in the Save & Share tab.

### Settings

- Section headings are 12px and muted. Rows put the label on the left and the value on the right.
- Color pickers are plain 24px swatches, next to their hex field.

### Sidebar resize handle

- From `b8` up, the sidebar's right edge is a resize handle (`ui/SidebarHandle.tsx`): an 8px strip centered on the 1px line, with the `col-resize` cursor.
- After resting on it for 150ms, or straight away while dragging, a 2px Storm 300 line with a soft Storm 300 glow fades in over `duration-hover`.
- Dragging is smooth, not stepped. The width shows in px beside the pointer while dragging. It's saved as a share of the window, so the board keeps its share when the window changes size. Double-click goes back to the default, 368px: wide enough for the main nav with its padding.
- It follows the WAI-ARIA window splitter pattern: a focusable `separator` that reports its width. Left and right arrows move it 16px, or 64px with Shift, and show the readout.
- No minimum width yet; Alex will choose one. No collapse yet.

### Main nav

- A radio bar (`ui/RadioBar.tsx`): Add Cards, Customize and Save & Share, in `tier-fraud`, `tier-mid` and `tier-solid`. Text is Figtree 14px at weight 600, and columns size to their labels. The bar hugs its tabs rather than filling the sidebar's width. Each label has a 16px Feather icon before it, 4px away: `plus`, `sliders` and `share`. These are stand-ins until Alex draws TierBinder's own.
- The bar has 4px of padding inside, and 8px at its ends from `b3` up.
- A colored block hugs the selected icon and word, with 4px of padding top and bottom and 8px at the sides (4px below `b3`, so the three tabs fit a small phone). It springs to the next word over `duration-move` and changes color over `duration-hover`.
- Reduced motion: the block moves straight away and only its color fades.

## 14. Exceptions

Places where the token rules do not apply. Keep raw values in named constants, matching a palette color when one exists.

| Where                                            | Allowed                         | Why                                                                                   |
| ------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------- |
| Canvas drawing: Konva boards                     | Named color and size constants  | Canvas drawing does not take CSS variables, and exported images must match the screen |
| User-chosen colors, including saved board colors | Any value                       | They belong to the user's content, not the design system                              |
| Exported images                                  | Values the artwork needs        | They are images, not interface                                                        |
| Image display sizes: search result thumbnails    | A chosen fixed size, named once | Card art reads best at a size picked by eye; deriving it from the layout adds nothing |
| The sidebar's width once someone drags it        | Any width, smoothly             | It's the user's choice, like their colors                                             |
| `themeColor` in metadata                         | Hex matching the top bar        | Browsers read it as a plain value                                                     |

## 15. Changelog

- **November 7, 2026 · v1.3:** The main layout change moved from `b7` to `b8`: below 896px the sidebar sits under the board. Breakpoints in CSS use `@variant` instead of raw widths. Added Consult best practices to the principles. The main nav hugs its tabs. The sidebar became resizable by dragging its edge or with the arrow keys, in place of growing with the window. Added No magic numbers: layouts are responsive and sized by the layout, each fixed size is named once, and real layout choices go to Alex. Component sizes are no longer raw values written in place ([#10](https://github.com/alexhutton28/tierbinder/issues/10)).
- **November 6, 2026 · v1.2:** Added a type scale: 16px for fields on phones, then 14 and 12px, up from 13px page text. The main nav went from 16px to 14px and gained stand-in Feather icons. Fields are 16px on phones, buttons are weight 500, and Figtree is now the chosen interface font ([#8](https://github.com/alexhutton28/tierbinder/issues/8)).
- **November 6, 2026 · v1.1:** New tier colors, chosen for stronger contrast with dark text and better red-green separation: Goated `#F0392B`, Solid `#F78C1E`, Mid `#FFCB2E`, Fraud `#3CC65A`. Added the logo to a Storm 400 top bar, moved Export PNG and Copy PNG to the Save & Share tab, and moved the board type dropdown above the board.
- **November 6, 2026 · v1.0:** TierBinder's own system, built from the tcgTierStack Page System and the spacing, radius and breakpoint choices in big-a-website's HuttonDesign System ([#72](https://github.com/alexhutton28/big-a-website/issues/72)).
