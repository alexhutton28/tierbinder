# tcgTierStack

A hidden tool (not linked from the home page, `noindex`) for laying out Pokémon TCG tier
lists and exporting them as images for X. It's meant to grow into a small design tool
(more chart types, free-placed elements), so the document is plain JSON kept separate
from rendering. Styling is deliberately minimal for now, and there's no help text on the
page.

## Files

- `tierList.ts`: the document types, defaults, all board sizes, the layout (`layoutCards`, `tierGap`, `dropTarget`) and edits (`moveCard`, `insertCard`), and `parseDoc` for saved documents.
- `Board.tsx`: draws the document with react-konva (canvas): tier labels, cards (single and split), dragging, selection, and the click that opens the card menu.
- `TierStack.tsx`: editor state and everything around the board: the card menu, Add a card (search), Customize Board, Bulk import, export, New board, autosave.
- `TierStackLoader.tsx`: loads `TierStack` with `ssr: false` (Konva needs a browser canvas).
- `ColorField.tsx`: a hex text field plus the browser's color picker.
- `importText.ts`: the bulk import format (documented at the top of the file).
- `cards.ts`: client calls to the API routes, and image loading through the proxy.
- `layout.tsx`: the page's scroll container, and Inter Black for the tier labels.
- `../api/tcg-tier-stack/`: `card` (by set + number), `search` (by name), `image` (proxy), and `limitless.ts`, which reads limitlesstcg.com pages.

## The board

- 1200×675; export is 2× (2400×1350 PNG), downloaded or copied. Always 4 tiers, at most 12 cards per tier. New boards start with Goated, Solid, Mid, Fraud.
- Cards are 100×140 with a 25px gap that shrinks (negative overlaps, later cards on top) once a row is full; 8 fit at the default gap. Every card is clipped to the card images' rounded corners (`CARD_CORNER_RADIUS`, ~4.5px).
- Settings: `background`, `border` (the lines between tiers, and split card dividers and strokes) and `tierCardBorders` (a 3px stroke inside each card in its tier's color).
- Tier labels are Inter Black (900) at 30px, loaded with `next/font` in `layout.tsx` (`--font-inter`); canvas text needs `document.fonts.load` before it draws. Names wrap at spaces in `wrapLabel`, never mid-word (Konva's own wrap splits words). `\n` in a name is a line break.
- The editor-only layer (selection outline) is named `editor` and hidden while exporting.

## Split cards

- A `CardItem` with `split` (its bottom `CardFace`). Drawn as the top halves of both cards (each image's top 50%, 70px tall) over a border-colored backing, with a 3px divider in `border` and a 3px inner stroke in `border` (or the tier's color when tier borders are on).
- Made from the card menu or imported as `Top card / Bottom card`; both halves must be found.

## Editing

- Drag a card to move or reorder it. Clicking a card without dragging (Konva's `click`/`tap` don't fire after a drag) opens the card menu, HTML over the board:
  - Card: Remove card, Replace card, Make split card.
  - Split card: Remove card, Replace top half, Replace bottom half, Swap halves, Unsplit (keeps the top).
  - Replace and Make split card put Add a card in picking mode (`picking`: `{ id, part: 'top' | 'bottom' }`): replacing searches that card's name, and the next result clicked takes its place (or becomes the bottom half), until Cancel or Escape.
- Add a card: results show 3 rows and scroll. Click one to add it to the chosen tier, or drag it onto the board (HTML drag and drop on the board's wrapper, placed with `dropTarget` and `insertCard`; no touch support). A blank search clears the results.
- Bulk import adds cards after the ones already in each tier (cards past 12 are left out and reported); it never clears the board. `#` lines move to the next tier and rename it if they have text.
- Customize Board (tier colors and names, the tier border checkbox, background, border) and Bulk import are `<details>`, collapsed by default; double-clicking a tier label opens Customize Board and focuses that name.

## Cards from Limitless

- Every image is loaded through `/api/tcg-tier-stack/image`: Limitless sends no CORS headers, and a canvas with cross-origin images can't be exported. The proxy only allows the hosts listed in its route; add a host there to use a new image source (e.g. Pokémon HOME sprites). Search thumbnails load from the CDN directly and retry once through the proxy if they fail.
- Limitless has no card API, so lookups read its pages. Image numbers aren't predictable (MEG pads to 3 digits, TWM doesn't), so image URLs always come from the page.
- Search uses `show=all` to get every match on one page (the default is 50 per page); results whose images aren't on the Limitless CDN (older cards on pokemontcg.io) are skipped.
- Results are newest set first. A name-only import picks the lowest number in the newest set, skipping special reprint sets (`SPECIAL_SETS` in `TierStack.tsx`: 30th Celebration and Celebrations, which Limitless lists first) and subset numbers like CC21 or TG05 while a regular print exists.

## Saving

- The document autosaves to `localStorage` (`tcg-tier-stack-doc`) and is read back with `parseDoc`; there's no file save/load.
- Changing the shape means bumping `version`; a new setting with a default can instead be filled in by `parseDoc` for older saves (as `border` and `tierCardBorders` are).
- In `next dev`, a tab left open while the document shape changes keeps its old in-memory board (without the new fields) until it's reloaded.

## Testing in the in-app browser

- It doesn't paint: screenshots time out and Konva's hit canvas goes stale. Call `stage.draw()` before simulating clicks on the board, and read results from `localStorage` or the Konva tree (`Konva.stages[0]`). Pixels can be checked with `stage.toCanvas()`.
- `confirm()` returns false at once and `alert()` never shows, so confirm on the page instead (see New board).
- Every tab shares the saved board: back up `tcg-tier-stack-doc` before a test that edits it, restore it after, and test in a background tab rather than the one being used.

## Not done yet

- Pokémon HOME sprites, other chart types, and dragging search results on touch screens.
