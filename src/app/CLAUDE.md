# tcgTierStack

A hidden tool (not linked from the home page, `noindex`) for laying out Pokémon TCG
graphics, tier lists first, and exporting them as images for X. It's growing into a small
design tool, so the editor is a shared shell and each kind of graphic (tier list, blank
canvas; later charts, Venn diagrams) is a pluggable **graphic type**. Styling is
deliberately minimal for now, and there's no help text on the page.

## Files

- `Editor.tsx`: the shell, shared by every graphic: the stage and its scaling, selection and its outline, the card menu, Add a card (search, picking, dragging results), Customize Board (around the graphic's own settings), Bulk import (lookups), export, Clear board, Change board type, autosave. It only talks to graphics through `GraphicType`.
- `document.ts`: the saved document (`{ version: 3, kind, graphics }`), `currentGraphic`, and `parseSaved`, which converts older saves.
- `graphics/types.ts`: the `GraphicType` interface; `graphics/index.ts`: the list of types (`GRAPHIC_TYPES`), the `Graphic` union, and `typeOf(kind)`.
- `graphics/tier-list/`: `model.ts` (document, layout, edits, import, parse), `TierListCanvas.tsx`, `TierListSettings.tsx`, and `index.ts` (its `GraphicType`).
- `graphics/blank/`: the same for the blank canvas (`BlankCanvasView.tsx`, `BlankSettings.tsx`).
- `canvas/CardNode.tsx`: a card on the board for every graphic (image or split card, rounded clip, placeholder, dragging, menu clicks). `canvas/size.ts`: board, export and card sizes.
- `cards.ts`: card types saved in documents (`CardFace`, `CardItem`), `newId`, client calls to the API routes, bulk import lookups (`resolveCard`, `defaultPrint`), and image loading through the proxy.
- `importText.ts`: the bulk import format (documented at the top of the file).
- `ui/ColorField.tsx`: a hex text field plus the browser's color picker.
- `TierStackLoader.tsx`: loads `Editor` with `ssr: false` (Konva needs a browser canvas).
- `layout.tsx`: the page's scroll container, and Inter Black for the tier labels.
- `../api/tcg-tier-stack/`: `card` (by set + number), `search` (by name), `image` (proxy), and `limitless.ts`, which reads limitlesstcg.com pages.

## Graphic types

A type (`GraphicType` in `graphics/types.ts`) owns its document, how it draws, its settings and where cards go; the editor owns everything else. What the editor asks of a type:

- `create`, `parse` (a saved graphic of its kind, with later settings filled in), `label` (in Change board type), `targetNoun` (as in "Add to tier").
- `Canvas`: Konva layers drawn inside the editor's stage, with a `Rect` named `background` (pressing it deselects) and cards drawn with `CardNode`. It gets callbacks to change the graphic, select cards, open the card menu, pick a target and open a setting.
- `Toolbar` (optional): tools beyond moving cards, shown under the board. The editor keeps the active tool (`DEFAULT_TOOL`, `move`, until the toolbar picks another; reset when the board type changes) and passes it to the canvas as `tool`.
- `Settings`: its part of Customize Board. `onEditSetting(key)` from the canvas opens the panel and passes `focus` to it (the tier list uses `tier:<index>`).
- Cards: `layout` (every card with its top-left corner and box, drawing order; the editor uses it for selection, hit-testing drops and export), `mapCards` (change or remove), `targets` (the Add to choices; hidden when there's only one), `addCard` (to a target), `dropCard` (at a point), `importCards` (bulk import's `#` groups). Adding returns the new graphic or `{ error }`, shown as the status.

### Adding a graphic type

1. Add `graphics/<kind>/` with a model (document type with a unique `kind`, defaults, parse, layout and edits), a canvas, settings, and an `index.ts` exporting its `GraphicType`.
2. Add it to `GRAPHIC_TYPES` and to the `Graphic` union in `graphics/index.ts`. Change board type lists it, and saves of it load with no other changes.
3. Add its notes below.

## The board

- 1200×675 for every graphic; export is 2× (2400×1350 PNG), downloaded (named after the graphic's kind) or copied.
- Cards are 100×140, clipped to the card images' rounded corners (`CARD_CORNER_RADIUS`, ~4.5px).
- Editor-only layers are named `editor` and hidden while exporting: the editor's (selection outline), and any a graphic adds (the eraser's circle).
- Canvas text uses Inter Black (900), loaded with `next/font` in `layout.tsx` (`--font-inter`); it needs `document.fonts.load` before it draws, so the editor passes `fontFamily` once it's loaded.

## Tier list

- Always 4 tiers, at most 12 cards per tier. New tier lists start with Goated, Solid, Mid, Fraud.
- Cards have a 25px gap that shrinks (negative overlaps, later cards on top) once a row is full; 8 fit at the default gap.
- Settings: `background`, `border` (the lines between tiers, and split card dividers and strokes) and `tierCardBorders` (a 3px stroke inside each card in its tier's color).
- Tier labels are Inter Black at 30px. Names wrap at spaces in `wrapLabel`, never mid-word (Konva's own wrap splits words). `\n` in a name is a line break.
- Dragging a card moves or reorders it (`dropTarget`, `moveCard`). A search result dropped on the board goes in the tier under the pointer, before the first card whose center is to its right.
- Clicking a tier's row anywhere but on a card (its label, the empty space) makes it the Add to tier. Cards are Konva groups named `card`, which is how the canvas tells them apart.
- Bulk import adds each `#` group to the next tier, after the cards already there, and renames the tier if the group has a name. Cards past 12 and groups past the fourth are left out and reported; it never clears the board.
- Double-clicking a tier label opens Customize Board and focuses that name.

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
  - Card: Remove card, Replace card, Make split card.
  - Split card: Remove card, Replace top half, Replace bottom half, Swap halves, Unsplit (keeps the top).
  - A search result dropped on a card opens the menu with the result's choices (`cardMenu.dropped`): Add as split card (the result is the bottom half) or Add to tier/canvas (the graphic's `dropCard` at the drop point); on a split card, Replace top half, Replace bottom half or Add to tier/canvas.
  - Replace and Make split card put Add a card in picking mode (`picking`: `{ id, part: 'top' | 'bottom' }`): replacing searches that card's name, and the next result clicked takes its place (or becomes the bottom half), until Cancel or Escape.
- Add a card: results show 3 rows and scroll. Click one to add it to the chosen target, or drag it onto the board (pointer events, not HTML drag and drop: a copy of the card follows the pointer after a 5px move, and the release goes to the graphic's `dropCard`; Escape cancels; mouse and pen only, since on touch a press-and-move scrolls the results). A blank search clears the results.
- Delete or Backspace removes the selected card (there's no button for it).
- Clear board (confirmed on the page) replaces the board showing with a new one of the same type; other types' boards are kept.
- Change board type lists the other types; each keeps its own board, so switching loses nothing (a type not used yet starts new).
- Customize Board and Bulk import are `<details>`, collapsed by default.

## Cards from Limitless

- Every image is loaded through `/api/tcg-tier-stack/image`: Limitless sends no CORS headers, and a canvas with cross-origin images can't be exported. The proxy only allows the hosts listed in its route; add a host there to use a new image source (e.g. Pokémon HOME sprites). Search thumbnails load from the CDN directly and retry once through the proxy if they fail.
- Limitless has no card API, so lookups read its pages. Image numbers aren't predictable (MEG pads to 3 digits, TWM doesn't), so image URLs always come from the page.
- Search uses `show=all` to get every match on one page (the default is 50 per page); results whose images aren't on the Limitless CDN (older cards on pokemontcg.io) are skipped.
- Results are newest set first. A name-only import picks the lowest number in the newest set, skipping special reprint sets (`SPECIAL_SETS` in `cards.ts`: 30th Celebration and Celebrations, which Limitless lists first) and subset numbers like CC21 or TG05 while a regular print exists.

## Saving

- The document autosaves to `localStorage` (`tcg-tier-stack-doc`) and is read back with `parseSaved`; there's no file save/load. It holds one board per type (`graphics`, keyed by kind) and which one is showing (`kind`, whose board is always present). Cards are saved as names and image URLs, so even full boards are a few KB.
- Version 1 was a tier list on its own (`{ version: 1, kind: 'tier-list', ... }`) and version 2 one graphic (`{ version: 2, graphic }`); `parseSaved` converts both. A saved board that doesn't parse is dropped and starts new, keeping the others.
- Changing the document's shape means bumping `version` and converting in `parseSaved`; a graphic's new setting with a default can instead be filled in by its `parse` (as the tier list's `border` and `tierCardBorders` are).
- In `next dev`, a tab left open while the document shape changes keeps its old in-memory board (without the new fields) until it's reloaded.

## Testing in the in-app browser

- It doesn't paint: screenshots time out and Konva's hit canvas goes stale. Call `stage.draw()` before simulating clicks on the board, and read results from `localStorage` or the Konva tree (`Konva.stages[0]`). Pixels can be checked with `stage.toCanvas()`; hashing them before and after a refactor checks nothing changed.
- Simulated mouse drags don't start Konva drags; to test a card drop, set the card node's position and `fire('dragend')`.
- `confirm()` returns false at once and `alert()` never shows, so confirm on the page instead (see New board).
- Every tab shares the saved board: back up `tcg-tier-stack-doc` before a test that edits it, restore it after, and test in a background tab rather than the one being used.

## Not done yet

- Free-placed elements on top of any graphic (cards, text, images in the document's own `elements`), charts and Venn diagrams, Pokémon HOME sprites, other games' cards, and dragging search results on touch screens.
