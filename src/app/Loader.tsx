'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import styles from './Loader.module.css';

// TierBinder runs only in the browser: Konva needs a real canvas, and the board loads
// from localStorage on its first render. Until its code arrives, the page shows the
// editor's frame: the top bar with the logo, the sidebar, and a shimmering 16:9 board.
const Editor = dynamic(() => import('./Editor'), { ssr: false, loading: Loading });

export default function Loader() {
  return <Editor />;
}

// Shown while the editor's code loads, and if it fails (offline, or a deploy since the page
// loaded), saying so instead of loading forever
function Loading({ error }: { error?: Error | null }) {
  return (
    <div className={`tierbinder-page ${styles.page}`}>
      <div className={styles.top}>
        <Image src="/tierbinder-combined-dark.svg" alt="TierBinder" width={114} height={25} />
      </div>
      <div className={styles.side} />
      <div className={styles.workspace}>
        {error ? (
          <p role="alert" className={styles.failed}>
            Couldn&apos;t Load TierBinder; Reload the Page
          </p>
        ) : (
          <div className={styles.board} />
        )}
      </div>
      {!error && (
        <p role="status" className="sr-only">
          Loading…
        </p>
      )}
    </div>
  );
}
