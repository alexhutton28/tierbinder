'use client';

import type Konva from 'konva';
import React from 'react';
import { Group, Layer, Rect, Text } from 'react-konva';
import CardNode from '../../canvas/CardNode';
import { BOARD_HEIGHT, BOARD_WIDTH, CARD_HEIGHT, CARD_WIDTH } from '../../canvas/size';
import type { CanvasProps } from '../types';
import {
  LABEL_WIDTH,
  SEPARATOR_WIDTH,
  TIER_HEIGHT,
  dropTarget,
  layoutCards,
  moveCard,
  tierAt,
  type TierList,
} from './model';

// The tier list on the canvas: tier labels and rows, separators, and the cards.

export default function TierListCanvas({
  graphic: list,
  fontFamily,
  onChange,
  onSelect,
  onCardMenu,
  onPickTarget,
  onEditSetting,
}: CanvasProps<TierList>) {
  const placements = layoutCards(list);

  // Clicking a tier's row outside its cards picks that tier; clicks on a card are the
  // card's own (they open its menu)
  const pickTier = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer || e.target.findAncestor('.card')) return;
    onPickTarget(tierAt(pointer.y / stage!.scaleY()));
  };

  return (
    <Layer
      onClick={(e) => {
        if (e.evt.button === 0) pickTier(e);
      }}
      onTap={pickTier}
    >
      <Rect name="background" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill={list.background} />
      {list.tiers.map((tier, i) => (
        <TierLabel
          key={tier.id}
          name={tier.name}
          color={tier.color}
          y={i * TIER_HEIGHT}
          fontFamily={fontFamily}
          onEdit={() => onEditSetting(`tier:${i}`)}
        />
      ))}
      {list.tiers.slice(1).map((tier, i) => (
        <Rect
          key={tier.id}
          y={(i + 1) * TIER_HEIGHT - SEPARATOR_WIDTH / 2}
          width={BOARD_WIDTH}
          height={SEPARATOR_WIDTH}
          fill={list.border}
          listening={false}
        />
      ))}
      {placements.map(({ item, tierIndex, x, y }) => (
        <CardNode
          key={item.id}
          item={item}
          x={x}
          y={y}
          // Split cards always have a border and divider: the tier's color if tier
          // borders are on, else the board's border color
          borderColor={
            list.tierCardBorders ? list.tiers[tierIndex].color : item.split ? list.border : null
          }
          dividerColor={list.tierCardBorders ? list.tiers[tierIndex].color : list.border}
          onSelect={() => onSelect(item.id)}
          onMenu={(menuX, menuY) => onCardMenu(item.id, menuX, menuY)}
          onDragEnd={(cardX, cardY) => {
            const target = dropTarget(
              list,
              item.id,
              cardX + CARD_WIDTH / 2,
              cardY + CARD_HEIGHT / 2
            );
            onChange(moveCard(list, item.id, target.tierIndex, target.index));
          }}
        />
      ))}
    </Layer>
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
