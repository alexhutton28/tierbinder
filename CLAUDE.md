# TierBinder

Alex Hutton's TCG graphics tool, live at tierbinder.big-a.fun and kept out of search with
`noindex` until it has its real domain. The goal is to be the best TCG tier list maker;
other graphics are a bonus. It moved here from big-a-website, whose issues and PRs old
commits link to. Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, Konva,
deployed on Vercel's Hobby plan.

## Workflow

- `main` is protected: changes go through a PR and must pass the `build` check. What it runs is in `.github/workflows/ci.yml`; run the same checks locally before committing, plus `npx prettier --write` on changed files and `npx tsc --noEmit`.
- Squash-merge and delete the branch.
- Don't stack PRs.
- Run tools from the repo folder.
- Dependabot opens weekly grouped minor/patch PRs; merge them once green.
- When a PR changes a convention described here, update the notes in the same PR.
- After changing `design/hutton-design-system.md`, run `npm run design:tokens` and commit `design/theme.css`. It needs the `hutton-design` skill installed. Never edit that file by hand.
- Stay on free plans until the tool is solid. Move to Vercel Pro before any ads or payments go live, since Hobby is non-commercial only.

## Gotchas

- **Custom spacing scale** (`design/hutton-design-system.md`): Tailwind's numbered spacing doesn't mean the default sizes here, e.g. `p-4` is 16px, but `px-6` (64px) and `gap-5` (32px) are much bigger than usual. Round to the nearest step rather than writing arbitrary spacing like `mt-[12px]`.
- **No magic numbers** (`design/hutton-design-system.md`, section 12): let flex, grid, `aspect-ratio`, `clamp()` and container queries size things; name each fixed size once (a `--tb-*` size in `globals.css` or a TS constant); and ask Alex when a layout has a real choice.
- **`html` and `body` don't scroll** (`overflow: hidden` in `globals.css`). The page has its own scroll container.
- **Tailwind's `hover:` variant only applies on devices that can hover.** For hover effects that must work everywhere use plain `:hover` in CSS.
- **Tailwind's `shadow-[...]` stacks the shadow with four empty layers**, so animating `box-shadow` from it fades instead of moving. Set shadows that animate in plain CSS.
- **`@theme inline` tokens aren't real CSS variables** at runtime. Generated tokens are, but fonts use the `next/font` variables from `src/app/layout.tsx` directly.

## Design

Follow `design/hutton-design-system.md` using the `hutton-design` skill. Use the tokens, not raw hex.

## Files

All paths are in `src/app/`.

- `Editor.tsx`: the shell, shared by every graphic: the stage and its scaling, selection and its outline, the card menu, the Add Cards tab (search, picking, dragging results, bulk import), the Customize tab (the graphic's own settings, Clear board), the Save & Share tab (export), autosave. It only talks to graphics through `GraphicType`.
- `document.ts`: the saved document (`{ version: 3, kind, graphics }`), `currentGraphic`, and `parseSaved`, which converts older saves.
- `graphics/types.ts`: the `GraphicType` interface; `graphics/index.ts`: the list of types (`GRAPHIC_TYPES`), the `Graphic` union, and `typeOf(kind)`.
- `graphics/tier-list/`: `model.ts` (document, layout, edits, import, parse), `TierListCanvas.tsx`, `TierListSettings.tsx`, and `index.ts` (its `GraphicType`).
- `graphics/blank/`: the same for the blank canvas (`BlankCanvasView.tsx`, `BlankSettings.tsx`).
- `canvas/CardNode.tsx`: a card on the board for every graphic (image or split card, rounded clip, placeholder, dragging, menu clicks). `canvas/size.ts`: board, export and card sizes.
- `cards.ts`: card types saved in documents (`CardFace`, `CardItem`), `newId`, client calls to the API routes, bulk import lookups (`resolveCard`, `defaultPrint`), and image loading through the proxy.
- `importText.ts`: the bulk import format (documented at the top of the file).
- `ui/Button.tsx`: the page's buttons, with a `variant` (`default`, `primary`, `tool`).
- `ui/RadioBar.tsx`: the main nav. Each option has an icon from `public/`, drawn in the text color. A block in each option's color hugs the selected icon and word, measured from them, and springs to the next; left and right arrow keys move it. When the tabs don't fit, they show icons with only the selected tab named, then only icons (hidden labels are tooltips and stay for screen readers): hidden copies of the bar in each wider mode are measured against its space (`.sizers` in `RadioBar.module.css`), so the switch follows the real text widths. Labels fold and open by transitioning `max-width` to each label's measured width (`--label-width`), on the block's spring; the block's target comes from the hidden copy for the current step and selection, so it slides straight to where the name settles instead of chasing it.
- `ui/ColorField.tsx`: a hex text field plus the browser's color picker.
- `ui/SidebarHandle.tsx`: the sidebar's resize handle (from `b8` up). Saves the width as a share of the window in `localStorage` (`tierbinder-sidebar`) and sets it on the sidebar column (`.sideColumn`: the header and the sidebar) as `--tb-sidebar-width` (a `vw` value), which that rule in `Editor.module.css` uses, falling back to `--tb-sidebar-default`. `Editor.tsx` sets that default on the column from the main nav's measured full width (`RadioBar`'s `onFullWidth`), plus 8px each side and the edge line, so the nav fits with every label; `globals.css` has a 368px stand-in until then. Its limits are a `clamp()` in that CSS: at least `--tb-sidebar-min` (250px) and at most the window less `--tb-workspace-min` (`b5`, 512px), the minimum winning; a drag past either is saved at the limit, and the readout shows the width the sidebar really has. Double-click resets; it's also a focusable `separator` (WAI-ARIA window splitter) that the left and right arrows move.
- `ui/SearchFilters.tsx`: the card search's Filters button and popup (format, card type, newest print only), opening like a dropdown. `searchOptions.ts`: the search's filters and sort orders, their labels, and how they travel as `/api/search` query parameters.
- `ui/Dropdown.tsx`: a labeled dropdown (the Add to picker and the search's Sort) in place of a native `<select>`, so it can open and close with the card menu's animation (top to bottom); arrow keys, Enter/Space and Escape work as in a select.
- `Loader.tsx`: loads `Editor` with `ssr: false` (Konva needs a browser canvas).
- `layout.tsx`: the root layout: fonts (Inter Black for tier labels, Figtree for the controls), metadata, analytics and the scroll container.
- Interface styles: a component's own CSS is a CSS Module beside it (`Editor.module.css`, `ui/RadioBar.module.css`, and so on), with camelCase class names used as `styles.name`; a module that uses a breakpoint (`@variant b8`) starts with `@reference` to `globals.css`. `globals.css` keeps the tokens, the `--tb-*` roles and sizes on `body` (change the look through those), base rules, and the `.tierbinder-*` rules more than one component uses (page, panel, heading, prop, field, popup, option, menu, focus ring).
- `api/`: `card` (by set + number), `search` (by name), `image` (proxy); `cardSource.ts`, which they call, combining `tcgdex.ts` (the TCGdex API, with `tcgdex-sets.json`: set codes and dates, from `npm run tcgdex:sets`) and `limitless.ts` (the fallback, reading limitlesstcg.com pages).

## Graphic types

A type (`GraphicType` in `graphics/types.ts`) owns its document, how it draws, its settings and where cards go; the editor owns everything else. What the editor asks of a type:

- `create`, `parse` (a saved graphic of its kind, with later settings filled in), `label` (in the board type dropdown), `targetNoun` (as in "Add to tier").
- `Canvas`: Konva layers drawn inside the editor's stage, with a `Rect` named `background` (pressing it deselects) and cards drawn with `CardNode`. It gets callbacks to change the graphic, select cards, open the card menu, pick a target and open a setting.
- `Toolbar` (optional): tools beyond moving cards, shown under the board. The editor keeps the active tool (`DEFAULT_TOOL`, `move`, until the toolbar picks another; reset when the board type changes) and passes it to the canvas as `tool`.
- `Settings`: its part of the Customize tab. `onEditSetting(key)` from the canvas switches to the Customize tab and passes `focus` to it (the tier list uses `tier:<index>`).
- Cards: `layout` (every card with its top-left corner and box, drawing order; the editor uses it for selection, hit-testing drops and export), `mapCards` (change or remove), `targets` (the Add to choices; hidden when there's only one), `addCard` (to a target), `dropCard` (at a point), `importCards` (bulk import's `#` groups). Adding returns the new graphic or `{ error }`, shown as the status.

### Adding a graphic type

1. Add `graphics/<kind>/` with a model (document type with a unique `kind`, defaults, parse, layout and edits), a canvas, settings, and an `index.ts` exporting its `GraphicType`.
2. Add it to `GRAPHIC_TYPES` and to the `Graphic` union in `graphics/index.ts`. The board type dropdown lists it, and saves of it load with no other changes.
3. Add its notes below.

## The board

- 1200×675 for every graphic; export is 2× (2400×1350 PNG), downloaded (named after the graphic's kind) or copied.
- On screen the stage scales to fill the workspace, larger or smaller than 1200 (`scale` in `Editor.tsx`): its width on narrow screens, and from `b8` up as much as fits beside the sidebar, with room left for the board type, toolbar and status, which it measures rather than assumes.
- Cards are 100×140, clipped to the card images' rounded corners (`CARD_CORNER_RADIUS`, ~4.5px).
- Editor-only layers are named `editor` and hidden while exporting: the editor's (selection outline), and any a graphic adds (the eraser's circle).
- The selection outline follows a dragged card: Konva moves the card without React, so the stage's `dragmove` and `dragend` move the outline too. Cards carry their item's id (`CardNode` sets the group's `id`), which is how the editor knows the dragged card is the selected one.
- Canvas text uses Inter Black (900), loaded with `next/font` in `layout.tsx` (`--font-inter`); it needs `document.fonts.load` before it draws, so the editor passes `fontFamily` once it's loaded.

## Tier list

- Always 4 tiers, at most 12 cards per tier. New tier lists start with Goated, Solid, Mid, Fraud.
- Cards have a 25px gap that shrinks (negative overlaps, later cards on top) once a row is full; 8 fit at the default gap.
- Settings: `background`, `border` (the lines between tiers, and split card dividers and strokes) and `tierCardBorders` (a 3px stroke inside each card in its tier's color).
- Tier labels are Inter Black at 30px. Names wrap at spaces in `wrapLabel`, never mid-word (Konva's own wrap splits words). `\n` in a name is a line break.
- Dragging a card moves or reorders it (`dropTarget`, `moveCard`). A search result dropped on the board goes in the tier under the pointer, before the first card whose center is to its right.
- Clicking a tier's row anywhere but on a card (its label, the empty space) makes it the Add to tier. Cards are Konva groups named `card`, which is how the canvas tells them apart.
- Bulk import adds each `#` group to the next tier, after the cards already there, and renames the tier if the group has a name. Cards past 12 and groups past the fourth are left out and reported; it never clears the board.
- Double-clicking a tier label switches to the Customize tab and focuses that name.

## Blank canvas

- Cards placed anywhere: each item is a `CardItem` with its top-left `x`, `y`, kept wholly on the board. Later cards draw on top, and a moved card goes on top.
- Cards added from search or import fill a grid of as many spots as fit at the card size (10 × 4 at the default), by how many cards there are, starting over once full; a dropped result is centered on the pointer. Import groups mean nothing here.
- Settings: `cardWidth` (Card size, 40–400px wide; the field applies once a typed number is in range), `topHalf` (Show only top half of cards), `background` (white by default), and `border` for split cards' divider and stroke. Changing the size or top halves moves cards that would hang off the board back onto it.
- Tools (`BlankToolbar.tsx`, under the board): Move (the default: drag and click cards), Pen (color, size; default near-black `#1b1b1b`, 12px) and Eraser (size; default 24px). Pen and eraser settings are saved with the board.
- Ink: `strokes` (pen or eraser, with Konva `Line` points rounded to 0.1px) on their own layer above the cards. Eraser strokes use `destination-out`, so they remove only ink, never cards or the background. While drawing, a transparent rect on the ink layer takes every press (cards don't move or open menus), the stroke stays in component state until the pointer is released anywhere, and a click leaves a dot (the point is doubled). The pen shows a crosshair; the eraser hides the pointer and draws its size as a circle in an editor-only layer. Clear board clears the ink.
- `CardNode` draws every card at 100×140 and scales it (`width`), so borders and corners scale too; `topHalf` clips to the top half. Split cards always show both halves, at full height, since their top half would hide the bottom card. `cardBox` gives the box a card takes, which the canvas reports in `layout` for the selection outline and drop hit-testing.

## Split cards

- A `CardItem` with `split` (its bottom `CardFace`). Drawn as the top halves of both cards (each image's top 50%, 70px tall) over a backing in the divider color, with a 3px divider and a 3px inner stroke, both in the graphic's border color (or the tier's color when tier borders are on).
- Made from the card menu, by dropping a result on a card, or imported as `Top card / Bottom card`; both halves must be found.

## Editing

- Clicking a card without dragging (Konva's `click`/`tap` don't fire after a drag) opens the card menu, HTML over the board; so does right-clicking a card (the browser's own menu is prevented on cards only). Konva also fires `click` for the right button, so only a left `click` opens the menu; right-click opens it from `contextmenu`, which would otherwise land on the already-open menu:
  - The menu stretches out to the right from its left edge (`.tierbinder-menu` in `globals.css`) on `--ease-spring`, and on close folds back to its left edge in 180ms, fading over the last part (`shownMenu` keeps the last menu on screen for 220ms, on a timer since `animationend` doesn't fire in a tab that isn't painting). It's keyed by card and position, so each opening replays the animation.
  - Card: Remove card, Replace card, Make split card.
  - Split card: Remove card, Replace top half, Replace bottom half, Swap halves, Unsplit (keeps the top).
  - A search result dropped on a card opens the menu with the result's choices (`cardMenu.dropped`): Add as split card (the result is the bottom half) or Add to tier/canvas (the graphic's `dropCard` at the drop point); on a split card, Replace top half, Replace bottom half or Add to tier/canvas.
  - Replace and Make split card switch to the Add Cards tab and put it in picking mode (`picking`: `{ id, part: 'top' | 'bottom' }`): replacing searches that card's name, and the next result clicked takes its place (or becomes the bottom half), until Cancel or Escape.
- The Add Cards tab: autocorrect, auto-capitalize and spellcheck are off on the search field and bulk import, because card names aren't real words. Results scroll (3 rows tall on narrow screens). Click one to add it to the chosen target, or drag it onto the board (pointer events, not HTML drag and drop: a copy of the card follows the pointer after a 5px move, and the release goes to the graphic's `dropCard`; Escape cancels; mouse and pen only, since on touch a press-and-move scrolls the results). A blank search clears the results.
- Delete or Backspace removes the selected card (there's no button for it).
- Clear board (confirmed on the page) replaces the board showing with a new one of the same type; other types' boards are kept.
- The board type dropdown above the board lists every type; each keeps its own board, so switching loses nothing (a type not used yet starts new).
- The window: a sidebar column left of the board, headed by the top bar (`.top` in `Editor.module.css`) with the logo, then the sidebar; the workspace beside it runs the window's full height, with the board centered. Under `b8` the column dissolves (`display: contents`): the top bar stays at the top of the page, then the board, then the sidebar (`order`). The sidebar's main nav has Add Cards (green), Customize (yellow) and Save & Share (orange). Add Cards has three sections, 16px apart: Add a Card (search; a row with Filters and Sort, which rerun the current search when changed and apply to the next; the Add to picker, shown only once a submitted search has results; and results), Featured Card Pools (`FEATURED_POOLS` in `Editor.tsx`: named boxes previewing six cards, whose image URLs are copied from Limitless, or card-shaped placeholders while a pool has none; they don't open yet) and Advanced (Bulk import). A search with results hides the pools and Advanced until the field is emptied (typing it blank clears the results), the board is cleared (which also clears the search) or the page reloads. Bulk import opens inside Advanced and hides the pools. The panels stay mounted and are `hidden` when not shown. On wide screens the sidebar and the workspace each scroll on their own, and the search results fill the sidebar's height. The board's toolbar and status stay under the board.

## Look and motion

- The palette, look and motion are in `design/hutton-design-system.md`, including `--ease-spring`, `--duration-move`, `--duration-drop` and `--duration-fade`.
- The type scale (`text-field`, `text-body`, `text-caption`) is in the `@theme` block at the top of `globals.css`, since the token generator has none. Fields are 16px on phones, because iPhones zoom the page on smaller ones.
- Popups (the card menu, dropdowns) share `.tierbinder-menu` in `globals.css`.

## Cards from TCGdex and Limitless

- Card data and images come from the TCGdex API (tcgdex.dev: free, no key, open source), called from our API routes. Pokémon TCG Pocket sets are left out.
- Limitless is the fallback (`api/cardSource.ts`), for cards TCGdex lists without an image (the newest set for a while after release, MEP and some SVP promos, basic energies, gallery subsets) and when TCGdex is down or finds nothing. A search only asks Limitless when TCGdex comes up short, and then takes just the cards TCGdex has no image for, matched by set code and number, with TCGdex's names and release dates; anything else could be a duplicate, since a few older sets have other codes there (`UD` for Undaunted, `UND` on TCGdex). A lookup tries Limitless when TCGdex has no card with an image. Limitless has no card API, so it reads pages; image numbers aren't predictable (MEG pads to 3 digits, TWM doesn't), so its image URLs always come from the page, and results whose images aren't on its CDN are skipped. Search uses `show=all` to get every match on one page. Its search results have no names, so when everything comes from Limitless they're named after the search.
- Cards are saved and imported by their official set code and printed number (`TWM 130`, `SIT TG05`); TCGdex's own set ids (`sv06`) stay inside `api/tcgdex.ts`. `api/tcgdex-sets.json` maps ids to codes and release dates, since TCGdex only gives them one set at a time; sets released since it was generated are looked up when they first appear. Run `npm run tcgdex:sets` now and then and commit the result (in the cloud container it needs `NODE_USE_ENV_PROXY=1`). Subsets share their main set's code (`SIT:TG` → `SIT`), and one code can cover several TCGdex sets (30th Celebration and its Classic Collection are both `30C`).
- TCGdex pads some numbers (`073`); they're saved as printed (`73`).
- Every image is loaded through `/api/image`, which keeps canvas export working and caches images. The proxy only allows the hosts listed in its route. TCGdex images are `high.webp` (600×825) on the board and `low.webp` in the results, Limitless's `_LG.png` and `_SM.png`; search thumbnails load from the source directly and retry once through the proxy if they fail.
- Search matches names containing the query. Results are newest set first, then by set code and number, and named from TCGdex.
- Search filters and sorts (`searchOptions.ts`): format (Standard or Expanded) and card type (Pokémon, Trainer or Energy) are TCGdex query filters (`legal.standard`, `category`); the Pokédex sort is TCGdex's `sort:field=dexId`, kept as each card's `rank`; name sorting and newest print only (one card per name, the newest) happen in `cardSource.ts`. A Limitless-only search uses Limitless's own terms (`f:`, `t:`, `o:`, `u:cards`); filling TCGdex's missing images asks Limitless with the filters only. TCGdex can't sort by price (its search ignores price fields, and prices come only with each card's full record), so there's no price sort. A name-only import picks the lowest number in the newest set, skipping special reprint sets (`SPECIAL_SETS` in `cards.ts`: 30th Celebration and Celebrations) and subset numbers like TG05 while a regular print exists.

## Saving

- The document autosaves to `localStorage` (`tierbinder-doc`) and is read back with `parseSaved`; there's no file save/load. It holds one board per type (`graphics`, keyed by kind) and which one is showing (`kind`, whose board is always present). Cards are saved as names and image URLs, so even full boards are a few KB.
- Version 1 was a tier list on its own (`{ version: 1, kind: 'tier-list', ... }`) and version 2 one graphic (`{ version: 2, graphic }`); `parseSaved` converts both. A saved board that doesn't parse is dropped and starts new, keeping the others.
- Changing the document's shape means bumping `version` and converting in `parseSaved`; a graphic's new setting with a default can instead be filled in by its `parse` (as the tier list's `border` and `tierCardBorders` are).
- In `next dev`, a tab left open while the document shape changes keeps its old in-memory board (without the new fields) until it's reloaded.

## Testing in the in-app browser

- It doesn't paint: screenshots time out and Konva's hit canvas goes stale. Call `stage.draw()` before simulating clicks on the board, and read results from `localStorage` or the Konva tree (`Konva.stages[0]`). Pixels can be checked with `stage.toCanvas()`; hashing them before and after a refactor checks nothing changed.
- Simulated mouse drags don't start Konva drags; to test a card drop, set the card node's position and `fire('dragend')`.
- CSS animations start but don't advance, and `animationend` never fires; check where one ends with `el.getAnimations().forEach((a) => a.finish())`.
- `confirm()` returns false at once and `alert()` never shows, so confirm on the page instead (see Clear board).
- Every tab shares the saved board: back up `tierbinder-doc` before a test that edits it, restore it after, and test in a background tab rather than the one being used.

## Not done yet

- Free-placed elements on top of any graphic (cards, text, images in the document's own `elements`), charts and Venn diagrams, Pokémon HOME sprites, other games' cards, and dragging search results on touch screens.
