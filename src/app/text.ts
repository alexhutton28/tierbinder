// Title case for labels written in sentence case in code (the card menu's items are also its
// keys). As in Apple's guidelines, articles, coordinating conjunctions and prepositions of
// three letters or fewer stay lower case unless they're the first or last word.
// See Capitalization in design/hutton-design-system.md.

const SMALL_WORDS = new Set(
  'a an the and but for nor or so yet as at by in of off on per to up via'.split(' ')
);

export const titleCase = (text: string) =>
  text
    .split(' ')
    .map((word, i, all) =>
      i > 0 && i < all.length - 1 && SMALL_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ');

// "1 Card", "12 Cards"
export const cardCount = (n: number) => `${n} ${n === 1 ? 'Card' : 'Cards'}`;

// "Cards", "Cards and Ink", "Cards, Ink and Card Tray"
export const listWords = (words: string[]) =>
  words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? '');
