# The Board and Split Cards

Part of TierBinder's notes, indexed in `CLAUDE.md`. Keep them matching the code in the same PR that changes it.

## The board

- Every board is 675 design pixels tall (`BOARD_HEIGHT`), so rows and cards keep their size; its shape (`shape` in each graphic's document, `SHAPES` in `canvas/size.ts`) sets only its width (`boardWidth`) and the image's size: Wide 16:9 (1200 wide, 2400×1350, for X and Bluesky), Square 1:1 (675, 1080×1080), Portrait 4:5 (540, 1080×1350), Tall 3:4 (506.25, 1080×1440) and Story 9:16 (about 380, 1080×1920). Narrow shapes are the ones for a few cards per tier. Shape is in Customize's Board section, under the board type (a `Dropdown` `prop` row); changing it goes through the type's `reshape`. Each board keeps its own shape; a board saved before shapes is 16:9 (`parseShape`); Reset Board Styles and the clears leave it be.
- Export is the shape's size (`exportSize`, at `exportScale` image pixels to a design pixel: 2 at 16:9), taller with the card tray, downloaded (`tierbinder-tier-list.png`, after the graphic's kind) or copied. Some shapes' design widths aren't whole numbers, and Konva cuts its canvas size to a whole number, so the export asks for half an image pixel more (`EXPORT_MARGIN`) to always get the exact size.
- On screen the stage scales to fill the workspace, larger or smaller than its design width (`scale` in `Editor.tsx`; `stageWidth` is the board's width, or the card tray's while it shows and is wider): under `b8` its width, as long as the workspace stays within `BOARD_SHARE` of the page's height (see The window), and from `b8` up as much as fits beside the sidebar, with room left for the toolbar, which it measures rather than assumes.
- Cards are 100×140, clipped to the card images' rounded corners (`CARD_CORNER_RADIUS`, ~4.5px). While its image loads a card shimmers as search results do (`Shimmer` in `CardNode.tsx`: a Konva gradient band moved each frame, in `--tb-skeleton` colors, a still dark card under reduced motion); one whose image fails shows its name and "(no image)". The board draws the full-size image, not the result's thumbnail, so pressing a result with a mouse or pen starts loading it (`loadImage` in its `pointerdown`; not on touch, where a press often starts a scroll).
- Editor-only layers are named `editor` and hidden while exporting: the editor's (selection outline, and the `drag` group the dragged card moves into), and any a graphic adds (the eraser's circle). The editor's layer listens, so a dragged card's events still reach the stage and move the outline with it; the outline itself doesn't (`listening={false}`).
- The selection outline follows a dragged card: Konva moves the card without React, so the stage's `dragmove` and `dragend` move the outline too. Cards carry their item's id (`CardNode` sets the group's `id`), which is how the editor knows the dragged card is the selected one.
- Canvas text uses Inter Black (900), loaded with `next/font` in `layout.tsx` (`--font-inter`); it needs `document.fonts.load` before it draws, so the editor passes `fontFamily` once it's loaded.

## Split cards

- A `CardItem` with `split` (its bottom `CardFace`). Drawn as the top halves of both cards (each image's top 50%, 70px tall) over a backing in the divider color, with a 3px divider and a 3px inner stroke, both in the graphic's border color (or the tier's color when tier borders are on).
- Made from the card menu, by dropping a result on a card, or imported as `Top card / Bottom card`; both halves must be found.
