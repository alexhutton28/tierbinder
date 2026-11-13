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
  cardWidth: (canvas) => canvas.cardWidth,
  layout: layoutCards,
  mapCards,
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
