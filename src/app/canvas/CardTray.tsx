'use client';

import React from 'react';
import { Group, Layer, Rect } from 'react-konva';
import CardNode from './CardNode';
import { BOARD_WIDTH } from './size';
import { TRAY_HEIGHT, TRAY_RADIUS, layoutTray, type Tray } from './tray';

// The card tray on the canvas, under the board: a rounded box in the tray's color holding
// its cards. The group is named `tray` and its box `trayBox`, so the export can set it
// flush and square under the board.

export default function CardTray({
  tray,
  top,
  scale,
  border,
  fontFamily,
  onSelect,
  onCardMenu,
  onCardDrop,
  onPick,
  listening,
}: {
  tray: Tray;
  // Its top edge, in design pixels
  top: number;
  // The board's on-screen scale, for corners that stay the same size on screen
  scale: number;
  // Split cards' divider and border: the graphic's border color
  border: string;
  fontFamily: string;
  onSelect: (id: string) => void;
  onCardMenu: (id: string, x: number, y: number) => void;
  // A card was dropped with its top-left corner at x, y on the board (design pixels)
  onCardDrop: (id: string, x: number, y: number) => void;
  // The tray's own space was clicked, making it the Add to target
  onPick: () => void;
  // Off while a drawing tool is active
  listening: boolean;
}) {
  return (
    <Layer listening={listening}>
      <Group name="tray" y={top}>
        <Rect
          // `background`, so pressing it deselects, as the board's does
          name="background trayBox"
          width={BOARD_WIDTH}
          height={TRAY_HEIGHT}
          fill={tray.color}
          cornerRadius={TRAY_RADIUS / (scale || 1)}
          onClick={(e) => {
            if (e.evt.button === 0) onPick();
          }}
          onTap={onPick}
        />
        {layoutTray(tray).map(({ item, x, y, width }) => (
          <CardNode
            key={item.id}
            item={item}
            x={x}
            y={y}
            width={width}
            fontFamily={fontFamily}
            borderColor={item.split ? border : null}
            dividerColor={border}
            onSelect={() => onSelect(item.id)}
            onMenu={(menuX, menuY) => onCardMenu(item.id, menuX, menuY)}
            onDragEnd={(cardX, cardY) => onCardDrop(item.id, cardX, cardY + top)}
          />
        ))}
      </Group>
    </Layer>
  );
}
