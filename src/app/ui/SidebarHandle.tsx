'use client';

import React from 'react';

// Drag handle on the sidebar's right edge (from b8 up, where it sits beside the board).
// The width is saved as a share of the window, so it keeps the board's share when the
// window changes size; globals.css turns it into the sidebar's width (--tb-sidebar-width).
// Double-click goes back to the default width. While dragging, the width shows in px.

const STORAGE_KEY = 'tierbinder-sidebar';

function loadShare() {
  try {
    const share = Number(localStorage.getItem(STORAGE_KEY));
    return share > 0 && share <= 1 ? share : null;
  } catch {
    return null;
  }
}

function saveShare(share: number | null) {
  try {
    if (share === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(share));
  } catch {}
}

// Sets the width on the sidebar itself rather than through React state, so dragging
// doesn't re-render the editor for every pointer move
function applyShare(sidebar: HTMLElement, share: number | null) {
  if (share === null) sidebar.style.removeProperty('--tb-sidebar-width');
  else sidebar.style.setProperty('--tb-sidebar-width', `${share * 100}vw`);
}

export default function SidebarHandle() {
  const ref = React.useRef<HTMLDivElement>(null);
  // While dragging: the sidebar's width in px and the pointer's height, for the readout
  const [drag, setDrag] = React.useState<{ width: number; y: number } | null>(null);

  // Before the first paint, so a saved width never flashes the default one first
  React.useLayoutEffect(() => {
    const sidebar = ref.current?.parentElement;
    if (sidebar) applyShare(sidebar, loadShare());
  }, []);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const sidebar = e.currentTarget.parentElement;
    if (!sidebar) return;
    const box = sidebar.getBoundingClientRect();
    const width = Math.max(0, e.clientX - box.left);
    const share = Math.min(1, width / window.innerWidth);
    applyShare(sidebar, share);
    saveShare(share);
    setDrag({ width: Math.round(sidebar.offsetWidth), y: e.clientY - box.top });
  }

  return (
    <div
      ref={ref}
      className="tierbinder-side-handle"
      data-dragging={drag ? '' : undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // No text selection or native drag while resizing
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
      }}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={(e) => {
        const sidebar = e.currentTarget.parentElement;
        if (sidebar) applyShare(sidebar, null);
        saveShare(null);
      }}
    >
      {drag && (
        <output className="tierbinder-side-readout tierbinder-popup" style={{ top: drag.y }}>
          {drag.width} px
        </output>
      )}
    </div>
  );
}
