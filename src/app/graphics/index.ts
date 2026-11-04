import blank from './blank';
import type { BlankCanvas } from './blank/model';
import tierList from './tier-list';
import type { TierList } from './tier-list/model';
import type { GraphicType } from './types';

// Every graphic type, in New board's order. To add one, see "Adding a graphic type" in
// this tool's CLAUDE.md.
export const GRAPHIC_TYPES = [tierList, blank];

export type Graphic = TierList | BlankCanvas;
export type GraphicKind = Graphic['kind'];

// The type that draws and edits a graphic. Typed for any graphic, so the editor can call
// it without narrowing; it's only ever given graphics of its own kind.
export function typeOf(kind: GraphicKind) {
  return GRAPHIC_TYPES.find((t) => t.kind === kind) as unknown as GraphicType<Graphic>;
}
