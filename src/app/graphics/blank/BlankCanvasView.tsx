'use client';

import type Konva from 'konva';
import React from 'react';
import { Circle, Layer, Line, Rect } from 'react-konva';
import { newId } from '../../cards';
import CardNode from '../../canvas/CardNode';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../../canvas/size';
import type { CanvasProps } from '../types';
import { moveCard, type BlankCanvas, type Stroke } from './model';

// The blank canvas: a background and freely placed cards, with ink drawn over them. Cards
// are dragged anywhere on the board with the move tool; the pen and eraser draw on the
// ink layer, which sits above the cards.

export default function BlankCanvasView({
  graphic: canvas,
  onChange,
  onSelect,
  onCardMenu,
  onCardDrop,
  tool,
  fontFamily,
}: CanvasProps<BlankCanvas>) {
  const drawing = tool === 'pen' || tool === 'eraser';
  // The stroke being drawn, kept out of the document until the pointer is released
  const [stroke, setStroke] = React.useState<Stroke | null>(null);
  const inkRef = React.useRef<Konva.Layer>(null);

  // Where the pointer is over the board, for the eraser's circle
  const [hover, setHover] = React.useState<{ x: number; y: number } | null>(null);

  // While drawing: a crosshair for the pen, the eraser's circle (drawn below) in place of
  // the pointer, and no touch scrolling or zooming on the board
  React.useEffect(() => {
    const container = inkRef.current?.getStage()?.container();
    if (!container || !drawing) return;
    container.style.cursor = tool === 'eraser' ? 'none' : 'crosshair';
    container.style.touchAction = 'none';
    return () => {
      container.style.cursor = '';
      container.style.touchAction = '';
    };
  }, [drawing, tool]);

  const pointer = () => inkRef.current?.getRelativePointerPosition();

  const commit = React.useEffectEvent(() => {
    if (!stroke) return;
    // One decimal is plenty, and keeps the saved board small
    const points = stroke.points.map((p) => Math.round(p * 10) / 10);
    onChange({ ...canvas, strokes: [...canvas.strokes, { ...stroke, points }] });
    setStroke(null);
  });

  // The stroke ends wherever the pointer is released, even off the board
  React.useEffect(() => {
    if (!stroke) return;
    const end = () => commit();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [stroke]);

  return (
    <>
      <Layer>
        <Rect
          name="background"
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          fill={canvas.background}
        />
        {canvas.items.map((item) => (
          <CardNode
            key={item.id}
            item={item}
            x={item.x}
            y={item.y}
            width={canvas.cardWidth}
            topHalf={canvas.topHalf}
            fontFamily={fontFamily}
            borderColor={item.split ? canvas.border : null}
            dividerColor={canvas.border}
            onSelect={() => onSelect(item.id)}
            onMenu={(menuX, menuY) => onCardMenu(item.id, menuX, menuY)}
            onDragEnd={(x, y) => {
              if (!onCardDrop(item.id, x, y)) onChange(moveCard(canvas, item.id, x, y));
            }}
          />
        ))}
      </Layer>
      {/* Its own layer, so eraser strokes (destination-out) remove only ink */}
      <Layer
        ref={inkRef}
        listening={drawing}
        // The stage also holds the card tray under the board: ink stays on the board
        clipX={0}
        clipY={0}
        clipWidth={BOARD_WIDTH}
        clipHeight={BOARD_HEIGHT}
      >
        {[...canvas.strokes, ...(stroke ? [stroke] : [])].map((s) => (
          <Line
            key={s.id}
            points={s.points}
            stroke={s.tool === 'pen' ? s.color : '#000000'}
            strokeWidth={s.width}
            lineCap="round"
            lineJoin="round"
            globalCompositeOperation={s.tool === 'eraser' ? 'destination-out' : 'source-over'}
            listening={false}
          />
        ))}
        {drawing && (
          // Takes every press on the board while drawing, so cards don't move
          <Rect
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            fill="rgba(0,0,0,0)"
            onPointerDown={(e) => {
              if (e.evt.button !== 0) return;
              const point = pointer();
              if (!point) return;
              onSelect(null);
              // The point twice, so a click leaves a dot
              setStroke({
                id: newId(),
                tool: tool === 'pen' ? 'pen' : 'eraser',
                color: canvas.penColor,
                width: tool === 'pen' ? canvas.penWidth : canvas.eraserWidth,
                points: [point.x, point.y, point.x, point.y],
              });
            }}
            onPointerMove={() => {
              const point = pointer();
              if (!point) return;
              if (tool === 'eraser') setHover(point);
              if (!stroke) return;
              const [lastX, lastY] = stroke.points.slice(-2);
              if (Math.hypot(point.x - lastX, point.y - lastY) < 1) return;
              setStroke({ ...stroke, points: [...stroke.points, point.x, point.y] });
            }}
            onPointerLeave={() => setHover(null)}
          />
        )}
      </Layer>
      {/* Editor-only (named `editor`, hidden while exporting): the eraser's size, as a
          light circle with a dark edge so it shows on any color */}
      {tool === 'eraser' && hover && (
        <Layer name="editor" listening={false}>
          <Circle
            x={hover.x}
            y={hover.y}
            radius={canvas.eraserWidth / 2}
            stroke="#000000"
            strokeWidth={3}
          />
          <Circle
            x={hover.x}
            y={hover.y}
            radius={canvas.eraserWidth / 2}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </Layer>
      )}
    </>
  );
}
