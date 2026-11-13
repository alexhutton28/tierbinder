'use client';

import React from 'react';
import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva';
import { PETREL_950, darkReadsBetter } from '../color';
import CardNode from './CardNode';
import { BOARD_HEIGHT, BOARD_WIDTH } from './size';
import { TRAY_HINT, TRAY_HINT_SIZE, TRAY_RADIUS, layoutTray, trayHeight, type Tray } from './tray';

// The hint's text on a light tray or a dark one, faint: dark text needs more strength to
// read on a light tray (about 3:1 on Petrel 100), as white does at less on a dark one
const HINT_DARK = PETREL_950;
const HINT_LIGHT = '#ffffff';
const HINT_OPACITY = { light: 0.45, dark: 0.6 };
// Feather's info icon before the hint, as tall as its text, drawn in Feather's 24-unit
// grid, with 4 on-screen px (space-2) between them, as in the credits
const ICON_GRID = 24;
const HINT_ICON_GAP = 4;

let measureContext: CanvasRenderingContext2D | null = null;

// The hint's text width at a font size, to center the icon and the text together
function textWidth(text: string, fontSize: number, fontFamily: string) {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return 0;
  measureContext.font = `${fontSize}px ${fontFamily}`;
  return measureContext.measureText(text).width;
}

// The hint: the info icon, then its text, centered together in the empty tray, faint.
// Editor-only (named `editor`): left out of exports; and not for screen readers, which the
// canvas doesn't reach.
function TrayHint({
  width,
  height,
  scale,
  fontFamily,
  dark,
}: {
  width: number;
  height: number;
  scale: number;
  fontFamily: string;
  // Dark text (on a light tray), else white
  dark: boolean;
}) {
  const color = dark ? HINT_DARK : HINT_LIGHT;
  const fontSize = TRAY_HINT_SIZE / (scale || 1);
  const gap = HINT_ICON_GAP / (scale || 1);
  const textW = textWidth(TRAY_HINT, fontSize, fontFamily);
  const left = (width - (fontSize + gap + textW)) / 2;
  const icon = fontSize / ICON_GRID;
  return (
    <Group name="editor" opacity={HINT_OPACITY[dark ? 'dark' : 'light']} listening={false}>
      <Group x={left} y={(height - fontSize) / 2} scaleX={icon} scaleY={icon}>
        <Circle x={12} y={12} radius={10} stroke={color} strokeWidth={2} />
        <Line points={[12, 16, 12, 12]} stroke={color} strokeWidth={2} lineCap="round" />
        <Line points={[12, 8, 12, 8.01]} stroke={color} strokeWidth={2} lineCap="round" />
      </Group>
      <Text
        x={left + fontSize + gap}
        y={0}
        height={height}
        verticalAlign="middle"
        text={TRAY_HINT}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fill={color}
      />
    </Group>
  );
}

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
  onTrayMenu,
  listening,
  boardCardWidth,
  hintFont,
  showHint,
  arriving,
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
  // The tray's own space was right-clicked: its menu (Hide Card Tray, and Clear Card Tray
  // while it holds cards), at x, y in the stage's on-screen pixels
  onTrayMenu: (x: number, y: number) => void;
  // Off while a drawing tool is active
  listening: boolean;
  // The board's card width: a card dragged out of the tray grows to it
  boardCardWidth: number;
  // The interface's font (Figtree), for the empty tray's hint
  hintFont: string;
  // Whether an empty tray shows its hint (only until a card has been in one this session)
  showHint: boolean;
  // Cards not drawn yet: copies of them are flying in from the sidebar
  arriving: ReadonlySet<string>;
}) {
  const height = trayHeight(tray.items.length);
  return (
    <Layer listening={listening}>
      <Group name="tray" y={top}>
        <Rect
          // `background`, so pressing it deselects, as the board's does
          name="background trayBox"
          width={BOARD_WIDTH}
          height={height}
          fill={tray.color}
          cornerRadius={TRAY_RADIUS / (scale || 1)}
          onClick={(e) => {
            if (e.evt.button === 0) onPick();
          }}
          onTap={onPick}
          onContextMenu={(e) => {
            e.evt.preventDefault();
            const pointer = e.target.getStage()?.getPointerPosition();
            if (pointer) onTrayMenu(pointer.x, pointer.y);
          }}
        />
        {showHint && tray.items.length === 0 && (
          // What it's for, quietly, while it's empty
          <TrayHint
            width={BOARD_WIDTH}
            height={height}
            scale={scale}
            fontFamily={hintFont}
            dark={darkReadsBetter(tray.color, HINT_DARK)}
          />
        )}
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
            hidden={arriving.has(item.id)}
            dragWidth={(center) => (center.y > BOARD_HEIGHT ? width : boardCardWidth)}
            onDragEnd={(cardX, cardY) => onCardDrop(item.id, cardX, cardY + top)}
          />
        ))}
      </Group>
    </Layer>
  );
}
