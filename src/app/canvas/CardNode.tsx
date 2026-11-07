'use client';

import Konva from 'konva';
import React from 'react';
import { Group, Image as KonvaImage, Rect, Text } from 'react-konva';
import { loadImage, type CardFace, type CardItem } from '../cards';
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
        fontSize={13}
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
  // Where the card was dropped (its top-left corner, in design pixels)
  onDragEnd: (x: number, y: number) => void;
}) {
  const zIndex = React.useRef(0);
  const half = showsTopHalf(item, topHalf);
  // Visible height at design size
  const height = half ? CARD_HEIGHT / 2 : CARD_HEIGHT;
  const scale = width / CARD_WIDTH;

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
      scaleX={scale}
      scaleY={scale}
      // Rounded like the card images; a split card's bottom half (the middle of a card)
      // would otherwise have square corners
      clipFunc={(ctx) =>
        Konva.Util.drawRoundedRectPath(ctx, CARD_WIDTH, height, CARD_CORNER_RADIUS)
      }
      draggable
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
        zIndex.current = e.target.zIndex();
        e.target.moveToTop();
      }}
      onDragEnd={(e) => {
        const node = e.target;
        onDragEnd(node.x(), node.y());
        // Back to its laid-out spot; the new layout moves it if the drop changed it
        node.position({ x, y });
        node.zIndex(zIndex.current);
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
