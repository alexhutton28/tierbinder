'use client';

import dynamic from 'next/dynamic';

// tcgTierStack runs only in the browser: Konva needs a real canvas, and the board loads
// from localStorage on its first render
const TierStack = dynamic(() => import('./TierStack'), { ssr: false });

export default function TierStackLoader() {
  return <TierStack />;
}
