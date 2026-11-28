# TierBinder

Alex Hutton's TCG graphics tool, live at tierbinder.big-a.fun and kept out of search with
`noindex` until it has its real domain. The goal is to be the best TCG tier list maker;
other graphics are a bonus. It moved here from big-a-website, whose issues and PRs old
commits link to. Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, Konva,
deployed on Vercel's Hobby plan.

## Workflow

- `main` is protected: changes go through a PR and must pass the `build` check. What it runs is in `.github/workflows/ci.yml`; run the same checks locally before committing, plus `npx prettier --write` on changed files and `npx tsc --noEmit`.
- Before calling a PR done, run the independent reviewers in `.claude/agents/` on its diff: `code-reviewer`, and `design-reviewer` when the interface changed. They haven't seen the work, so they catch what its author misses. Run them once per finished batch of work (before calling the PR done, or before pushing a substantial new piece), not after every small tweak or follow-up fix: tokens are spent per run, and a one-line change rarely needs a fresh pair of eyes. `design-reviewer` runs on Sonnet (its frontmatter), since most of its work is checking against the design system; `code-reviewer` inherits the session's model, since it catches the subtle bugs. Check their findings against the code, fix the clear ones, and ask Alex about any that need a decision. Don't request GitHub Copilot reviews on this repo: Alex's Copilot access isn't his to spend on it.
- Squash-merge and delete the branch.
- Don't stack PRs.
- Run tools from the repo folder.
- Dependabot opens weekly grouped minor/patch PRs; merge them once green.
- When a PR changes a convention described here or in `docs/notes/`, update those notes in the same PR.
- After changing `design/hutton-design-system.md`, run `npm run design:tokens` and commit `design/theme.css`. It needs the `hutton-design` skill installed. Never edit that file by hand.
- **Remind Alex to refresh the card data.** At the start of a session, check when `src/app/api/tcgdex-sets.json` was last committed (`git log -1 --format=%cs -- src/app/api/tcgdex-sets.json`). If it's over a month old, or a new English set has come out since, remind him to run `npm run tcgdex:sets` and commit `tcgdex-sets.json`, `extra-images.json` and `tcgdex-skipped.json` (it takes about two minutes; offer to run it). That's how new sets, and the images TCGdex adds weeks after a release, reach the site. Also remind him when a Featured Card Pool still uses `pokemontcgCard` for a card the last run says TCGdex now has an image for (it no longer appears in `extra-images.json`), so the pool can switch to `poolCard`: Best Decks of All Time's Zoroark-GX (SLG 53) is waiting on that.
- Stay on free plans until the tool is solid. Move to Vercel Pro before any ads or payments go live, since Hobby is non-commercial only.

## Gotchas

- **The layout switch isn't `b8` alone.** The sidebar goes beside the board from `b8` up and on a landscape window from `b6` (a phone turned sideways): use the `beside` variant (`beside:`, `@variant beside`, defined in `globals.css` from the breakpoint tokens) for anything about that layout, never `b8`, and `wideQuery` in `Editor.tsx` is the same query (`wide`). Where these notes say "from `b8` up" or "under `b8`", they mean that layout.
- **Custom spacing scale** (`design/hutton-design-system.md`): Tailwind's numbered spacing doesn't mean the default sizes here, e.g. `p-4` is 16px, but `px-6` (64px) and `gap-5` (32px) are much bigger than usual. Round to the nearest step rather than writing arbitrary spacing like `mt-[12px]`.
- **No magic numbers** (`design/hutton-design-system.md`, section 12): let flex, grid, `aspect-ratio`, `clamp()` and container queries size things; name each fixed size once (a `--tb-*` size in `globals.css` or a TS constant); and ask Alex when a layout has a real choice.
- **`html` and `body` don't scroll** (`overflow: hidden` in `globals.css`). The page has its own scroll container (`<main>`), though the editor fits the window at every width and only its panels scroll.
- **Tailwind's `hover:` variant only applies on devices that can hover.** For hover effects that must work everywhere use plain `:hover` in CSS.
- **Tailwind's `shadow-[...]` stacks the shadow with four empty layers**, so animating `box-shadow` from it fades instead of moving. Set shadows that animate in plain CSS.
- **`@theme inline` tokens aren't real CSS variables** at runtime. Generated tokens are, but fonts use the `next/font` variables from `src/app/layout.tsx` directly.
- **Share links are untrusted input.** A linked board comes from anywhere, so every saved or shared board is parsed strictly (colors kept only as `#rrggbb`, since they reach CSS). See `docs/notes/saving.md`.
- **Never scrape card data** (Limitless, pokemon.com): cards come from TCGdex and the images `npm run tcgdex:sets` fills in. Never submit data to TCGdex: its contributing rules forbid AI-assisted data. See `docs/notes/tcgdex.md`.

## Design

Follow `design/hutton-design-system.md` using the `hutton-design` skill. Use the tokens, not raw hex.

## Notes

How each part works lives in `docs/notes/`. Read the notes for what you're changing before changing it: they hold decisions and browser workarounds the code doesn't explain. Paths are in `src/app/`.

- `files.md`: what each file does (`Editor.tsx`, `ui/`, `canvas/`, `api/`, `document.ts`, `cards.ts`, `share.ts` and the rest), and where interface styles go.
- `graphic-types.md`: the `GraphicType` interface the editor talks to, toasts, and adding a graphic type.
- `board.md`: the board's size, shapes, export, scaling and editor-only layers, and split cards.
- `tier-list.md` and `blank-canvas.md`: each graphic's own rules.
- `card-tray.md`: the card tray under the board.
- `editing.md`: selecting cards, the card menu, View, the Add Cards tab and search, the keyboard on the board, Clear, undo, the window and sidebar layout, and hiding the sidebar.
- `flying-in.md`: cards flying from the sidebar to the board.
- `tcgdex.md`: card data and images (TCGdex, pokemon-tcg-data), licensing and search order.
- `saving.md`: autosave, document versions and strict parsing.
- `share-links.md`: Save & Share's buttons and board links.

## Look and motion

- The palette, look and motion are in `design/hutton-design-system.md`, including `--ease-spring`, `--duration-move`, `--duration-drop` and `--duration-fade`.
- The type scale (`text-field`, `text-body`, `text-caption`) is in the `@theme` block at the top of `globals.css`, since the token generator has none. Fields are 16px on phones, because iPhones zoom the page on smaller ones.
- Capitalization (section 4 of the design system): title case for headings, tabs, buttons, menu items, dropdown options, field labels and messages (no closing period; the API routes' errors too, and the search turns the browser's own network errors into "Couldn't Reach the Server"); sentence case for checkbox labels, placeholders, tooltips and screen reader text.
- Scrollbars (the page's and every panel's) are thin, a rounded `--tb-scroll-thumb` on no track (`globals.css`), drawn with `scrollbar-color` where it's supported and the WebKit scrollbar in Safari.
- Popups (the card menu, the search result menu and its flyout, the card menu's Clear Card Tray flyout, dropdowns, the Sets popup and the color picker) share `.tierbinder-menu` in `globals.css`; those listing options (the card menu, the result menu and its flyout, and the dropdowns' lists) are `.tierbinder-list`: options as rounded rows inset 4px, lighting up in `--tb-option-hover` on hover and, on every device, while pressed, with 8px corners on the card menu and 4px on dropdowns; the dropdowns, the Sets popup and the color picker float in the top layer (`ui/anchored.ts`).

## Testing in the in-app browser

- It doesn't paint: screenshots time out and Konva's hit canvas goes stale. Call `stage.draw()` before simulating clicks on the board, and read results from `localStorage` or the Konva tree (`Konva.stages[0]`). Pixels can be checked with `stage.toCanvas()`; hashing them before and after a refactor checks nothing changed.
- Simulated mouse drags don't start Konva drags; to test a card drop, set the card node's position and `fire('dragend')`.
- CSS animations start but don't advance, and `animationend` never fires; check where one ends with `el.getAnimations().forEach((a) => a.finish())`.
- `confirm()` returns false at once and `alert()` never shows, so confirm on the page instead (see Clear board).
- Every tab shares the saved board: back up `tierbinder-doc` before a test that edits it, restore it after, and test in a background tab rather than the one being used.

## Not done yet

- Short share links (a stored board behind a short URL, which needs a store such as Vercel Blob or Upstash Redis set up in Vercel).
- Free-placed elements on top of any graphic (cards, text, images in the document's own `elements`), charts and Venn diagrams, Pokémon HOME sprites, and other games' cards. Dragging search results on touch screens was decided against: a tap adds a result, and its long-press menu adds it to any tier.
