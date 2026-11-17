'use client';

import type Konva from 'konva';
import React from 'react';
import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva';
import { TOUCH_SLOP } from '../ui/pointer';
import { readDuration } from '../ui/motion';
import { PETREL_50, PETREL_950, darkReadsBetter } from '../color';
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
  type OneRow,
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

// A wheel's line, in pixels, for wheels that scroll by lines
const WHEEL_LINE = 16;

// A scrolling tray's edge shades, in on-screen pixels: how wide, and how far it scrolls
// before one fades fully in; and how dark at the edge
const SHADE_WIDTH = 48;
const SHADE_FADE = 24;
// (Petrel 950 at 60%, as the page's scroll shade is, fading to nothing)
const SHADE_COLOR = 'rgba(18, 23, 26, 0.6)';
const SHADE_CLEAR = 'rgba(18, 23, 26, 0)';
// The arrow in each shade, in on-screen pixels: its round button's radius (a 32px circle,
// taking taps as a 44px one: --tb-touch-target), its center from the tray's edge, and its
// chevron's half size and line
const ARROW_RADIUS = 16;
// (Petrel 50, a little see-through over the cards)
const ARROW_OPACITY = 0.9;
const ARROW_HIT = 22;
const ARROW_INSET = 24;
const CHEVRON = 4;
const CHEVRON_LINE = 2;
// Tapping an arrow scrolls this share of the tray's width (over --duration-move)
const ARROW_STEP = 0.75;

// A shade inside one edge of the tray, dark at the edge and clear inward, rounded with the
// tray's corners on that side, with an arrow in it that scrolls that way when tapped or
// clicked: there are more cards past that edge
function EdgeShade({
  side,
  strength,
  trayWidth,
  height,
  scale,
  onStep,
}: {
  side: 'left' | 'right';
  strength: number;
  trayWidth: number;
  height: number;
  scale: number;
  onStep: () => void;
}) {
  if (strength <= 0) return null;
  const s = scale || 1;
  const width = SHADE_WIDTH / s;
  const radius = TRAY_RADIUS / s;
  const left = side === 'left';
  const arrowX = left ? ARROW_INSET / s : trayWidth - ARROW_INSET / s;
  const point = (CHEVRON / s) * (left ? -1 : 1);
  return (
    <Group name="editor" opacity={strength}>
      <Rect
        listening={false}
        x={left ? 0 : trayWidth - width}
        width={width}
        height={height}
        cornerRadius={left ? [radius, 0, 0, radius] : [0, radius, radius, 0]}
        fillLinearGradientStartPoint={{ x: left ? 0 : width, y: 0 }}
        fillLinearGradientEndPoint={{ x: left ? width : 0, y: 0 }}
        fillLinearGradientColorStops={[0, SHADE_COLOR, 1, SHADE_CLEAR]}
      />
      <Group
        x={arrowX}
        y={height / 2}
        onClick={(e) => {
          e.cancelBubble = true;
          if (e.evt.button === 0) onStep();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onStep();
        }}
        onPointerDown={(e) => {
          // Not a pan or a card's drag
          e.cancelBubble = true;
        }}
      >
        {/* Its touch target, unseen */}
        <Circle radius={ARROW_HIT / s} fill="transparent" />
        <Circle
          radius={ARROW_RADIUS / s}
          fill={PETREL_50}
          opacity={ARROW_OPACITY}
          listening={false}
        />
        <Line
          points={[-point / 2, -CHEVRON / s, point / 2, 0, -point / 2, CHEVRON / s]}
          stroke={HINT_DARK}
          strokeWidth={CHEVRON_LINE / s}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      </Group>
    </Group>
  );
}

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
  // Phones and tablets: every card in one row at this width, scrolled sideways by `pan`
  // (design pixels) when they don't fit; a sideways swipe (or a wheel's sideways scroll)
  // asks for another through onPan
  oneRow: OneRow;
  pan: number;
  onPan: (pan: number) => void;
}) {
  const height = trayHeight(tray.items.length, width, oneRow);
  const maxPan = oneRow ? Math.max(0, trayRowWidth(tray.items.length, oneRow) - width) : 0;
  const clampPan = (next: number) => Math.min(maxPan, Math.max(0, next));
  // (its card width changes as the sidebar folds; the gestures only need whether it's a row)
  const isOneRow = oneRow !== false;

  // A touch in the one-row tray on a touch screen: once it has moved TOUCH_SLOP, sideways
  // pans the tray and up or down drags the card it started on (cards don't start their own
  // drags there, or a swipe along the row would pick one up); a pen or mouse there drags
  // the card either way. A tap that panned doesn't open a card's menu.
  const gesture = React.useRef<{
    id: number;
    x: number;
    y: number;
    pan: number;
    card: Konva.Node | null;
    // Only a finger pans; a pen or mouse past the slop drags the card in any direction
    pans: boolean;
    mode: 'wait' | 'pan' | 'done';
  } | null>(null);
  const panned = React.useRef(false);
  const latest = React.useRef({ scale, clampPan, onPan });
  React.useLayoutEffect(() => {
    latest.current = { scale, clampPan, onPan };
  });
  React.useEffect(() => {
    if (!isOneRow) return;
    let frame = 0;
    let pending: number | null = null;
    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (g.mode === 'wait' && Math.hypot(dx, dy) > TOUCH_SLOP) {
        if (g.pans && Math.abs(dx) > Math.abs(dy)) {
          g.mode = 'pan';
          panned.current = true;
        } else {
          g.mode = 'done';
          const card = g.card;
          if (card) {
            card.draggable(true);
            card.startDrag();
            const settle = () => {
              card.off('dragend.trayPan');
              card.draggable(false);
            };
            // (a drag that didn't start, with no pointer known to the stage or the card
            // still flying in, leaves it as it was, so later swipes on it still pan)
            if (card.isDragging()) card.on('dragend.trayPan', settle);
            else settle();
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
  }, [isOneRow]);
  // An arrow's scroll: most of the tray's width that way, easing out (at once under reduced
  // motion); a swipe or another arrow takes over from it
  const scrollFrame = React.useRef(0);
  React.useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);
  const scrollBy = (direction: 1 | -1) => {
    cancelAnimationFrame(scrollFrame.current);
    const from = pan;
    const to = clampPan(pan + direction * width * ARROW_STEP);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onPan(to);
      return;
    }
    const start = performance.now();
    const duration = readDuration('--duration-move') || 1;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      latest.current.onPan(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) scrollFrame.current = requestAnimationFrame(step);
    };
    scrollFrame.current = requestAnimationFrame(step);
  };
  const touchPans = isOneRow && matchMedia('(pointer: coarse)').matches;

  return (
    <Layer listening={listening} opacity={opacity}>
      <Group
        name="tray"
        x={left}
        y={top}
        onPointerDown={(e) => {
          cancelAnimationFrame(scrollFrame.current);
          panned.current = false;
          if (!touchPans) return;
          gesture.current = {
            id: e.evt.pointerId,
            x: e.evt.clientX,
            y: e.evt.clientY,
            pan,
            card: e.target.findAncestor('.card') ?? null,
            pans: e.evt.pointerType === 'touch',
            mode: 'wait',
          };
        }}
        onWheel={(e) => {
          if (!maxPan) return;
          // (Firefox reports a mouse wheel in lines, about 16 pixels each)
          const lines = e.evt.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE : 1;
          const delta = (e.evt.deltaX || (e.evt.shiftKey ? e.evt.deltaY : 0)) * lines;
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
        {/* A one-row tray that scrolls: a shade inside each edge with cards past it, fading
        in over the first SHADE_FADE of the way (editor-only, left out of exports) */}
        {maxPan > 0 && (
          <>
            <EdgeShade
              side="left"
              strength={Math.min(1, pan / (SHADE_FADE / (scale || 1)))}
              trayWidth={width}
              height={height}
              scale={scale}
              onStep={() => scrollBy(-1)}
            />
            <EdgeShade
              side="right"
              strength={Math.min(1, (maxPan - pan) / (SHADE_FADE / (scale || 1)))}
              trayWidth={width}
              height={height}
              scale={scale}
              onStep={() => scrollBy(1)}
            />
          </>
        )}
      </Group>
    </Layer>
  );
}
