'use client';

import dynamic from 'next/dynamic';

// TierBinder runs only in the browser: Konva needs a real canvas, and the board loads
// from localStorage on its first render
const Editor = dynamic(() => import('./Editor'), { ssr: false });

export default function Loader() {
  return <Editor />;
}
