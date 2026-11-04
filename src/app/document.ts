// The saved document, kept in localStorage: one graphic of each kind, so switching board
// type keeps each board, and which kind is showing. Plain JSON, separate from rendering.
// Changing its shape means bumping `version` and converting older saves in parseSaved; a
// graphic's own new settings can instead be filled in by its `parse`.

import { typeOf, type Graphic, type GraphicKind } from './graphics';

export type TierStackDoc = {
  version: 3;
  // The board showing; its board is always in `graphics`
  kind: GraphicKind;
  // Each kind's board, once it's been used
  graphics: Partial<Record<GraphicKind, Graphic>>;
};

export function newDoc(): TierStackDoc {
  return { version: 3, kind: 'tier-list', graphics: { 'tier-list': typeOf('tier-list').create() } };
}

// The board showing
export function currentGraphic(doc: TierStackDoc): Graphic {
  return doc.graphics[doc.kind]!;
}

function parseGraphic(value: unknown): Graphic | null {
  const kind = (value as { kind?: string } | null | undefined)?.kind;
  const type = kind ? typeOf(kind as GraphicKind) : undefined;
  return type?.parse(value) ?? null;
}

export function parseSaved(value: unknown): TierStackDoc | null {
  const saved = value as {
    version?: number;
    kind?: string;
    graphic?: unknown;
    graphics?: Record<string, unknown>;
  } | null;
  // Version 1 was a tier list on its own ({ version: 1, kind: 'tier-list', ...the list });
  // version 2 had one graphic ({ version: 2, graphic })
  if (saved?.version === 1 || saved?.version === 2) {
    const graphic = parseGraphic(saved.version === 1 ? saved : saved.graphic);
    return graphic && { version: 3, kind: graphic.kind, graphics: { [graphic.kind]: graphic } };
  }
  if (saved?.version !== 3 || !saved.graphics) return null;
  // Boards that don't parse are dropped (and start new), keeping the others
  const graphics: TierStackDoc['graphics'] = {};
  for (const value of Object.values(saved.graphics)) {
    const graphic = parseGraphic(value);
    if (graphic) graphics[graphic.kind] = graphic as never;
  }
  const kind = saved.kind as GraphicKind;
  if (!typeOf(kind)) return null;
  graphics[kind] ??= typeOf(kind).create() as never;
  return { version: 3, kind, graphics };
}
