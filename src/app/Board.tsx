'use client';

import Konva from 'konva';
import React from 'react';
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva';
import { loadImage } from './cards';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CARD_BORDER_WIDTH,
  CARD_CORNER_RADIUS,
  CARD_HEIGHT,
  CARD_WIDTH,
  LABEL_WIDTH,
  SEPARATOR_WIDTH,
  TIER_HEIGHT,
  dropTarget,
  layoutCards,
  moveCard,
  type CardFace,
  type CardItem,
  type TierListDoc,
} from './tierList';

// The tier list on a Konva canvas, drawn at design size and scaled to fit the editor.
// Konva is browser-only, so TierStack loads this with ssr: false.

type Props = {
  doc: TierListDoc;
  scale: number;
  fontFamily: string;
  selectedId: string | null;
  onChange: (doc: TierListDoc) => void;
  onSelect: (id: string | null) => void;
  // A card was clicked without dragging; x, y are in the stage's on-screen pixels
  onCardMenu: (id: string, x: number, y: number) => void;
  onEditTier: (index: number) => void;
  onStage: (stage: Konva.Stage | null) => void;
};

export default function Board({
  doc,
  scale,
  fontFamily,
  selectedId,
  onChange,
  onSelect,
  onCardMenu,
  onEditTier,
  onStage,
}: Props) {
  const placements = layoutCards(doc);

  return (
    <Stage
      ref={onStage}
      width={BOARD_WIDTH * scale}
      height={BOARD_HEIGHT * scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === 'background') onSelect(null);
      }}
    >
      <Layer>
        <Rect name="background" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill={doc.background} />
        {doc.tiers.map((tier, i) => (
          <TierLabel
            key={tier.id}
            name={tier.name}
            color={tier.color}
            y={i * TIER_HEIGHT}
            fontFamily={fontFamily}
            onEdit={() => onEditTier(i)}
          />
        ))}
        {doc.tiers.slice(1).map((tier, i) => (
          <Rect
            key={tier.id}
            y={(i + 1) * TIER_HEIGHT - SEPARATOR_WIDTH / 2}
            width={BOARD_WIDTH}
            height={SEPARATOR_WIDTH}
            fill={doc.border}
            listening={false}
          />
        ))}
        {placements.map(({ item, tierIndex, x, y }) => (
          <Card
            key={item.id}
            item={item}
            x={x}
            y={y}
            // Split cards always have a border and divider: the tier's color if tier
            // borders are on, else the board's border color
            borderColor={
              doc.tierCardBorders ? doc.tiers[tierIndex].color : item.split ? doc.border : null
            }
            dividerColor={doc.tierCardBorders ? doc.tiers[tierIndex].color : doc.border}
            onSelect={() => onSelect(item.id)}
            onMenu={(menuX, menuY) => onCardMenu(item.id, menuX, menuY)}
            onDrop={(centerX, centerY) => {
              const target = dropTarget(doc, item.id, centerX, centerY);
              onChange(moveCard(doc, item.id, target.tierIndex, target.index));
            }}
          />
        ))}
      </Layer>
      {/* Editor-only layer: hidden while exporting */}
      <Layer name="editor" listening={false}>
        {placements
          .filter((p) => p.item.id === selectedId)
          .map((p) => (
            <Rect
              key={p.item.id}
              x={p.x - 3}
              y={p.y - 3}
              width={CARD_WIDTH + 6}
              height={CARD_HEIGHT + 6}
              stroke="#ffffff"
              strokeWidth={3}
              cornerRadius={8}
            />
          ))}
      </Layer>
    </Stage>
  );
}

const LABEL_PADDING = 6;
// Inter Black
const LABEL_FONT_SIZE = 30;
const LABEL_FONT_WEIGHT = '900';
const LABEL_STROKE = LABEL_FONT_SIZE / 6;

let measureContext: CanvasRenderingContext2D | null = null;

// Wraps a label at spaces to fit its box. Words are never split: a word too long for
// the box gets a line to itself and overflows evenly on both sides. (Konva's own word
// wrap splits words that don't fit, e.g. "Commen" / "t".)
function wrapLabel(name: string, fontFamily: string) {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return name;
  const ctx = measureContext;
  ctx.font = `${LABEL_FONT_WEIGHT} ${LABEL_FONT_SIZE}px ${fontFamily}`;
  // The outline adds half its width on each side
  const maxWidth = LABEL_WIDTH - LABEL_PADDING * 2 - LABEL_STROKE;
  return name
    .split('\n')
    .map((paragraph) => {
      const lines: string[] = [];
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const last = lines.at(-1);
        if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= maxWidth) {
          lines[lines.length - 1] = `${last} ${word}`;
        } else {
          lines.push(word);
        }
      }
      return lines.join('\n');
    })
    .join('\n');
}

function TierLabel({
  name,
  color,
  y,
  fontFamily,
  onEdit,
}: {
  name: string;
  color: string;
  y: number;
  fontFamily: string;
  onEdit: () => void;
}) {
  const text = React.useMemo(() => wrapLabel(name, fontFamily), [name, fontFamily]);
  return (
    <Group y={y} onDblClick={onEdit} onDblTap={onEdit}>
      <Rect width={LABEL_WIDTH} height={TIER_HEIGHT} fill={color} />
      <Text
        text={text}
        width={LABEL_WIDTH}
        height={TIER_HEIGHT}
        align="center"
        verticalAlign="middle"
        wrap="none"
        lineHeight={1}
        fontFamily={fontFamily}
        fontStyle={LABEL_FONT_WEIGHT}
        fontSize={LABEL_FONT_SIZE}
        fill="#ffffff"
        stroke="#1b1b1b"
        strokeWidth={LABEL_STROKE}
        fillAfterStrokeEnabled
        lineJoin="round"
      />
    </Group>
  );
}

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
}: {
  face: CardFace;
  y?: number;
  height: number;
  half?: boolean;
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
        fontSize={13}
        fill="#ffffff"
      />
    </>
  );
}

function Card({
  item,
  x,
  y,
  borderColor,
  dividerColor,
  onSelect,
  onMenu,
  onDrop,
}: {
  item: CardItem;
  x: number;
  y: number;
  borderColor: string | null;
  dividerColor: string;
  onSelect: () => void;
  onMenu: (x: number, y: number) => void;
  onDrop: (centerX: number, centerY: number) => void;
}) {
  const zIndex = React.useRef(0);

  const openMenu = (stage: Konva.Stage | null) => {
    const pointer = stage?.getPointerPosition();
    if (pointer) onMenu(pointer.x, pointer.y);
  };

  return (
    <Group
      x={x}
      y={y}
      // Rounded like the card images; a split card's bottom half (the middle of a card)
      // would otherwise have square corners
      clipFunc={(ctx) =>
        Konva.Util.drawRoundedRectPath(ctx, CARD_WIDTH, CARD_HEIGHT, CARD_CORNER_RADIUS)
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
        onDrop(node.x() + CARD_WIDTH / 2, node.y() + CARD_HEIGHT / 2);
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
          <Face face={item} height={CARD_HEIGHT / 2} half />
          <Face face={item.split} y={CARD_HEIGHT / 2} height={CARD_HEIGHT / 2} half />
          <Rect
            y={(CARD_HEIGHT - CARD_BORDER_WIDTH) / 2}
            width={CARD_WIDTH}
            height={CARD_BORDER_WIDTH}
            fill={dividerColor}
            listening={false}
          />
        </>
      ) : (
        <Face face={item} height={CARD_HEIGHT} />
      )}
      {borderColor && (
        // Konva centers strokes on the path, so the path is inset by half the width
        // to keep the whole stroke inside the card
        <Rect
          x={CARD_BORDER_WIDTH / 2}
          y={CARD_BORDER_WIDTH / 2}
          width={CARD_WIDTH - CARD_BORDER_WIDTH}
          height={CARD_HEIGHT - CARD_BORDER_WIDTH}
          cornerRadius={CARD_CORNER_RADIUS - CARD_BORDER_WIDTH / 2}
          stroke={borderColor}
          strokeWidth={CARD_BORDER_WIDTH}
          listening={false}
        />
      )}
    </Group>
  );
}
