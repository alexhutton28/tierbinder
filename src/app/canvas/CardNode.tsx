'use client';

import Konva from 'konva';
import React from 'react';
import { Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import { loadImage, type CardFace, type CardItem } from '../cards';
import type { Point } from '../graphics/types';
import { CARD_BORDER_WIDTH, CARD_CORNER_RADIUS, CARD_HEIGHT, CARD_WIDTH } from './size';

// A card on the board, shared by every graphic: its image (or both halves of a split
// card), clipped to the card's rounded corners, draggable, with the card menu on click.

// Crop for drawing an image at the card's shape without stretching it
function coverCrop(img: HTMLImageElement) {
  const target = CARD_WIDTH / CARD_HEIGHT;
  const ratio = img.width / img.height;
  if (ratio > target) {
    const width = img.height * target;
    return { x: (img.width - width) / 2, y: 0, width, height: img.height };
  }
  const height = img.width / target;
  return { x: 0, y: (img.height - height) / 2, width: img.width, height };
}

// One card image (or a placeholder while it loads), drawn into a box at (0, y). A half
// shows the top half of the card.
function Face({
  face,
  y = 0,
  height,
  half = false,
  fontFamily,
}: {
  face: CardFace;
  y?: number;
  height: number;
  half?: boolean;
  fontFamily: string;
}) {
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let current = true;
    loadImage(face.image).then(
      (img) => current && setImage(img),
      () => current && setFailed(true)
    );
    return () => {
      current = false;
    };
  }, [face.image]);

  if (image) {
    const crop = coverCrop(image);
    return (
      <KonvaImage
        image={image}
        y={y}
        crop={half ? { ...crop, height: crop.height / 2 } : crop}
        width={CARD_WIDTH}
        height={height}
      />
    );
  }
  return (
    <>
      <Rect y={y} width={CARD_WIDTH} height={height} fill="#2c4e5e" cornerRadius={6} />
      <Text
        text={failed ? `${face.name}\n(no image)` : face.name}
        y={y}
        width={CARD_WIDTH}
        height={height}
        padding={6}
        align="center"
        verticalAlign="middle"
        fontFamily={fontFamily}
        fontStyle="900"
        fontSize={12}
        fill="#ffffff"
      />
    </>
  );
}

// Whether a card shows only its top half: split cards always show both halves (their
// top half would hide the bottom card)
function showsTopHalf(item: CardItem, topHalf: boolean) {
  return topHalf && !item.split;
}

// The box a card takes on the board at a width, whole or top half only
export function cardBox(item: CardItem, width = CARD_WIDTH, topHalf = false) {
  const height = (width * CARD_HEIGHT) / CARD_WIDTH;
  return { width, height: showsTopHalf(item, topHalf) ? height / 2 : height };
}

// How long a dragged card takes to grow or shrink to the size where it's over (the
// board's, or the card tray's): --duration-drop, read from the page, easing out
function resizeDuration() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--duration-drop');
  return parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000) || 0;
}
const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Where the card being dragged is drawn (a group named `drag` at the bottom of the editor's
// layer): above the board and the card tray, so a card dragged between them shows over
// both, and below the selection outline. The card goes back to its own layer when it's
// dropped. Konva doesn't redraw the layer a node leaves, so each move redraws it.
const DRAG_GROUP = '.drag';

// Named `card`, so the board can tell clicks on cards from clicks on what's behind them.
// Drawn at the design size (100×140) and scaled to `width`, so borders and corners scale
// with it.
export default function CardNode({
  item,
  x,
  y,
  width = CARD_WIDTH,
  topHalf = false,
  fontFamily,
  borderColor,
  dividerColor,
  onSelect,
  onMenu,
  onDragEnd,
  dragWidth,
  hidden = false,
}: {
  item: CardItem;
  x: number;
  y: number;
  width?: number;
  // Show only the card's top half (not for split cards)
  topHalf?: boolean;
  // For a card with no image yet
  fontFamily: string;
  // Inside stroke, or none
  borderColor: string | null;
  // A split card's divider and backing
  dividerColor: string;
  onSelect: () => void;
  // x, y are in the stage's on-screen pixels
  onMenu: (x: number, y: number) => void;
  // Where the card was dropped: its top-left corner, in design pixels, at the size it's
  // laid out at, with its center where the dragged card's was
  onDragEnd: (x: number, y: number) => void;
  // The width to show at while dragged with its center at `center` (the stage's design
  // pixels): the card grows or shrinks to it, keeping its center under the same spot
  // of the pointer. Without it, it keeps its size.
  dragWidth?: (center: Point) => number;
  // Not drawn yet, while a copy of it flies in from the sidebar (Editor's flyIn)
  hidden?: boolean;
}) {
  // Where the card is drawn while it isn't dragged: its parent and place in it
  const home = React.useRef<{ parent: Konva.Container; zIndex: number } | null>(null);
  // Set as the card leaves the board (removed, or the card tray hidden), when Konva ends
  // its drag: that drop is ignored, since it no longer has a place to go back to
  const unmounting = React.useRef(false);
  React.useLayoutEffect(() => {
    // Mounted (again, in development, where React mounts each component twice)
    unmounting.current = false;
    return () => {
      unmounting.current = true;
    };
  }, []);
  // While dragged with dragWidth: the card's center from the pointer, its scale, and the
  // resize under way
  const drag = React.useRef<{
    offset: Point;
    scale: number;
    target: number;
    frame: number;
  } | null>(null);
  const half = showsTopHalf(item, topHalf);
  // Visible height at design size
  const height = half ? CARD_HEIGHT / 2 : CARD_HEIGHT;
  const scale = width / CARD_WIDTH;

  // The dragged card's center, in the stage's design pixels
  const dragCenter = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer || !drag.current) return null;
    const stageScale = stage.scaleX();
    return {
      x: pointer.x / stageScale + drag.current.offset.x,
      y: pointer.y / stageScale + drag.current.offset.y,
    };
  };

  // The top-left corner (on screen) that puts a card at `cardScale` around `center`
  const cornerAt = (stage: Konva.Stage, center: Point, cardScale: number) => ({
    x: (center.x - (CARD_WIDTH * cardScale) / 2) * stage.scaleX(),
    y: (center.y - (height * cardScale) / 2) * stage.scaleX(),
  });

  // Grows or shrinks the dragged card to the width for where it is, easing out
  const resizeTo = (node: Konva.Node, width: number) => {
    const state = drag.current;
    const target = width / CARD_WIDTH;
    if (!state || target === state.target) return;
    state.target = target;
    cancelAnimationFrame(state.frame);
    const from = state.scale;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = resizeDuration();
    const start = performance.now();
    const step = (now: number) => {
      const stage = node.getStage();
      const center = stage && dragCenter(stage);
      if (!stage || !center || drag.current !== state) return;
      const t = reduce || !duration ? 1 : Math.min(1, (now - start) / duration);
      state.scale = from + (target - from) * easeOut(t);
      node.scale({ x: state.scale, y: state.scale });
      node.absolutePosition(cornerAt(stage, center, state.scale));
      // Moves the selection outline with it, as dragging does
      node.fire('dragmove', {}, true);
      if (t < 1) state.frame = requestAnimationFrame(step);
    };
    state.frame = requestAnimationFrame(step);
  };

  const openMenu = (stage: Konva.Stage | null) => {
    const pointer = stage?.getPointerPosition();
    if (pointer) onMenu(pointer.x, pointer.y);
  };

  return (
    <Group
      name="card"
      // Lets the editor tell which card is being dragged (to move its selection outline)
      id={item.id}
      x={x}
      y={y}
      visible={!hidden}
      scaleX={scale}
      scaleY={scale}
      // Rounded like the card images; a split card's bottom half (the middle of a card)
      // would otherwise have square corners
      clipFunc={(ctx) =>
        Konva.Util.drawRoundedRectPath(ctx, CARD_WIDTH, height, CARD_CORNER_RADIUS)
      }
      draggable
      // Keeps a resizing card's center under the same spot of the pointer
      dragBoundFunc={function (this: Konva.Node, pos) {
        const stage = this.getStage();
        const center = stage && dragCenter(stage);
        if (!stage || !center || !drag.current) return pos;
        if (dragWidth) resizeTo(this, dragWidth(center));
        return cornerAt(stage, center, drag.current.scale);
      }}
      onMouseDown={onSelect}
      // Konva fires click/tap only when the card wasn't dragged. It also fires click for
      // the right button; that opens the menu through contextmenu instead, or the menu
      // would open under the pointer before contextmenu and take that event.
      onClick={(e) => {
        if (e.evt.button === 0) openMenu(e.target.getStage());
      }}
      onTap={(e) => {
        onSelect();
        openMenu(e.target.getStage());
      }}
      // Right-click opens the same menu in place of the browser's
      onContextMenu={(e) => {
        e.evt.preventDefault();
        onSelect();
        openMenu(e.target.getStage());
      }}
      // Above everything while dragging, then back in order (later cards overlap earlier)
      onDragStart={(e) => {
        const node = e.target;
        const stage = node.getStage();
        const parent = node.getParent();
        const dragGroup = stage?.findOne<Konva.Group>(DRAG_GROUP);
        if (parent && dragGroup) {
          home.current = { parent, zIndex: node.zIndex() };
          const corner = node.getAbsolutePosition();
          node.moveTo(dragGroup);
          node.absolutePosition(corner);
          parent.getLayer()?.batchDraw();
        }
        const pointer = stage?.getPointerPosition();
        if (!dragWidth || !stage || !pointer) return;
        const corner = node.getAbsolutePosition();
        const stageScale = stage.scaleX();
        drag.current = {
          offset: {
            x: (corner.x - pointer.x) / stageScale + (CARD_WIDTH * scale) / 2,
            y: (corner.y - pointer.y) / stageScale + (height * scale) / 2,
          },
          scale,
          target: scale,
          frame: 0,
        };
      }}
      onDragEnd={(e) => {
        const node = e.target;
        const dragScale = drag.current?.scale ?? scale;
        if (drag.current) cancelAnimationFrame(drag.current.frame);
        drag.current = null;
        // Back in its own layer, where it was, before its spot is read in that layer's terms
        const back = home.current;
        home.current = null;
        if (back) {
          const corner = node.getAbsolutePosition();
          const dragLayer = node.getLayer();
          node.moveTo(back.parent);
          dragLayer?.batchDraw();
          node.zIndex(Math.min(back.zIndex, back.parent.children.length - 1));
          node.absolutePosition(corner);
        }
        if (unmounting.current) return;
        // Reported at its laid-out size around the dragged card's center
        const centerX = node.x() + (CARD_WIDTH * dragScale) / 2;
        const centerY = node.y() + (height * dragScale) / 2;
        onDragEnd(centerX - (CARD_WIDTH * scale) / 2, centerY - (height * scale) / 2);
        // Back to its laid-out spot and size; the new layout moves it if the drop changed it
        node.scale({ x: scale, y: scale });
        node.position({ x, y });
      }}
    >
      {item.split ? (
        <>
          {/* Behind the halves, so the bottom card's rounded top corners at the seam
              show the divider's color, not the board */}
          <Rect
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            fill={dividerColor}
            cornerRadius={CARD_CORNER_RADIUS}
          />
          <Face fontFamily={fontFamily} face={item} height={CARD_HEIGHT / 2} half />
          <Face
            fontFamily={fontFamily}
            face={item.split}
            y={CARD_HEIGHT / 2}
            height={CARD_HEIGHT / 2}
            half
          />
          <Rect
            y={(CARD_HEIGHT - CARD_BORDER_WIDTH) / 2}
            width={CARD_WIDTH}
            height={CARD_BORDER_WIDTH}
            fill={dividerColor}
            listening={false}
          />
        </>
      ) : (
        <Face fontFamily={fontFamily} face={item} height={height} half={half} />
      )}
      {borderColor && (
        // Konva centers strokes on the path, so the path is inset by half the width
        // to keep the whole stroke inside the card
        <Rect
          x={CARD_BORDER_WIDTH / 2}
          y={CARD_BORDER_WIDTH / 2}
          width={CARD_WIDTH - CARD_BORDER_WIDTH}
          height={height - CARD_BORDER_WIDTH}
          cornerRadius={CARD_CORNER_RADIUS - CARD_BORDER_WIDTH / 2}
          stroke={borderColor}
          strokeWidth={CARD_BORDER_WIDTH}
          listening={false}
        />
      )}
    </Group>
  );
}
