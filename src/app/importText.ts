// Bulk import format. Cards before any `#` line go in the card tray, after the cards
// already there (or on the board, where the graphic says: its `ungroupedImport`). A `#` line starts the next group, named by its text (`#` alone gives no
// name; `\n` is a line break). Each graphic decides what groups are: a tier list fills a
// tier per group and renames it. Each other line is a card, in deck-list form with an
// optional count:
//
//   Pikachu ex SSP 57   <- before any #: the card tray
//   # Goated
//   Mew ex MEW 151
//   1 Dipplin TWM 18
//   Alakazam            <- name only: the newest regular print
//   Dragapult ex TWM 130 / Pidgeot ex   <- a split card: top / bottom

import type { CardItem } from './cards';

export type ImportCard = { name: string; set?: string; number?: string };
export type ImportLine = ImportCard & { line: number; split?: ImportCard };
export type ImportGroup = { name?: string; cards: ImportLine[] };
// A group once its cards are looked up (the ones found)
export type ResolvedGroup = { name?: string; items: CardItem[] };

const WITH_SET = /^(.+?)\s+([A-Z][A-Z0-9-]{1,7})\s+([A-Za-z0-9-]{1,8})$/;

function parseCard(text: string): ImportCard {
  const match = text.trim().match(WITH_SET);
  return match ? { name: match[1], set: match[2], number: match[3] } : { name: text.trim() };
}

// The cards for the card tray (before the first `#`), and the groups for the board
export type ParsedImport = { tray: ImportLine[]; groups: ImportGroup[] };

export function parseImport(text: string): ParsedImport {
  const tray: ImportLine[] = [];
  const groups: ImportGroup[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      const name = line.slice(1).trim().replaceAll('\\n', '\n');
      groups.push(name ? { name, cards: [] } : { cards: [] });
      return;
    }
    const [top, bottom] = line.replace(/^\d+\s+/, '').split(/\s+\/\s+/);
    (groups.at(-1)?.cards ?? tray).push({
      ...parseCard(top),
      ...(bottom ? { split: parseCard(bottom) } : {}),
      line: i + 1,
    });
  });

  return { tray, groups };
}
