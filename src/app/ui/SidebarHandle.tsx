'use client';

import React from 'react';
import styles from './SidebarHandle.module.css';

// Drag handle on the sidebar column's right edge (from b8 up, where it sits beside the board),
// following the WAI-ARIA window splitter pattern. The width is saved as a share of the
// window, so it keeps the board's share when the window changes size; Editor.module.css
// turns it into the sidebar's width (--tb-sidebar-width). Drag it, or focus it and use the left
// and right arrow keys; double-click goes back to the default width. While resizing, the
// width shows in px.

const STORAGE_KEY = 'tierbinder-sidebar';

// How far one arrow key press moves the edge (space-4); Shift moves it further
// (space-6), as in most splitters
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

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

// CSS keeps the sidebar between these (--tb-sidebar-min, and the window less
// --tb-workspace-min; the minimum wins). A width saved outside them would make the sidebar
// jump on a different window, so it's saved within them.
function limits(sidebar: HTMLElement) {
  const style = getComputedStyle(sidebar);
  const min = parseFloat(style.getPropertyValue('--tb-sidebar-min')) || 0;
  const workspace = parseFloat(style.getPropertyValue('--tb-workspace-min')) || 0;
  return { min, max: Math.max(min, window.innerWidth - workspace) };
}

// Sets the width on the sidebar itself rather than through React state, so dragging
// doesn't re-render the editor for every pointer move
function applyShare(sidebar: HTMLElement, share: number | null) {
  if (share === null) sidebar.style.removeProperty('--tb-sidebar-width');
  else sidebar.style.setProperty('--tb-sidebar-width', `${share * 100}vw`);
}

export default function SidebarHandle() {
  const ref = React.useRef<HTMLDivElement>(null);
  // The sidebar's width in px, for screen readers and the readout
  const [width, setWidth] = React.useState(0);
  // Its narrowest and widest widths, for screen readers
  const [range, setRange] = React.useState({ min: 0, max: 0 });
  // Where the readout shows (the pointer's height, or the middle for keys), while resizing
  const [readoutY, setReadoutY] = React.useState<number | null>(null);

  // Before the first paint, so a saved width never flashes the default one first
  React.useLayoutEffect(() => {
    const sidebar = ref.current?.parentElement;
    if (!sidebar) return;
    applyShare(sidebar, loadShare());
    setWidth(sidebar.offsetWidth);
    setRange(limits(sidebar));
  }, []);

  function resize(sidebar: HTMLElement, to: number | null) {
    const { min, max } = limits(sidebar);
    setRange({ min, max });
    const share = to === null ? null : Math.min(max, Math.max(min, to)) / window.innerWidth;
    applyShare(sidebar, share);
    saveShare(share);
    setWidth(sidebar.offsetWidth);
  }

  function drag(e: React.PointerEvent<HTMLDivElement>) {
    const sidebar = e.currentTarget.parentElement;
    if (!sidebar) return;
    const box = sidebar.getBoundingClientRect();
    resize(sidebar, e.clientX - box.left);
    setReadoutY(e.clientY - box.top);
  }

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
      aria-valuetext={`${width} pixels wide`}
      tabIndex={0}
      className={styles.handle}
      data-resizing={readoutY !== null ? '' : undefined}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        // No text selection or native drag while resizing
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) drag(e);
      }}
      onPointerUp={() => setReadoutY(null)}
      onPointerCancel={() => setReadoutY(null)}
      onKeyDown={(e) => {
        const direction = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const sidebar = e.currentTarget.parentElement;
        if (!direction || !sidebar) return;
        e.preventDefault();
        resize(sidebar, sidebar.offsetWidth + direction * (e.shiftKey ? KEY_STEP_LARGE : KEY_STEP));
        setReadoutY(sidebar.offsetHeight / 2);
      }}
      // The widest width follows the window, and the default width follows the main nav
      // (Editor.tsx), so both are refreshed when the handle is reached
      onFocus={(e) => {
        const sidebar = e.currentTarget.parentElement;
        if (!sidebar) return;
        setRange(limits(sidebar));
        setWidth(sidebar.offsetWidth);
      }}
      onBlur={() => setReadoutY(null)}
      onDoubleClick={(e) => {
        const sidebar = e.currentTarget.parentElement;
        if (sidebar) resize(sidebar, null);
      }}
    >
      {readoutY !== null && (
        <output
          aria-hidden
          className={`${styles.readout} tierbinder-popup`}
          style={{ top: readoutY }}
        >
          {width} px
        </output>
      )}
    </div>
  );
}
