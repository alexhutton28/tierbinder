import type { GraphicType } from '../types';
import BlankCanvasView from './BlankCanvasView';
import BlankSettings, { BlankBoardSettings } from './BlankSettings';
import BlankToolbar from './BlankToolbar';
import {
  addCard,
  defaultBlankCanvas,
  dropCard,
  layoutCards,
  mapCards,
  parseBlankCanvas,
  setCardShape,
  type BlankCanvas,
} from './model';

const blank: GraphicType<BlankCanvas> = {
  kind: 'blank',
  label: 'Blank Canvas',
  icon: '/blank-canvas.svg',
  targetNoun: 'canvas',
  create: defaultBlankCanvas,
  parse: parseBlankCanvas,
  Canvas: BlankCanvasView,
  BoardSettings: BlankBoardSettings,
  Settings: BlankSettings,
  Toolbar: BlankToolbar,
  toolSettings: ['penColor', 'penWidth', 'eraserWidth'],
  cardWidth: (canvas) => canvas.cardWidth,
  layout: layoutCards,
  describe: (canvas) => [
    {
      name: 'Canvas',
      items: canvas.items,
      note: canvas.strokes.length ? 'ink drawn on it' : undefined,
    },
  ],
  mapCards,
  hasContents: (canvas) => canvas.items.length > 0 || canvas.strokes.length > 0,
  clear: (canvas) => ({ ...canvas, items: [], strokes: [] }),
  // Cards a smaller size left hanging off the board move back onto it
  restyle: (canvas) => {
    const fresh = defaultBlankCanvas();
    return setCardShape(
      {
        ...canvas,
        background: fresh.background,
        border: fresh.border,
        tray: { ...canvas.tray, color: fresh.tray.color },
      },
      { cardWidth: fresh.cardWidth, topHalf: fresh.topHalf }
    );
  },
  // Cards a narrower board leaves hanging off it move back onto it
  reshape: (canvas, shape) => setCardShape(canvas, { shape }),
  // One place to add cards: the canvas
  targets: () => [{ name: 'Canvas' }],
  addCard: (canvas, item) => addCard(canvas, item),
  dropCard,
  // Groups don't mean anything on a blank canvas: every card takes the next spot
  ungroupedImport: 'board',
  importCards: (canvas, groups) => ({
    graphic: groups.flatMap((g) => g.items).reduce(addCard, canvas),
    errors: [],
  }),
};

export default blank;
