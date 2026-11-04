// Bulk import format. A `#` line starts the next group, named by its text (`#` alone
// gives no name; `\n` is a line break). Each graphic decides what groups are: a tier list
// fills a tier per group and renames it. Each other line is a card, in deck-list form with
// an optional count:
//
//   # Goated
//   Mew ex MEW 151
//   1 Dipplin TWM 18
//   Alakazam            <- name only: the newest regular print
//   Dragapult ex TWM 130 / Pidgeot ex   <- a split card: top / bottom
//
// Cards before the first `#` go in the first group.

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

export function parseImport(text: string): ImportGroup[] {
  const groups: ImportGroup[] = [{ cards: [] }];
  let started = false;

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      if (started || groups[0].cards.length > 0) groups.push({ cards: [] });
      started = true;
      const name = line.slice(1).trim().replaceAll('\\n', '\n');
      if (name) groups[groups.length - 1].name = name;
      return;
    }
    const [top, bottom] = line.replace(/^\d+\s+/, '').split(/\s+\/\s+/);
    groups[groups.length - 1].cards.push({
      ...parseCard(top),
      ...(bottom ? { split: parseCard(bottom) } : {}),
      line: i + 1,
    });
  });

  return groups;
}
