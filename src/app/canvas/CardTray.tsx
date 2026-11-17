'use client';

import type Konva from 'konva';
import React from 'react';
import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva';
import { TOUCH_SLOP } from '../ui/pointer';
import { PETREL_950, darkReadsBetter } from '../color';
import { selectedLast } from '../graphics/types';
import CardNode from './CardNode';
import { BOARD_HEIGHT } from './size';
import {
  TRAY_HINT,
  TRAY_HINT_SIZE,
  TRAY_RADIUS,
  layoutTray,
  trayHeight,
  trayRowWidth,
  type Tray,
} from './tray';

// The hint's text on a light tray or a dark one, faint: dark text needs more strength to
// read on a light tray (about 3:1 on Petrel 100), as white does at less on a dark one
const HINT_DARK = PETREL_950;
const HINT_LIGHT = '#ffffff';
const HINT_OPACITY = { light: 0.45, dark: 0.6 };
// Feather's info icon before the hint, as tall as its text, drawn in Feather's 24-unit
// grid, with 4 on-screen px (space-2) between them, as in the credits
const ICON_GRID = 24;
// Its line: 1px at 16px, as every icon's is (1.5 on the 24 grid)
const ICON_LINE = 1.5;
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
        <Circle x={12} y={12} radius={10} stroke={color} strokeWidth={ICON_LINE} />
        <Line points={[12, 16, 12, 12]} stroke={color} strokeWidth={ICON_LINE} lineCap="round" />
        <Line points={[12, 8, 12, 8.01]} stroke={color} strokeWidth={ICON_LINE} lineCap="round" />
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
  width,
  left,
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
  opacity,
  boardCardWidth,
  hintFont,
  showHint,
  arriving,
  selectedId,
  oneRow,
  pan,
  onPan,
}: {
  tray: Tray;
  // Its width in design pixels (TRAY_WIDTH), and its
  // left edge from the board's: the board is centered over it, so it starts left of it
  width: number;
  left: number;
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
  // Off while a drawing tool is active, and while it slides away
  listening: boolean;
  // Faded while it slides in or out
  opacity: number;
  // The board's card width: a card dragged out of the tray grows to it
  boardCardWidth: number;
  // The interface's font (Figtree), for the empty tray's hint
  hintFont: string;
  // Whether an empty tray shows its hint (only until a card has been in one this session)
  showHint: boolean;
  // Cards not drawn yet: copies of them are flying in from the sidebar
  arriving: ReadonlySet<string>;
  // The selected card, drawn over the others
  selectedId: string | null;
  // Phones and tablets: every card in one row at full size, scrolled sideways by `pan`
  // (design pixels) when they don't fit; a sideways swipe (or a wheel's sideways scroll)
  // asks for another through onPan
  oneRow: boolean;
  pan: number;
  onPan: (pan: number) => void;
}) {
  const height = trayHeight(tray.items.length, width, oneRow);
  const maxPan = oneRow ? Math.max(0, trayRowWidth(tray.items.length) - width) : 0;
  const clampPan = (next: number) => Math.min(maxPan, Math.max(0, next));

  // A touch in the one-row tray: once it has moved TOUCH_SLOP, sideways pans the tray and
  // up or down drags the card it started on (cards don't start their own drags there, or a
  // swipe along the row would pick one up). A tap that panned doesn't open a card's menu.
  const gesture = React.useRef<{
    id: number;
    x: number;
    y: number;
    pan: number;
    card: Konva.Node | null;
    mode: 'wait' | 'pan' | 'done';
  } | null>(null);
  const panned = React.useRef(false);
  const latest = React.useRef({ scale, clampPan, onPan });
  React.useLayoutEffect(() => {
    latest.current = { scale, clampPan, onPan };
  });
  React.useEffect(() => {
    if (!oneRow) return;
    let frame = 0;
    let pending: number | null = null;
    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (g.mode === 'wait' && Math.hypot(dx, dy) > TOUCH_SLOP) {
        if (Math.abs(dx) > Math.abs(dy)) {
          g.mode = 'pan';
          panned.current = true;
        } else {
          g.mode = 'done';
          const card = g.card;
          if (card) {
            card.draggable(true);
            card.startDrag();
            card.on('dragend.trayPan', () => {
              card.off('dragend.trayPan');
              card.draggable(false);
            });
          }
        }
      }
      // Once a frame, however often the pointer reports
      if (g.mode === 'pan') {
        const { scale: s, clampPan: clamp } = latest.current;
        pending = clamp(g.pan - dx / (s || 1));
        frame ||= requestAnimationFrame(() => {
          frame = 0;
          if (pending !== null) latest.current.onPan(pending);
          pending = null;
        });
      }
    };
    const end = (e: PointerEvent) => {
      if (gesture.current?.id === e.pointerId) gesture.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [oneRow]);
  const touchPans = oneRow && matchMedia('(pointer: coarse)').matches;

  return (
    <Layer listening={listening} opacity={opacity}>
      <Group
        name="tray"
        x={left}
        y={top}
        onPointerDown={(e) => {
          panned.current = false;
          if (!touchPans || e.evt.pointerType !== 'touch') return;
          gesture.current = {
            id: e.evt.pointerId,
            x: e.evt.clientX,
            y: e.evt.clientY,
            pan,
            card: e.target.findAncestor('.card') ?? null,
            mode: 'wait',
          };
        }}
        onWheel={(e) => {
          if (!maxPan) return;
          const delta = e.evt.deltaX || (e.evt.shiftKey ? e.evt.deltaY : 0);
          if (!delta) return;
          e.evt.preventDefault();
          onPan(clampPan(pan + delta / (scale || 1)));
        }}
      >
        <Rect
          // `background`, so pressing it deselects, as the board's does
          name="background trayBox"
          width={width}
          height={height}
          fill={tray.color}
          cornerRadius={TRAY_RADIUS / (scale || 1)}
          onClick={(e) => {
            if (e.evt.button === 0) onPick();
          }}
          onTap={() => {
            if (!panned.current) onPick();
          }}
          onContextMenu={(e) => {
            e.evt.preventDefault();
            const pointer = e.target.getStage()?.getPointerPosition();
            if (pointer) onTrayMenu(pointer.x, pointer.y);
          }}
        />
        {showHint && tray.items.length === 0 && (
          // What it's for, quietly, while it's empty
          <TrayHint
            width={width}
            height={height}
            scale={scale}
            fontFamily={hintFont}
            dark={darkReadsBetter(tray.color, HINT_DARK)}
          />
        )}
        {/* The cards, clipped to the box, scrolled sideways by `pan` in one row (the export
        takes the clip and the scroll off: trayClip, trayCards) */}
        <Group name="trayClip" clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
          <Group name="trayCards" x={-pan}>
            {selectedLast(layoutTray(tray, width, oneRow), selectedId).map(
              ({ item, x, y, width: cardWidth }) => (
                <CardNode
                  key={item.id}
                  item={item}
                  x={x}
                  y={y}
                  width={cardWidth}
                  fontFamily={fontFamily}
                  borderColor={item.split ? border : null}
                  dividerColor={border}
                  onSelect={() => {
                    if (!panned.current) onSelect(item.id);
                  }}
                  onMenu={(menuX, menuY) => {
                    if (!panned.current) onCardMenu(item.id, menuX, menuY);
                  }}
                  hidden={arriving.has(item.id)}
                  raised={item.id === selectedId}
                  draggable={!touchPans}
                  dragWidth={(center) => (center.y > BOARD_HEIGHT ? cardWidth : boardCardWidth)}
                  onDragEnd={(cardX, cardY) => onCardDrop(item.id, cardX - pan + left, cardY + top)}
                />
              )
            )}
          </Group>
        </Group>
      </Group>
    </Layer>
  );
}
