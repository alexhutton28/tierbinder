'use client';

import type Konva from 'konva';
import React from 'react';
import { Group, Layer, Rect, Text } from 'react-konva';
import CardNode from '../../canvas/CardNode';
import { BOARD_HEIGHT, boardWidth } from '../../canvas/size';
import { selectedLast, type CanvasProps } from '../types';
import {
  SEPARATOR_WIDTH,
  dropTarget,
  layoutCards,
  moveCard,
  tierAt,
  tierHeight,
  type TierList,
} from './model';

// The tier list on the canvas: tier labels and rows, separators, and the cards.

export default function TierListCanvas({
  graphic: list,
  fontFamily,
  onChange,
  onSelect,
  onCardMenu,
  onCardDrop,
  cardDragWidth,
  arriving,
  onPickTarget,
  onEditSetting,
  selectedId,
}: CanvasProps<TierList>) {
  const placements = layoutCards(list);
  const rowHeight = tierHeight(list);
  const width = boardWidth(list.shape);

  // Clicking a tier's row outside its cards picks that tier; clicks on a card are the
  // card's own (they open its menu)
  const pickTier = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer || e.target.findAncestor('.card')) return;
    onPickTarget(tierAt(list, pointer.y / stage!.scaleY()));
  };

  return (
    <Layer
      onClick={(e) => {
        if (e.evt.button === 0) pickTier(e);
      }}
      onTap={pickTier}
    >
      <Rect name="background" width={width} height={BOARD_HEIGHT} fill={list.background} />
      {list.tiers.map((tier, i) => (
        <TierLabel
          key={tier.id}
          name={tier.name}
          color={tier.color}
          y={i * rowHeight}
          width={list.labelWidth}
          height={rowHeight}
          fontFamily={fontFamily}
          onEdit={() => onEditSetting(`tier:${i}`)}
        />
      ))}
      {list.tiers.slice(1).map((tier, i) => (
        <Rect
          key={tier.id}
          y={(i + 1) * rowHeight - SEPARATOR_WIDTH / 2}
          width={width}
          height={SEPARATOR_WIDTH}
          fill={list.border}
          listening={false}
        />
      ))}
      {selectedLast(placements, selectedId).map(({ item, tierIndex, x, y, width, height }) => (
        <CardNode
          key={item.id}
          item={item}
          x={x}
          y={y}
          width={width}
          fontFamily={fontFamily}
          // Split cards always have a border and divider: the tier's color if tier
          // borders are on, else the board's border color
          borderColor={
            list.tierCardBorders ? list.tiers[tierIndex].color : item.split ? list.border : null
          }
          dividerColor={list.tierCardBorders ? list.tiers[tierIndex].color : list.border}
          onSelect={() => onSelect(item.id)}
          onMenu={(menuX, menuY) => onCardMenu(item.id, menuX, menuY)}
          dragWidth={cardDragWidth}
          hidden={arriving.has(item.id)}
          raised={item.id === selectedId}
          onDragEnd={(cardX, cardY) => {
            if (onCardDrop(item.id, cardX, cardY)) return;
            const target = dropTarget(list, item.id, cardX + width / 2, cardY + height / 2);
            onChange(moveCard(list, item.id, target.tierIndex, target.index));
          }}
        />
      ))}
    </Layer>
  );
}

const LABEL_PADDING = 6;
// Inter Black, shrinking from 30px for a name that doesn't fit, down to 12px
const LABEL_FONT_SIZE = 30;
const LABEL_MIN_FONT_SIZE = 12;
const LABEL_FONT_WEIGHT = '900';
// The outline, as a share of the font size
const LABEL_STROKE_SHARE = 1 / 6;

let measureContext: CanvasRenderingContext2D | null = null;

// Wraps a label at spaces to fit its box at the largest size that fits, from
// LABEL_FONT_SIZE down. Words are never split (Konva's own word wrap splits words that
// don't fit, e.g. "Commen" / "t"): a word too long for the box ("Charmander") makes the
// whole label smaller, as do too many lines. At the smallest size, what still doesn't fit
// overflows evenly on both sides.
function fitLabel(name: string, fontFamily: string, width: number, height: number) {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return { text: name, size: LABEL_FONT_SIZE };
  const ctx = measureContext;
  const wrap = (size: number) => {
    ctx.font = `${LABEL_FONT_WEIGHT} ${size}px ${fontFamily}`;
    // The outline adds half its width on each side
    const maxWidth = width - LABEL_PADDING * 2 - size * LABEL_STROKE_SHARE;
    const lines = name.split('\n').flatMap((paragraph) => {
      const lines: string[] = [];
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const last = lines.at(-1);
        if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= maxWidth) {
          lines[lines.length - 1] = `${last} ${word}`;
        } else {
          lines.push(word);
        }
      }
      // An empty line (two line breaks in a row) keeps its place
      return lines.length ? lines : [''];
    });
    const fits =
      lines.every((line) => ctx.measureText(line).width <= maxWidth) &&
      lines.length * size + size * LABEL_STROKE_SHARE <= height - LABEL_PADDING * 2;
    return { text: lines.join('\n'), fits };
  };
  for (let size = LABEL_FONT_SIZE; size > LABEL_MIN_FONT_SIZE; size--) {
    const { text, fits } = wrap(size);
    if (fits) return { text, size };
  }
  return { text: wrap(LABEL_MIN_FONT_SIZE).text, size: LABEL_MIN_FONT_SIZE };
}

function TierLabel({
  name,
  color,
  y,
  width,
  height,
  fontFamily,
  onEdit,
}: {
  name: string;
  color: string;
  y: number;
  // The label's width (the list's Label Width) and its tier's height
  width: number;
  height: number;
  fontFamily: string;
  onEdit: () => void;
}) {
  const { text, size } = React.useMemo(
    () => fitLabel(name, fontFamily, width, height),
    [name, fontFamily, width, height]
  );
  return (
    <Group y={y} onDblClick={onEdit} onDblTap={onEdit}>
      <Rect width={width} height={height} fill={color} />
      <Text
        text={text}
        width={width}
        height={height}
        align="center"
        verticalAlign="middle"
        wrap="none"
        lineHeight={1}
        fontFamily={fontFamily}
        fontStyle={LABEL_FONT_WEIGHT}
        fontSize={size}
        fill="#ffffff"
        stroke="#1b1b1b"
        strokeWidth={size * LABEL_STROKE_SHARE}
        fillAfterStrokeEnabled
        lineJoin="round"
      />
    </Group>
  );
}
